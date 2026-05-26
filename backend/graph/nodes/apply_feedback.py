from langchain_core.messages import SystemMessage, HumanMessage
from backend.config import SCRIPT_ENDING
from backend.llm import get_llm
from backend.prompts.templates import APPLY_FEEDBACK_PROMPT
from backend.tools.chapters import parse_chapters

SYSTEM_MSG = (
    "你是一位口播稿修改专家。你必须根据用户反馈对稿件做出明确、可感知的修改。"
    "修改后的稿件必须与原稿有显著不同。保留 ## 章节标题 分段格式。"
    "直接输出修改后的完整稿件全文。"
)


def apply_feedback_node(state: dict) -> dict:
    current_script = state.get("script_draft", "")
    feedback = state.get("user_feedback", "")

    llm = get_llm(temperature=0.7)

    prompt = APPLY_FEEDBACK_PROMPT.format(
        current_script=current_script,
        user_feedback=feedback,
    )

    messages = [
        SystemMessage(content=SYSTEM_MSG),
        HumanMessage(content=prompt),
    ]

    response = llm.invoke(messages)

    script = response.content.strip()
    if SCRIPT_ENDING.strip() not in script:
        script += SCRIPT_ENDING
    return {
        "script_draft": script,
        "script_chapters": parse_chapters(script),
        "current_step": "apply_feedback",
    }
