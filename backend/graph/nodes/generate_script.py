from langchain_core.messages import SystemMessage, HumanMessage
from backend.config import SCRIPT_ENDING
from backend.llm import get_llm
from backend.prompts.templates import GENERATE_SCRIPT_PROMPT
from backend.tools.chapters import parse_chapters

GENERATE_SYSTEM_MSG = (
    "你是一位资深短视频口播稿撰稿人，擅长将书籍内容转化为讲故事式口播稿。"
    "用 ## 章节标题 分段输出，每章一行二级标题，标题下为正文纯文本。"
    "直接输出口播稿全文，不要加任何额外说明。"
)


def generate_script_node(state: dict) -> dict:
    book = state.get("selected_book", {})
    reference = state.get("reference_script", "")

    llm = get_llm(temperature=0.7)

    prompt = GENERATE_SCRIPT_PROMPT.format(
        book_title=book.get("title", ""),
        book_author=book.get("author", ""),
        book_intro=book.get("intro", ""),
        reference_script=reference or "无",
    )

    messages = [
        SystemMessage(content=GENERATE_SYSTEM_MSG),
        HumanMessage(content=prompt),
    ]

    response = llm.invoke(messages)
    script = response.content.strip() + SCRIPT_ENDING
    chapters = parse_chapters(script)

    return {
        "script_draft": script,
        "script_chapters": chapters,
        "current_step": "generate_script",
    }
