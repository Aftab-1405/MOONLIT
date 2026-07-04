"""Protocol (interface) definitions for the VAMP memory subsystem.

These Protocols decouple ``VampMemoryService`` from the concrete Qdrant
adapter (``qdrant_vector_store.py``). Tests can substitute in-memory fakes
that satisfy the Protocol without spinning up Qdrant.
"""

from typing import Protocol, runtime_checkable


@runtime_checkable
class VectorMemoryStore(Protocol):
    """Async vector store port for VAMP memory bullet pointers.

    Implementations must be safe to call from any event loop (lazy-lock
    pattern, see ``qdrant_vector_store.py`` FIX [M29]). The concrete
    implementation is ``QdrantVectorMemoryStore``.
    """

    async def ensure_ready(self) -> None:
        """Initialize the collection / indexes idempotently.

        Called before every ``upsert``/``search``/``delete`` so the store
        is usable even if startup warm-up failed. Must be safe to call
        concurrently and from any event loop.
        """
        ...

    async def upsert(
        self,
        *,
        conversation_id: str,
        summary_id: str,
        vector: list[float],
        payload: dict,
        point_seed: str | None = None,
    ) -> None:
        """Upsert one vector + payload as a deterministic UUIDv5 point.

        ``point_seed`` is the source string for the UUIDv5; re-embedding the
        same seed overwrites the same point (idempotent).
        """
        ...

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
        """Return up to ``k`` matching pointers, filtered by the given fields.

        Each hit dict carries ``summary_id``, ``idx``, ``score``, ``bullet_id``
        and ``pointer_type`` so the caller can hydrate the bullet text from
        Firestore and rank by retrieval score.
        """
        ...

    async def delete_conversation_pointers(
        self,
        conversation_id: str,
        user_id: str,
    ) -> None:
        """Delete all points matching both ``conversation_id`` and ``user_id``.

        Called on conversation deletion. MUST filter on BOTH fields so a
        stale ``conversation_id`` from another tenant cannot delete our
        points. Raises on failure so the caller can record a durable
        cleanup-retry record.
        """
        ...
