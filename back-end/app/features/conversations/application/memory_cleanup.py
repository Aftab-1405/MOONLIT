"""Conversation memory cleanup adapters."""

import asyncio
import threading

from app.features.conversations.domain.protocols import ConversationMemoryCleaner


class VampConversationMemoryCleaner:
    """Conversation memory cleaner backed by the VAMP memory feature."""

    async def delete_conversation_pointers(
        self, conversation_id: str, user_id: str
    ) -> None:
        from app.features.vamp_memory.application.vamp_memory_service import (
            VampMemoryService,
        )

        await VampMemoryService().delete_conversation_pointers(conversation_id, user_id)


def run_memory_cleanup_sync(
    cleaner: ConversationMemoryCleaner, conversation_id: str, user_id: str
) -> None:
    """Run an async memory-cleanup port from synchronous application code."""
    error_wrapper: list[BaseException] = []

    def _delete_pointers():
        try:
            asyncio.run(cleaner.delete_conversation_pointers(conversation_id, user_id))
        except BaseException as exc:
            error_wrapper.append(exc)

    thread = threading.Thread(target=_delete_pointers)
    thread.start()
    thread.join()

    if error_wrapper:
        raise error_wrapper[0]


def get_default_memory_cleaner() -> ConversationMemoryCleaner:
    """Return the configured conversation memory cleaner."""
    return VampConversationMemoryCleaner()
