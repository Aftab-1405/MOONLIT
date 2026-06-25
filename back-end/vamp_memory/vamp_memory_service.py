import asyncio
import inspect
import logging
from typing import Callable

from vamp_memory.protocols import VectorMemoryStore
from vamp_memory.qdrant_vector_store import QdrantVectorMemoryStore
from vamp_memory.bedrock_embedding_provider import default_embedding_provider, DEFAULT_EMBEDDING_MODEL
from vamp_memory.historical_context_builder import format_historical_context
from vamp_memory.budget_selection import adaptive_k, dedupe_select_budget_then_sort
from config import get_config

logger = logging.getLogger(__name__)

DEFAULT_CONTEXT_TOKEN_BUDGET_CHARS = get_config().VAMP_CONTEXT_BUDGET_CHARS
_VECTOR_STORE_SINGLETON = None
_VAMP_MEMORY_SERVICE_SINGLETON = None


def get_vamp_memory_service():
    """Create or return the configured VampMemoryService singleton."""
    global _VAMP_MEMORY_SERVICE_SINGLETON
    if _VAMP_MEMORY_SERVICE_SINGLETON is None:
        _VAMP_MEMORY_SERVICE_SINGLETON = VampMemoryService()
    return _VAMP_MEMORY_SERVICE_SINGLETON


