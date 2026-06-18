"""Conversation summary-memory adapters."""

from app.features.conversations.domain.protocols import ConversationSummaryMemoryWriter


class VampConversationSummaryMemoryWriter:
    """Summary-memory writer backed by the VAMP memory feature."""

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
        from app.features.vamp_memory.application.vamp_memory_service import (
            VampMemoryService,
        )

        return await VampMemoryService().store_summary_block(
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


def get_default_summary_memory_writer() -> ConversationSummaryMemoryWriter:
    """Return the configured summary-memory writer."""
    return VampConversationSummaryMemoryWriter()
