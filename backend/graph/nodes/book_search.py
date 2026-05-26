import json
from langchain_core.messages import SystemMessage, HumanMessage
from backend.llm import get_llm
from backend.tools.json_utils import parse_llm_json
from backend.prompts.templates import BOOK_SEARCH_FORMAT_PROMPT
from backend.tools.search import tavily_search, tavily_search_raw


def _clean_book_info(title: str, raw_text: str) -> dict:
    """轻量 LLM 调用：从原始文本中提取干净的中文作者名和简介。"""
    llm = get_llm(temperature=0, max_tokens=512)
    messages = [
        SystemMessage(content="从原始文本中提取书籍信息，输出严格JSON，无其他文字。"),
        HumanMessage(content=(
            f"书名：{title}\n\n原始文本：\n{raw_text}\n\n"
            '输出JSON：{"author": "作者姓名", "intro": "100-200字中文简介"}\n'
            "要求：author只填人名；intro用中文，概括该书核心内容和主题。"
        )),
    ]
    response = llm.invoke(messages)
    return parse_llm_json(response.content, dict)


def _direct_search(user_input: str, previous_titles: list[str]) -> list[dict]:
    """直接搜索书名，Tavily 取原始数据后轻量 LLM 清洗。"""
    title = user_input.replace("《", "").replace("》", "").strip()
    query = f"{title} 书籍 作者 简介"
    raw = tavily_search_raw(query, max_results=3)

    answer = raw.get("answer", "")
    results = raw.get("results", [])
    snippets = [answer] if answer else []
    for r in results[:2]:
        c = r.get("content", "")
        if c:
            snippets.append(c)
    raw_text = "\n".join(snippets)[:500]

    book = {
        "title": title,
        "author": "",
        "intro": "",
        "relevance_reason": "用户直接搜索",
    }

    try:
        cleaned = _clean_book_info(title, raw_text)
        book["author"] = cleaned.get("author", "")
        book["intro"] = cleaned.get("intro", "")
    except Exception:
        book["intro"] = answer[:300] if answer else f"关于《{title}》的详细信息"

    books = [book]
    if previous_titles:
        books = [b for b in books if b["title"] not in previous_titles]
    return books


def _keyword_search(keywords: list[str], previous_titles: list[str], retry_count: int) -> list[dict]:
    """关键词模式，需要 LLM 整理多源结果。"""
    query = " ".join(keywords) + " 推荐书籍"
    if retry_count > 0 and previous_titles:
        query += f" 其他推荐 -{' -'.join(previous_titles[:10])}"

    raw_results = tavily_search(query, max_results=8)

    llm = get_llm(temperature=0.3)

    exclude_note = ""
    if previous_titles:
        exclude_note = f"\n\n注意：以下书籍已被用户看过，请排除：{', '.join(previous_titles)}"

    prompt = BOOK_SEARCH_FORMAT_PROMPT.format(raw_search_results=raw_results) + exclude_note
    response = llm.invoke(prompt)

    try:
        books = parse_llm_json(response.content, list)
    except (json.JSONDecodeError, ValueError):
        books = []

    if previous_titles:
        books = [b for b in books if b.get("title", "") not in previous_titles]

    return books


def book_search_node(state: dict) -> dict:
    mode = state.get("mode", "direct")
    previous_titles = state.get("previous_search_titles", [])
    retry_count = state.get("search_retry_count", 0)

    if mode == "direct":
        books = _direct_search(state.get("user_input", ""), previous_titles)
    else:
        keywords = state.get("keywords", [])
        books = _keyword_search(keywords, previous_titles, retry_count)

    new_titles = previous_titles + [b.get("title", "") for b in books]

    return {
        "search_results": books,
        "previous_search_titles": new_titles,
        "current_step": "search_books",
    }
