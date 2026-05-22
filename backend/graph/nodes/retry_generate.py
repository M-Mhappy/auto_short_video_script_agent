def retry_generate_node(state: dict) -> dict:
    retry_count = state.get("retry_count", 0)
    return {
        "retry_count": retry_count + 1,
        "current_step": "retry_generate",
    }
