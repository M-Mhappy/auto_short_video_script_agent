"""Unified JSON parsing for LLM responses."""

from __future__ import annotations

import json
import re
from typing import Type


def parse_llm_json(content: str, expect_type: Type = list):
    """Strip markdown fences and parse JSON from LLM output.

    Raises json.JSONDecodeError or ValueError on failure.
    """
    text = content.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    data = json.loads(text.strip())
    if not isinstance(data, expect_type):
        raise ValueError(f"Expected {expect_type.__name__}, got {type(data).__name__}")
    return data
