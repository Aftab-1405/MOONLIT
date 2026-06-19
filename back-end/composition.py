"""Application composition root.

This is the only module that wires concrete implementations across major
backend layers. Feature modules should depend on ports from ``api_contract``.
"""

from api_contract.runtime_ports import register_port
from langgraph_orchestration.conversation_streamer import (
    LangGraphConversationAgentStreamer,
)
from langgraph_orchestration.summarization_context import (
    create_summarization_context_provider,
)
from service.conversations.orchestration_access import (
    create_conversation_state_reader,
    create_conversation_summarizer,
    create_conversation_task_state_store,
)
from vamp_memory.conversation_ports import (
    create_conversation_memory_cleaner,
    create_conversation_summary_memory_writer,
)
from vamp_memory.orchestration_provider import create_historical_context_provider


def configure_runtime_ports() -> None:
    """Register default concrete implementations for runtime ports."""
    register_port(
        "conversation_agent_streamer",
        LangGraphConversationAgentStreamer(),
    )
    register_port(
        "conversation_memory_cleaner",
        create_conversation_memory_cleaner(),
    )
    register_port(
        "conversation_summary_memory_writer",
        create_conversation_summary_memory_writer(),
    )
    register_port(
        "conversation_summarization_context_provider",
        create_summarization_context_provider(),
    )
    register_port(
        "conversation_state_reader",
        create_conversation_state_reader(),
    )
    register_port(
        "conversation_summarizer",
        create_conversation_summarizer(),
    )
    register_port(
        "conversation_task_state_store",
        create_conversation_task_state_store(),
    )
    register_port(
        "historical_context_provider",
        create_historical_context_provider(),
    )
