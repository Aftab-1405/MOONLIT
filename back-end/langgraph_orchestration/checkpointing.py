"""
Global checkpointer adapter.

Production uses AsyncRedisSaver from langgraph-checkpoint-redis.
Development defaults to InMemorySaver.
"""

import logging
from typing import Optional

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.redis.aio import AsyncRedisSaver
from redis.asyncio import Redis

from config import get_config

logger = logging.getLogger(__name__)

_checkpointer: Optional[BaseCheckpointSaver] = None
_redis_saver: Optional[AsyncRedisSaver] = None


async def init_checkpointer(*, app_env: str, redis_url: str | None) -> None:
    """
    Initialize the global checkpointer. Call once from FastAPI lifespan startup.
    """
    global _checkpointer, _redis_saver

    if _checkpointer is not None:
        logger.debug("Checkpointer already initialized; skipping")
        return

    env = (app_env or "development").lower()

    if env in ("production", "staging"):
        if not redis_url:
            raise RuntimeError(
                "Redis-backed LangGraph checkpointing is required in production/staging"
            )
        try:
            saver = AsyncRedisSaver.from_conn_info(redis_url=redis_url)
            await saver.__aenter__()
            _redis_saver = saver
            _checkpointer = saver
            logger.info("LangGraph checkpointer: AsyncRedisSaver (Redis-backed)")
            return
        except Exception as e:
            # A process-local fallback loses resumability on restart and splits
            # state across workers. Fail startup instead of silently weakening
            # production durability.
            logger.exception("Redis checkpointer initialization failed: %s", e)
            raise RuntimeError("Redis checkpointer initialization failed") from e

    _checkpointer = InMemorySaver()
    logger.info("LangGraph checkpointer: InMemorySaver")


async def shutdown_checkpointer() -> None:
    """Close Redis connections if we own an AsyncRedisSaver."""
    global _checkpointer, _redis_saver

    if _redis_saver is not None:
        try:
            await _redis_saver.__aexit__(None, None, None)
        except Exception as e:
            logger.warning("Error closing AsyncRedisSaver: %s", e)
        _redis_saver = None

    _checkpointer = None


def get_checkpointer() -> BaseCheckpointSaver:
    """
    Return the process-wide checkpointer.
    """
    global _checkpointer

    if _checkpointer is not None:
        return _checkpointer

    env = get_config().APP_ENV.lower()
    if env in ("production", "staging"):
        raise RuntimeError(
            "Checkpointer not initialized: ensure FastAPI lifespan calls "
            "init_checkpointer() before handling requests."
        )

    logger.warning(
        "Dev fallback: instantiating InMemorySaver without lifespan init "
        "(OK for local scripts; use lifespan in production)"
    )
    _checkpointer = InMemorySaver()
    return _checkpointer
