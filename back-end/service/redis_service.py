"""Redis service singleton for the application."""

from typing import Optional
import redis.asyncio as redis

_redis_client: Optional[redis.Redis] = None

def get_redis_client() -> Optional[redis.Redis]:
    """Get the active Redis client."""
    return _redis_client

def set_redis_client(client: Optional[redis.Redis]) -> None:
    """Set the active Redis client."""
    global _redis_client
    _redis_client = client
