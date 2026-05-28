"""Generate a narration script Markdown from presentation steps."""

from __future__ import annotations


def _describe_screen(step: dict) -> str:
    """Build a Chinese text description of what's on screen for this step."""
    screen = step.get("screen") or {}
    headline = screen.get("headline", "")
    subhead = screen.get("subhead", "")
    visual = screen.get("visual") or {}
    vtype = visual.get("type", "reveal")
    elements = visual.get("elements") or []

    parts: list[str] = []
    if headline:
        parts.append(f"标题「{headline}」")
    if subhead:
        parts.append(f"副标题「{subhead}」")

    if vtype == "quote":
        for el in elements:
            if el.get("kind") == "quote":
                parts.append(f"金句「{el.get('content', '')}」淡入")
                break
    elif vtype == "list":
        for el in elements:
            anim = el.get("animate", "fade-in")
            parts.append(f"要点「{el.get('content', '')}」{anim}")
    else:
        for el in elements:
            anim = el.get("animate", "fade-in")
            parts.append(f"「{el.get('content', '')}」{anim}")

    mood = visual.get("mood", "")
    if mood and mood != "calm":
        parts.append(f"氛围：{mood}")

    return "；".join(parts) if parts else "画面展示相关内容"


def _estimate_seconds(narration: str) -> int:
    """Rough estimate: ~4 chars/second for Chinese."""
    chars = len(narration.strip())
    return max(5, round(chars / 4))


def render_narration_script(steps: list[dict], book_title: str = "") -> str:
    """Render a downloadable Markdown narration script."""
    total_secs = sum(_estimate_seconds(s.get("narration", "")) for s in steps)
    total_min = round(total_secs / 60, 1)

    lines: list[str] = []
    title = f"《{book_title}》" if book_title else "演示"
    lines.append(f"# {title}配音稿\n")
    lines.append(f"> 总步数：{len(steps)} 步 | 预估时长：~{total_min} 分钟")
    lines.append("> 使用方式：打开演示网页 → 开始录屏 → 按此稿逐句配音\n")
    lines.append("---\n")

    current_chapter = ""
    for step in steps:
        chapter = step.get("chapter_title", "")
        if chapter != current_chapter:
            current_chapter = chapter
            lines.append(f"\n## {chapter}\n")

        idx = step.get("step", "?")
        narration = step.get("narration", "")
        secs = _estimate_seconds(narration)
        screen_desc = _describe_screen(step)

        lines.append(f"### Step {idx}（~{secs} 秒）")
        lines.append(f"**屏幕**：{screen_desc}")
        lines.append(f"**口播**：「{narration}」\n")

    lines.append("---\n")
    return "\n".join(lines)
