"""
Conversation Service - Handles conversation management. Delegates AI streaming to
ConversationStreamingService and historical logs compaction to ConversationCompactionService.
"""

import logging
import uuid
from typing import AsyncGenerator, Optional

from service.conversations.conversation_streaming_service import ConversationStreamingService
from service.conversations.conversation_compaction_service import ConversationCompactionService

logger = logging.getLogger(__name__)


class ConversationService:
    """Service for managing conversations and AI interactions (facade)."""

    # ── Conversation CRUD ────────────────────────────────────────────

    @staticmethod
    def create_or_get_conversation_id(provided_id: Optional[str] = None) -> str:
        if provided_id:
            return provided_id
        return str(uuid.uuid4())

    @staticmethod
    def get_conversation_data(conversation_id: str, user_id: str) -> Optional[dict]:
        from service.conversations.conversation_repository import (
            ConversationRepository,
        )

        return ConversationRepository.get_for_user(conversation_id, user_id)

    @staticmethod
    def verify_conversation_owner(conversation_id: str, user_id: str) -> bool:
        from service.conversations.conversation_repository import (
            ConversationRepository,
        )

        return ConversationRepository.verify_owner(conversation_id, user_id)

    @staticmethod
    def delete_user_conversation(conversation_id: str, user_id: str) -> None:
        from service.conversations.conversation_repository import (
            ConversationRepository,
        )
        from service.conversations.vector_memory_cleanup import (
            get_default_memory_cleaner,
            run_memory_cleanup_sync,
        )

        if ConversationRepository.get_for_user(conversation_id, user_id) is None:
            raise ValueError("Conversation not found")

        memory_cleaner = get_default_memory_cleaner()
        try:
            run_memory_cleanup_sync(memory_cleaner, conversation_id, user_id)
        except Exception as cleanup_err:
            logger.warning(
                "Failed to clean up external memory during conversation delete: %s",
                cleanup_err,
            )
            ConversationRepository.create_memory_cleanup_retry(
                conversation_id, user_id, cleanup_err
            )

        ConversationRepository.delete(conversation_id, user_id)

    @staticmethod
    def retry_external_memory_cleanups() -> int:
        from service.conversations.conversation_repository import (
            ConversationRepository,
        )
        from service.conversations.vector_memory_cleanup import (
            get_default_memory_cleaner,
        )

        return ConversationRepository.retry_qdrant_cleanups(
            get_default_memory_cleaner()
        )

    @staticmethod
    def rename_user_conversation(conversation_id: str, user_id: str, title: str) -> str:
        from service.conversations.conversation_repository import (
            ConversationRepository,
        )

        return ConversationRepository.rename(conversation_id, user_id, title)

    @staticmethod
    def get_user_conversations(user_id: str) -> list:
        from service.conversations.conversation_repository import (
            ConversationRepository,
        )

        return ConversationRepository.get_by_user(user_id)

    # ── AI Streaming Delegation ──────────────────────────────────────

    @staticmethod
    def create_streaming_generator(
        conversation_id: str,
        prompt: str | None,
        user_id: str,
        db_config: dict = None,
        enable_reasoning: bool = True,
        reasoning_effort: str = "medium",
        response_style: str = "balanced",
        max_rows: int = None,
        api_key: str = None,
        provider: str | None = None,
        model: str | None = None,
        resume: dict | None = None,
        task_mode: str = "normal",
    ) -> AsyncGenerator[str, None]:
        return ConversationStreamingService.create_streaming_generator(
            conversation_id=conversation_id,
            prompt=prompt,
            user_id=user_id,
            db_config=db_config,
            enable_reasoning=enable_reasoning,
            reasoning_effort=reasoning_effort,
            response_style=response_style,
            max_rows=max_rows,
            api_key=api_key,
            provider=provider,
            model=model,
            resume=resume,
            task_mode=task_mode,
        )

    @staticmethod
    def get_streaming_headers(conversation_id: str) -> dict:
        return ConversationStreamingService.get_streaming_headers(conversation_id)

    @staticmethod
    def check_quota_error(error_message: str) -> bool:
        return ConversationStreamingService.check_quota_error(error_message)

    # ── AI History Compaction Delegation ─────────────────────────────

    @staticmethod
    async def check_and_summarize(
        conversation_id: str,
        user_id: str,
        model: str = None,
        *,
        pressure_budget_tokens: int | None = None,
    ) -> dict:
        return await ConversationCompactionService.check_and_summarize(
            conversation_id=conversation_id,
            user_id=user_id,
            model=model,
            pressure_budget_tokens=pressure_budget_tokens,
        )
