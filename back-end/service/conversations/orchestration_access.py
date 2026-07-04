"""Conversation ports exposed to orchestration."""

from datetime import datetime, timedelta, timezone

from firebase_admin import firestore
from google.api_core.exceptions import Aborted, FailedPrecondition
from google.api_core.retry import Retry
from google.cloud.firestore_v1 import LastUpdateOption

from api_contract.orchestration_protocols import (
    ConversationStateReader,
    ConversationSummarizer,
    ConversationTaskStateStore,
    TaskRunAcquisition,
)
from service.conversations.conversation_repository import ConversationRepository
from service.conversations.conversation_service import ConversationService
from service.firestore.firestore_service import FirestoreService

_TASK_STATE_RPC_TIMEOUT_SECONDS = 8.0
_TASK_STATE_CAS_ATTEMPTS = 3


def _task_state_retry() -> Retry:
    return Retry(deadline=_TASK_STATE_RPC_TIMEOUT_SECONDS)


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
        model_id: str | None = None,
    ) -> dict:
        from service.conversations.conversation_compaction_service import (
            _get_background_summary_pressure,
        )

        return _get_background_summary_pressure(
            conv_data,
            new_messages=new_messages,
            assistant_message=assistant_message,
            pressure_budget_tokens=pressure_budget_tokens,
            model_id=model_id,
        )

    async def check_and_summarize(
        self,
        conversation_id: str,
        user_id: str,
        model: str | None = None,
        pressure_budget_tokens: int | None = None,
    ) -> dict:
        return await ConversationService.check_and_summarize(
            conversation_id,
            user_id,
            model,
            pressure_budget_tokens=pressure_budget_tokens,
        )


