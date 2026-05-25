import asyncio
import json
import os
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.types import Command

from backend.graph.builder import build_graph
from backend.config import SQLITE_DB_PATH, SCRIPT_ENDING, TTS_VOICE, TTS_PROXY
from backend.tools.tts import (
    generate_audio, generate_chapter_audios, generate_step_audios, zip_audio_files,
)
from backend.tools.chapters import parse_chapters
from backend.tools.presentation import generate_presentation_steps
from backend.tools.output_paths import book_output_dirs, book_slug
from backend.tools.pptx_export import generate_pptx
from backend.tools.video_export import generate_video

sessions: dict[str, dict] = {}
checkpointer: AsyncSqliteSaver | None = None
compiled_graph = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global checkpointer, compiled_graph
    async with AsyncSqliteSaver.from_conn_string(SQLITE_DB_PATH) as saver:
        checkpointer = saver
        await checkpointer.setup()
        builder = build_graph()
        compiled_graph = builder.compile(checkpointer=checkpointer)
        yield


app = FastAPI(title="智能口播稿生成器", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StartRequest(BaseModel):
    user_input: str
    mode: str = "direct"  # "direct" | "keyword"


class BookConfirmRequest(BaseModel):
    action: str  # "select" | "research" | "abandon"
    index: int | None = 0
    query: str | None = ""


class LowQualityRequest(BaseModel):
    action: str  # "accept" | "abandon"


class FeedbackRequest(BaseModel):
    action: str  # "confirm" | "feedback" | "abandon"
    feedback: str | None = ""


@app.post("/api/session/create")
async def create_session():
    session_id = uuid.uuid4().hex
    sessions[session_id] = {"status": "created", "events": []}
    return {"session_id": session_id}


async def run_graph_and_collect(session_id: str, input_data: dict, config: dict):
    """Run graph, collect events into the session store."""
    session = sessions.get(session_id)
    if not session:
        return

    session["status"] = "running"
    try:
        async for event in compiled_graph.astream(
            input_data, config=config, stream_mode="updates"
        ):
            for node_name, node_output in event.items():
                ev = {
                    "node": node_name,
                    "data": _serialize(node_output),
                }
                session["events"].append(ev)

        snapshot = await compiled_graph.aget_state(config)
        next_nodes = snapshot.next if snapshot else ()

        if next_nodes:
            session["status"] = "interrupted"
            interrupt_data = None
            if snapshot and snapshot.tasks:
                for task in snapshot.tasks:
                    if hasattr(task, "interrupts") and task.interrupts:
                        interrupt_data = task.interrupts[0].value
                        break
            session["events"].append({
                "node": "__interrupt__",
                "data": _serialize(interrupt_data) if interrupt_data else {},
            })
        else:
            session["status"] = "completed"
            session["events"].append({
                "node": "__completed__",
                "data": {},
            })

    except Exception as e:
        session["status"] = "error"
        session["events"].append({
            "node": "__error__",
            "data": {"error": str(e)},
        })


async def resume_graph_and_collect(session_id: str, resume_value: dict, config: dict):
    """Resume graph from interrupt, collect events."""
    session = sessions.get(session_id)
    if not session:
        return

    session["status"] = "running"
    try:
        async for event in compiled_graph.astream(
            Command(resume=resume_value), config=config, stream_mode="updates"
        ):
            for node_name, node_output in event.items():
                ev = {
                    "node": node_name,
                    "data": _serialize(node_output),
                }
                session["events"].append(ev)

        snapshot = await compiled_graph.aget_state(config)
        next_nodes = snapshot.next if snapshot else ()

        if next_nodes:
            session["status"] = "interrupted"
            interrupt_data = None
            if snapshot and snapshot.tasks:
                for task in snapshot.tasks:
                    if hasattr(task, "interrupts") and task.interrupts:
                        interrupt_data = task.interrupts[0].value
                        break
            session["events"].append({
                "node": "__interrupt__",
                "data": _serialize(interrupt_data) if interrupt_data else {},
            })
        else:
            session["status"] = "completed"
            session["events"].append({
                "node": "__completed__",
                "data": {},
            })

    except Exception as e:
        session["status"] = "error"
        session["events"].append({
            "node": "__error__",
            "data": {"error": str(e)},
        })


def _serialize(obj):
    """Make objects JSON-serializable."""
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_serialize(i) for i in obj]
    if isinstance(obj, (str, int, float, bool)):
        return obj
    return str(obj)


