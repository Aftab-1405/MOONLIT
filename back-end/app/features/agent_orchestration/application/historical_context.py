"""Historical-context provider adapters for agent orchestration."""

from app.features.agent_orchestration.domain.protocols import HistoricalContextProvider


class VampHistoricalContextProvider:
    """Historical context provider backed by the VAMP memory feature."""

    async def retrieve_context(
        self, conversation_id: str, user_id: str, user_prompt: str
    ) -> str:
        from app.features.vamp_memory.application.vamp_memory_service import (
            VampMemoryService,
        )

        return await VampMemoryService().retrieve_context(
            conversation_id,
            user_id,
            user_prompt,
        )


def get_default_historical_context_provider() -> HistoricalContextProvider:
    """Return the configured historical-context provider."""
    return VampHistoricalContextProvider()
