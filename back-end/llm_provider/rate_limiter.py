"""
LLM Rate Limiter - Single-key rate limiting and concurrency management.

Maintains concurrency and RPM limits for each configured provider using
asyncio Semaphores and sliding window timestamp tracking.
"""

import asyncio
import time
import logging
from collections import deque
from dataclasses import dataclass

from llm_provider.model_factory import get_provider_api_key, get_supported_providers

logger = logging.getLogger(__name__)


@dataclass
class RateLimiterConfig:
    """Configuration for the rate limiter."""

    enabled: bool
    api_key: str
    max_rpm: int
    max_concurrent: int
    queue_timeout: int


class SingleKeyRateLimiter:
    """
    Global rate limiter for a provider using a single API key or credentials.

    Features:
    - RPM tracking to respect API limits
    - Semaphore for max concurrent calls
    - Configurable queue timeout
    """

    def __init__(self, config: RateLimiterConfig):
        self.config = config
        self.semaphore = asyncio.Semaphore(config.max_concurrent)
        self.lock = asyncio.Lock()
        self.timestamps = deque()

        if config.enabled:
            logger.info(
                f"🔑 SingleKeyRateLimiter initialized: "
                f"{config.max_rpm} RPM limit, "
                f"{config.max_concurrent} concurrent limit"
            )

    async def acquire(self) -> bool:
        """
        Acquire a rate limit slot.

        Returns:
            bool: True if slot acquired, False if timeout/failure.
        """
        if not self.config.enabled:
            return True

        deadline = time.time() + self.config.queue_timeout

        while True:
            remaining = deadline - time.time()
            if remaining <= 0:
                logger.warning("Rate limiter timeout - queue full")
                return False

            # Wait for semaphore (concurrency limit)
            try:
                await asyncio.wait_for(self.semaphore.acquire(), timeout=remaining)
            except asyncio.TimeoutError:
                logger.warning("Rate limiter timeout - queue full")
                return False

            wait_time = 0.0
            async with self.lock:
                now = time.time()

                # Clean old timestamps (older than 60 seconds)
                while self.timestamps and now - self.timestamps[0] > 60:
                    self.timestamps.popleft()

                # Check if this provider has RPM capacity
                if len(self.timestamps) < self.config.max_rpm:
                    self.timestamps.append(now)
                    logger.debug(
                        f"Rate limiter slot acquired. "
                        f"RPM: {len(self.timestamps)}/{self.config.max_rpm}"
                    )
                    return True

                # RPM limit reached - compute wait time without blocking the semaphore
                wait_time = 60 - (now - self.timestamps[0])
                logger.info(f"RPM limit reached, waiting {wait_time:.1f}s")

            # No capacity available; release semaphore before waiting
            self.semaphore.release()

            if wait_time <= 0:
                await asyncio.sleep(0)
                continue

            sleep_for = min(wait_time, max(deadline - time.time(), 0))
            if sleep_for <= 0:
                return False
            await asyncio.sleep(sleep_for)

    def release(self):
        """Release semaphore after LLM call completes."""
        if self.config.enabled:
            self.semaphore.release()

    def get_stats(self) -> dict:
        """Get current rate limiter statistics."""
        now = time.time()
        recent = sum(1 for t in self.timestamps if now - t <= 60)
        # Mask key for security if it exists
        key = self.config.api_key
        masked = f"{key[:8]}...{key[-4:]}" if len(key) > 12 else key
        return {
            "rpm_used": recent,
            "rpm_limit": self.config.max_rpm,
            "api_key": masked,
        }


class ProviderRateLimiter:
    """Provider-aware LLM rate limiter managing single key instances."""

    def __init__(self, app_config):
        self.app_config = app_config
        self.limiters: dict[str, SingleKeyRateLimiter] = {}
        self.lock = asyncio.Lock()

    async def acquire(self, provider: str) -> tuple[bool, str | None]:
        limiter = await self._get_limiter(provider)
        if limiter is None:
            logger.error("No API key/credentials configured for provider %s", provider)
            return False, None

        success = await limiter.acquire()
        if not success:
            return False, None
        return True, limiter.config.api_key

    async def _get_limiter(self, provider: str) -> SingleKeyRateLimiter | None:
        provider = provider.strip().lower()
        async with self.lock:
            if provider in self.limiters:
                return self.limiters[provider]

            api_key = get_provider_api_key(provider)
            if not api_key:
                return None

            config = RateLimiterConfig(
                enabled=getattr(self.app_config, "LLM_RATELIMIT_ENABLED", True),
                api_key=api_key,
                max_rpm=getattr(self.app_config, "LLM_MAX_RPM_PER_KEY", 25),
                max_concurrent=getattr(self.app_config, "LLM_MAX_CONCURRENT", 5),
                queue_timeout=getattr(self.app_config, "LLM_QUEUE_TIMEOUT", 60),
            )
            limiter = SingleKeyRateLimiter(config)
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
        app_config: Application configuration class.

    Returns:
        Configured provider-aware rate limiter instance.
    """
    return ProviderRateLimiter(app_config)
