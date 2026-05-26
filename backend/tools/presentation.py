"""Generate web presentation steps from script chapters via LLM."""

from __future__ import annotations

import json

from langchain_core.messages import SystemMessage, HumanMessage

from backend.llm import get_llm
from backend.prompts.templates import PRESENTATION_OUTLINE_PROMPT
from backend.tools.json_utils import parse_llm_json

VALID_TYPES = frozenset({"hero", "text", "quote", "list_item"})

SYSTEM_MSG = (
    "你是短视频网页演示编导。将口播稿拆成演示步骤。"
    "仅输出 JSON 数组，无 markdown 包裹，无解释。"
)


def _validate_steps(steps: list) -> list[dict]:
    validated: list[dict] = []
    for i, raw in enumerate(steps):
        if not isinstance(raw, dict):
            raise ValueError(f"Step {i} is not an object")
        step_type = raw.get("type", "")
        if step_type not in VALID_TYPES:
            raise ValueError(f"Step {i} invalid type: {step_type}")
        chapter_title = str(raw.get("chapter_title", "")).strip()
        narration = str(raw.get("narration", "")).strip()
        if not chapter_title or not narration:
            raise ValueError(f"Step {i} missing chapter_title or narration")
        step = {
            "type": step_type,
            "chapter_title": chapter_title,
            "narration": narration,
        }
        for key in ("title", "subtitle", "body", "quote", "list_title", "item_index", "item_text"):
            if key in raw and raw[key] is not None and raw[key] != "":
                step[key] = raw[key]
        validated.append(step)
    if len(validated) < 2:
        raise ValueError("Need at least 2 steps")
    return validated


def generate_presentation_steps(
    chapters: list[dict],
    book_info: dict,
) -> list[dict]:
    """Call LLM to split chapters into presentation steps. Retries once on parse failure."""
    chapters_json = json.dumps(chapters, ensure_ascii=False, indent=2)
    prompt = PRESENTATION_OUTLINE_PROMPT.format(
        book_title=book_info.get("title", ""),
        book_author=book_info.get("author", ""),
        chapters_json=chapters_json,
    )

    llm = get_llm(temperature=0.5)

    last_error: Exception | None = None
    for attempt in range(2):
        messages = [
            SystemMessage(content=SYSTEM_MSG),
            HumanMessage(content=prompt if attempt == 0 else (
                prompt + "\n\n上次输出无法解析，请只输出合法 JSON 数组。"
            )),
        ]
        response = llm.invoke(messages)
        try:
            steps = parse_llm_json(response.content, list)
            return _validate_steps(steps)
        except (json.JSONDecodeError, ValueError) as e:
            last_error = e
            continue

    raise ValueError(f"Failed to generate presentation steps: {last_error}")
