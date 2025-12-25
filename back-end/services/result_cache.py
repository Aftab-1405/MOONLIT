"""
Query Result Cache Service

In-memory cache for query results with TTL expiration.
Enables LLMs to receive preview only while frontend fetches full data.
"""

import uuid
import time
import threading
from typing import Dict, Any, Optional

# Cache configuration
CACHE_TTL_SECONDS = 300  # 5 minutes
CLEANUP_INTERVAL_SECONDS = 60  # Run cleanup every minute

# Thread-safe cache storage
_cache: Dict[str, Dict[str, Any]] = {}
_cache_lock = threading.Lock()


def generate_result_id() -> str:
    """Generate a unique result ID."""
    return str(uuid.uuid4())


def store_result(result_id: str, data: Dict[str, Any]) -> None:
    """
    Store query result data in cache.
    
    Args:
        result_id: Unique identifier for the result
        data: Full query result data (columns, rows, etc.)
    """
    with _cache_lock:
        _cache[result_id] = {
            "data": data,
            "expires_at": time.time() + CACHE_TTL_SECONDS
        }


def get_result(result_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve query result from cache.
    
    Returns None if not found or expired.
    """
    with _cache_lock:
        entry = _cache.get(result_id)
        if not entry:
            return None
        
        # Check expiration
        if time.time() > entry["expires_at"]:
            del _cache[result_id]
            return None
        
        return entry["data"]


def cleanup_expired() -> int:
    """
    Remove expired entries from cache.
    Returns count of removed entries.
    """
    now = time.time()
    removed = 0
    
    with _cache_lock:
        expired_ids = [
            rid for rid, entry in _cache.items() 
            if now > entry["expires_at"]
        ]
        for rid in expired_ids:
            del _cache[rid]
            removed += 1
    
    return removed


def get_cache_stats() -> Dict[str, int]:
    """Get current cache statistics."""
    with _cache_lock:
        return {
            "total_entries": len(_cache),
            "ttl_seconds": CACHE_TTL_SECONDS
        }
