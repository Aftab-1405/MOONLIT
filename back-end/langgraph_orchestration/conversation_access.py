"""Conversation access port lookup for agent orchestration."""

from api_contract.orchestration_protocols import (
    ConversationStateReader,
    ConversationSummarizer,
)
from api_contract.runtime_ports import (
    get_conversation_state_reader as _get_conversation_state_reader,
    get_conversation_summarizer as _get_conversation_summarizer,
)


def get_default_conversation_state_reader() -> ConversationStateReader:
    """Return the configured conversation state reader."""
    return _get_conversation_state_reader()


def get_default_conversation_summarizer() -> ConversationSummarizer:
    """Return the configured conversation summarizer."""
    return _get_conversation_summarizer()


def get_default_conversation_access() -> ConversationStateReader:
    """Return the configured conversation access adapter."""
    return _get_conversation_state_reader()
