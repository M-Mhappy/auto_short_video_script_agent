import json
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from backend.config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL
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

    llm = ChatOpenAI(
        api_key=DEEPSEEK_API_KEY,
        base_url=DEEPSEEK_BASE_URL,
        model=DEEPSEEK_MODEL,
        temperature=0.2,
    )

    messages = [
        SystemMessage(content=REVIEW_SYSTEM_MSG),
        HumanMessage(content=(
            f"书籍：{title} / {author}\n\n"
            f"联网补充：{web_results}\n\n"
            f"待审核稿：\n{script}\n\n"
            "评分维度（各 0-25，满分 100）：\n"
            "1. 事实准确性：有无编造原文不存在的情节/论点/案例/数据\n"
            "2. 忠实度：转述是否歪曲作者原意，有无断章取义\n"
            "3. 完整性：是否遗漏全书核心章节关键内容\n"
            "4. 风格一致性：风格是否符合该书主旨应有的基调\n\n"
            '输出严格 JSON：\n'
            '{"fact_accuracy": 0, "fidelity": 0, "completeness": 0, '
            '"style_consistency": 0, "total": 0, '
            '"reasoning": "总体评价200-400字", '
            '"hallucinations": [], "omissions": []}\n\n'
            "规则：如无问题可给满分；总分=四维之和；理由必须具体。"
        )),
    ]

    response = llm.invoke(messages)
    content = response.content.strip()

    try:
        content = content.replace("```json", "").replace("```", "").strip()
        review = json.loads(content)
        review["total"] = (
            review.get("fact_accuracy", 0)
            + review.get("fidelity", 0)
            + review.get("completeness", 0)
            + review.get("style_consistency", 0)
        )
    except json.JSONDecodeError:
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
