import asyncio
import logging
import uuid
from vamp_memory.protocols import VectorMemoryStore

logger = logging.getLogger(__name__)

class QdrantVectorMemoryStore(VectorMemoryStore):
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
        self._ready = False
        self._ready_lock = asyncio.Lock()

    async def ensure_ready(self) -> None:
        """Initialize and validate the collection without blocking the event loop."""
        if self._ready:
            return
        async with self._ready_lock:
            if self._ready:
                return
            await asyncio.to_thread(self._ensure_collection_sync)
            self._ready = True

    def _ensure_collection_sync(self) -> None:
        exists = self.client.collection_exists(self.collection_name)
        if not exists:
            try:
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=self.models.VectorParams(
                        size=self.vector_size,
                        distance=self.models.Distance.COSINE,
                    ),
                )
            except Exception:
                # Another process may have created it between the existence
                # check and create. Re-check; otherwise preserve the real error.
                if not self.client.collection_exists(self.collection_name):
                    raise

        info = self.client.get_collection(self.collection_name)
        vectors = info.config.params.vectors
        configured_size = getattr(vectors, "size", None)
        if configured_size is None and isinstance(vectors, dict):
            sizes = {getattr(item, "size", None) for item in vectors.values()}
            sizes.discard(None)
            configured_size = next(iter(sizes)) if len(sizes) == 1 else None
        if configured_size != self.vector_size:
            raise RuntimeError(
                f"Qdrant collection {self.collection_name!r} uses vector size "
                f"{configured_size!r}; configured embedding model requires "
                f"{self.vector_size}. Use a matching collection or dimensions."
            )

        for field_name in ("conversation_id", "user_id", "pointer_type", "summary_id"):
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
        await self.ensure_ready()
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
        score_threshold: float | None = None,
    ) -> list[dict]:
        await self.ensure_ready()
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
                    score_threshold=score_threshold,
                )
                return getattr(result, "points", result)
            return self.client.search(
                collection_name=self.collection_name,
                query_vector=query_vector,
                query_filter=query_filter,
                limit=k,
                with_payload=True,
                score_threshold=score_threshold,
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

    async def delete_conversation_pointers(
        self,
        conversation_id: str,
        user_id: str,
    ) -> None:
        """Delete all points matching both conversation_id and user_id."""
        await self.ensure_ready()
        must = [
            self.models.FieldCondition(
                key="conversation_id",
                match=self.models.MatchValue(value=conversation_id),
            ),
            self.models.FieldCondition(
                key="user_id",
                match=self.models.MatchValue(value=user_id),
            ),
        ]
        query_filter = self.models.Filter(must=must)

        def _delete():
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=self.models.FilterSelector(filter=query_filter),
            )

        await asyncio.to_thread(_delete)
