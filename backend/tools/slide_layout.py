"""Shared presentation slide content layout for PPTX and PNG export."""

from __future__ import annotations

from dataclasses import dataclass, field

# Match frontend presentation.css
BG_COLOR = (0x0F, 0x14, 0x19)
FG_COLOR = (0xE8, 0xEA, 0xED)
MUTED_COLOR = (0x9A, 0xA0, 0xA6)
ACCENT_COLOR = (0x6B, 0x9F, 0xFF)

SLIDE_W = 1920
SLIDE_H = 1080
PADDING_X = 100
PADDING_Y = 80


@dataclass
class SlideLayout:
    chapter_tag: str = ""
    title: str = ""
    subtitle: str = ""
    body_lines: list[str] = field(default_factory=list)
    is_quote: bool = False
    list_title: str = ""
    item_index: str = ""
    step_type: str = "text"


def layout_from_step(step: dict) -> SlideLayout:
    step_type = step.get("type", "text")
    chapter = str(step.get("chapter_title", "")).strip()
    layout = SlideLayout(chapter_tag=chapter, step_type=step_type)

    if step_type == "hero":
        layout.title = str(step.get("title") or chapter).strip()
        layout.subtitle = str(step.get("subtitle") or "").strip()
        return layout

    if step_type == "text":
        body = str(step.get("body") or step.get("narration") or "").strip()
        layout.body_lines = _split_lines(body)
        return layout

    if step_type == "quote":
        quote = str(step.get("quote") or step.get("narration") or "").strip()
        layout.body_lines = _split_lines(quote)
        layout.is_quote = True
        return layout

    if step_type == "list_item":
        layout.list_title = str(step.get("list_title") or "").strip()
        item_index = step.get("item_index")
        layout.item_index = str(item_index).strip() if item_index is not None else ""
        item_text = str(step.get("item_text") or step.get("narration") or "").strip()
        layout.body_lines = _split_lines(item_text)
        return layout

    body = str(step.get("narration") or "").strip()
    layout.body_lines = _split_lines(body)
    return layout


def _split_lines(text: str) -> list[str]:
    if not text:
        return []
    return [line.strip() for line in text.split("\n") if line.strip()]
