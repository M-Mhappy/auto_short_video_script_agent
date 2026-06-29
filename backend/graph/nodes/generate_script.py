from langchain_core.messages import SystemMessage, HumanMessage
from backend.config import SCRIPT_ENDING
from backend.llm import get_llm
from backend.prompts.templates import GENERATE_SCRIPT_TASK_PROMPT
from backend.tools.chapters import parse_chapters
from backend.tools.prompt_cache import (
    SCRIPT_WRITER_SYSTEM_MSG,
    append_prompt_cache_stat,
    build_cacheable_prompt,
    build_script_context_prefix,
    make_script_context_cache_key,
)


def generate_script_node(state: dict) -> dict:
    book = state.get("selected_book", {})
    reference = state.get("reference_script", "")

    llm = get_llm(temperature=0.7)

    prefix = build_script_context_prefix(book, reference)
    cache_key = state.get("script_context_cache_key") or make_script_context_cache_key(
        prefix,
    )
    prompt = build_cacheable_prompt(prefix, GENERATE_SCRIPT_TASK_PROMPT)

    messages = [
        SystemMessage(content=SCRIPT_WRITER_SYSTEM_MSG),
        HumanMessage(content=prompt),
    ]

    response = llm.invoke(messages)
    script = response.content.strip() + SCRIPT_ENDING
    chapters = parse_chapters(script)

    return {
        "script_draft": script,
        "script_chapters": chapters,
        "script_context_cache_key": cache_key,
        "llm_cache_stats": append_prompt_cache_stat(
            state, response, "generate_script", cache_key,
        ),
        "current_step": "generate_script",
    }
