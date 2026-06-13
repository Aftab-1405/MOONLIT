"""
VAMP memory orchestration.

The vector store is treated as an index of pointers. Firestore summary block
documents remain the authoritative source for historical text.
"""

from __future__ import annotations

import asyncio
import logging
import math
import uuid
from typing import Callable, Iterable, Protocol

logger = logging.getLogger(__name__)

DEFAULT_EMBEDDING_MODEL = "amazon.titan-embed-text-v2:0"
DEFAULT_CONTEXT_TOKEN_BUDGET_CHARS = 12000
_VECTOR_STORE_SINGLETON = None


class VectorMemoryStore(Protocol):
    async def upsert(
        self,
        *,
        conversation_id: str,
        summary_id: str,
        vector: list[float],
        payload: dict,
        point_seed: str | None = None,
    ) -> None:
        ...

    async def search(
        self,
        *,
        conversation_id: str,
        query_vector: list[float],
        k: int,
        user_id: str | None = None,
        pointer_type: str | None = None,
    ) -> list[dict]:
        ...


class QdrantVectorMemoryStore:
    """Qdrant-backed pointer index for VAMP summary blocks."""

    def __init__(
        self,
        *,
        url: str,
        api_key: str | None,
        collection_name: str,
        vector_size: int,
    ):
        from qdrant_client import QdrantClient
        from qdrant_client import models

        self.client = QdrantClient(url=url, api_key=api_key or None)
        self.models = models
        self.collection_name = collection_name
        self.vector_size = vector_size
        self._ensure_collection()

    def _ensure_collection(self) -> None:
        try:
            exists = self.client.collection_exists(self.collection_name)
        except Exception:
            exists = False
        if exists:
            return
        self.client.create_collection(
            collection_name=self.collection_name,
            vectors_config=self.models.VectorParams(
                size=self.vector_size,
                distance=self.models.Distance.COSINE,
            ),
        )
        for field_name in ("conversation_id", "user_id"):
            try:
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name=field_name,
                    field_schema=self.models.PayloadSchemaType.KEYWORD,
                )
            except Exception:
                logger.debug("Could not create Qdrant payload index for %s", field_name)

    async def upsert(
        self,
        *,
        conversation_id: str,
        summary_id: str,
        vector: list[float],
        payload: dict,
        point_seed: str | None = None,
    ) -> None:
        seed = point_seed or f"{conversation_id}:{summary_id}"
        point_id = str(uuid.uuid5(uuid.NAMESPACE_URL, seed))

        def _upsert():
            self.client.upsert(
                collection_name=self.collection_name,
                points=[
                    self.models.PointStruct(
                        id=point_id,
                        vector=vector,
                        payload=payload,
                    )
                ],
            )

        await asyncio.to_thread(_upsert)

    async def search(
        self,
        *,
        conversation_id: str,
        query_vector: list[float],
        k: int,
        user_id: str | None = None,
        pointer_type: str | None = None,
    ) -> list[dict]:
        must = [
            self.models.FieldCondition(
                key="conversation_id",
                match=self.models.MatchValue(value=conversation_id),
            )
        ]
        if user_id:
            must.append(
                self.models.FieldCondition(
                    key="user_id",
                    match=self.models.MatchValue(value=user_id),
                )
            )
        if pointer_type:
            must.append(
                self.models.FieldCondition(
                    key="pointer_type",
                    match=self.models.MatchValue(value=pointer_type),
                )
            )
        query_filter = self.models.Filter(must=must)

        def _search():
            if hasattr(self.client, "query_points"):
                result = self.client.query_points(
                    collection_name=self.collection_name,
                    query=query_vector,
                    query_filter=query_filter,
                    limit=k,
                    with_payload=True,
                )
                return getattr(result, "points", result)
            return self.client.search(
                collection_name=self.collection_name,
                query_vector=query_vector,
                query_filter=query_filter,
                limit=k,
                with_payload=True,
            )

        points = await asyncio.to_thread(_search)
        hits = []
        for point in points:
            payload = getattr(point, "payload", {}) or {}
            hits.append(
                {
                    "summary_id": payload.get("summary_id"),
                    "idx": payload.get("idx", 0),
                    "score": getattr(point, "score", 0.0),
                    "bullet_id": payload.get("bullet_id"),
                    "pointer_type": payload.get("pointer_type"),
                }
            )
        return hits


