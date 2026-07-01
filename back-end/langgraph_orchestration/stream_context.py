"""Context-loading phase for conversation streaming."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
import logging
import inspect

from config import get_config
from langgraph_orchestration.conversation_access import (
    get_default_conversation_state_reader,
)

logger = logging.getLogger(__name__)


def vamp_token_budget(model_id: str) -> int:
    from llm_provider.token_budget import get_model_context_window

    config = get_config()
    proportional = int(
        get_model_context_window(model_id) * config.VAMP_CONTEXT_WINDOW_RATIO
    )
    return min(
        config.VAMP_CONTEXT_MAX_TOKENS,
        max(config.VAMP_CONTEXT_MIN_TOKENS, proportional),
    )


async def retrieve_historical_context(
    provider, conversation_id: str, user_id: str, message: str, model_id: str
) -> str | None:
    """Call the current port while tolerating legacy three-argument adapters."""
    method = provider.retrieve_context
    parameters = inspect.signature(method).parameters
    kwargs = {}
    if "model_id" in parameters:
        kwargs["model_id"] = model_id
    if "token_budget" in parameters:
        kwargs["token_budget"] = vamp_token_budget(model_id)
    return await method(conversation_id, user_id, message, **kwargs)


@dataclass(frozen=True)
class InitialStreamContext:
    conversation: dict | None
    historical_context: str | None


async def load_initial_stream_context(
    conversation_id: str,
    user_id: str,
    message: str | None,
    selected_model: str,
) -> InitialStreamContext:
    """Load independent durable state and semantic memory concurrently."""

    async def load_conversation() -> dict | None:
        try:
            reader = get_default_conversation_state_reader()
            return await asyncio.to_thread(
                reader.get_conversation,
                conversation_id,
            )
        except Exception as exc:
            logger.warning("Failed to fetch conversation data: %s", exc)
            return None

    async def load_historical_context() -> str | None:
        if not message or str(selected_model).startswith("mock"):
            return None
        try:
            if not get_config().VAMP_MEMORY_ENABLED:
                return None
            from langgraph_orchestration.historical_context import (
                get_default_historical_context_provider,
            )

            return await asyncio.wait_for(
                retrieve_historical_context(
                    get_default_historical_context_provider(),
                    conversation_id,
                    user_id,
                    message,
                    selected_model,
                ),
                timeout=3.0,
            )
        except Exception as exc:
            logger.warning(
                "VAMP historical context retrieval failed for %s: %s",
                conversation_id,
                exc,
            )
            return None

    conversation, historical_context = await asyncio.gather(
        load_conversation(), load_historical_context()
    )
    return InitialStreamContext(conversation, historical_context)
