from typing import Protocol, runtime_checkable

@runtime_checkable
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

    async def delete_conversation_pointers(
        self,
        conversation_id: str,
        user_id: str,
    ) -> None:
        ...
