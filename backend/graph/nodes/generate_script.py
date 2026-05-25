from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from backend.config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL, SCRIPT_ENDING
from backend.tools.chapters import parse_chapters

GENERATE_SYSTEM_MSG = (
    "你是一位资深短视频口播稿撰稿人，擅长将书籍内容转化为讲故事式口播稿。"
    "用 ## 章节标题 分段输出，每章一行二级标题，标题下为正文纯文本。"
    "直接输出口播稿全文，不要加任何额外说明。"
)


def generate_script_node(state: dict) -> dict:
    book = state.get("selected_book", {})
    reference = state.get("reference_script", "")

    llm = ChatOpenAI(
        api_key=DEEPSEEK_API_KEY,
        base_url=DEEPSEEK_BASE_URL,
        model=DEEPSEEK_MODEL,
        temperature=0.7,
        max_tokens=8192,
    )

    ref_section = f"参考示例（仅借鉴句式结构）：\n{reference}" if reference else ""

    messages = [
        SystemMessage(content=GENERATE_SYSTEM_MSG),
        HumanMessage(content=(
            f"书名：{book.get('title', '')}\n"
            f"作者：{book.get('author', '')}\n"
            f"简介：{book.get('intro', '')}\n\n"
            f"{ref_section}\n\n"
            "任务：撰写 8-15 分钟口播稿（约 2000-3500 字）。\n\n"
            "核心要求：\n"
            "1. 第三人称叙述\n"
            "2. 讲故事式转述，有起承转合\n"
            "3. 概述整本书全部章节核心内容，不局限于片段\n"
            "4. 风格由你根据书籍主旨自动判定\n"
            "5. 弱关联当前社会现实，自然融入\n"
            "6. 用 ## 章节标题 分段，标题简短有吸引力，正文纯文本\n"
            "7. 禁止编造原文不存在的情节、论点、案例\n\n"
            "叙事建议：开场钩子 → 背景铺垫 → 分章转述 → 高潮转折 → 现实映照 → 收尾升华"
        )),
    ]

    response = llm.invoke(messages)
    script = response.content.strip() + SCRIPT_ENDING
    chapters = parse_chapters(script)

    return {
        "script_draft": script,
        "script_chapters": chapters,
        "current_step": "generate_script",
    }