def get_default_vector_store() -> VectorMemoryStore:
    """Create the configured vector store once per process."""
    global _VECTOR_STORE_SINGLETON
    if _VECTOR_STORE_SINGLETON is not None:
        return _VECTOR_STORE_SINGLETON

    from config import Config

    if Config.VAMP_VECTOR_BACKEND != "qdrant":
        raise RuntimeError(
            "VAMP requires Qdrant. Set VAMP_VECTOR_BACKEND=qdrant."
        )
    if not Config.VAMP_QDRANT_URL:
        raise RuntimeError("VAMP_VECTOR_BACKEND=qdrant requires VAMP_QDRANT_URL")

    _VECTOR_STORE_SINGLETON = QdrantVectorMemoryStore(
        url=Config.VAMP_QDRANT_URL,
        api_key=Config.VAMP_QDRANT_API_KEY,
        collection_name=Config.VAMP_QDRANT_COLLECTION,
        vector_size=Config.VAMP_EMBEDDING_DIMENSIONS,
    )
    return _VECTOR_STORE_SINGLETON


def _default_embedding_provider(text: str) -> list[float]:
    """
    Generate an embedding using Bedrock Titan Text Embeddings V2.

    This function is intentionally lazy-imported so unit tests and deployments
    without embedding credentials can import the service safely.
    """
    import boto3
    import json

    client = boto3.client("bedrock-runtime")
    try:
        from config import Config

        model_id = Config.VAMP_EMBEDDING_MODEL
    except Exception:
        model_id = DEFAULT_EMBEDDING_MODEL
    response = client.invoke_model(
        modelId=model_id,
        body=json.dumps({"inputText": text}),
        accept="application/json",
        contentType="application/json",
    )
    body = json.loads(response["body"].read())
    embedding = body.get("embedding")
    if not isinstance(embedding, list):
        raise ValueError("Bedrock embedding response did not include an embedding")
    return embedding


def adaptive_k(total_summaries: int) -> int:
    """VAMP retrieval pool size."""
    return max(7, min(10, math.floor(total_summaries / 7)))


# extract_memory_terms removed in strict VAMP mode


def format_historical_context(blocks: Iterable[dict]) -> str:
    """Format retrieved context units for direct system-prompt injection."""
    by_summary = {}
    sids_ordered = []
    for unit in blocks:
        sid = unit.get("summary_id")
        if not sid:
            continue
        if sid not in by_summary:
            by_summary[sid] = {"bullets": []}
            sids_ordered.append(sid)
        
        is_parent = unit.get("is_parent")
        if is_parent is None:
            is_parent = "bullet_id" not in unit
            
        if not is_parent:
            by_summary[sid]["bullets"].append(unit)

    sections = []
    for sid in sids_ordered:
        group = by_summary[sid]
        bullets = group["bullets"]
        
        if not bullets:
            continue
            
        base_unit = bullets[0]
        idx = int(base_unit.get("idx", 0) or 0)
        
        bullets.sort(key=lambda b: int(b.get("bullet_index", 0) or 0))
        lines = [f"- {b.get('text', '').strip()}" for b in bullets if b.get('text')]
        if lines:
            sections.append(
                f"[Memory block {idx} | matched bullets]\n" + "\n".join(lines)
            )

    return "\n\n".join(sections)


