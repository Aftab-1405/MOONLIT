"""Historical-context provider adapters for agent orchestration."""

from api_contract.orchestration_protocols import HistoricalContextProvider
from api_contract.runtime_ports import get_historical_context_provider


def get_default_historical_context_provider() -> HistoricalContextProvider:
    """Return the configured historical-context provider."""
    return get_historical_context_provider()
