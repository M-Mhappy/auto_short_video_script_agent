from langchain_core.messages import SystemMessage, HumanMessage
from backend.config import SCRIPT_ENDING
from backend.llm import get_llm
from backend.prompts.templates import APPLY_FEEDBACK_TASK_PROMPT
from backend.tools.chapters import parse_chapters
from backend.tools.prompt_cache import (
    SCRIPT_WRITER_SYSTEM_MSG,
    append_prompt_cache_stat,
    build_cacheable_prompt,
    build_script_context_prefix,
    make_script_context_cache_key,
)


def apply_feedback_node(state: dict) -> dict:
    current_script = state.get("script_draft", "")
    feedback = state.get("user_feedback", "")
    book = state.get("selected_book", {})
    reference = state.get("reference_script", "")

    llm = get_llm(temperature=0.7)

    prefix = build_script_context_prefix(book, reference)
    cache_key = state.get("script_context_cache_key") or make_script_context_cache_key(
        prefix,
    )
    task_prompt = APPLY_FEEDBACK_TASK_PROMPT.format(
        current_script=current_script,
        user_feedback=feedback,
    )
    prompt = build_cacheable_prompt(prefix, task_prompt)

    messages = [
        SystemMessage(content=SCRIPT_WRITER_SYSTEM_MSG),
        HumanMessage(content=prompt),
    ]

    response = llm.invoke(messages)

    script = response.content.strip()
    if SCRIPT_ENDING.strip() not in script:
        script += SCRIPT_ENDING
    return {
        "script_draft": script,
        "script_chapters": parse_chapters(script),
        "script_context_cache_key": cache_key,
        "llm_cache_stats": append_prompt_cache_stat(
            state, response, "apply_feedback", cache_key,
        ),
        "current_step": "apply_feedback",
    }
