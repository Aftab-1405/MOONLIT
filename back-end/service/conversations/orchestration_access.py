"""Conversation ports exposed to orchestration."""

from api_contract.orchestration_protocols import (
    ConversationStateReader,
    ConversationSummarizer,
    ConversationTaskStateStore,
)
from service.conversations.conversation_repository import ConversationRepository
from service.conversations.conversation_service import ConversationService
from service.firestore.firestore_service import FirestoreService


class ConversationOrchestrationAccess:
    """Conversation access backed by conversation services/repositories."""

    def get_conversation(self, conversation_id: str) -> dict | None:
        return ConversationRepository.get(conversation_id)

    def get_background_summary_pressure(
        self,
        conv_data: dict | None,
        *,
        new_messages: list[dict] | None = None,
        assistant_message: dict | None = None,
        pressure_budget_tokens: int | None = None,
    ) -> dict:
        from service.conversations.conversation_service import (
            _get_background_summary_pressure,
        )

        return _get_background_summary_pressure(
            conv_data,
            new_messages=new_messages,
            assistant_message=assistant_message,
            pressure_budget_tokens=pressure_budget_tokens,
        )

    async def check_and_summarize(
        self,
        conversation_id: str,
        user_id: str,
        model: str | None = None,
        thread_id: str | None = None,
    ) -> None:
        await ConversationService.check_and_summarize(
            conversation_id,
            user_id,
            model,
            thread_id=thread_id,
        )


class FirestoreConversationTaskStateStore:
    """Conversation task-state persistence backed by Firestore."""

    def _conversation_ref(self, conversation_id: str):
        db = FirestoreService.get_db()
        return db.collection("conversations").document(conversation_id)

    def get_task_status(self, conversation_id: str) -> str:
        snap = self._conversation_ref(conversation_id).get()
        return snap.to_dict().get("task_status", "") if snap.exists else ""

    def update_task_checkpoint_summary(
        self, conversation_id: str, summary: str
    ) -> None:
        self._conversation_ref(conversation_id).update(
            {"task_checkpoint_summary": summary}
        )

    def reset_task_checkpoint(self, conversation_id: str, task_mode: str) -> None:
        self._conversation_ref(conversation_id).update(
            {
                "task_checkpoint_summary": "",
                "task_status": "",
                "task_mode": task_mode,
            }
        )

    def save_paused_task(self, conversation_id: str, task_mode: str) -> None:
        self._conversation_ref(conversation_id).update(
            {
                "task_status": "paused_step_limit",
                "task_mode": task_mode,
            }
        )

    def clear_task_status(self, conversation_id: str, task_mode: str) -> None:
        self._conversation_ref(conversation_id).update(
            {
                "task_status": "",
                "task_mode": task_mode,
            }
        )


def create_conversation_state_reader() -> ConversationStateReader:
    return ConversationOrchestrationAccess()


def create_conversation_summarizer() -> ConversationSummarizer:
    return ConversationOrchestrationAccess()


def create_conversation_task_state_store() -> ConversationTaskStateStore:
    return FirestoreConversationTaskStateStore()
