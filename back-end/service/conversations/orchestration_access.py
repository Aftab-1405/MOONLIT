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
    """Build a Retry policy for Firestore task-state RPCs."""
    return Retry(deadline=_TASK_STATE_RPC_TIMEOUT_SECONDS)


class ConversationOrchestrationAccess:
    """Conversation access backed by conversation services/repositories."""

    def get_conversation(self, conversation_id: str) -> dict | None:
        """Fetch the conversation document by id (no owner check)."""
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
        """Compute unsummarized-tail pressure used to schedule background summarization."""
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
        """Trigger a compaction/summarization pass on the conversation (delegates to ConversationService)."""
        return await ConversationService.check_and_summarize(
            conversation_id,
            user_id,
            model,
            pressure_budget_tokens=pressure_budget_tokens,
        )


class FirestoreConversationTaskStateStore:
    """Conversation task-state persistence backed by Firestore."""

    def _conversation_ref(self, conversation_id: str):
        """Return the Firestore DocumentReference for the given conversation."""
        db = FirestoreService.get_db()
        return db.collection("conversations").document(conversation_id)

    @staticmethod
    def _lease_is_active(data: dict, now: datetime) -> bool:
        """Return True if the task lease in ``data`` has not expired as of ``now``."""
        expires_at = data.get("task_lease_expires_at")
        return bool(expires_at and expires_at > now)

    def try_acquire_task_run(
        self,
        conversation_id: str,
        task_mode: str,
        run_id: str,
        lease_seconds: int,
    ) -> TaskRunAcquisition:
        """Acquire a task run lease via Firestore compare-and-set.

        If no active lease exists, atomically marks the conversation as
        ``running`` under ``run_id`` with a lease expiring at
        ``now + lease_seconds``. If a lease is already held by ``run_id``,
        the acquisition succeeds (re-entrant). If a lease is held by a
        different run, the acquisition fails and returns the previous
        status/mode so the caller can decide whether to abort or wait.

        Args:
            conversation_id: Target conversation id.
            task_mode: Mode to record on the run (e.g. ``normal``).
            run_id: Unique id of the run attempting to acquire the lease.
            lease_seconds: Lease duration in seconds.

        Returns:
            TaskRunAcquisition indicating success and the prior status/mode.

        Raises:
            ValueError: If the conversation document does not exist.
            RuntimeError: If the CAS retry budget is exhausted.
        """
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
        """Extend the lease for an in-flight task run owned by ``run_id``."""
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
        """Persist the latest checkpoint summary for an owned task run."""
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
        """Apply ``updates`` only if ``run_id`` still owns the task run (CAS-guarded)."""
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
        """Clear the checkpoint summary and set a fresh task mode for the run."""
        return self._update_if_owner(
            conversation_id,
            run_id,
            {"task_checkpoint_summary": "", "task_mode": task_mode},
        )

    def update_task_mode(self, conversation_id: str, task_mode: str, run_id: str) -> bool:
        """Update the task mode for an owned, in-flight task run."""
        return self._update_if_owner(
            conversation_id,
            run_id,
            {"task_mode": task_mode},
        )

    def save_paused_task(self, conversation_id: str, task_mode: str, run_id: str) -> bool:
        """Mark the task run as paused due to the step limit, clearing the lease."""
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
        """Persist an interrupted (cancelled/error) task run and clear the lease."""
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
        """Reset the conversation to idle (no task running) and clear lease fields."""
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
    """Build the ConversationStateReader port implementation."""
    return ConversationOrchestrationAccess()


def create_conversation_summarizer() -> ConversationSummarizer:
    """Build the ConversationSummarizer port implementation."""
    return ConversationOrchestrationAccess()


def create_conversation_task_state_store() -> ConversationTaskStateStore:
    """Build the ConversationTaskStateStore port implementation."""
    return FirestoreConversationTaskStateStore()
