"""
LLM Rate Limiter - Multi-key load balancing with per-key rate limiting.

Distributes requests across multiple API keys using round-robin selection,
while respecting per-key RPM limits via semaphore and timestamp tracking.
"""

import asyncio
import time
import logging
from collections import deque
from dataclasses import dataclass

from app.llm.providers.model_factory import get_provider_api_keys, get_supported_providers

logger = logging.getLogger(__name__)


@dataclass
class RateLimiterConfig:
    """Configuration for the rate limiter."""

    enabled: bool
    api_keys: list[str]
    max_rpm_per_key: int
    max_concurrent: int
    queue_timeout: int


class MultiKeyRateLimiter:
    """
    Global rate limiter for LLM API calls with multi-key support.

    Features:
    - Round-robin key selection for load distribution
    - Per-key RPM tracking to respect API limits
    - Semaphore for max concurrent calls
    - Configurable queue timeout
    """

    def __init__(self, config: RateLimiterConfig):
        self.config = config
        self.semaphore = asyncio.Semaphore(config.max_concurrent)
        self.lock = asyncio.Lock()
        self.current_key_index = 0

        # Per-key timestamp tracking for RPM
        self.key_timestamps: dict[str, deque] = {
            key: deque() for key in config.api_keys
        }

        if config.enabled:
            logger.info(
                f"🔑 MultiKeyRateLimiter initialized: "
                f"{len(config.api_keys)} keys, "
                f"{config.max_rpm_per_key} RPM/key, "
                f"{config.max_concurrent} concurrent"
            )

    async def acquire(self) -> tuple[bool, str | None]:
        """
        Acquire a rate limit slot and get an API key.

        Returns:
            tuple: (success: bool, api_key: str | None)
            - success=True, key=valid_key: Proceed with this key
            - success=False, key=None: Timeout, request should be rejected
        """
        if not self.config.api_keys:
            logger.error("No API keys configured")
            return False, None

        if not self.config.enabled:
            # Rate limiting disabled - still do round-robin key rotation
            async with self.lock:
                key = self.config.api_keys[self.current_key_index]
                self.current_key_index = (self.current_key_index + 1) % len(
                    self.config.api_keys
                )
                logger.debug(
                    f"Rate limiting disabled, using key index {self.current_key_index} (round-robin)"
                )
                return True, key

        deadline = time.time() + self.config.queue_timeout

        while True:
            remaining = deadline - time.time()
            if remaining <= 0:
                logger.warning("Rate limiter timeout - queue full")
                return False, None

            # Wait for semaphore (concurrency limit)
            try:
                await asyncio.wait_for(self.semaphore.acquire(), timeout=remaining)
            except asyncio.TimeoutError:
                logger.warning("Rate limiter timeout - queue full")
                return False, None

            wait_time = 0.0
            async with self.lock:
                now = time.time()

                # Try each key (round-robin with fallback)
                for _ in range(len(self.config.api_keys)):
                    key = self.config.api_keys[self.current_key_index]
                    self.current_key_index = (self.current_key_index + 1) % len(
                        self.config.api_keys
                    )

                    timestamps = self.key_timestamps[key]

                    # Clean old timestamps (older than 60 seconds)
                    while timestamps and now - timestamps[0] > 60:
                        timestamps.popleft()

                    # Check if this key has capacity
                    if len(timestamps) < self.config.max_rpm_per_key:
                        timestamps.append(now)
                        logger.debug(
                            f"Using key index {self.current_key_index}, "
                            f"RPM: {len(timestamps)}/{self.config.max_rpm_per_key}"
                        )
                        return True, key

                # All keys at limit - compute wait time without blocking the semaphore
                wait_candidates = [
                    60 - (now - timestamps[0])
                    for timestamps in self.key_timestamps.values()
                    if timestamps
                ]
                wait_time = max(min(wait_candidates, default=0), 0)
                if wait_time > 0:
                    logger.info(f"All keys at RPM limit, waiting {wait_time:.1f}s")

            # No key available; release semaphore before waiting
            self.semaphore.release()

            if wait_time <= 0:
                await asyncio.sleep(0)
                continue

            sleep_for = min(wait_time, max(deadline - time.time(), 0))
            if sleep_for <= 0:
                return False, None
            await asyncio.sleep(sleep_for)

    def release(self):
        """Release semaphore after LLM call completes."""
        if self.config.enabled:
            self.semaphore.release()

    def get_stats(self) -> dict:
        """Get current rate limiter statistics."""
        now = time.time()
        stats = {}
        for key in self.config.api_keys:
            # Mask key for security
            masked = f"{key[:8]}...{key[-4:]}"
            timestamps = self.key_timestamps[key]
            # Count only recent timestamps
            recent = sum(1 for t in timestamps if now - t <= 60)
            stats[masked] = {
                "rpm_used": recent,
                "rpm_limit": self.config.max_rpm_per_key,
            }
        return stats


class ProviderRateLimiter:
    """Provider-aware LLM rate limiter with isolated key pools."""

    def __init__(self, app_config):
        self.app_config = app_config
        self.limiters: dict[str, MultiKeyRateLimiter] = {}
        self.lock = asyncio.Lock()

    async def acquire(self, provider: str) -> tuple[bool, str | None]:
        limiter = await self._get_limiter(provider)
        if limiter is None:
            logger.error("No API keys configured for provider %s", provider)
            return False, None
        return await limiter.acquire()

    async def _get_limiter(self, provider: str) -> MultiKeyRateLimiter | None:
        provider = provider.strip().lower()
        async with self.lock:
            if provider in self.limiters:
                return self.limiters[provider]

            api_keys = get_provider_api_keys(provider)
            if not api_keys:
                return None

            config = RateLimiterConfig(
                enabled=getattr(self.app_config, "LLM_RATELIMIT_ENABLED", True),
                api_keys=api_keys,
                max_rpm_per_key=getattr(self.app_config, "LLM_MAX_RPM_PER_KEY", 25),
                max_concurrent=getattr(self.app_config, "LLM_MAX_CONCURRENT", 5),
                queue_timeout=getattr(self.app_config, "LLM_QUEUE_TIMEOUT", 60),
            )
            limiter = MultiKeyRateLimiter(config)
            self.limiters[provider] = limiter
            return limiter

    def release(self, provider: str) -> None:
        limiter = self.limiters.get(provider.strip().lower())
        if limiter:
            limiter.release()

    def configured_provider_count(self) -> int:
        return len(get_supported_providers())

    def get_stats(self) -> dict:
        return {
            provider: limiter.get_stats()
            for provider, limiter in self.limiters.items()
        }


def create_rate_limiter(app_config) -> ProviderRateLimiter:
    """
    Factory function to create rate limiter from application config.

    Args:
        app_config: Application configuration class (DevelopmentConfig, ProductionConfig, etc.)

    Returns:
        Configured provider-aware rate limiter instance.
    """
    return ProviderRateLimiter(app_config)
