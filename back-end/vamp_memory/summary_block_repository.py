"""
Firestore access for immutable VAMP summary blocks.

Summary text is stored under a conversation subcollection instead of inside the
conversation document. The vector database stores only pointers to these docs.
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)


def _fast_firestore_retry():
    from google.api_core.retry import Retry

    return Retry(deadline=2.0)


def _maintenance_firestore_retry(timeout_seconds: float):
    """Use a background-friendly retry window for collection-group scans."""
    from google.api_core.retry import Retry

    return Retry(
        initial=0.5,
        maximum=4.0,
        multiplier=2.0,
        deadline=max(20.0, timeout_seconds + 5.0),
    )


def _split_utf8(value: str, max_bytes: int) -> list[str]:
    """Split text on UTF-8 boundaries without dropping or changing content."""
    encoded = value.encode("utf-8")
    size = max(1024, int(max_bytes))
    chunks: list[str] = []
    start = 0
    while start < len(encoded):
        end = min(start + size, len(encoded))
        if end < len(encoded):
            while end > start and (encoded[end] & 0xC0) == 0x80:
                end -= 1
        if end <= start:
            raise ValueError("Unable to split summary payload on a UTF-8 boundary")
        chunks.append(encoded[start:end].decode("utf-8"))
        start = end
    return chunks or [""]


def _encode_summary_payload_chunks(
    text: str,
    memory_bullets: list[dict],
    max_bytes: int,
) -> list[str]:
    payload = json.dumps(
        {"text": text, "memory_bullets": memory_bullets},
        ensure_ascii=False,
        separators=(",", ":"),
        default=str,
    )
    return _split_utf8(payload, max_bytes)


def _decode_summary_payload_chunks(chunks: list[str]) -> dict:
    return json.loads("".join(chunks))


class SummaryBlockRepository:
    """Data access layer for VAMP summary block documents."""

    CONVERSATION_COLLECTION = "conversations"
    SUMMARY_COLLECTION = "summary_blocks"
    PAYLOAD_CHUNK_COLLECTION = "payload_chunks"

    @staticmethod
    def _conversation_ref(conversation_id: str):
        from service.firestore.firestore_service import FirestoreService

        db = FirestoreService.get_db()
        return db.collection(SummaryBlockRepository.CONVERSATION_COLLECTION).document(
            conversation_id
        )

    @staticmethod
    def _summary_ref(conversation_id: str, summary_id: str):
        return (
            SummaryBlockRepository._conversation_ref(conversation_id)
            .collection(SummaryBlockRepository.SUMMARY_COLLECTION)
            .document(summary_id)
        )

    @staticmethod
    def get_conversation(conversation_id: str) -> Optional[dict]:
        doc = SummaryBlockRepository._conversation_ref(conversation_id).get(
            retry=_fast_firestore_retry(),
            timeout=2.0,
        )
        return doc.to_dict() if doc.exists else None

    @staticmethod
    def create_block(
        conversation_id: str,
        user_id: str,
        *,
        text: str,
        start_message_idx: int,
        end_message_idx: int,
        embedding_model: str,
        memory_bullets: list[dict] | None = None,
        covers_from_turn: int | None = None,
        covers_to_turn: int | None = None,
        covers_message_ids: list | None = None,
        created_from_unsummarized_tail: bool = True,
    ) -> dict:
        """
        Append one immutable summary block safely using a Firestore transaction.
        """
        from firebase_admin import firestore
        from service.firestore.firestore_service import FirestoreService

        db = FirestoreService.get_db()
        from config import get_config

        config = get_config()
        conv_ref = SummaryBlockRepository._conversation_ref(conversation_id)

        @firestore.transactional
        def update_in_transaction(transaction):
            conv_snapshot = conv_ref.get(transaction=transaction)
            if conv_snapshot.exists:
                conv_data = conv_snapshot.to_dict() or {}
                if conv_data.get("user_id") not in (None, user_id):
                    raise PermissionError("User does not own this conversation")
                idx = int(conv_data.get("summary_count") or 0)
            else:
                idx = 0

            # A summary range is immutable. A deterministic document id makes
            # retries idempotent when vector indexing succeeds but the caller
            # loses its response, or when a summary claim changes ownership.
            summary_id = (
                f"range-{int(start_message_idx):08d}-{int(end_message_idx):08d}"
            )
            summary_ref = SummaryBlockRepository._summary_ref(
                conversation_id, summary_id
            )
            existing_snapshot = summary_ref.get(transaction=transaction)
            if existing_snapshot.exists:
                return existing_snapshot.to_dict()

            prepared_bullets = list(memory_bullets or [])
            for b in prepared_bullets:
                if "bullet_id" not in b:
                    b["bullet_id"] = f"b{b.get('bullet_index', 0):03d}"
                if not str(b["bullet_id"]).startswith(f"{summary_id}#"):
                    b["bullet_id"] = f"{summary_id}#{b['bullet_id']}"

            payload_chunks = _encode_summary_payload_chunks(
                text,
                prepared_bullets,
                config.VAMP_SUMMARY_CHUNK_BYTES,
            )
            payload_bytes = sum(len(chunk.encode("utf-8")) for chunk in payload_chunks)
            content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
            block = {
                "conversation_id": conversation_id,
                "user_id": user_id,
                "summary_id": summary_id,
                "idx": idx,
                "start_message_idx": start_message_idx,
                "end_message_idx": end_message_idx,
                "content_hash": content_hash,
                "embedding_model": embedding_model,
                "vector_status": "pending",
                "vector_attempts": 0,
                "created_at": datetime.now(timezone.utc),
                "covers_from_turn": covers_from_turn,
                "covers_to_turn": covers_to_turn,
                "covers_message_ids": covers_message_ids,
                "created_from_unsummarized_tail": created_from_unsummarized_tail,
            }

            if memory_bullets is not None:
                if payload_bytes <= config.VAMP_SUMMARY_INLINE_MAX_BYTES:
                    block["schema_version"] = 2
                    block["text"] = text
                    block["memory_bullets"] = prepared_bullets
                else:
                    logger.info(
                        "Storing summary %s in %s immutable payload chunks (%s bytes)",
                        summary_id,
                        len(payload_chunks),
                        payload_bytes,
                    )
                    block.update(
                        {
                            "schema_version": 3,
                            "payload_storage": "chunks",
                            "payload_chunk_count": len(payload_chunks),
                            "payload_bytes": payload_bytes,
                        }
                    )
                    chunk_collection = summary_ref.collection(
                        SummaryBlockRepository.PAYLOAD_CHUNK_COLLECTION
                    )
                    for chunk_index, chunk in enumerate(payload_chunks):
                        transaction.set(
                            chunk_collection.document(f"{chunk_index:06d}"),
                            {
                                "index": chunk_index,
                                "data": chunk,
                                "content_hash": content_hash,
                            },
                        )
            else:
                block["text"] = text

            transaction.set(summary_ref, block)
            transaction.set(
                conv_ref,
                {
                    "user_id": user_id,
                    "summary_count": idx + 1,
                    "latest_summary_block_idx": idx,
                    "latest_summary_id": summary_id,
                    "updated_at": firestore.SERVER_TIMESTAMP,
                },
                merge=True,
            )
            return block

        transaction = db.transaction()
        stored = update_in_transaction(transaction)
        return SummaryBlockRepository._hydrate_blocks([stored])[0]

    @staticmethod
    def _hydrate_blocks(blocks: list[dict]) -> list[dict]:
        """Reassemble chunked logical blocks without truncating their payload."""
        chunked = [
            block
            for block in blocks
            if block.get("payload_storage") == "chunks"
            and int(block.get("payload_chunk_count", 0) or 0) > 0
        ]
        if not chunked:
            return blocks

        from service.firestore.firestore_service import FirestoreService

        refs = []
        ref_metadata: dict[str, tuple[tuple[str, str], int]] = {}
        for block in chunked:
            conversation_id = str(block["conversation_id"])
            summary_id = str(block["summary_id"])
            collection = SummaryBlockRepository._summary_ref(
                conversation_id, summary_id
            ).collection(SummaryBlockRepository.PAYLOAD_CHUNK_COLLECTION)
            for index in range(int(block["payload_chunk_count"])):
                ref = collection.document(f"{index:06d}")
                refs.append(ref)
                ref_metadata[ref.path] = ((conversation_id, summary_id), index)

        grouped: dict[tuple[str, str], dict[int, str]] = {}
        docs = FirestoreService.get_db().get_all(
            refs,
            retry=_fast_firestore_retry(),
            timeout=4.0,
        )
        for doc in docs:
            metadata = ref_metadata.get(doc.reference.path)
            if not doc.exists or metadata is None:
                continue
            block_key, index = metadata
            grouped.setdefault(block_key, {})[index] = str(
                (doc.to_dict() or {}).get("data", "")
            )

        hydrated = []
        for block in blocks:
            if block.get("payload_storage") != "chunks":
                hydrated.append(block)
                continue
            summary_id = str(block["summary_id"])
            block_key = (str(block["conversation_id"]), summary_id)
            expected = int(block.get("payload_chunk_count", 0) or 0)
            parts = grouped.get(block_key, {})
            if len(parts) != expected:
                raise RuntimeError(
                    f"Summary payload {summary_id} is incomplete: "
                    f"expected {expected} chunks, found {len(parts)}"
                )
            payload = _decode_summary_payload_chunks(
                [parts[index] for index in range(expected)]
            )
            hydrated.append(
                {
                    **block,
                    "text": payload["text"],
                    "memory_bullets": payload["memory_bullets"],
                }
            )
        return hydrated

    @staticmethod
    def get_blocks_by_ids(conversation_id: str, summary_ids: list[str]) -> list[dict]:
        if not summary_ids:
            return []
        from service.firestore.firestore_service import FirestoreService

        refs = [
            SummaryBlockRepository._summary_ref(conversation_id, summary_id)
            for summary_id in dict.fromkeys(summary_ids)
        ]
        docs = FirestoreService.get_db().get_all(
            refs,
            retry=_fast_firestore_retry(),
            timeout=2.0,
        )
        return SummaryBlockRepository._hydrate_blocks(
            [doc.to_dict() for doc in docs if doc.exists]
        )

    @staticmethod
    def get_recent_blocks(conversation_id: str, limit: int = 5) -> list[dict]:
        """Return recent immutable blocks for degraded retrieval fallback."""
        from google.cloud.firestore_v1 import Query

        docs = (
            SummaryBlockRepository._conversation_ref(conversation_id)
            .collection(SummaryBlockRepository.SUMMARY_COLLECTION)
            .order_by("idx", direction=Query.DESCENDING)
            .limit(max(1, int(limit)))
            .get(retry=_fast_firestore_retry(), timeout=2.0)
        )
        return SummaryBlockRepository._hydrate_blocks(
            [doc.to_dict() for doc in docs if doc.exists]
        )



    @staticmethod
    def mark_vector_indexed(
        conversation_id: str,
        summary_id: str,
        *,
        status: str = "indexed",
    ) -> None:
        payload = {
            "vector_status": status,
            "vector_error": None,
            "vector_next_retry_at": None,
            "vector_updated_at": datetime.now(timezone.utc),
        }
        SummaryBlockRepository._summary_ref(conversation_id, summary_id).update(payload)

    @staticmethod
    def mark_vector_failed(
        conversation_id: str,
        summary_id: str,
        *,
        error: str,
        attempts: int,
    ) -> None:
        delay_seconds = min(3600, 15 * (2 ** min(max(attempts - 1, 0), 8)))
        SummaryBlockRepository._summary_ref(conversation_id, summary_id).update(
            {
                "vector_status": "failed",
                "vector_attempts": attempts,
                "vector_error": str(error)[:1000],
                "vector_next_retry_at": datetime.now(timezone.utc)
                + timedelta(seconds=delay_seconds),
                "vector_updated_at": datetime.now(timezone.utc),
            }
        )

    @staticmethod
    def get_vector_retry_blocks(limit: int = 25) -> list[dict]:
        """Return due pending/failed blocks across conversations."""
        from google.cloud.firestore_v1 import FieldFilter
        from config import get_config
        from service.firestore.firestore_service import FirestoreService

        timeout = max(
            4.0, float(get_config().VAMP_MAINTENANCE_QUERY_TIMEOUT_SECONDS)
        )
        docs = (
            FirestoreService.get_db()
            .collection_group(SummaryBlockRepository.SUMMARY_COLLECTION)
            .where(filter=FieldFilter("vector_status", "in", ["pending", "failed"]))
            .limit(max(1, int(limit) * 3))
            .get(
                retry=_maintenance_firestore_retry(timeout),
                timeout=timeout,
            )
        )
        now = datetime.now(timezone.utc)
        due = []
        for doc in docs:
            block = doc.to_dict() or {}
            next_retry = block.get("vector_next_retry_at")
            if next_retry is not None and next_retry > now:
                continue
            due.append(block)
            if len(due) >= limit:
                break
        return SummaryBlockRepository._hydrate_blocks(due)
