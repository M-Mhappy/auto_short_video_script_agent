"""LangGraph workflow interaction: start, confirm-book, feedback, etc."""

import asyncio
import os

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from langgraph.types import Command

from backend.deps import (
    sessions, compiled_graph, require_session,
    get_config, get_script_data, stream_graph_and_collect,
)
from backend.graph.nodes.export_word import export_word_node

router = APIRouter(prefix="/api/session", tags=["graph"])


class StartRequest(BaseModel):
    user_input: str
    mode: str = "direct"


class BookConfirmRequest(BaseModel):
    action: str
    index: int | None = 0
    query: str | None = ""


class LowQualityRequest(BaseModel):
    action: str


class FeedbackRequest(BaseModel):
    action: str
    feedback: str | None = ""


@router.post("/{session_id}/start")
async def start_session(session_id: str, req: StartRequest):
    require_session(session_id)

    sessions[session_id]["events"] = []
    sessions[session_id]["title"] = req.user_input.strip()[:50]
    config = get_config(session_id)
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

    asyncio.create_task(stream_graph_and_collect(session_id, input_data, config))
    return {"status": "started"}


@router.post("/{session_id}/confirm-book")
async def confirm_book(session_id: str, req: BookConfirmRequest):
    require_session(session_id)

    config = get_config(session_id)
    resume_value = {
        "action": req.action,
        "index": req.index or 0,
        "query": req.query or "",
    }

    sessions[session_id]["events"] = []
    asyncio.create_task(stream_graph_and_collect(
        session_id, Command(resume=resume_value), config,
    ))
    return {"status": "resumed"}


@router.post("/{session_id}/low-quality-decision")
async def low_quality_decision(session_id: str, req: LowQualityRequest):
    require_session(session_id)

    config = get_config(session_id)
    resume_value = {"action": req.action}

    sessions[session_id]["events"] = []
    asyncio.create_task(stream_graph_and_collect(
        session_id, Command(resume=resume_value), config,
    ))
    return {"status": "resumed"}


@router.post("/{session_id}/feedback")
async def submit_feedback(session_id: str, req: FeedbackRequest):
    require_session(session_id)

    config = get_config(session_id)
    resume_value = {
        "action": req.action,
        "feedback": req.feedback or "",
    }

    sessions[session_id]["events"] = []
    asyncio.create_task(stream_graph_and_collect(
        session_id, Command(resume=resume_value), config,
    ))
    return {"status": "resumed"}


@router.get("/{session_id}/download")
async def download_word(session_id: str):
    session = require_session(session_id)

    if session.get("custom_script"):
        filepath = session.get("word_file_path", "")
        if filepath and os.path.exists(filepath):
            return FileResponse(
                filepath,
                media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                filename=os.path.basename(filepath),
            )
        raise HTTPException(404, "Word file not found")

    config = get_config(session_id)
    try:
        snapshot = await compiled_graph.aget_state(config)
        if snapshot and snapshot.values:
            filepath = snapshot.values.get("word_file_path", "")
            if filepath and os.path.exists(filepath):
                return FileResponse(
                    filepath,
                    media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    filename=os.path.basename(filepath),
                )
    except Exception:
        pass

    raise HTTPException(404, "Word file not found")


@router.post("/{session_id}/export-word")
async def export_word_custom(session_id: str):
    session = require_session(session_id)

    if not session.get("custom_script"):
        raise HTTPException(400, "Not a custom script session")

    script, chapters, book = await get_script_data(session_id)
    result = export_word_node({
        "script_draft": script,
        "script_chapters": chapters,
        "selected_book": book,
    })
    session["word_file_path"] = result["word_file_path"]
    sessions.save(session_id)
    return {
        "status": "ok",
        "filename": os.path.basename(result["word_file_path"]),
    }
