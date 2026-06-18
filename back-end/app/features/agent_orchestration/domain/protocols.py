"""Agent orchestration protocols."""

from typing import Protocol


class HistoricalContextProvider(Protocol):
    """Port for retrieving historical context for an agent turn."""

    async def retrieve_context(
        self, conversation_id: str, user_id: str, user_prompt: str
    ) -> str:
        """Return formatted historical context relevant to the prompt."""


class ConversationStateReader(Protocol):
    """Port for reading persisted conversation state."""

    def get_conversation(self, conversation_id: str) -> dict | None:
        """Return a conversation document by id."""


class ConversationSummarizer(Protocol):
    """Port for updating conversation summaries before orchestration."""

    async def check_and_summarize(
        self,
        conversation_id: str,
        user_id: str,
        model: str | None = None,
        thread_id: str | None = None,
    ) -> None:
        """Summarize conversation history when needed."""
