"""Runtime port registry for cross-layer dependencies.

Feature modules depend on protocol-shaped ports from ``api_contract``. Concrete
implementations are registered by the composition root during app startup.
"""

from __future__ import annotations

from typing import Any

from api_contract.conversations_protocols import (
    ConversationAgentStreamer,
    ConversationMemoryCleaner,
    ConversationSummarizationContextProvider,
    ConversationSummaryMemoryWriter,
)
from api_contract.orchestration_protocols import (
    ConversationStateReader,
    ConversationSummarizer,
    ConversationTaskStateStore,
    HistoricalContextProvider,
)


_ports: dict[str, Any] = {}


def register_port(name: str, implementation: Any) -> None:
    _ports[name] = implementation


def get_port(name: str) -> Any:
    try:
        return _ports[name]
    except KeyError as exc:
        raise RuntimeError(f"Runtime port '{name}' is not configured") from exc


def get_conversation_agent_streamer() -> ConversationAgentStreamer:
    return get_port("conversation_agent_streamer")


def get_conversation_memory_cleaner() -> ConversationMemoryCleaner:
    return get_port("conversation_memory_cleaner")


def get_conversation_summary_memory_writer() -> ConversationSummaryMemoryWriter:
    return get_port("conversation_summary_memory_writer")


def get_conversation_summarization_context_provider(
) -> ConversationSummarizationContextProvider:
    return get_port("conversation_summarization_context_provider")


def get_conversation_state_reader() -> ConversationStateReader:
    return get_port("conversation_state_reader")


def get_conversation_summarizer() -> ConversationSummarizer:
    return get_port("conversation_summarizer")


def get_conversation_task_state_store() -> ConversationTaskStateStore:
    return get_port("conversation_task_state_store")


def get_historical_context_provider() -> HistoricalContextProvider:
    return get_port("historical_context_provider")
