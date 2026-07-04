"""Conversation ports backed by VAMP memory."""

from api_contract.conversations_protocols import (
    ConversationMemoryCleaner,
    ConversationSummaryMemoryWriter,
)
from vamp_memory.vamp_memory_service import get_vamp_memory_service


class VampConversationMemoryCleaner:
    """Conversation memory cleaner backed by VAMP memory."""

    async def delete_conversation_pointers(self, conversation_id: str, user_id: str) -> None:
        await get_vamp_memory_service().delete_conversation_pointers(conversation_id, user_id)


class VampConversationSummaryMemoryWriter:
    """Summary-memory writer backed by VAMP memory."""

    async def store_summary_block(
        self,
        conversation_id: str,
        user_id: str,
        *,
        text: str,
        start_message_idx: int,
        end_message_idx: int,
        memory_bullets: list[dict] | None = None,
        covers_from_turn: int | None = None,
        covers_to_turn: int | None = None,
        covers_message_ids: list | None = None,
        created_from_unsummarized_tail: bool = True,
    ) -> dict:
        return await get_vamp_memory_service().store_summary_block(
            conversation_id,
            user_id,
            text=text,
            start_message_idx=start_message_idx,
            end_message_idx=end_message_idx,
            memory_bullets=memory_bullets,
            covers_from_turn=covers_from_turn,
            covers_to_turn=covers_to_turn,
            covers_message_ids=covers_message_ids,
            created_from_unsummarized_tail=created_from_unsummarized_tail,
        )


def create_conversation_memory_cleaner() -> ConversationMemoryCleaner:
    return VampConversationMemoryCleaner()


def create_conversation_summary_memory_writer() -> ConversationSummaryMemoryWriter:
    return VampConversationSummaryMemoryWriter()
