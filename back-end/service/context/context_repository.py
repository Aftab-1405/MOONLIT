"""
Context Repository

Encapsulates Firestore data access for user-context documents.
Collection: ``user_context/{user_id}``

Each user-context document stores:

- ``current_connection`` — the user's active DB connection metadata.
- ``database_schemas`` — per-database schema cache (tables + columns).
- ``recent_queries`` — recent SQL query history for AI prompt context.
- ``metrics_telemetry`` — counters for context hit/miss observability.
- ``updated_at`` — last write timestamp.

Error propagation
-----------------
FIX [M20]: Transient Firestore errors
(``DeadlineExceeded``, ``ServiceUnavailable``, ``TooManyRequests``,
``ResourceExhausted``) are NOT swallowed — they propagate to the
controller, which surfaces a 503 so the client can retry. Only
``NotFound`` and genuinely unexpected generic ``Exception`` paths
return the empty / False default. Previously a Firestore outage
caused every ``ContextService.get_full_context`` call to silently
return ``{}`` — the AI agent then generated SQL against an empty
schema, with no signal to the user that the backend was degraded.

Input mutation
--------------
FIX [M31]: ``update`` no longer writes ``data["updated_at"] = ...``
in-place on the caller's dict. It builds a fresh payload so callers
that reuse the input dict (e.g. the loop in ``ContextService``) don't
see a stale timestamp bleed across writes.
"""

import logging
from datetime import datetime, timezone
from typing import Dict

from google.api_core.exceptions import (
    DeadlineExceeded,
    NotFound,
    ResourceExhausted,
    ServiceUnavailable,
    TooManyRequests,
)

logger = logging.getLogger(__name__)

# FIX [M20]: Transient Firestore errors that should propagate so the
# controller can return 503. Anything else is either a programming bug
# (we want to see it surface) or a NotFound (which we handle explicitly).
_TRANSIENT_FIRESTORE_ERRORS = (
    DeadlineExceeded,
    ResourceExhausted,
    ServiceUnavailable,
    TooManyRequests,
)


class ContextRepository:
    """Data access layer for user context in Firestore."""

    COLLECTION_NAME = "user_context"

    @staticmethod
    def _normalize_user_id(user_id) -> str:
        """Normalize user_id to string for Firestore document ID.

        Uses uid as primary identifier to match route behavior.
        This ensures consistent document IDs across context and conversations.
        """
        if isinstance(user_id, dict):
            # Prefer uid (stable) over email (can change)
            return user_id.get("uid") or user_id.get("email") or str(user_id)
        return str(user_id) if user_id else "anonymous"

    @staticmethod
    def get_ref(user_id):
        """
        Get Firestore document reference for user context.

        Args:
            user_id: User identifier (string or dict with email/uid)

        Returns:
            DocumentReference for the user's context document
        """
        from service.firestore.firestore_service import FirestoreService

        user_id = ContextRepository._normalize_user_id(user_id)
        db = FirestoreService.get_db()
        return db.collection(ContextRepository.COLLECTION_NAME).document(user_id)

    @staticmethod
    def get(user_id: str) -> Dict:
        """
        Get the full context document for ``user_id``.

        Returns ``{}`` when the document doesn't exist (a normal "first
        request" condition). FIX [M20]: transient Firestore errors
        (``DeadlineExceeded``, ``ServiceUnavailable``, etc.) propagate so
        the controller can return 503 instead of silently degrading the
        AI agent into running with no context.

        Args:
            user_id: User identifier

        Returns:
            Context document as dict, or empty dict if it does not exist.

        Raises:
            ``DeadlineExceeded``, ``ServiceUnavailable``,
            ``TooManyRequests``, ``ResourceExhausted`` — to be surfaced
            as 503 by the controller.
        """
        try:
            doc = ContextRepository.get_ref(user_id).get()
            return doc.to_dict() if doc.exists else {}
        except NotFound:
            return {}
        except _TRANSIENT_FIRESTORE_ERRORS:
            # FIX [M20]: Let transient Firestore errors propagate so
            # controllers can return 503 instead of silently degrading.
            raise
        except Exception as e:
            logger.error(f"Error getting context for user {user_id}: {e}")
            return {}

    @staticmethod
    def update(user_id: str, data: Dict) -> bool:
        """
        Merge ``data`` into the user's context document, setting ``updated_at``.

        FIX [M31]: Previously this mutated the caller's ``data`` dict in
        place (``data["updated_at"] = ...``). If the caller reused the
        dict across multiple writes — common in
        :meth:`ContextService.store_schema_context` which mutates a
        ``schemas`` dict and re-saves — the stale timestamp would bleed
        across writes. We now build a fresh payload via ``{**data, ...}``.

        Returns ``True`` on success, ``False`` on non-transient failure.
        Transient Firestore errors propagate (FIX [M20]).
        """
        try:
            # FIX [M31]: Build a fresh payload so the caller's dict is not
            # mutated. The stale `updated_at` previously survived across
            # reuses of the input dict.
            payload = {**data, "updated_at": datetime.now(timezone.utc)}
            ContextRepository.get_ref(user_id).set(payload, merge=True)
            return True
        except _TRANSIENT_FIRESTORE_ERRORS:
            # FIX [M20]: propagate so controllers can return 503.
            raise
        except Exception as e:
            logger.error(f"Error updating context for user {user_id}: {e}")
            return False

    @staticmethod
    def delete(user_id: str) -> bool:
        """
        Delete the user's context document (full reset).

        Returns ``True`` on success, ``False`` on non-transient failure.
        Transient Firestore errors propagate (FIX [M20]).
        """
        try:
            ContextRepository.get_ref(user_id).delete()
            logger.info(f"Deleted context for user {user_id}")
            return True
        except _TRANSIENT_FIRESTORE_ERRORS:
            raise
        except Exception as e:
            logger.error(f"Error deleting context for user {user_id}: {e}")
            return False

    @staticmethod
    def delete_field(user_id: str, field_path: str) -> bool:
        """
        Delete a single field (dot-notation path) from the context document.

        Used by :meth:`ContextService.clear_schema_context` to drop one
        database's cached schema without touching the rest of the document.
        Also stamps ``updated_at`` so subsequent reads can detect a change.

        Args:
            user_id: User identifier
            field_path: Dot-notation path to the field (e.g., 'database_schemas.mydb')

        Returns:
            True if successful, False otherwise

        Raises:
            Transient Firestore errors propagate (FIX [M20]).
        """
        from firebase_admin import firestore

        try:
            ref = ContextRepository.get_ref(user_id)
            ref.update(
                {
                    field_path: firestore.DELETE_FIELD,
                    "updated_at": datetime.now(timezone.utc),
                }
            )
            return True
        except _TRANSIENT_FIRESTORE_ERRORS:
            raise
        except Exception as e:
            logger.error(f"Error deleting field {field_path} for user {user_id}: {e}")
            return False
