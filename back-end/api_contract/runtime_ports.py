"""Runtime port registry for cross-layer dependencies.

Feature modules depend on protocol-shaped ports from ``api_contract``. Concrete
implementations are registered by the composition root during app startup.

FIX [AUDIT-2-D]: ``get_port`` previously swallowed ``TypeError`` raised
by ``isinstance`` against ``@runtime_checkable`` protocols, silently
returning wrong-type implementations when the protocol included
non-attribute members. The check is now skipped ONLY for the specific
``TypeError`` raised by ``isinstance`` on unsupported protocols
(message starts with ``"isinstance() argument 2 cannot be..."``); all
other ``TypeError`` instances (including the explicit one we raise on
type mismatch) now propagate.
"""

from __future__ import annotations

from typing import Any, TypeVar

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

T = TypeVar("T")

_ports: dict[str, Any] = {}


def register_port(name: str, implementation: Any) -> None:
    """Register a concrete implementation for a named port.

    Args:
        name: Port name (e.g. ``"conversation_agent_streamer"``).
        implementation: Concrete implementation instance.
    """
    _ports[name] = implementation


def get_port(name: str, expected_type: type[T] | None = None) -> T:
    """Get a registered port implementation.

    Args:
        name: Port name to retrieve.
        expected_type: Optional type check for the returned implementation.

    Returns:
        The registered implementation.

    Raises:
        RuntimeError: If the port is not configured.
        TypeError: If the implementation does not match ``expected_type``
            (and the check is supported by the runtime).
    """
    try:
        implementation = _ports[name]
    except KeyError as exc:
        raise RuntimeError(f"Runtime port '{name}' is not configured") from exc

    if expected_type is not None:
        try:
            if not isinstance(implementation, expected_type):
                raise TypeError(
                    f"Port '{name}' expected type {expected_type.__name__}, got {type(implementation).__name__}"
                )
        except TypeError as exc:
            # FIX [AUDIT-2-D]: only swallow the specific TypeError raised
            # by ``isinstance`` against a @runtime_checkable Protocol
            # that has non-attribute members. All other TypeErrors
            # (including the explicit one we just raised) propagate.
            if str(exc).startswith("isinstance() argument 2 cannot be"):
                return implementation
            raise
    return implementation


def get_conversation_agent_streamer() -> ConversationAgentStreamer:
    """Return the registered conversation agent streamer port."""
    return get_port("conversation_agent_streamer", ConversationAgentStreamer)


def get_conversation_memory_cleaner() -> ConversationMemoryCleaner:
    """Return the registered conversation memory cleaner port."""
    return get_port("conversation_memory_cleaner", ConversationMemoryCleaner)


def get_conversation_summary_memory_writer() -> ConversationSummaryMemoryWriter:
    """Return the registered conversation summary memory writer port."""
    return get_port("conversation_summary_memory_writer", ConversationSummaryMemoryWriter)


def get_conversation_summarization_context_provider() -> ConversationSummarizationContextProvider:
    """Return the registered conversation summarization context provider port."""
    return get_port(
        "conversation_summarization_context_provider",
        ConversationSummarizationContextProvider,
    )


def get_conversation_state_reader() -> ConversationStateReader:
    """Return the registered conversation state reader port."""
    return get_port("conversation_state_reader", ConversationStateReader)


def get_conversation_summarizer() -> ConversationSummarizer:
    """Return the registered conversation summarizer port."""
    return get_port("conversation_summarizer", ConversationSummarizer)


def get_conversation_task_state_store() -> ConversationTaskStateStore:
    """Return the registered conversation task-state store port."""
    return get_port("conversation_task_state_store", ConversationTaskStateStore)


def get_historical_context_provider() -> HistoricalContextProvider:
    """Return the registered historical context provider port."""
    return get_port("historical_context_provider", HistoricalContextProvider)
