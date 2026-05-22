from langgraph.types import interrupt


def preview_script_node(state: dict) -> dict:
    script = state.get("script_draft", "")
    review = state.get("review_result", {})

    value = interrupt({
        "type": "preview_feedback",
        "script": script,
        "review": review,
        "message": "请预览口播稿，确认输出或提交修改建议。",
    })

    action = value.get("action", "confirm")

    if action == "confirm":
        return {"current_step": "confirmed"}
    elif action == "feedback":
        return {
            "user_feedback": value.get("feedback", ""),
            "current_step": "feedback_received",
        }
    else:
        return {"current_step": "abandoned"}
