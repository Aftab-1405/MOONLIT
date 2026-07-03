"""
Vector Memory Cleanup Adapter - Deletes Qdrant vector embeddings associated with a conversation
upon its deletion, ensuring security, privacy, and prevention of orphaned memory.
"""

import asyncio
import threading

from api_contract.conversations_protocols import ConversationMemoryCleaner
from api_contract.runtime_ports import get_conversation_memory_cleaner


def run_memory_cleanup_sync(
    cleaner: ConversationMemoryCleaner, conversation_id: str, user_id: str
) -> None:
    """
    Run the asynchronous vector memory cleanup (Qdrant collection/document deletion)
    from a synchronous application block by spawning a worker thread with its own event loop.
    """
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
    """Return the configured conversation vector memory cleaner (Qdrant connection wrapper)."""
    return get_conversation_memory_cleaner()
