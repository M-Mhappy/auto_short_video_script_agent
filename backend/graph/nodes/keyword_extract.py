import json
from langchain_openai import ChatOpenAI
from backend.config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL
from backend.prompts.templates import KEYWORD_EXTRACT_PROMPT


def keyword_extract_node(state: dict) -> dict:
    user_input = state.get("user_input", "")
    llm = ChatOpenAI(
        api_key=DEEPSEEK_API_KEY,
        base_url=DEEPSEEK_BASE_URL,
        model=DEEPSEEK_MODEL,
        temperature=0.3,
    )
    prompt = KEYWORD_EXTRACT_PROMPT.format(user_input=user_input)
    response = llm.invoke(prompt)
    content = response.content.strip()

    try:
        content = content.replace("```json", "").replace("```", "").strip()
        keywords = json.loads(content)
        if not isinstance(keywords, list):
            keywords = [user_input]
    except json.JSONDecodeError:
        keywords = [user_input]

    return {
        "keywords": keywords,
        "current_step": "extract_keywords",
    }