def _get_config(session_id: str) -> dict:
    return {"configurable": {"thread_id": session_id}}


@app.post("/api/session/{session_id}/start")
async def start_session(session_id: str, req: StartRequest):
    if session_id not in sessions:
        raise HTTPException(404, "Session not found")

    sessions[session_id]["events"] = []
    config = _get_config(session_id)
    input_data = {
        "user_input": req.user_input,
        "mode": req.mode,
        "keywords": [],
        "search_results": [],
        "selected_book": None,
        "reference_script": "",
        "script_draft": "",
        "review_result": None,
        "retry_count": 0,
        "search_retry_count": 0,
        "previous_search_titles": [],
        "user_feedback": "",
        "current_step": "",
        "word_file_path": "",
        "error": "",
    }

    asyncio.create_task(run_graph_and_collect(session_id, input_data, config))
    return {"status": "started"}


@app.post("/api/session/{session_id}/confirm-book")
async def confirm_book(session_id: str, req: BookConfirmRequest):
    if session_id not in sessions:
        raise HTTPException(404, "Session not found")

    config = _get_config(session_id)
    resume_value = {
        "action": req.action,
        "index": req.index or 0,
        "query": req.query or "",
    }

    sessions[session_id]["events"] = []
    asyncio.create_task(resume_graph_and_collect(session_id, resume_value, config))
    return {"status": "resumed"}


@app.post("/api/session/{session_id}/low-quality-decision")
async def low_quality_decision(session_id: str, req: LowQualityRequest):
    if session_id not in sessions:
        raise HTTPException(404, "Session not found")

    config = _get_config(session_id)
    resume_value = {"action": req.action}

    sessions[session_id]["events"] = []
    asyncio.create_task(resume_graph_and_collect(session_id, resume_value, config))
    return {"status": "resumed"}


@app.post("/api/session/{session_id}/feedback")
async def submit_feedback(session_id: str, req: FeedbackRequest):
    if session_id not in sessions:
        raise HTTPException(404, "Session not found")

    config = _get_config(session_id)
    resume_value = {
        "action": req.action,
        "feedback": req.feedback or "",
    }

    sessions[session_id]["events"] = []
    asyncio.create_task(resume_graph_and_collect(session_id, resume_value, config))
    return {"status": "resumed"}


@app.get("/api/session/{session_id}/stream")
async def stream_events(session_id: str):
    if session_id not in sessions:
        raise HTTPException(404, "Session not found")

    async def event_generator():
        session = sessions[session_id]
        sent_count = 0

        while True:
            events = session["events"]
            while sent_count < len(events):
                ev = events[sent_count]
                yield {
                    "event": ev["node"],
                    "data": json.dumps(ev["data"], ensure_ascii=False),
                }
                sent_count += 1

            status = session["status"]
            if status in ("completed", "error", "interrupted"):
                if sent_count >= len(events):
                    break

            await asyncio.sleep(0.3)

    return EventSourceResponse(event_generator())


@app.get("/api/session/{session_id}/state")
async def get_session_state(session_id: str):
    if session_id not in sessions:
        raise HTTPException(404, "Session not found")

    config = _get_config(session_id)
    try:
        snapshot = await compiled_graph.aget_state(config)
        state_values = _serialize(snapshot.values) if snapshot else {}
        return {
            "status": sessions[session_id]["status"],
            "state": state_values,
            "next": list(snapshot.next) if snapshot else [],
        }
    except Exception as e:
        return {
            "status": sessions[session_id]["status"],
            "state": {},
            "next": [],
            "error": str(e),
        }


@app.get("/api/session/{session_id}/download")
async def download_word(session_id: str):
    if session_id not in sessions:
        raise HTTPException(404, "Session not found")

    config = _get_config(session_id)
    try:
        snapshot = await compiled_graph.aget_state(config)
        if snapshot and snapshot.values:
            filepath = snapshot.values.get("word_file_path", "")
            if filepath and os.path.exists(filepath):
                filename = os.path.basename(filepath)
                return FileResponse(
                    filepath,
                    media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    filename=filename,
                )
    except Exception:
        pass

    raise HTTPException(404, "Word file not found")


