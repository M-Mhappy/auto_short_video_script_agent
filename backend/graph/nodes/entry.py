def entry_node(state: dict) -> dict:
    return {
        "mode": state.get("mode", "direct"),
        "current_step": "entry",
    }
