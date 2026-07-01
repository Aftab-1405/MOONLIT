"""Historical-context provider backed by VAMP memory."""

from api_contract.orchestration_protocols import HistoricalContextProvider
from vamp_memory.vamp_memory_service import get_vamp_memory_service


class VampHistoricalContextProvider:
    """Retrieve formatted historical context from VAMP memory."""

    async def retrieve_context(
        self,
        conversation_id: str,
        user_id: str,
        user_prompt: str,
        *,
        model_id: str | None = None,
        token_budget: int | None = None,
    ) -> str:
        return await get_vamp_memory_service().retrieve_context(
            conversation_id,
            user_id,
            user_prompt,
            model_id=model_id,
            token_budget=token_budget,
        )


def create_historical_context_provider() -> HistoricalContextProvider:
    return VampHistoricalContextProvider()
