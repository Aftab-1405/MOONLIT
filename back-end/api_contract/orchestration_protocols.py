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

    def get_background_summary_pressure(
        self,
        conv_data: dict | None,
        *,
        new_messages: list[dict] | None = None,
        assistant_message: dict | None = None,
        pressure_budget_tokens: int | None = None,
    ) -> dict:
        """Return cheap unsummarized-tail pressure used by summary scheduling."""

    async def check_and_summarize(
        self,
        conversation_id: str,
        user_id: str,
        model: str | None = None,
        thread_id: str | None = None,
    ) -> None:
        """Summarize conversation history when needed."""


class ConversationTaskStateStore(Protocol):
    """Port for task-mode state persisted with a conversation."""

    def get_task_status(self, conversation_id: str) -> str:
        """Return the current task status for a conversation."""

    def update_task_checkpoint_summary(
        self, conversation_id: str, summary: str
    ) -> None:
        """Persist the task checkpoint summary."""

    def reset_task_checkpoint(self, conversation_id: str, task_mode: str) -> None:
        """Clear task checkpoint state for a new turn."""

    def save_paused_task(self, conversation_id: str, task_mode: str) -> None:
        """Persist paused task state after an orchestration step limit."""

    def clear_task_status(self, conversation_id: str, task_mode: str) -> None:
        """Clear task status after successful completion."""
