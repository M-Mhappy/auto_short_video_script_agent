"""Parse structured script with ## chapter headings."""

from __future__ import annotations

import re


def parse_chapters(script: str) -> list[dict[str, str]]:
    """Split script into chapters by markdown ## headings."""
    if not script or not script.strip():
        return []

    lines = script.split("\n")
    chapters: list[dict[str, str]] = []
    current_title = ""
    current_lines: list[str] = []
    has_heading = False

    for line in lines:
        if line.startswith("## "):
            has_heading = True
            if current_title or current_lines:
                chapters.append({
                    "title": current_title or "前言",
                    "content": "\n".join(current_lines).strip(),
                })
            current_title = line[3:].strip()
            current_lines = []
        else:
            current_lines.append(line)

    if current_title or current_lines:
        chapters.append({
            "title": current_title or ("全文" if not has_heading else "收尾"),
            "content": "\n".join(current_lines).strip(),
        })

    if not chapters and script.strip():
        return [{"title": "全文", "content": script.strip()}]

    return [c for c in chapters if c["title"] or c["content"]]
