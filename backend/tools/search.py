from tavily import TavilyClient
from backend.config import TAVILY_API_KEY


def tavily_search(query: str, max_results: int = 5) -> str:
    client = TavilyClient(api_key=TAVILY_API_KEY)
    response = client.search(
        query=query,
        search_depth="basic",
        max_results=max_results,
        include_answer=True,
    )
    parts = []
    if response.get("answer"):
        parts.append(f"摘要：{response['answer']}")
    for r in response.get("results", []):
        parts.append(f"- {r.get('title', '')}: {r.get('content', '')}")
    return "\n".join(parts) if parts else "未找到相关结果"


def tavily_search_raw(query: str, max_results: int = 5) -> dict:
    """返回 Tavily 原始响应，包含 answer 和 results。"""
    client = TavilyClient(api_key=TAVILY_API_KEY)
    return client.search(
        query=query,
        search_depth="basic",
        max_results=max_results,
        include_answer=True,
    )


def search_book_info(book_title: str, author: str = "") -> str:
    query = f"{book_title} {author} 书籍简介 章节内容 核心观点".strip()
    return tavily_search(query, max_results=5)


def search_for_review(book_title: str, author: str = "") -> str:
    query = f"{book_title} {author} 核心情节 论点 章节结构 书评".strip()
    return tavily_search(query, max_results=5)