class TTSRequest(BaseModel):
    voice: str = ""
    rate: str = "+0%"
    volume: str = "+0%"
    pitch: str = "+0Hz"
    mode: str = "full"  # "full" | "chapters"


@app.post("/api/session/{session_id}/tts")
async def generate_tts(session_id: str, body: TTSRequest = TTSRequest()):
    if session_id not in sessions:
        raise HTTPException(404, "Session not found")

    config = _get_config(session_id)
    try:
        snapshot = await compiled_graph.aget_state(config)
        if not (snapshot and snapshot.values):
            raise HTTPException(400, "Session has no script data")

        script = snapshot.values.get("script_draft", "")
        if not script:
            raise HTTPException(400, "No script to convert")

        book = snapshot.values.get("selected_book") or {}
        book_title = book.get("title", "")
        dirs = book_output_dirs(book_title)
        mp3_dir = dirs["mp3"]
        voice = body.voice or TTS_VOICE
        mode = body.mode if body.mode in ("full", "chapters") else "full"
        slug = book_slug(book_title)

        if mode == "chapters":
            chapters = snapshot.values.get("script_chapters") or []
            if not chapters:
                tts_text = script.replace(SCRIPT_ENDING.strip(), "").strip()
                chapters = parse_chapters(tts_text)
            if not chapters:
                raise HTTPException(400, "No chapters to convert")

            chapter_results = await generate_chapter_audios(
                chapters, voice, mp3_dir, TTS_PROXY,
                book_title=book_title,
                rate=body.rate, volume=body.volume, pitch=body.pitch,
            )
            if not chapter_results:
                raise HTTPException(400, "No chapter audio generated")

            filepaths = [r["filepath"] for r in chapter_results]
            zip_name = f"{slug}_章节音频_{uuid.uuid4().hex[:6]}.zip"
            zip_path = os.path.join(mp3_dir, zip_name)
            zip_audio_files(filepaths, zip_path)

            sessions[session_id]["audio_path"] = ""
            sessions[session_id]["audio_chapters"] = chapter_results
            sessions[session_id]["audio_zip_path"] = zip_path

            return {
                "status": "ok",
                "mode": "chapters",
                "files": [
                    {"chapter": r["chapter"], "title": r["title"], "filename": r["filename"]}
                    for r in chapter_results
                ],
                "zip_filename": zip_name,
            }

        tts_text = script.replace(SCRIPT_ENDING.strip(), "").strip()
        filepath = await generate_audio(
            tts_text, voice, mp3_dir, TTS_PROXY,
            book_title=book_title,
            rate=body.rate, volume=body.volume, pitch=body.pitch,
        )
        sessions[session_id]["audio_path"] = filepath
        sessions[session_id]["audio_chapters"] = []
        sessions[session_id]["audio_zip_path"] = ""
        return {"status": "ok", "mode": "full", "filename": os.path.basename(filepath)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"TTS generation failed: {e}")


@app.get("/api/session/{session_id}/download-audio")
async def download_audio(session_id: str, chapter: int | None = None):
    if session_id not in sessions:
        raise HTTPException(404, "Session not found")

    if chapter is not None:
        chapter_list = sessions[session_id].get("audio_chapters", [])
        for item in chapter_list:
            if item.get("chapter") == chapter:
                fp = item.get("filepath", "")
                if fp and os.path.exists(fp):
                    return FileResponse(
                        fp,
                        media_type="audio/mpeg",
                        filename=item.get("filename", os.path.basename(fp)),
                    )
        raise HTTPException(404, "Chapter audio not found")

    filepath = sessions[session_id].get("audio_path", "")
    if filepath and os.path.exists(filepath):
        return FileResponse(
            filepath,
            media_type="audio/mpeg",
            filename=os.path.basename(filepath),
        )
    raise HTTPException(404, "Audio file not found")


