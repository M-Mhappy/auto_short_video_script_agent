from langgraph.graph import StateGraph, START, END
from backend.graph.state import AgentState
from backend.graph.nodes.entry import entry_node
from backend.graph.nodes.keyword_extract import keyword_extract_node
from backend.graph.nodes.book_search import book_search_node
from backend.graph.nodes.book_confirm import book_confirm_node
from backend.graph.nodes.load_reference import load_reference_node
from backend.graph.nodes.generate_script import generate_script_node
from backend.graph.nodes.review_script import review_script_node
from backend.graph.nodes.retry_generate import retry_generate_node
from backend.graph.nodes.low_quality import low_quality_node
from backend.graph.nodes.preview_script import preview_script_node
from backend.graph.nodes.apply_feedback import apply_feedback_node
from backend.graph.nodes.export_word import export_word_node
from backend.config import (
    REVIEW_PASS_THRESHOLD,
    REVIEW_RETRY_THRESHOLD,
    MAX_RETRY_COUNT,
)


def route_after_entry(state: dict) -> str:
    if state.get("mode") == "keyword":
        return "extract_keywords"
    return "search_books"


def route_after_confirm(state: dict) -> str:
    step = state.get("current_step", "")
    if step == "research_requested":
        return "search_books"
    if step == "abandoned":
        return END
    return "load_reference"


def route_after_review(state: dict) -> str:
    review = state.get("review_result", {})
    total = review.get("total", 0)
    retry_count = state.get("retry_count", 0)

    if total >= REVIEW_PASS_THRESHOLD:
        return "preview_script"
    if total >= REVIEW_RETRY_THRESHOLD and retry_count < MAX_RETRY_COUNT:
        return "retry_generate"
    return "low_quality_decision"


def route_after_low_quality(state: dict) -> str:
    step = state.get("current_step", "")
    if step == "abandoned":
        return END
    return "preview_script"


def route_after_preview(state: dict) -> str:
    step = state.get("current_step", "")
    if step == "confirmed":
        return "export_word"
    if step == "feedback_received":
        return "apply_feedback"
    return END


def build_graph():
    builder = StateGraph(AgentState)

    builder.add_node("entry", entry_node)
    builder.add_node("extract_keywords", keyword_extract_node)
    builder.add_node("search_books", book_search_node)
    builder.add_node("confirm_book", book_confirm_node)
    builder.add_node("load_reference", load_reference_node)
    builder.add_node("generate_script", generate_script_node)
    builder.add_node("review_script", review_script_node)
    builder.add_node("retry_generate", retry_generate_node)
    builder.add_node("low_quality_decision", low_quality_node)
    builder.add_node("preview_script", preview_script_node)
    builder.add_node("apply_feedback", apply_feedback_node)
    builder.add_node("export_word", export_word_node)

    builder.add_edge(START, "entry")
    builder.add_conditional_edges("entry", route_after_entry)
    builder.add_edge("extract_keywords", "search_books")
    builder.add_edge("search_books", "confirm_book")
    builder.add_conditional_edges("confirm_book", route_after_confirm)
    builder.add_edge("load_reference", "generate_script")
    builder.add_edge("generate_script", "review_script")
    builder.add_conditional_edges("review_script", route_after_review)
    builder.add_edge("retry_generate", "generate_script")
    builder.add_conditional_edges("low_quality_decision", route_after_low_quality)
    builder.add_conditional_edges("preview_script", route_after_preview)
    builder.add_edge("apply_feedback", "preview_script")
    builder.add_edge("export_word", END)

    return builder
