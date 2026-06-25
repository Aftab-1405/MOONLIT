"""Runtime port registry for cross-layer dependencies.

Feature modules depend on protocol-shaped ports from ``api_contract``. Concrete
implementations are registered by the composition root during app startup.
"""

from __future__ import annotations

from typing import Any, TypeVar, Protocol as TypingProtocol

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


T = TypeVar('T')

_ports: dict[str, Any] = {}


def register_port(name: str, implementation: Any) -> None:
    """Register a concrete implementation for a named port."""
    _ports[name] = implementation


def get_port(name: str, expected_type: type[T] | None = None) -> T:
    """Get a registered port implementation.
    
    Args:
        name: Port name to retrieve
        expected_type: Optional type check for the returned implementation
    
    Returns:
        The registered implementation
    
    Raises:
        RuntimeError: If port is not configured
        TypeError: If implementation doesn't match expected type
    """
    try:
        implementation = _ports[name]
        if expected_type is not None:
            try:
                if not isinstance(implementation, expected_type):
                    raise TypeError(
                        f"Port '{name}' expected type {expected_type.__name__}, "
                        f"got {type(implementation).__name__}"
                    )
            except TypeError:
                # Some generic protocols or older Python versions don't support isinstance()
                # even with @runtime_checkable. We safely ignore the check in those cases.
                pass
        return implementation
    except KeyError as exc:
        raise RuntimeError(f"Runtime port '{name}' is not configured") from exc


def get_conversation_agent_streamer() -> ConversationAgentStreamer:
    return get_port("conversation_agent_streamer", ConversationAgentStreamer)


def get_conversation_memory_cleaner() -> ConversationMemoryCleaner:
    return get_port("conversation_memory_cleaner", ConversationMemoryCleaner)


def get_conversation_summary_memory_writer() -> ConversationSummaryMemoryWriter:
    return get_port("conversation_summary_memory_writer", ConversationSummaryMemoryWriter)


def get_conversation_summarization_context_provider(
) -> ConversationSummarizationContextProvider:
    return get_port(
        "conversation_summarization_context_provider",
        ConversationSummarizationContextProvider
    )


def get_conversation_state_reader() -> ConversationStateReader:
    return get_port("conversation_state_reader", ConversationStateReader)


def get_conversation_summarizer() -> ConversationSummarizer:
    return get_port("conversation_summarizer", ConversationSummarizer)


def get_conversation_task_state_store() -> ConversationTaskStateStore:
    return get_port("conversation_task_state_store", ConversationTaskStateStore)


def get_historical_context_provider() -> HistoricalContextProvider:
    return get_port("historical_context_provider", HistoricalContextProvider)
