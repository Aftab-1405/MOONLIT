"""Summarization context exposed by LangGraph orchestration."""

from typing import Any

from api_contract.conversations_protocols import (
    ConversationSummarizationContextProvider,
)
from langgraph_orchestration.prompt_builder import PromptBuilder
from langgraph_orchestration.tools import ALL_TOOLS


class LangGraphSummarizationContextProvider:
    """Prompt/tool metadata used by conversation summarization budgeting."""

    def build_system_prompt(self, response_style: str = "balanced") -> str:
        """Return the summarization system prompt for the given style."""
        return PromptBuilder.build_system_prompt(response_style)

    def get_tools(self) -> list[Any]:
        """Return a copy of the tool list exposed to the summarization agent."""
        return list(ALL_TOOLS)


def create_summarization_context_provider() -> ConversationSummarizationContextProvider:
    """Build the default LangGraph-backed summarization context provider."""
    return LangGraphSummarizationContextProvider()
