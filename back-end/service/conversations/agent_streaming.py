"""Agent streaming port access for conversations."""

from api_contract.conversations_protocols import ConversationAgentStreamer
from api_contract.runtime_ports import get_conversation_agent_streamer

def get_default_agent_streamer() -> ConversationAgentStreamer:
    """Return the configured agent streamer for conversations."""
    return get_conversation_agent_streamer()
