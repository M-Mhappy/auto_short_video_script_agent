import os

from backend.tools.prompt_cache import (
    build_script_context_prefix,
    make_script_context_cache_key,
)


def load_reference_node(state: dict) -> dict:
    ref_path = os.path.join(os.path.dirname(__file__), "..", "..", "reference_script.md")
    try:
        with open(ref_path, "r", encoding="utf-8") as f:
            content = f.read()
    except FileNotFoundError:
        content = ""

    prefix = build_script_context_prefix(state.get("selected_book", {}), content)

    return {
        "reference_script": content,
        "script_context_cache_key": make_script_context_cache_key(prefix),
        "current_step": "load_reference",
    }
