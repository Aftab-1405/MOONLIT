"""Conversation summary-memory port access."""

from api_contract.conversations_protocols import ConversationSummaryMemoryWriter
from api_contract.runtime_ports import get_conversation_summary_memory_writer


def get_default_summary_memory_writer() -> ConversationSummaryMemoryWriter:
    """Return the configured summary-memory writer."""
    return get_conversation_summary_memory_writer()
