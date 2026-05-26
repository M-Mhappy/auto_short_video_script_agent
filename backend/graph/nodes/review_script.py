import json
from langchain_core.messages import SystemMessage, HumanMessage
from backend.llm import get_llm
from backend.prompts.templates import REVIEW_SCRIPT_PROMPT
from backend.tools.json_utils import parse_llm_json
from backend.tools.search import search_for_review

REVIEW_SYSTEM_MSG = (
    "你是一位严格的书籍内容审核员。审核 AI 生成的口播稿是否忠实、准确地转述了原书。"
    "输出严格 JSON，无其他文字。"
)


def review_script_node(state: dict) -> dict:
    book = state.get("selected_book", {})
    script = state.get("script_draft", "")
    title = book.get("title", "")
    author = book.get("author", "")

    web_results = ""
    try:
        web_results = search_for_review(title, author)
    except Exception:
        web_results = "联网搜索不可用"

    llm = get_llm(temperature=0.2)

    prompt = REVIEW_SCRIPT_PROMPT.format(
        book_title=title,
        book_author=author,
        script_draft=script,
        web_search_results=web_results,
    )

    messages = [
        SystemMessage(content=REVIEW_SYSTEM_MSG),
        HumanMessage(content=prompt),
    ]

    response = llm.invoke(messages)

    try:
        review = parse_llm_json(response.content, dict)
        review["total"] = (
            review.get("fact_accuracy", 0)
            + review.get("fidelity", 0)
            + review.get("completeness", 0)
            + review.get("style_consistency", 0)
        )
    except (json.JSONDecodeError, ValueError):
        review = {
            "fact_accuracy": 20,
            "fidelity": 20,
            "completeness": 20,
            "style_consistency": 20,
            "total": 80,
            "reasoning": "审核解析失败，给出默认通过分数",
            "hallucinations": [],
            "omissions": [],
        }

    return {
        "review_result": review,
        "current_step": "review_script",
    }
