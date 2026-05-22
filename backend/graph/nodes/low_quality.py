from langgraph.types import interrupt


def low_quality_node(state: dict) -> dict:
    review = state.get("review_result", {})
    value = interrupt({
        "type": "low_quality_decision",
        "review": review,
        "message": (
            f"口播稿审核得分 {review.get('total', 0)} 分，未达标。\n"
            f"原因：{review.get('reasoning', '无')}\n\n"
            "当前书籍信息可能不足以生成高质量口播稿。\n"
            "您可以选择：接受当前稿件 / 放弃本次生成"
        ),
    })

    action = value.get("action", "accept")

    if action == "accept":
        return {"current_step": "low_quality_accepted"}
    else:
        return {"current_step": "abandoned"}
