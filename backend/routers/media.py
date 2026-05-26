"""Media generation & download: TTS, presentation, video."""

import asyncio
import json
import os
import uuid

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from backend.config import SCRIPT_ENDING, TTS_VOICE, TTS_PROXY
from backend.deps import sessions, require_session, get_script_data, get_book_info
from backend.tools.tts import (
    generate_audio, generate_chapter_audios, generate_step_audios, zip_audio_files,
)
from backend.tools.presentation import generate_presentation_steps
from backend.tools.output_paths import book_output_dirs, book_slug
from backend.tools.pptx_export import generate_pptx
from backend.tools.video_export import generate_video

router = APIRouter(prefix="/api/session", tags=["media"])


class TTSRequest(BaseModel):
    voice: str = ""
    rate: str = "+0%"
    volume: str = "+0%"
    pitch: str = "+0Hz"
    mode: str = "full"  # "full" | "chapters"


# ── TTS ──────────────────────────────────────────────────────

@router.post("/{session_id}/tts")
async def generate_tts(session_id: str, body: TTSRequest = TTSRequest()):
    require_session(session_id)

    try:
        script, chapters, book = await get_script_data(session_id)
        book_title = book.get("title", "")
        dirs = book_output_dirs(book_title)
        mp3_dir = dirs["mp3"]
        voice = body.voice or TTS_VOICE
        mode = body.mode if body.mode in ("full", "chapters") else "full"
        slug = book_slug(book_title)

        if mode == "chapters":
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
            sessions.save(session_id)

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
        sessions.save(session_id)
        return {"status": "ok", "mode": "full", "filename": os.path.basename(filepath)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"TTS generation failed: {e}")


@router.get("/{session_id}/download-audio")
async def download_audio(session_id: str, chapter: int | None = None):
    session = require_session(session_id)

    if chapter is not None:
        chapter_list = session.get("audio_chapters", [])
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

    filepath = session.get("audio_path", "")
    if filepath and os.path.exists(filepath):
        return FileResponse(
            filepath,
            media_type="audio/mpeg",
            filename=os.path.basename(filepath),
        )
    raise HTTPException(404, "Audio file not found")


@router.get("/{session_id}/download-audio-zip")
async def download_audio_zip(session_id: str):
    session = require_session(session_id)

    zip_path = session.get("audio_zip_path", "")
    if zip_path and os.path.exists(zip_path):
        return FileResponse(
            zip_path,
            media_type="application/zip",
            filename=os.path.basename(zip_path),
        )
    raise HTTPException(404, "Audio zip not found")


# ── Presentation ─────────────────────────────────────────────

async def _load_script_chapters(session_id: str) -> tuple[dict, list[dict], str]:
    script, chapters, book = await get_script_data(session_id)
    if not chapters:
        raise HTTPException(400, "No chapters to build presentation")
    return book, chapters, script


@router.post("/{session_id}/presentation/generate")
async def presentation_generate(session_id: str):
    require_session(session_id)
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
        sessions.save(session_id)
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


@router.get("/{session_id}/presentation")
async def presentation_get(session_id: str):
    session = require_session(session_id)
    steps = session.get("presentation_steps", [])
    if not steps:
        raise HTTPException(404, "Presentation not generated yet")

    book = await get_book_info(session_id)

    audio_list = session.get("presentation_step_audio", [])
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


@router.post("/{session_id}/presentation/tts")
async def presentation_tts(session_id: str, body: TTSRequest = TTSRequest()):
    session = require_session(session_id)

    steps = session.get("presentation_steps", [])
    if not steps:
        raise HTTPException(400, "Generate presentation first")

    book = await get_book_info(session_id)
    book_title = book.get("title", "")

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
        sessions.save(session_id)

        return {
            "status": "ok",
            "audio_count": len(audio_results),
            "zip_filename": zip_name,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Presentation TTS failed: {e}")


@router.get("/{session_id}/presentation/audio/{step_index}")
async def presentation_audio(session_id: str, step_index: int):
    session = require_session(session_id)

    audio_list = session.get("presentation_step_audio", [])
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


@router.get("/{session_id}/presentation/audio-zip")
async def presentation_audio_zip(session_id: str):
    session = require_session(session_id)

    zip_path = session.get("presentation_audio_zip_path", "")
    if zip_path and os.path.exists(zip_path):
        return FileResponse(
            zip_path,
            media_type="application/zip",
            filename=os.path.basename(zip_path),
        )
    raise HTTPException(404, "Presentation audio zip not found")


@router.get("/{session_id}/presentation/download-pptx")
async def presentation_download_pptx(session_id: str):
    session = require_session(session_id)

    pptx_path = session.get("presentation_pptx_path", "")
    if pptx_path and os.path.exists(pptx_path):
        return FileResponse(
            pptx_path,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            filename=os.path.basename(pptx_path),
        )
    raise HTTPException(404, "Presentation PPTX not found")


# ── Video ────────────────────────────────────────────────────

@router.post("/{session_id}/presentation/video")
async def presentation_video(session_id: str):
    session = require_session(session_id)

    steps = session.get("presentation_steps", [])
    if not steps:
        raise HTTPException(400, "Generate presentation first")

    audio_list = session.get("presentation_step_audio", [])
    if not audio_list:
        raise HTTPException(400, "Generate presentation audio first")

    book = await get_book_info(session_id)
    book_title = book.get("title", "")

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
    sessions.save(session_id)
    return {"status": "ok", "video_filename": video_name}


@router.get("/{session_id}/presentation/download-video")
async def presentation_download_video(session_id: str):
    session = require_session(session_id)

    video_path = session.get("presentation_video_path", "")
    if video_path and os.path.exists(video_path):
        return FileResponse(
            video_path,
            media_type="video/mp4",
            filename=os.path.basename(video_path),
        )
    raise HTTPException(404, "Presentation video not found")
