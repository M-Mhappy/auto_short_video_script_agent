import json

from backend.llm import get_llm
from backend.tools.json_utils import parse_llm_json
from backend.prompts.templates import KEYWORD_EXTRACT_PROMPT


def keyword_extract_node(state: dict) -> dict:
    user_input = state.get("user_input", "")
    llm = get_llm(temperature=0.3)
    prompt = KEYWORD_EXTRACT_PROMPT.format(user_input=user_input)
    response = llm.invoke(prompt)
    content = response.content.strip()

    try:
        keywords = parse_llm_json(content, list)
    except (json.JSONDecodeError, ValueError):
        keywords = [user_input]

    return {
        "keywords": keywords,
        "current_step": "extract_keywords",
    }
