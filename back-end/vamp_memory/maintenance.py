"""Periodic durable maintenance for VAMP vector pointers.

The maintenance loop runs in the main event loop, started by ``main.py``'s
lifespan startup. Every ``VAMP_MAINTENANCE_INTERVAL_SECONDS`` (default ~30s)
it performs two independent jobs:

1. **Vector-index retry** — re-embeds summary blocks in ``pending`` /
   ``partial`` / due-``failed`` ``vector_status`` (selected by
   ``SummaryBlockRepository.get_vector_retry_blocks``). Each block is fed
   back through ``VampMemoryService._index_with_failure_record`` which
   either flips it to ``indexed``/``partial`` or atomically increments
   ``vector_attempts`` (and transitions to ``dead`` after
   ``MAX_VECTOR_ATTEMPTS`` — see ``summary_block_repository.py``).

2. **Pointer cleanup retry** — re-attempts Qdrant pointer deletion for
   conversations whose Firestore docs are already gone. The cleanup queue
   lives in a separate Firestore collection (``qdrant_conversation_cleanup``)
   and is drained by ``ConversationService.retry_external_memory_cleanups``.

Failure isolation
-----------------
The two jobs are independent: a transient Firestore outage in one must NOT
suppress the other. ``run_vamp_maintenance_pass`` wraps each job in its own
``try/except`` and counts failures. ``run_vamp_maintenance`` then applies an
exponential backoff (capped at ``VAMP_MAINTENANCE_MAX_BACKOFF_SECONDS``) on
consecutive failed passes so an infrastructure outage doesn't hammer Firestore
at 30s intervals.

Shutdown
--------
``run_vamp_maintenance`` cooperatively polls the ``stop`` event between passes.
``main.py``'s lifespan shutdown sets ``stop`` and cancels the task, then calls
``VampMemoryService.aclose`` to drain any in-flight background index tasks
(FIX [M30]).
"""

from __future__ import annotations

import asyncio
import logging

logger = logging.getLogger(__name__)


def _is_transient_firestore_error(exc: Exception) -> bool:
    """Return ``True`` for Firestore errors that warrant a retry/backoff."""
    try:
        from google.api_core import exceptions as google_exceptions

        return isinstance(
            exc,
            (
                google_exceptions.DeadlineExceeded,
                google_exceptions.ServiceUnavailable,
                google_exceptions.TooManyRequests,
                google_exceptions.ResourceExhausted,
            ),
        )
    except ImportError:
        return False


def _log_job_failure(job: str, exc: Exception) -> None:
    """Log a maintenance-job failure, downgrading transient Firestore errors to warning."""
    if _is_transient_firestore_error(exc):
        logger.warning("VAMP %s deferred after transient Firestore error: %s", job, exc)
    else:
        logger.error(
            "VAMP %s failed: %s",
            job,
            exc,
            exc_info=(type(exc), exc, exc.__traceback__),
        )


async def run_vamp_maintenance_pass(memory_service, cleanup_callback) -> tuple[int, int, int]:
    """Run independent retry jobs; one outage must not suppress the other job."""
    indexed = 0
    cleaned = 0
    failures = 0
    try:
        indexed = await memory_service.retry_pending_indexes()
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        failures += 1
        _log_job_failure("vector-index retry", exc)

    try:
        cleaned = await asyncio.to_thread(cleanup_callback)
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        failures += 1
        _log_job_failure("pointer-cleanup retry", exc)

    return indexed, cleaned, failures


async def _wait_or_stop(stop: asyncio.Event, seconds: float) -> bool:
    """Sleep for ``seconds`` unless ``stop`` is set first; return ``True`` if stopped."""
    try:
        await asyncio.wait_for(stop.wait(), timeout=max(0.0, seconds))
        return True
    except TimeoutError:
        return False


async def run_vamp_maintenance(stop: asyncio.Event, interval_seconds: int) -> None:
    """Retry due indexes and orphan cleanup records until shutdown."""
    from config import get_config
    from service.conversations.conversation_service import ConversationService
    from vamp_memory.vamp_memory_service import get_vamp_memory_service

    config = get_config()
    interval = max(5, int(interval_seconds))
    initial_delay = max(0, config.VAMP_MAINTENANCE_INITIAL_DELAY_SECONDS)
    max_backoff = max(interval, config.VAMP_MAINTENANCE_MAX_BACKOFF_SECONDS)
    if initial_delay and await _wait_or_stop(stop, initial_delay):
        return

    consecutive_failed_passes = 0
    while not stop.is_set():
        indexed, cleaned, failures = await run_vamp_maintenance_pass(
            get_vamp_memory_service(),
            ConversationService.retry_external_memory_cleanups,
        )
        if indexed or cleaned:
            logger.info("VAMP maintenance indexed=%s cleaned=%s", indexed, cleaned)

        consecutive_failed_passes = consecutive_failed_passes + 1 if failures else 0
        delay = min(
            max_backoff,
            interval * (2 ** min(consecutive_failed_passes, 4)),
        )
        if await _wait_or_stop(stop, delay):
            return
