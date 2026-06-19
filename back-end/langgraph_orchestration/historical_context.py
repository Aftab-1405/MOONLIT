"""Historical-context provider adapters for agent orchestration."""

from api_contract.orchestration_protocols import HistoricalContextProvider
from api_contract.runtime_ports import get_historical_context_provider


class VampHistoricalContextProvider:
    """Historical context provider backed by the VAMP memory feature."""

    async def retrieve_context(
        self, conversation_id: str, user_id: str, user_prompt: str
    ) -> str:
        return await get_historical_context_provider().retrieve_context(
            conversation_id, user_id, user_prompt
        )


def get_default_historical_context_provider() -> HistoricalContextProvider:
    """Return the configured historical-context provider."""
    return VampHistoricalContextProvider()