class VampMemoryService:
    """Coordinates immutable summary storage, vector indexing, and retrieval."""

    def __init__(
        self,
        *,
        summary_repo=None,
        vector_store: VectorMemoryStore | None = None,
        embedding_provider: Callable[[str], list[float]] | None = None,
        embedding_model: str = DEFAULT_EMBEDDING_MODEL,
        context_budget_chars: int = DEFAULT_CONTEXT_TOKEN_BUDGET_CHARS,
    ):
        if summary_repo is None:
            from repositories.summary_block_repository import SummaryBlockRepository

            summary_repo = SummaryBlockRepository
        self.summary_repo = summary_repo
        if embedding_model == DEFAULT_EMBEDDING_MODEL:
            try:
                from config import Config

                embedding_model = Config.VAMP_EMBEDDING_MODEL
                context_budget_chars = Config.VAMP_CONTEXT_BUDGET_CHARS
            except Exception:
                pass
        self.vector_store = vector_store or get_default_vector_store()
        self.embedding_provider = embedding_provider or _default_embedding_provider
        self.embedding_model = embedding_model
        self.context_budget_chars = context_budget_chars

    async def _embed(self, text: str) -> list[float]:
        result = self.embedding_provider(text)
        if asyncio.iscoroutine(result):
            result = await result
        return result

    async def store_summary_block(
        self,
        conversation_id: str,
        user_id: str,
        *,
        text: str,
        start_message_idx: int,
        end_message_idx: int,
        memory_bullets: list[dict] | None = None,
    ) -> dict:
        block = self.summary_repo.create_block(
            conversation_id,
            user_id,
            text=text,
            start_message_idx=start_message_idx,
            end_message_idx=end_message_idx,
            embedding_model=self.embedding_model,
            memory_bullets=memory_bullets,
        )
        try:
            await self.index_summary_block(block)
        except Exception as exc:
            logger.warning(
                "VAMP vector indexing failed for %s/%s: %s",
                conversation_id,
                block.get("summary_id"),
                exc,
            )
            mark_indexed = getattr(self.summary_repo, "mark_vector_indexed", None)
            if callable(mark_indexed):
                try:
                    mark_indexed(conversation_id, block["summary_id"], status="failed")
                except Exception:
                    pass
        return block

    async def index_summary_block(self, block: dict) -> None:
        if not (block.get("schema_version", 1) >= 2 and block.get("memory_bullets")):
            logger.warning("Summary block has no memory_bullets; skipped VAMP v2 vector indexing.")
        else:
            for bullet in block["memory_bullets"]:
                b_text = bullet.get("text", "")
                if not b_text:
                    continue
                b_vector = await self._embed(b_text)
                b_payload = {
                    "pointer_type": "memory_bullet",
                    "user_id": block.get("user_id"),
                    "conversation_id": block.get("conversation_id"),
                    "summary_id": block.get("summary_id"),
                    "idx": block.get("idx"),
                    "bullet_id": bullet.get("bullet_id"),
                    "bullet_index": bullet.get("bullet_index"),
                    "schema_version": block.get("schema_version"),
                    "content_hash": block.get("content_hash"),
                    "embedding_model": self.embedding_model,
                }
                await self.vector_store.upsert(
                    conversation_id=block["conversation_id"],
                    summary_id=block["summary_id"],
                    vector=b_vector,
                    payload=b_payload,
                    point_seed=f"{block['conversation_id']}:{block['summary_id']}:{bullet.get('bullet_id')}",
                )

        mark_indexed = getattr(self.summary_repo, "mark_vector_indexed", None)
        if callable(mark_indexed):
            try:
                mark_indexed(block["conversation_id"], block["summary_id"])
            except Exception:
                pass

    async def retrieve_blocks(
        self,
        conversation_id: str,
        user_id: str,
        user_prompt: str,
        *,
        k: int | None = None,
    ) -> list[dict]:
        conv = self.summary_repo.get_conversation(conversation_id) or {}
        if conv and conv.get("user_id") not in (None, user_id):
            raise PermissionError("User does not own this conversation")

        total = int(conv.get("summary_count", 0) or 0)
        if total <= 0:
            return []

        effective_k = k or adaptive_k(total)
        query_vector = await self._embed(user_prompt)
        vector_hits = self.vector_store.search(
            conversation_id=conversation_id,
            query_vector=query_vector,
            k=effective_k,
            user_id=user_id,
            pointer_type="memory_bullet",
        )
        if asyncio.iscoroutine(vector_hits):
            vector_hits = await vector_hits

        summary_ids = list({
            hit["summary_id"]
            for hit in vector_hits
            if hit.get("summary_id") is not None
        })
        blocks = self.summary_repo.get_blocks_by_ids(conversation_id, summary_ids)

        hits_by_summary = {}
        for rank, hit in enumerate(vector_hits):
            sid = hit.get("summary_id")
            if not sid:
                continue
            if sid not in hits_by_summary:
                hits_by_summary[sid] = []
            hit["rank"] = rank
            hits_by_summary[sid].append(hit)

        units = []
        for block in blocks:
            sid = block.get("summary_id")
            if not block.get("memory_bullets"):
                logger.warning("Summary block %s has no memory_bullets; skipped VAMP v2 retrieval.", sid)
                continue
            s_hits = hits_by_summary.get(sid, [])
            if not s_hits:
                continue

            b_dict = {b.get("bullet_id"): b for b in block.get("memory_bullets", [])}
            
            for h in s_hits:
                if h.get("pointer_type") == "memory_bullet":
                    bid = h.get("bullet_id")
                    if bid and bid in b_dict:
                        b_obj = b_dict[bid]
                        units.append({
                            "unit_id": bid,
                            "summary_id": sid,
                            "idx": block.get("idx"),
                            "start_message_idx": block.get("start_message_idx"),
                            "end_message_idx": block.get("end_message_idx"),
                            "bullet_id": bid,
                            "bullet_index": b_obj.get("bullet_index"),
                            "text": b_obj.get("text"),
                            "is_parent": False,
                            "_retrieval_score": h.get("score", 0.0),
                            "_retrieval_rank": h.get("rank", 999999),
                        })

        return self._dedupe_select_budget_then_sort(units)

    async def retrieve_context(
        self,
        conversation_id: str,
        user_id: str,
        user_prompt: str,
        *,
        k: int | None = None,
    ) -> str | None:
        try:
            blocks = await self.retrieve_blocks(
                conversation_id, user_id, user_prompt, k=k
            )
        except Exception as exc:
            logger.warning("VAMP retrieval failed for %s: %s", conversation_id, exc)
            return None
        context = format_historical_context(blocks)
        return context or None

    def _dedupe_select_budget_then_sort(
        self,
        blocks: Iterable[dict],
        *,
        budget_chars: int | None = None,
    ) -> list[dict]:
        budget = budget_chars or self.context_budget_chars

        by_id = {}
        for block in blocks:
            unit_id = block.get("unit_id") or block.get("summary_id")
            if not unit_id:
                continue

            existing = by_id.get(unit_id)
            if existing is None:
                by_id[unit_id] = block
                continue

            old_score = float(existing.get("_retrieval_score", 0.0) or 0.0)
            new_score = float(block.get("_retrieval_score", 0.0) or 0.0)
            if new_score > old_score:
                by_id[unit_id] = block

        candidates = list(by_id.values())

        candidates.sort(
            key=lambda b: (
                -float(b.get("_retrieval_score", 0.0) or 0.0),
                int(b.get("_retrieval_rank", 999999) or 999999),
                len(str(b.get("text", ""))),
            )
        )

        selected = []
        used = 0

        for block in candidates:
            text = str(block.get("text", ""))
            size = len(text)
            if size <= 0:
                continue

            if used + size <= budget:
                selected.append(block)
                used += size

        selected.sort(key=lambda b: (
            int(b.get("idx", 0) or 0),
            int(b.get("bullet_index", 0) or 0)
        ))
        return selected
