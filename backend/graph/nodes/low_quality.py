from langgraph.types import interrupt


def low_quality_node(state: dict) -> dict:
    review = state.get("review_result", {})
    value = interrupt({
        "type": "low_quality_decision",
        "review": review,
        "message": (
            f"口播稿审核得分 {review.get('total', 0)} 分，未达标。\n"
            f"原因：{review.get('reasoning', '无')}\n\n"
            "该书信息不足以生成高质量口播稿，建议换一本热门书试试。\n"
            "您也可以选择接受当前稿件继续使用。"
        ),
    })

    action = value.get("action", "accept")

    if action == "accept":
        return {"current_step": "low_quality_accepted"}
    else:
        return {"current_step": "abandoned"}
