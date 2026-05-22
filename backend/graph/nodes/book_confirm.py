from langgraph.types import interrupt


MAX_SEARCH_RETRIES = 5


def book_confirm_node(state: dict) -> dict:
    search_results = state.get("search_results", [])
    search_retry_count = state.get("search_retry_count", 0)
    value = interrupt({
        "type": "book_confirm",
        "books": search_results,
        "message": "请选择一本书，或输入新的搜索关键词重新检索。",
        "search_retry_count": search_retry_count,
        "max_search_retries": MAX_SEARCH_RETRIES,
    })

    action = value.get("action", "select")

    if action == "select":
        index = value.get("index", 0)
        if 0 <= index < len(search_results):
            selected = search_results[index]
        else:
            selected = search_results[0] if search_results else {
                "title": "未知", "author": "未知", "intro": "", "relevance_reason": ""
            }
        return {
            "selected_book": selected,
            "current_step": "book_confirmed",
        }
    elif action == "retry":
        return {
            "search_retry_count": search_retry_count + 1,
            "current_step": "research_requested",
        }
    elif action == "research":
        return {
            "user_input": value.get("query", state.get("user_input", "")),
            "search_retry_count": 0,
            "previous_search_titles": [],
            "current_step": "research_requested",
        }
    else:
        return {
            "current_step": "abandoned",
        }