class FirestoreConversationTaskStateStore:
    """Conversation task-state persistence backed by Firestore."""

    def _conversation_ref(self, conversation_id: str):
        db = FirestoreService.get_db()
        return db.collection("conversations").document(conversation_id)

    @staticmethod
    def _lease_is_active(data: dict, now: datetime) -> bool:
        expires_at = data.get("task_lease_expires_at")
        return bool(expires_at and expires_at > now)

    def try_acquire_task_run(
        self,
        conversation_id: str,
        task_mode: str,
        run_id: str,
        lease_seconds: int,
    ) -> TaskRunAcquisition:
        ref = self._conversation_ref(conversation_id)
        for _attempt in range(_TASK_STATE_CAS_ATTEMPTS):
            now = datetime.now(timezone.utc)
            snapshot = ref.get(
                retry=_task_state_retry(),
                timeout=_TASK_STATE_RPC_TIMEOUT_SECONDS,
            )
            data = snapshot.to_dict() if snapshot.exists else {}
            previous_status = data.get("task_status", "")
            previous_task_mode = data.get("task_mode", "normal") or "normal"
            if data.get("task_status") == "running" and self._lease_is_active(data, now):
                if data.get("task_run_id") == run_id:
                    return TaskRunAcquisition(
                        True,
                        data.get("task_run_previous_status", ""),
                        data.get("task_run_previous_mode", "normal") or "normal",
                    )
                return TaskRunAcquisition(False, previous_status, previous_task_mode)
            if not snapshot.exists:
                raise ValueError(f"Conversation {conversation_id} does not exist")
            try:
                ref.update(
                    {
                        "task_status": "running",
                        "task_mode": task_mode,
                        "task_run_id": run_id,
                        "task_run_previous_status": previous_status,
                        "task_run_previous_mode": previous_task_mode,
                        "task_status_updated_at": now,
                        "task_lease_expires_at": now + timedelta(seconds=max(1, lease_seconds)),
                    },
                    option=LastUpdateOption(snapshot.update_time),
                    retry=_task_state_retry(),
                    timeout=_TASK_STATE_RPC_TIMEOUT_SECONDS,
                )
                return TaskRunAcquisition(True, previous_status, previous_task_mode)
            except (Aborted, FailedPrecondition):
                continue
        raise RuntimeError("Could not acquire task lease after concurrent updates")

    def renew_task_run(self, conversation_id: str, run_id: str, lease_seconds: int) -> bool:
        now = datetime.now(timezone.utc)
        return self._update_if_owner(
            conversation_id,
            run_id,
            {
                "task_status_updated_at": now,
                "task_lease_expires_at": now + timedelta(seconds=max(1, lease_seconds)),
            },
            require_running=True,
        )

    def update_task_checkpoint_summary(self, conversation_id: str, summary: str, run_id: str) -> bool:
        return self._update_if_owner(
            conversation_id,
            run_id,
            {"task_checkpoint_summary": summary},
        )

    def _update_if_owner(
        self,
        conversation_id: str,
        run_id: str,
        updates: dict,
        *,
        require_running: bool = False,
    ) -> bool:
        ref = self._conversation_ref(conversation_id)
        for _attempt in range(_TASK_STATE_CAS_ATTEMPTS):
            snapshot = ref.get(
                retry=_task_state_retry(),
                timeout=_TASK_STATE_RPC_TIMEOUT_SECONDS,
            )
            data = snapshot.to_dict() if snapshot.exists else {}
            if data.get("task_run_id") != run_id:
                return False
            if require_running and data.get("task_status") != "running":
                return False
            try:
                ref.update(
                    updates,
                    option=LastUpdateOption(snapshot.update_time),
                    retry=_task_state_retry(),
                    timeout=_TASK_STATE_RPC_TIMEOUT_SECONDS,
                )
                return True
            except (Aborted, FailedPrecondition):
                continue
        raise RuntimeError("Could not update task lease after concurrent updates")

    def reset_task_checkpoint(self, conversation_id: str, task_mode: str, run_id: str) -> bool:
        return self._update_if_owner(
            conversation_id,
            run_id,
            {"task_checkpoint_summary": "", "task_mode": task_mode},
        )

    def update_task_mode(self, conversation_id: str, task_mode: str, run_id: str) -> bool:
        return self._update_if_owner(
            conversation_id,
            run_id,
            {"task_mode": task_mode},
        )

    def save_paused_task(self, conversation_id: str, task_mode: str, run_id: str) -> bool:
        return self._update_if_owner(
            conversation_id,
            run_id,
            {
                "task_status": "paused_step_limit",
                "task_mode": task_mode,
                "task_status_updated_at": datetime.now(timezone.utc),
                "task_run_id": firestore.DELETE_FIELD,
                "task_lease_expires_at": firestore.DELETE_FIELD,
                "task_run_previous_status": firestore.DELETE_FIELD,
                "task_run_previous_mode": firestore.DELETE_FIELD,
            },
        )

    def save_interrupted_task(self, conversation_id: str, task_mode: str, reason: str, run_id: str) -> bool:
        safe_reason = reason if reason in {"cancelled", "error"} else "error"
        return self._update_if_owner(
            conversation_id,
            run_id,
            {
                "task_status": f"paused_{safe_reason}",
                "task_mode": task_mode,
                "task_status_updated_at": datetime.now(timezone.utc),
                "task_run_id": firestore.DELETE_FIELD,
                "task_lease_expires_at": firestore.DELETE_FIELD,
                "task_run_previous_status": firestore.DELETE_FIELD,
                "task_run_previous_mode": firestore.DELETE_FIELD,
            },
        )

    def clear_task_status(self, conversation_id: str, task_mode: str, run_id: str) -> bool:
        return self._update_if_owner(
            conversation_id,
            run_id,
            {
                "task_status": "",
                "task_mode": task_mode,
                "task_run_id": firestore.DELETE_FIELD,
                "task_lease_expires_at": firestore.DELETE_FIELD,
                "task_run_previous_status": firestore.DELETE_FIELD,
                "task_run_previous_mode": firestore.DELETE_FIELD,
            },
        )


def create_conversation_state_reader() -> ConversationStateReader:
    return ConversationOrchestrationAccess()


def create_conversation_summarizer() -> ConversationSummarizer:
    return ConversationOrchestrationAccess()


def create_conversation_task_state_store() -> ConversationTaskStateStore:
    return FirestoreConversationTaskStateStore()
