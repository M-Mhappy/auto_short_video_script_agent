import os
import uuid
from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from backend.config import WORD_OUTPUT_DIR


def export_word_node(state: dict) -> dict:
    script = state.get("script_draft", "")
    book = state.get("selected_book", {})
    title = book.get("title", "口播稿")
    author = book.get("author", "")

    os.makedirs(WORD_OUTPUT_DIR, exist_ok=True)

    doc = Document()

    style = doc.styles["Normal"]
    font = style.font
    font.name = "微软雅黑"
    font.size = Pt(12)
    style.paragraph_format.line_spacing = 1.5

    heading = doc.add_heading(f"《{title}》口播稿", level=1)
    heading.alignment = WD_ALIGN_PARAGRAPH.CENTER

    if author:
        sub = doc.add_paragraph(f"原著：{author}")
        sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
        sub.runs[0].font.size = Pt(10)

    doc.add_paragraph("")

    paragraphs = script.split("\n")
    for para_text in paragraphs:
        stripped = para_text.strip()
        if stripped:
            doc.add_paragraph(stripped)

    filename = f"{title}_口播稿_{uuid.uuid4().hex[:8]}.docx"
    filepath = os.path.join(WORD_OUTPUT_DIR, filename)
    doc.save(filepath)

    return {
        "word_file_path": filepath,
        "current_step": "export_word",
    }
