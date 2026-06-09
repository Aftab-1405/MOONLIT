"""Helpers for reading LangGraph checkpoint state."""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def get_thread_message_count(thread_id: str) -> int:
    """Return the number of messages stored in a checkpoint thread, or 0."""
    try:
        from agent.checkpointing import get_checkpointer

        checkpointer = get_checkpointer()
        result = await checkpointer.aget_tuple(
            {"configurable": {"thread_id": thread_id}}
        )
        if result is None:
            return 0

        channel_values = result.checkpoint.get("channel_values") or {}
        messages = channel_values.get("messages") or []
        return len(messages)
    except Exception as exc:
        logger.warning(
            "Could not read checkpoint message count for %s: %s",
            thread_id,
            exc,
        )
        return 0
