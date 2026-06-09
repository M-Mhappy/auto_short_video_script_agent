"""Shared application state and helpers used across routers."""

from __future__ import annotations

import asyncio
import json

from fastapi import HTTPException
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from backend.config import SCRIPT_ENDING
from backend.tools.chapters import parse_chapters
from backend.session_store import SessionStore

sessions: SessionStore = SessionStore()
checkpointer: AsyncSqliteSaver | None = None
compiled_graph = None


def _empty_media_session_fields() -> dict:
    return {
        "audio_path": "",
        "audio_chapters": [],
        "audio_zip_path": "",
        "presentation_steps": [],
        "presentation_step_audio": [],
        "presentation_audio_zip_path": "",
        "presentation_outline_path": "",
    }


def get_config(session_id: str) -> dict:
    return {"configurable": {"thread_id": session_id}}


def require_session(session_id: str) -> dict:
    if session_id not in sessions:
        raise HTTPException(404, "Session not found")
    return sessions[session_id]


def serialize(obj):
    """Make objects JSON-serializable."""
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return {k: serialize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [serialize(i) for i in obj]
    if isinstance(obj, (str, int, float, bool)):
        return obj
    return str(obj)


async def get_script_data(session_id: str) -> tuple[str, list[dict], dict]:
    """Return (script_text, chapters, book_info) from custom or LangGraph session."""
    session = require_session(session_id)

    if session.get("custom_script"):
        script = session.get("script_text", "")
        if not script.strip():
            raise HTTPException(400, "No script available")
        chapters = session.get("script_chapters") or parse_chapters(script)
        book = session.get("book_info") or {"title": "自定义口播稿", "author": ""}
        return script, chapters, book

    config = get_config(session_id)
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
    book = values.get("selected_book") or {}
    return script, chapters, book


async def get_book_info(session_id: str) -> dict:
    _, _, book = await get_script_data(session_id)
    return book


async def stream_graph_and_collect(session_id: str, stream_input, config: dict):
    """Stream graph (initial run or resume), collect events into session store."""
    session = sessions.get(session_id)
    if not session:
        return

    session["status"] = "running"
    try:
        async for event in compiled_graph.astream(
            stream_input, config=config, stream_mode="updates"
        ):
            for node_name, node_output in event.items():
                ev = {
                    "node": node_name,
                    "data": serialize(node_output),
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
                "data": serialize(interrupt_data) if interrupt_data else {},
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
    finally:
        sessions.save(session_id)
