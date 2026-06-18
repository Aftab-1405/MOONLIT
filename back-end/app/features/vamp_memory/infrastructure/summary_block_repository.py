"""
Firestore access for immutable VAMP summary blocks.

Summary text is stored under a conversation subcollection instead of inside the
conversation document. The vector database stores only pointers to these docs.
"""

from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Optional


def _fast_firestore_retry():
    from google.api_core.retry import Retry

    return Retry(deadline=2.0)


class SummaryBlockRepository:
    """Data access layer for VAMP summary block documents."""

    CONVERSATION_COLLECTION = "conversations"
    SUMMARY_COLLECTION = "summary_blocks"

    @staticmethod
    def _conversation_ref(conversation_id: str):
        from app.infrastructure.firestore.service import FirestoreService

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
    def next_idx(conversation_id: str) -> int:
        conv = SummaryBlockRepository.get_conversation(conversation_id) or {}
        return int(conv.get("summary_count", 0) or 0)

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
        Append one immutable summary block.

        The caller owns concurrency control. This method intentionally does not
        call an LLM or vector DB inside a Firestore transaction.
        """
        from firebase_admin import firestore

        idx = SummaryBlockRepository.next_idx(conversation_id)
        summary_id = f"{idx:06d}"
        content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
        block = {
            "conversation_id": conversation_id,
            "user_id": user_id,
            "summary_id": summary_id,
            "idx": idx,
            "text": text,
            "start_message_idx": start_message_idx,
            "end_message_idx": end_message_idx,
            "content_hash": content_hash,
            "embedding_model": embedding_model,
            "vector_status": "pending",
            "created_at": datetime.now(),
            "covers_from_turn": covers_from_turn,
            "covers_to_turn": covers_to_turn,
            "covers_message_ids": covers_message_ids,
            "created_from_unsummarized_tail": created_from_unsummarized_tail,
        }

        if memory_bullets is not None:
            for b in memory_bullets:
                if "bullet_id" not in b:
                    b["bullet_id"] = f"b{b.get('bullet_index', 0):03d}"
                if not str(b["bullet_id"]).startswith(f"{summary_id}#"):
                    b["bullet_id"] = f"{summary_id}#{b['bullet_id']}"
            block["schema_version"] = 2
            block["memory_bullets"] = memory_bullets

        SummaryBlockRepository._summary_ref(conversation_id, summary_id).set(block)
        SummaryBlockRepository._conversation_ref(conversation_id).set(
            {
                "user_id": user_id,
                "summary_count": idx + 1,
                "latest_summary_block_idx": idx,
                "updated_at": firestore.SERVER_TIMESTAMP,
            },
            merge=True,
        )
        return block

    @staticmethod
    def get_blocks_by_ids(conversation_id: str, summary_ids: list[str]) -> list[dict]:
        blocks = []
        for summary_id in summary_ids:
            doc = SummaryBlockRepository._summary_ref(conversation_id, summary_id).get(
                retry=_fast_firestore_retry(),
                timeout=2.0,
            )
            if doc.exists:
                blocks.append(doc.to_dict())
        return blocks

    @staticmethod
    def get_latest_block(conversation_id: str) -> Optional[dict]:
        conv = SummaryBlockRepository.get_conversation(conversation_id) or {}
        count = int(conv.get("summary_count", 0) or 0)
        if count <= 0:
            return None
        blocks = SummaryBlockRepository.get_blocks_by_ids(
            conversation_id, [f"{count - 1:06d}"]
        )
        return blocks[0] if blocks else None



    @staticmethod
    def mark_vector_indexed(
        conversation_id: str,
        summary_id: str,
        *,
        status: str = "indexed",
    ) -> None:
        SummaryBlockRepository._summary_ref(conversation_id, summary_id).update(
            {"vector_status": status}
        )
