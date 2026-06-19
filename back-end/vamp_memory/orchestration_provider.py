"""Historical-context provider backed by VAMP memory."""

from api_contract.orchestration_protocols import HistoricalContextProvider
from vamp_memory.vamp_memory_service import VampMemoryService


class VampHistoricalContextProvider:
    """Retrieve formatted historical context from VAMP memory."""

    async def retrieve_context(
        self, conversation_id: str, user_id: str, user_prompt: str
    ) -> str:
        return await VampMemoryService().retrieve_context(
            conversation_id,
            user_id,
            user_prompt,
        )


def create_historical_context_provider() -> HistoricalContextProvider:
    return VampHistoricalContextProvider()
