"""Session lifecycle: create, upload-script, stream, state."""

import asyncio
import json
import os
import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from backend.deps import (
    sessions, require_session, _empty_media_session_fields,
    get_script_data, serialize,
)
from backend.graph.nodes.export_word import export_word_node
from backend.tools.chapters import parse_chapters

router = APIRouter(prefix="/api/session", tags=["session"])


class UploadScriptRequest(BaseModel):
    text: str
    title: str = ""


@router.post("/create")
async def create_session():
    session_id = uuid.uuid4().hex
    sessions[session_id] = {
        "status": "created",
        "events": [],
        "created_at": datetime.now().isoformat(),
        "title": "",
    }
    return {"session_id": session_id}


@router.post("/upload-script")
async def upload_script(req: UploadScriptRequest):
    text = req.text.strip()
    if not text:
        raise HTTPException(400, "口播稿内容不能为空")

    session_id = uuid.uuid4().hex
    book_info = {"title": (req.title or "").strip() or "自定义口播稿", "author": ""}
    chapters = parse_chapters(text)
    word_result = export_word_node({
        "script_draft": text,
        "script_chapters": chapters,
        "selected_book": book_info,
    })

    sessions[session_id] = {
        "status": "completed",
        "events": [],
        "created_at": datetime.now().isoformat(),
        "title": book_info["title"],
        "custom_script": True,
        "script_text": text,
        "script_chapters": chapters,
        "book_info": book_info,
        "word_file_path": word_result["word_file_path"],
        **_empty_media_session_fields(),
    }
    return {
        "session_id": session_id,
        "chapter_count": len(chapters),
        "title": book_info["title"],
    }


@router.get("/history")
async def get_history(limit: int = 10):
    """Return recent completed sessions with available file info."""
    items = []
    for sid in sessions:
        s = sessions[sid]
        if s.get("status") not in ("completed", "interrupted"):
            continue
        has_word = bool(s.get("word_file_path")) and os.path.exists(s.get("word_file_path", ""))
        has_audio = (
            (bool(s.get("audio_path")) and os.path.exists(s.get("audio_path", "")))
            or bool(s.get("audio_zip_path")) and os.path.exists(s.get("audio_zip_path", ""))
        )
        has_pptx = bool(s.get("presentation_pptx_path")) and os.path.exists(s.get("presentation_pptx_path", ""))
        has_video = bool(s.get("presentation_video_path")) and os.path.exists(s.get("presentation_video_path", ""))

        title = s.get("title", "")
        if not title:
            book = s.get("book_info") or {}
            title = book.get("title", "")
        if not title:
            title = "未命名会话"

        items.append({
            "session_id": sid,
            "title": title,
            "created_at": s.get("created_at", ""),
            "is_custom": bool(s.get("custom_script")),
            "files": {
                "word": has_word,
                "audio": has_audio,
                "pptx": has_pptx,
                "video": has_video,
            },
        })

    items.sort(key=lambda x: x["created_at"], reverse=True)
    return {"sessions": items[:limit]}


@router.get("/{session_id}/resume-info")
async def resume_info(session_id: str):
    """Return downloadable file URLs for a session so the frontend can restore."""
    session = require_session(session_id)

    def _check(path_key: str) -> str:
        p = session.get(path_key, "")
        return os.path.basename(p) if (p and os.path.exists(p)) else ""

    word_file = _check("word_file_path")
    audio_file = _check("audio_path")
    audio_zip = _check("audio_zip_path")
    pptx_file = _check("presentation_pptx_path")
    video_file = _check("presentation_video_path")
    pres_audio_zip = _check("presentation_audio_zip_path")

    has_presentation = bool(session.get("presentation_steps"))
    has_pres_audio = bool(session.get("presentation_step_audio"))
    audio_chapters = session.get("audio_chapters") or []

    title = session.get("title", "")
    if not title:
        book = session.get("book_info") or {}
        title = book.get("title", "")

    return {
        "session_id": session_id,
        "title": title or "未命名会话",
        "is_custom": bool(session.get("custom_script")),
        "word_file": word_file,
        "audio_file": audio_file,
        "audio_zip": audio_zip,
        "audio_chapters": [
            {"chapter": c.get("chapter"), "title": c.get("title", ""), "filename": c.get("filename", "")}
            for c in audio_chapters
        ],
        "pptx_file": pptx_file,
        "video_file": video_file,
        "pres_audio_zip": pres_audio_zip,
        "has_presentation": has_presentation,
        "has_pres_audio": has_pres_audio,
    }


@router.get("/{session_id}/stream")
async def stream_events(session_id: str):
    require_session(session_id)

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


@router.get("/{session_id}/state")
async def get_session_state(session_id: str):
    require_session(session_id)
    from backend.deps import compiled_graph, get_config

    config = get_config(session_id)
    try:
        snapshot = await compiled_graph.aget_state(config)
        state_values = serialize(snapshot.values) if snapshot else {}
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