@app.get("/api/session/{session_id}/download-audio-zip")
async def download_audio_zip(session_id: str):
    if session_id not in sessions:
        raise HTTPException(404, "Session not found")

    zip_path = sessions[session_id].get("audio_zip_path", "")
    if zip_path and os.path.exists(zip_path):
        return FileResponse(
            zip_path,
            media_type="application/zip",
            filename=os.path.basename(zip_path),
        )
    raise HTTPException(404, "Audio zip not found")


async def _load_script_chapters(session_id: str) -> tuple[dict, list[dict], str]:
    config = _get_config(session_id)
    snapshot = await compiled_graph.aget_state(config)
    if not (snapshot and snapshot.values):
        raise HTTPException(400, "Session has no script data")
    values = snapshot.values
    script = values.get("script_draft", "")
    if not script:
        raise HTTPException(400, "No script available")
    chapters = values.get("script_chapters") or []
    if not chapters:
        tts_text = script.replace(SCRIPT_ENDING.strip(), "").strip()
        chapters = parse_chapters(tts_text)
    if not chapters:
        raise HTTPException(400, "No chapters to build presentation")
    book = values.get("selected_book") or {}
    return book, chapters, script


@app.post("/api/session/{session_id}/presentation/generate")
async def presentation_generate(session_id: str):
    if session_id not in sessions:
        raise HTTPException(404, "Session not found")
    try:
        book, chapters, _ = await _load_script_chapters(session_id)
        book_title = book.get("title", "")
        steps = generate_presentation_steps(chapters, book)
        dirs = book_output_dirs(book_title)
        slug = book_slug(book_title)
        outline_name = f"{slug}_演示文稿_{uuid.uuid4().hex[:6]}.json"
        outline_path = os.path.join(dirs["word"], outline_name)
        pptx_name = f"{slug}_演示文稿_{uuid.uuid4().hex[:6]}.pptx"
        pptx_path = os.path.join(dirs["word"], pptx_name)
        with open(outline_path, "w", encoding="utf-8") as f:
            json.dump(
                {"book": book, "steps": steps, "step_count": len(steps)},
                f,
                ensure_ascii=False,
                indent=2,
            )
        generate_pptx(steps, book, pptx_path)
        sessions[session_id]["presentation_steps"] = steps
        sessions[session_id]["presentation_step_audio"] = []
        sessions[session_id]["presentation_audio_zip_path"] = ""
        sessions[session_id]["presentation_outline_path"] = outline_path
        sessions[session_id]["presentation_pptx_path"] = pptx_path
        sessions[session_id]["presentation_video_path"] = ""
        return {
            "status": "ok",
            "step_count": len(steps),
            "outline_filename": outline_name,
            "pptx_filename": pptx_name,
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Presentation generation failed: {e}")


@app.get("/api/session/{session_id}/presentation")
async def presentation_get(session_id: str):
    if session_id not in sessions:
        raise HTTPException(404, "Session not found")
    steps = sessions[session_id].get("presentation_steps", [])
    if not steps:
        raise HTTPException(404, "Presentation not generated yet")

    config = _get_config(session_id)
    book: dict = {}
    try:
        snapshot = await compiled_graph.aget_state(config)
        if snapshot and snapshot.values:
            book = snapshot.values.get("selected_book") or {}
    except Exception:
        pass

    audio_list = sessions[session_id].get("presentation_step_audio", [])
    has_audio = len(audio_list) > 0
    return {
        "book": {
            "title": book.get("title", ""),
            "author": book.get("author", ""),
        },
        "steps": steps,
        "step_count": len(steps),
        "has_audio": has_audio,
    }


@app.post("/api/session/{session_id}/presentation/tts")
async def presentation_tts(session_id: str, body: TTSRequest = TTSRequest()):
    if session_id not in sessions:
        raise HTTPException(404, "Session not found")

    steps = sessions[session_id].get("presentation_steps", [])
    if not steps:
        raise HTTPException(400, "Generate presentation first")

    config = _get_config(session_id)
    book_title = ""
    try:
        snapshot = await compiled_graph.aget_state(config)
        if snapshot and snapshot.values:
            book = snapshot.values.get("selected_book") or {}
            book_title = book.get("title", "")
    except Exception:
        pass

    voice = body.voice or TTS_VOICE
    dirs = book_output_dirs(book_title)
    mp3_dir = dirs["mp3"]
    slug = book_slug(book_title)
    try:
        audio_results = await generate_step_audios(
            steps, voice, mp3_dir, TTS_PROXY,
            book_title=book_title,
            rate=body.rate, volume=body.volume, pitch=body.pitch,
        )
        if not audio_results:
            raise HTTPException(400, "No step audio generated")

        filepaths = [r["filepath"] for r in audio_results]
        zip_name = f"{slug}_演示音频_{uuid.uuid4().hex[:6]}.zip"
        zip_path = os.path.join(mp3_dir, zip_name)
        zip_audio_files(filepaths, zip_path)

        sessions[session_id]["presentation_step_audio"] = audio_results
        sessions[session_id]["presentation_audio_zip_path"] = zip_path

        return {
            "status": "ok",
            "audio_count": len(audio_results),
            "zip_filename": zip_name,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Presentation TTS failed: {e}")


@app.get("/api/session/{session_id}/presentation/audio/{step_index}")
async def presentation_audio(session_id: str, step_index: int):
    if session_id not in sessions:
        raise HTTPException(404, "Session not found")

    audio_list = sessions[session_id].get("presentation_step_audio", [])
    for item in audio_list:
        if item.get("step") == step_index:
            fp = item.get("filepath", "")
            if fp and os.path.exists(fp):
                return FileResponse(
                    fp,
                    media_type="audio/mpeg",
                    filename=item.get("filename", os.path.basename(fp)),
                )
    raise HTTPException(404, "Step audio not found")


@app.get("/api/session/{session_id}/presentation/audio-zip")
async def presentation_audio_zip(session_id: str):
    if session_id not in sessions:
        raise HTTPException(404, "Session not found")

    zip_path = sessions[session_id].get("presentation_audio_zip_path", "")
    if zip_path and os.path.exists(zip_path):
        return FileResponse(
            zip_path,
            media_type="application/zip",
            filename=os.path.basename(zip_path),
        )
    raise HTTPException(404, "Presentation audio zip not found")


@app.get("/api/session/{session_id}/presentation/download-pptx")
async def presentation_download_pptx(session_id: str):
    if session_id not in sessions:
        raise HTTPException(404, "Session not found")

    pptx_path = sessions[session_id].get("presentation_pptx_path", "")
    if pptx_path and os.path.exists(pptx_path):
        return FileResponse(
            pptx_path,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            filename=os.path.basename(pptx_path),
        )
    raise HTTPException(404, "Presentation PPTX not found")


@app.post("/api/session/{session_id}/presentation/video")
async def presentation_video(session_id: str):
    if session_id not in sessions:
        raise HTTPException(404, "Session not found")

    steps = sessions[session_id].get("presentation_steps", [])
    if not steps:
        raise HTTPException(400, "Generate presentation first")

    audio_list = sessions[session_id].get("presentation_step_audio", [])
    if not audio_list:
        raise HTTPException(400, "Generate presentation audio first")

    config = _get_config(session_id)
    book_title = ""
    try:
        snapshot = await compiled_graph.aget_state(config)
        if snapshot and snapshot.values:
            book = snapshot.values.get("selected_book") or {}
            book_title = book.get("title", "")
    except Exception:
        pass

    dirs = book_output_dirs(book_title)
    slug = book_slug(book_title)
    video_name = f"{slug}_演示视频_{uuid.uuid4().hex[:6]}.mp4"
    video_path = os.path.join(dirs["mp3"], video_name)

    try:
        await asyncio.to_thread(generate_video, steps, audio_list, video_path)
    except RuntimeError as e:
        raise HTTPException(500, str(e))
    except Exception as e:
        raise HTTPException(500, f"Video generation failed: {e}")

    sessions[session_id]["presentation_video_path"] = video_path
    return {"status": "ok", "video_filename": video_name}


@app.get("/api/session/{session_id}/presentation/download-video")
async def presentation_download_video(session_id: str):
    if session_id not in sessions:
        raise HTTPException(404, "Session not found")

    video_path = sessions[session_id].get("presentation_video_path", "")
    if video_path and os.path.exists(video_path):
        return FileResponse(
            video_path,
            media_type="video/mp4",
            filename=os.path.basename(video_path),
        )
    raise HTTPException(404, "Presentation video not found")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