def get_default_vector_store() -> VectorMemoryStore:
    """Create the configured vector store once per process."""
    global _VECTOR_STORE_SINGLETON
    if _VECTOR_STORE_SINGLETON is not None:
        return _VECTOR_STORE_SINGLETON

    config = get_config()

    if config.VAMP_VECTOR_BACKEND != "qdrant":
        raise RuntimeError(
            "VAMP requires Qdrant. Set VAMP_VECTOR_BACKEND=qdrant."
        )
    if not config.VAMP_QDRANT_URL:
        raise RuntimeError("VAMP_VECTOR_BACKEND=qdrant requires VAMP_QDRANT_URL")

    _VECTOR_STORE_SINGLETON = QdrantVectorMemoryStore(
        url=config.VAMP_QDRANT_URL,
        api_key=config.VAMP_QDRANT_API_KEY,
        collection_name=config.VAMP_QDRANT_COLLECTION,
        vector_size=config.VAMP_EMBEDDING_DIMENSIONS,
    )
    return _VECTOR_STORE_SINGLETON


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
            from vamp_memory.summary_block_repository import SummaryBlockRepository
            summary_repo = SummaryBlockRepository
        self.summary_repo = summary_repo
        if embedding_model == DEFAULT_EMBEDDING_MODEL:
            try:
                config = get_config()

                embedding_model = config.VAMP_EMBEDDING_MODEL
                context_budget_chars = config.VAMP_CONTEXT_BUDGET_CHARS
            except Exception:
                pass
        self._vector_store = vector_store
        self.embedding_provider = embedding_provider or default_embedding_provider
        self.embedding_model = embedding_model
        self.context_budget_chars = context_budget_chars

    @property
    def vector_store(self) -> VectorMemoryStore:
        if self._vector_store is None:
            self._vector_store = get_default_vector_store()
        return self._vector_store

    async def _call_maybe_async(self, func, /, *args, **kwargs):
        if inspect.iscoroutinefunction(func):
            return await func(*args, **kwargs)
        return await asyncio.to_thread(func, *args, **kwargs)

    async def _embed(self, text: str) -> list[float]:
        result = await self._call_maybe_async(self.embedding_provider, text)
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
        covers_from_turn: int | None = None,
        covers_to_turn: int | None = None,
        covers_message_ids: list | None = None,
        created_from_unsummarized_tail: bool = True,
    ) -> dict:
        if memory_bullets:
            for bullet in memory_bullets:
                if "text" in bullet and "char_length" not in bullet:
                    bullet["char_length"] = len(str(bullet["text"]))

        block = await asyncio.to_thread(
            self.summary_repo.create_block,
            conversation_id,
            user_id,
            text=text,
            start_message_idx=start_message_idx,
            end_message_idx=end_message_idx,
            embedding_model=self.embedding_model,
            memory_bullets=memory_bullets,
            covers_from_turn=covers_from_turn,
            covers_to_turn=covers_to_turn,
            covers_message_ids=covers_message_ids,
            created_from_unsummarized_tail=created_from_unsummarized_tail,
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
                    await asyncio.to_thread(
                        mark_indexed,
                        conversation_id,
                        block["summary_id"],
                        status="failed",
                    )
                except Exception:
                    pass
        return block

    async def index_summary_block(self, block: dict) -> None:
        if not (block.get("schema_version", 1) >= 2 and block.get("memory_bullets")):
            logger.warning("Summary block has no memory_bullets; skipped VAMP v2 vector indexing.")
            mark_indexed = getattr(self.summary_repo, "mark_vector_indexed", None)
            if callable(mark_indexed):
                try:
                    await asyncio.to_thread(
                        mark_indexed,
                        block["conversation_id"],
                        block["summary_id"],
                        status="no_bullets",
                    )
                except Exception:
                    pass
            return
        else:
            indexed_bullets = 0
            for bullet in block["memory_bullets"]:
                b_text = bullet.get("text", "")
                if not b_text:
                    continue
                b_vector = await self._embed(b_text)
                if len(b_vector) != get_config().VAMP_EMBEDDING_DIMENSIONS:
                    raise ValueError(
                        "Embedding dimension mismatch for "
                        f"{block.get('conversation_id')}/{block.get('summary_id')} "
                        f"{bullet.get('bullet_id')}: got {len(b_vector)}, "
                        f"expected {get_config().VAMP_EMBEDDING_DIMENSIONS}"
                    )
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
                indexed_bullets += 1

            if indexed_bullets == 0:
                logger.warning("Summary block has no indexable memory_bullets; skipped VAMP v2 vector indexing.")
                mark_indexed = getattr(self.summary_repo, "mark_vector_indexed", None)
                if callable(mark_indexed):
                    try:
                        await asyncio.to_thread(
                            mark_indexed,
                            block["conversation_id"],
                            block["summary_id"],
                            status="no_bullets",
                        )
                    except Exception:
                        pass
                return

        mark_indexed = getattr(self.summary_repo, "mark_vector_indexed", None)
        if callable(mark_indexed):
            try:
                await asyncio.to_thread(
                    mark_indexed,
                    block["conversation_id"],
                    block["summary_id"],
                )
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
        conv = await asyncio.to_thread(
            self.summary_repo.get_conversation,
            conversation_id,
        )
        conv = conv or {}
        if conv and conv.get("user_id") not in (None, user_id):
            raise PermissionError("User does not own this conversation")

        total = int(conv.get("summary_count", 0) or 0)
        if total <= 0:
            return []

        effective_k = k or adaptive_k(total)
        query_vector = await self._embed(user_prompt)
        vector_hits = await self._call_maybe_async(
            self.vector_store.search,
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
        blocks = await asyncio.to_thread(
            self.summary_repo.get_blocks_by_ids,
            conversation_id,
            summary_ids,
        )

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

        return dedupe_select_budget_then_sort(units, budget_chars=self.context_budget_chars)

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
        blocks: list[dict],
        *,
        budget_chars: int | None = None,
    ) -> list[dict]:
        """Shim for tests accessing private method directly."""
        return dedupe_select_budget_then_sort(blocks, budget_chars=budget_chars or self.context_budget_chars)

    async def delete_conversation_pointers(
        self,
        conversation_id: str,
        user_id: str,
    ) -> None:
        """Delete all Qdrant vector pointers for the given conversation owned by the user."""
        try:
            await self.vector_store.delete_conversation_pointers(conversation_id, user_id)
            logger.info("Deleted Qdrant pointers for conversation %s and user %s", conversation_id, user_id)
        except Exception as exc:
            logger.warning("Failed to delete Qdrant pointers for conversation %s: %s", conversation_id, exc)
