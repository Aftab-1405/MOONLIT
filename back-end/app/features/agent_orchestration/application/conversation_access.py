"""Conversation feature access adapters for agent orchestration."""

from app.features.agent_orchestration.domain.protocols import (
    ConversationStateReader,
    ConversationSummarizer,
)


class ConversationFeatureAccess:
    """Conversation access backed by the conversations feature."""

    def get_conversation(self, conversation_id: str) -> dict | None:
        from app.features.conversations.infrastructure.conversation_repository import (
            ConversationRepository,
        )

        return ConversationRepository.get(conversation_id)

    async def check_and_summarize(
        self,
        conversation_id: str,
        user_id: str,
        model: str | None = None,
        thread_id: str | None = None,
    ) -> None:
        from app.features.conversations.application.conversation_service import (
            ConversationService,
        )

        await ConversationService.check_and_summarize(
            conversation_id,
            user_id,
            model,
            thread_id=thread_id,
        )


def get_default_conversation_state_reader() -> ConversationStateReader:
    """Return the configured conversation state reader."""
    return ConversationFeatureAccess()


def get_default_conversation_summarizer() -> ConversationSummarizer:
    """Return the configured conversation summarizer."""
    return ConversationFeatureAccess()


def get_default_conversation_access() -> ConversationFeatureAccess:
    """Return the configured conversation access adapter."""
    return ConversationFeatureAccess()
