"""Render presentation slides to PNG and compose MP4 via FFmpeg."""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from backend.config import FFMPEG_PATH
from backend.tools.slide_layout import (
    ACCENT_COLOR, FG_COLOR, MUTED_COLOR, BG_COLOR,
    SLIDE_W, SLIDE_H, PADDING_X, PADDING_Y,
    layout_from_step,
)

DEFAULT_SLIDE_SECONDS = 5
FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\msyhbd.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
]


def _resolve_ffmpeg() -> str:
    if FFMPEG_PATH and os.path.isfile(FFMPEG_PATH):
        return FFMPEG_PATH
    found = shutil.which("ffmpeg")
    if found:
        return found
    raise RuntimeError(
        "未找到 FFmpeg。请安装后将其加入 PATH，或在 .env 中设置 FFMPEG_PATH=ffmpeg.exe 的完整路径。"
    )


def _load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = FONT_CANDIDATES if not bold else [
        r"C:\Windows\Fonts\msyhbd.ttc",
        r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\simhei.ttf",
    ]
    for path in candidates:
        if os.path.isfile(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def _wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int, draw: ImageDraw.ImageDraw) -> list[str]:
    if not text:
        return []
    lines: list[str] = []
    for paragraph in text.split("\n"):
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        current = ""
        for char in paragraph:
            trial = current + char
            bbox = draw.textbbox((0, 0), trial, font=font)
            if bbox[2] - bbox[0] <= max_width:
                current = trial
            else:
                if current:
                    lines.append(current)
                current = char
        if current:
            lines.append(current)
    return lines


def _draw_text_block(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    max_width: int,
    lines: list[str],
    font: ImageFont.FreeTypeFont,
    color: tuple[int, int, int],
    *,
    line_spacing: int = 12,
) -> int:
    cy = y
    for line in lines:
        draw.text((x, cy), line, font=font, fill=color)
        bbox = draw.textbbox((x, cy), line, font=font)
        cy += (bbox[3] - bbox[1]) + line_spacing
    return cy


def render_slide_png(step: dict, output_path: str) -> str:
    """Render one presentation step to a 1920x1080 PNG."""
    img = Image.new("RGB", (SLIDE_W, SLIDE_H), BG_COLOR)
    draw = ImageDraw.Draw(img)
    layout = layout_from_step(step)
    content_w = SLIDE_W - PADDING_X * 2
    x = PADDING_X
    y = PADDING_Y + 40

    if layout.step_type == "hero":
        title_font = _load_font(72, bold=True)
        sub_font = _load_font(32)
        title_lines = _wrap_text(layout.title, title_font, content_w, draw)
        title_h = len(title_lines) * 86
        start_y = (SLIDE_H - title_h) // 2 - 40
        cy = _draw_text_block(draw, x, start_y, content_w, title_lines, title_font, FG_COLOR, line_spacing=16)
        if layout.subtitle:
            sub_lines = _wrap_text(layout.subtitle, sub_font, content_w, draw)
            _draw_text_block(draw, x, cy + 24, content_w, sub_lines, sub_font, MUTED_COLOR)
        img.save(output_path)
        return output_path

    tag_font = _load_font(22)
    if layout.chapter_tag:
        draw.text((x, y), layout.chapter_tag, font=tag_font, fill=ACCENT_COLOR)
        y += 48

    if layout.step_type == "quote":
        bar_h = min(420, SLIDE_H - y - PADDING_Y)
        draw.rectangle([x, y, x + 8, y + bar_h], fill=ACCENT_COLOR)
        quote_font = _load_font(44)
        quote_lines = _wrap_text(
            "\n".join(layout.body_lines), quote_font, content_w - 48, draw,
        )
        _draw_text_block(draw, x + 36, y, content_w - 48, quote_lines, quote_font, FG_COLOR, line_spacing=18)
        img.save(output_path)
        return output_path

    if layout.step_type == "list_item":
        if layout.list_title:
            list_title_font = _load_font(26)
            draw.text((x, y), layout.list_title, font=list_title_font, fill=MUTED_COLOR)
            y += 44
        item_font = _load_font(38, bold=True)
        prefix = f"{layout.item_index}. " if layout.item_index else ""
        body = prefix + (layout.body_lines[0] if layout.body_lines else "")
        item_lines = _wrap_text(body, item_font, content_w, draw)
        _draw_text_block(draw, x, y, content_w, item_lines, item_font, FG_COLOR, line_spacing=16)
        img.save(output_path)
        return output_path

    body_font = _load_font(32)
    body_lines = _wrap_text("\n".join(layout.body_lines), body_font, content_w, draw)
    _draw_text_block(draw, x, y, content_w, body_lines, body_font, FG_COLOR, line_spacing=18)
    img.save(output_path)
    return output_path


def _run_ffmpeg(args: list[str]) -> None:
    ffmpeg = _resolve_ffmpeg()
    cmd = [ffmpeg, *args]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "unknown error").strip()
        raise RuntimeError(f"FFmpeg 执行失败: {err[-500:]}")


def _make_segment(png_path: str, audio_path: str | None, segment_path: str) -> None:
    if audio_path and os.path.isfile(audio_path):
        _run_ffmpeg([
            "-y", "-loop", "1", "-i", png_path, "-i", audio_path,
            "-c:v", "libx264", "-tune", "stillimage", "-c:a", "aac",
            "-shortest", "-pix_fmt", "yuv420p", segment_path,
        ])
    else:
        _run_ffmpeg([
            "-y", "-loop", "1", "-i", png_path,
            "-t", str(DEFAULT_SLIDE_SECONDS),
            "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p",
            segment_path,
        ])


def generate_video(
    steps: list[dict],
    audio_results: list[dict],
    output_path: str,
) -> str:
    """Compose step slides + optional per-step audio into one MP4."""
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    audio_by_step = {item.get("step"): item.get("filepath", "") for item in audio_results}

    with tempfile.TemporaryDirectory(prefix="pres_video_") as tmp:
        tmp_dir = Path(tmp)
        segments: list[str] = []

        for idx, step in enumerate(steps):
            png_path = str(tmp_dir / f"slide_{idx:03d}.png")
            seg_path = str(tmp_dir / f"seg_{idx:03d}.mp4")
            render_slide_png(step, png_path)
            audio_path = audio_by_step.get(idx) or ""
            _make_segment(png_path, audio_path or None, seg_path)
            segments.append(seg_path)

        if not segments:
            raise RuntimeError("没有可合成的演示步骤")

        if len(segments) == 1:
            shutil.copy2(segments[0], output_path)
            return output_path

        concat_file = tmp_dir / "concat.txt"
        with open(concat_file, "w", encoding="utf-8") as f:
            for seg in segments:
                safe = seg.replace("\\", "/").replace("'", "'\\''")
                f.write(f"file '{safe}'\n")

        _run_ffmpeg([
            "-y", "-f", "concat", "-safe", "0", "-i", str(concat_file),
            "-c", "copy", output_path,
        ])

    return output_path
