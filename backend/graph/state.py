from __future__ import annotations

from typing import TypedDict, Optional
from langgraph.graph import MessagesState


class BookInfo(TypedDict):
    title: str
    author: str
    intro: str
    relevance_reason: str


class ReviewResult(TypedDict):
    fact_accuracy: int
    fidelity: int
    completeness: int
    style_consistency: int
    total: int
    reasoning: str
    hallucinations: list[str]
    omissions: list[str]


class AgentState(MessagesState):
    mode: str  # "keyword" | "direct"
    user_input: str
    keywords: list[str]
    search_results: list[BookInfo]
    selected_book: Optional[BookInfo]
    reference_script: str
    script_draft: str
    review_result: Optional[ReviewResult]
    retry_count: int
    user_feedback: str
    current_step: str
    search_retry_count: int
    previous_search_titles: list[str]
    word_file_path: str
    error: str
