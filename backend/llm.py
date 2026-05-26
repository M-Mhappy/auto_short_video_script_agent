"""Centralized LLM client factory."""

from langchain_openai import ChatOpenAI
from backend.config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL


def get_llm(temperature: float = 0.7, max_tokens: int = 8192) -> ChatOpenAI:
    return ChatOpenAI(
        api_key=DEEPSEEK_API_KEY,
        base_url=DEEPSEEK_BASE_URL,
        model=DEEPSEEK_MODEL,
        temperature=temperature,
        max_tokens=max_tokens,
    )
