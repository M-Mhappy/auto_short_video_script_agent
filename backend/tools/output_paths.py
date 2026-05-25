"""Resolve per-book output directories: output/{book_slug}/word|mp3."""

from __future__ import annotations

import os
import re

from backend.config import OUTPUT_BASE


def book_slug(title: str) -> str:
    name = re.sub(r'[\\/:*?"<>|]', '_', (title or "").strip())
    return name or "untitled"


def book_output_dirs(book_title: str, base: str | None = None) -> dict[str, str]:
    root = base or OUTPUT_BASE
    slug = book_slug(book_title)
    book_base = os.path.join(root, slug)
    word_dir = os.path.join(book_base, "word")
    mp3_dir = os.path.join(book_base, "mp3")
    os.makedirs(word_dir, exist_ok=True)
    os.makedirs(mp3_dir, exist_ok=True)
    return {"base": book_base, "word": word_dir, "mp3": mp3_dir}
