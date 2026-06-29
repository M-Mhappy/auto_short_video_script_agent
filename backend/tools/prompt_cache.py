"""Helpers for arranging prompt prefixes for provider-side context caching."""

from __future__ import annotations

import hashlib
from typing import Any

from backend.prompts.templates import SCRIPT_CONTEXT_PREFIX_PROMPT

SCRIPT_CONTEXT_CACHE_VERSION = "script-context-v1"

SCRIPT_WRITER_SYSTEM_MSG = (
    "你是一位资深短视频口播稿撰稿人与修改专家，擅长将书籍内容转化为讲故事式口播稿，"
    "也擅长根据用户反馈对稿件做出明确、可感知的修改。"
    "用 ## 章节标题 分段输出，每章一行二级标题，标题下为正文纯文本。"
    "直接输出口播稿全文，不要加任何额外说明。"
)


def build_script_context_prefix(book: dict[str, Any], reference_script: str) -> str:
    """Build the stable prompt prefix shared by generation and feedback edits."""
    book = book or {}
    reference = (reference_script or "").strip() or "无"
    return SCRIPT_CONTEXT_PREFIX_PROMPT.format(
        book_title=book.get("title", ""),
        book_author=book.get("author", ""),
        book_intro=book.get("intro", ""),
        reference_script=reference,
    ).strip()


def make_script_context_cache_key(prefix: str) -> str:
    """Short deterministic key for tracing which prompt prefix was used."""
    raw = f"{SCRIPT_CONTEXT_CACHE_VERSION}\n{prefix}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:16]


def build_cacheable_prompt(prefix: str, task_prompt: str) -> str:
    """Keep reusable context first and changing task data last."""
    return f"{prefix.rstrip()}\n\n---\n\n{task_prompt.strip()}"


def append_prompt_cache_stat(
    state: dict[str, Any],
    response: Any,
    stage: str,
    cache_key: str,
) -> list[dict[str, Any]]:
    """Append provider cache usage if the OpenAI-compatible response exposes it."""
    stats = list(state.get("llm_cache_stats") or [])
    stat = extract_prompt_cache_stat(response, stage, cache_key)
    if stat:
        stats.append(stat)
    return stats[-20:]


def extract_prompt_cache_stat(
    response: Any,
    stage: str,
    cache_key: str,
) -> dict[str, Any] | None:
    usage = _extract_usage(response)
    prompt_tokens = _coerce_int(usage.get("prompt_tokens"))
    hit_tokens = _coerce_int(usage.get("prompt_cache_hit_tokens"))
    miss_tokens = _coerce_int(usage.get("prompt_cache_miss_tokens"))

    prompt_details = usage.get("prompt_tokens_details")
    if isinstance(prompt_details, dict) and hit_tokens is None:
        hit_tokens = _coerce_int(prompt_details.get("cached_tokens"))

    input_details = usage.get("input_token_details")
    if isinstance(input_details, dict) and hit_tokens is None:
        hit_tokens = _coerce_int(
            input_details.get("cache_read") or input_details.get("cached_tokens")
        )

    if prompt_tokens is None:
        prompt_tokens = _coerce_int(usage.get("input_tokens"))
    if prompt_tokens is None and hit_tokens is not None and miss_tokens is not None:
        prompt_tokens = hit_tokens + miss_tokens
    if miss_tokens is None and prompt_tokens is not None and hit_tokens is not None:
        miss_tokens = max(prompt_tokens - hit_tokens, 0)

    if prompt_tokens is None and hit_tokens is None and miss_tokens is None:
        return None

    hit_rate = None
    if prompt_tokens and hit_tokens is not None:
        hit_rate = round(hit_tokens / prompt_tokens, 4)

    return {
        "stage": stage,
        "cache_key": cache_key,
        "prompt_tokens": prompt_tokens,
        "prompt_cache_hit_tokens": hit_tokens,
        "prompt_cache_miss_tokens": miss_tokens,
        "cache_hit_rate": hit_rate,
    }


def _extract_usage(response: Any) -> dict[str, Any]:
    metadata = getattr(response, "response_metadata", None) or {}
    usage = metadata.get("token_usage") or metadata.get("usage") or {}
    if not isinstance(usage, dict):
        usage = {}

    usage_metadata = getattr(response, "usage_metadata", None) or {}
    if isinstance(usage_metadata, dict):
        usage = {**usage_metadata, **usage}
    return usage


def _coerce_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
