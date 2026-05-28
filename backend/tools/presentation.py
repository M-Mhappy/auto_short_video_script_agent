"""Generate web presentation steps from script chapters via LLM."""

from __future__ import annotations

import json

from langchain_core.messages import SystemMessage, HumanMessage

from backend.llm import get_llm
from backend.prompts.templates import PRESENTATION_OUTLINE_PROMPT
from backend.tools.json_utils import parse_llm_json

VALID_VISUAL_TYPES = frozenset({"reveal", "quote", "list"})
VALID_SCENES = frozenset({"book", "archive", "timeline", "silhouette", "city", "nature", "void"})
VALID_MOTIONS = frozenset({"slow", "medium", "strong"})

SYSTEM_MSG = (
    "你是书籍解说的视觉导演。将口播稿拆成视觉演示步骤。"
    "仅输出 JSON 数组，无 markdown 包裹，无解释。"
)


def _make_default_screen(headline: str, narration: str) -> dict:
    """Build a minimal reveal screen as fallback."""
    return {
        "headline": headline,
        "subhead": "",
        "visual": {
            "type": "reveal",
            "elements": [
                {
                    "kind": "text",
                    "content": narration[:80] if narration else headline,
                    "role": "主内容",
                    "animate": "fade-in",
                }
            ],
            "mood": "calm",
        },
    }


def _normalize_step(raw: dict, index: int) -> dict:
    """Validate and normalize a single step, with fallback to reveal."""
    if not isinstance(raw, dict):
        raise ValueError(f"Step {index} is not an object")

    chapter_title = str(raw.get("chapter_title", "")).strip()
    narration = str(raw.get("narration", "")).strip()
    if not narration:
        raise ValueError(f"Step {index} missing narration")
    if not chapter_title:
        chapter_title = f"步骤 {index + 1}"

    screen = raw.get("screen")

    # --- Legacy format adaptation (hero/text/quote/list_item) ---
    old_type = raw.get("type", "")
    if old_type and not screen:
        screen = _legacy_to_screen(raw, old_type, chapter_title, narration)

    if not isinstance(screen, dict):
        screen = _make_default_screen(chapter_title, narration)

    visual = screen.get("visual")
    if not isinstance(visual, dict):
        screen = _make_default_screen(
            screen.get("headline", chapter_title), narration,
        )
        visual = screen["visual"]

    vtype = visual.get("type", "reveal")
    if vtype not in VALID_VISUAL_TYPES:
        visual["type"] = "reveal"

    if not isinstance(visual.get("elements"), list) or len(visual["elements"]) == 0:
        visual["elements"] = [
            {"kind": "text", "content": narration[:80], "role": "主内容", "animate": "fade-in"}
        ]

    for elem in visual["elements"]:
        if not isinstance(elem, dict):
            continue
        elem.setdefault("kind", "text")
        elem.setdefault("content", "")
        elem.setdefault("role", "")
        elem.setdefault("animate", "fade-in")

    visual.setdefault("mood", "calm")

    if visual.get("scene") and visual["scene"] not in VALID_SCENES:
        del visual["scene"]
    if visual.get("motion") and visual["motion"] not in VALID_MOTIONS:
        del visual["motion"]

    screen.setdefault("headline", chapter_title)
    screen.setdefault("subhead", "")

    return {
        "step": raw.get("step", index + 1),
        "chapter_title": chapter_title,
        "narration": narration,
        "screen": screen,
    }


def _legacy_to_screen(raw: dict, old_type: str, chapter_title: str, narration: str) -> dict:
    """Convert old hero/text/quote/list_item format to new screen format."""
    if old_type == "hero":
        return {
            "headline": raw.get("title") or chapter_title,
            "subhead": raw.get("subtitle", ""),
            "visual": {
                "type": "reveal",
                "elements": [{"kind": "text", "content": raw.get("title") or chapter_title, "role": "主标题", "animate": "fade-in"}],
                "mood": "dramatic",
            },
        }
    if old_type == "quote":
        quote_text = raw.get("quote") or narration
        return {
            "headline": "",
            "subhead": "",
            "visual": {
                "type": "quote",
                "elements": [{"kind": "quote", "content": quote_text, "role": "金句", "animate": "fade-in"}],
                "mood": "warm",
            },
        }
    if old_type == "list_item":
        item_text = raw.get("item_text") or narration
        return {
            "headline": raw.get("list_title", ""),
            "subhead": "",
            "visual": {
                "type": "list",
                "elements": [{"kind": "text", "content": item_text, "role": f"第{raw.get('item_index', '')}项", "animate": "fly-in"}],
                "mood": "calm",
            },
        }
    body = raw.get("body") or narration
    return _make_default_screen(chapter_title, body)


def _validate_steps(steps: list) -> list[dict]:
    validated = [_normalize_step(raw, i) for i, raw in enumerate(steps)]
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
