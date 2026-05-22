from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from backend.config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL, SCRIPT_ENDING

SYSTEM_MSG = (
    "你是一位口播稿修改专家。你必须根据用户反馈对稿件做出明确、可感知的修改。"
    "修改后的稿件必须与原稿有显著不同。直接输出修改后的完整稿件全文。"
)


def apply_feedback_node(state: dict) -> dict:
    current_script = state.get("script_draft", "")
    feedback = state.get("user_feedback", "")

    llm = ChatOpenAI(
        api_key=DEEPSEEK_API_KEY,
        base_url=DEEPSEEK_BASE_URL,
        model=DEEPSEEK_MODEL,
        temperature=0.7,
        max_tokens=8192,
    )

    messages = [
        SystemMessage(content=SYSTEM_MSG),
        HumanMessage(content=(
            f"用户修改要求：\n{feedback}\n\n"
            "---以下是当前稿件---\n\n"
            f"{current_script}\n\n"
            "---稿件结束---\n\n"
            "请根据上述修改要求重写稿件。要求：\n"
            "1. 针对用户提到的问题做出明确修改\n"
            "2. 保持整体叙事结构和风格一致\n"
            "3. 反馈要求增加内容时，在不编造前提下补充\n"
            "4. 反馈要求删减时优先删重复或次要内容\n"
            "5. 输出修改后的完整稿件全文"
        )),
    ]

    response = llm.invoke(messages)

    script = response.content.strip()
    if SCRIPT_ENDING.strip() not in script:
        script += SCRIPT_ENDING
    return {
        "script_draft": script,
        "current_step": "apply_feedback",
    }
