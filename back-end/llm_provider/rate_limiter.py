"""
LLM Rate Limiter — per-user-per-provider RPM + concurrency limiting.

Why per-user-per-provider?
--------------------------
FIX [M18]: The original implementation used a single
:class:`SingleKeyRateLimiter` per provider, shared across ALL users. With
``LLM_MAX_RPM_PER_KEY=25`` and 10 concurrent users each sending a few
requests per minute, one user could exhaust the global RPM budget for
everybody. The limiter now keys on ``f"{provider}:{user_id}"`` so each
user has their own slot budget.

Why Redis-backed?
-----------------
FIX [M19]: The in-process ``asyncio.BoundedSemaphore`` and ``deque``
were per-uvicorn-worker — with ``--workers 4`` the effective RPM limit
became ``LLM_MAX_RPM_PER_KEY * 4``, far exceeding the Bedrock account's
actual quota and triggering account-level throttling. The limiter now
uses a Redis sliding-window Lua script (``_RATE_LIMIT_LUA``) so every
worker shares the same counters. The in-process limiter remains as a
dev-mode fallback when Redis is unavailable.

Acquisition protocol
--------------------
``acquire(provider, user_id)`` returns ``(success, api_key)``:

- ``success=True``: caller MUST call ``release(provider, user_id)`` when
  the LLM call completes (the Redis sliding-window counter is
  per-minute; release decrements only the concurrency counter, not the
  RPM counter).
- ``success=False``: caller should refund any pre-debited quota (see
  FIX [C4]) and surface a 429.
"""

import asyncio
import logging
import time
from collections import deque
from dataclasses import dataclass

from llm_provider.model_factory import get_provider_api_key, get_supported_providers

logger = logging.getLogger(__name__)


# FIX [M19]: Atomic sliding-window rate limiter.
#
# ZREMRANGEBYSCORE drops entries older than (now - 60s), then ZCARD counts
# the remaining entries. If the count is below max_rpm we add a new member
# at score=now with a unique member value (now + ":" + a tiny sequence) and
# return 1 (allowed). Otherwise return 0 (rejected). The whole sequence is
# atomic because Lua scripts in Redis run to completion without
# interruption — every worker sees the same counter state.
_RATE_LIMIT_LUA = """
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local max_rpm = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count < max_rpm then
    redis.call('ZADD', key, now, member)
    redis.call('PEXPIRE', key, window)
    return 1
end
return 0
"""

# Concurrency limiter: INCR up to max_concurrent; DECR on release.
# Atomic so two workers can't both see "1" and both increment past the cap.
_CONCURRENCY_ACQUIRE_LUA = """
local key = KEYS[1]
local max_concurrent = tonumber(ARGV[1])
local current = tonumber(redis.call('GET', key) or '0')
if current < max_concurrent then
    redis.call('INCR', key)
    redis.call('PEXPIRE', key, 120000)
    return 1
end
return 0
"""

# ENH [RL-ACCOUNT]: Global account-level RPM guard.
#
# The per-user limiter (above) prevents one user from starving another, but
# it does NOT protect the Bedrock account's total RPM quota. If 100 users
# each send 5 RPM = 500 RPM total, and the Bedrock account limit is 500,
# the account gets throttled — even though every user was "under their limit."
#
# This global guard uses the same sliding-window ZSET pattern as the per-user
# guard, but keys on the provider only (not the user). It runs BEFORE the
# per-user check so account-level rejection happens fast.
#
# Configure via LLM_ACCOUNT_MAX_RPM (default 0 = disabled, meaning the
# account quota is assumed to be managed by Bedrock's own throttling).
_ACCOUNT_RPM_LUA = """
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local max_rpm = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count < max_rpm then
    redis.call('ZADD', key, now, member)
    redis.call('PEXPIRE', key, window)
    return 1
end
return 0
"""


# ENH [RL-REFUND]: RPM slot refund Lua script.
# When the concurrency limiter rejects (concurrency full), we "refund" the
# RPM slot by removing the ZSET member we just added. This prevents the
# RPM slot from being burned while waiting for concurrency.
_RPM_REFUND_LUA = """
local key = KEYS[1]
local member = ARGV[2]
redis.call('ZREM', key, member)
return 1
"""


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
    In-process (per-worker) rate limiter for a single provider+user key.

    Used as the dev-mode fallback when Redis is unavailable (FIX [M19]).
    Production deployments use the Redis-backed sliding-window limiter in
    :class:`ProviderRateLimiter` directly. This class is still useful for
    unit tests and local development where Redis is not configured.

    Features:
    - RPM tracking via a 60-second sliding-window deque.
    - BoundedSemaphore for max concurrent calls.
    - Configurable queue timeout.
    """

    def __init__(self, config: RateLimiterConfig):
        self.config = config
        self.semaphore = asyncio.BoundedSemaphore(config.max_concurrent)
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

            try:
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
                            "Rate limiter slot acquired. RPM: %d/%d",
                            len(self.timestamps),
                            self.config.max_rpm,
                        )
                        return True

                    # RPM limit reached - compute wait time without blocking the semaphore
                    wait_time = 60 - (now - self.timestamps[0])
                    logger.info("RPM limit reached, waiting %.1fs", wait_time)
            except BaseException:
                self.semaphore.release()
                raise

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
            try:
                self.semaphore.release()
            except ValueError:
                logger.warning("Rate limiter semaphore released too many times.")

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
    """Per-user-per-provider rate limiter.

    Production (Redis available): uses a Redis sorted-set sliding window
    (``_RATE_LIMIT_LUA``) plus an INCR-based concurrency limiter
    (``_CONCURRENCY_ACQUIRE_LUA``) so all uvicorn workers share the same
    counters (FIX [M19]).

    Dev (no Redis): falls back to an in-process :class:`SingleKeyRateLimiter`
    keyed per ``f"{provider}:{user_id}"``. This is per-worker only and is
    only suitable for local development (FIX [M18] still applies — the key
    is per-user so one user can't starve another).

    Callers MUST call :meth:`release` exactly once for every successful
    :meth:`acquire` so the concurrency counter is decremented.
    """

    def __init__(self, app_config, redis_client=None):
        self.app_config = app_config
        self.redis = redis_client
        # FIX [M18]: keyed per-user-per-provider instead of per-provider.
        self.limiters: dict[str, SingleKeyRateLimiter] = {}
        self.lock = asyncio.Lock()

    def _redis_key(self, provider: str, user_id: str, *, suffix: str) -> str:
        """Build the Redis key for a per-user-per-provider limiter."""
        return f"llm_ratelimit:{provider}:{user_id}:{suffix}"

    async def acquire(self, provider: str, user_id: str) -> tuple[bool, str | None]:
        """
        Acquire a rate-limit slot for ``user_id`` on ``provider``.

        Args:
            provider: Provider name (e.g. ``"bedrock"``).
            user_id: The calling user's uid. FIX [M18]: previously this was
                not passed and the limiter was keyed only on ``provider``,
                so a single user could exhaust the global RPM budget.

        Returns:
            (success, api_key). On ``success=False`` the caller should
            refund any pre-debited quota (FIX [C4]) and surface a 429.
        """
        provider = provider.strip().lower()
        api_key = get_provider_api_key(provider)
        if not api_key:
            logger.error("No API key/credentials configured for provider %s", provider)
            return False, None

        if not getattr(self.app_config, "LLM_RATELIMIT_ENABLED", True):
            return True, api_key

        # FIX [M19]: Prefer the Redis-backed shared limiter when Redis is
        # available — multiple uvicorn workers share the same counters.
        if self.redis is not None:
            return await self._acquire_redis(provider, user_id, api_key)

        # Dev fallback: in-process per-user-per-provider limiter.
        limiter = await self._get_limiter(provider, user_id, api_key)
        if limiter is None:
            return False, None
        success = await limiter.acquire()
        if not success:
            return False, None
        return True, api_key

    async def _acquire_redis(self, provider: str, user_id: str, api_key: str) -> tuple[bool, str | None]:
        """Redis-backed sliding-window + concurrency acquire (FIX [M19]).

        ENH [RL-ACCOUNT]: Now checks the global account-level RPM guard
        BEFORE the per-user guard. This prevents total Bedrock account
        throttling when many users each stay under their per-user limit
        but the aggregate exceeds the account quota.

        ENH [RL-REFUND]: When the concurrency limiter rejects, the RPM
        slot is now refunded (removed from the ZSET) instead of being
        burned for 60 seconds. This prevents a user's RPM budget from
        being consumed by requests that never reached the LLM.
        """
        max_rpm = int(getattr(self.app_config, "LLM_MAX_RPM_PER_KEY", 25))
        max_concurrent = int(getattr(self.app_config, "LLM_MAX_CONCURRENT", 5))
        queue_timeout = int(getattr(self.app_config, "LLM_QUEUE_TIMEOUT", 60))
        # ENH [RL-ACCOUNT]: Account-level RPM guard (0 = disabled)
        account_max_rpm = int(getattr(self.app_config, "LLM_ACCOUNT_MAX_RPM", 0))

        rpm_key = self._redis_key(provider, user_id, suffix="rpm")
        conc_key = self._redis_key(provider, user_id, suffix="conc")
        # ENH [RL-ACCOUNT]: Global account-level key (no user_id)
        account_rpm_key = f"llm_ratelimit:{provider}:account:rpm"

        deadline = time.time() + queue_timeout
        member_seq = 0
        while True:
            now_ms = int(time.time() * 1000)
            member = f"{now_ms}:{member_seq}"
            member_seq += 1

            # ENH [RL-ACCOUNT]: Check account-level RPM first (if configured)
            if account_max_rpm > 0:
                try:
                    allowed_account = await self.redis.eval(
                        _ACCOUNT_RPM_LUA,
                        1,
                        account_rpm_key,
                        now_ms,
                        60_000,
                        account_max_rpm,
                        member,
                    )
                except Exception as exc:
                    logger.warning(
                        "Redis account-level RPM eval failed (%s); denying request to preserve Bedrock quota.",
                        exc,
                    )
                    return False, None

                if int(allowed_account) != 1:
                    # Account-level RPM full — this is the hard wall.
                    remaining = deadline - time.time()
                    if remaining <= 0:
                        logger.info(
                            "Account-level RPM limit reached for provider %s (limit=%d). Denying user %s.",
                            provider,
                            account_max_rpm,
                            user_id,
                        )
                        return False, None
                    await asyncio.sleep(min(0.5, remaining))
                    continue

            # Per-user RPM check
            try:
                allowed_rpm = await self.redis.eval(
                    _RATE_LIMIT_LUA,
                    1,
                    rpm_key,
                    now_ms,
                    60_000,  # 60-second window in ms
                    max_rpm,
                    member,
                )
            except Exception as exc:
                logger.warning(
                    "Redis rate-limit RPM eval failed (%s); denying request to "
                    "preserve Bedrock quota. Configure Redis for shared rate "
                    "limiting.",
                    exc,
                )
                return False, None

            if int(allowed_rpm) != 1:
                # Per-user RPM window full — wait and retry until queue_timeout.
                remaining = deadline - time.time()
                if remaining <= 0:
                    logger.info(
                        "Rate limiter queue timeout for user %s on provider %s",
                        user_id,
                        provider,
                    )
                    return False, None
                await asyncio.sleep(min(0.5, remaining))
                continue

            # RPM slot acquired — now acquire a concurrency slot.
            try:
                allowed_conc = await self.redis.eval(
                    _CONCURRENCY_ACQUIRE_LUA,
                    1,
                    conc_key,
                    max_concurrent,
                )
            except Exception as exc:
                # ENH [RL-REFUND]: Refund the RPM slot since we can't proceed
                await self._refund_rpm_slot(rpm_key, member)
                logger.warning(
                    "Redis rate-limit concurrency eval failed (%s); denying request. RPM slot refunded.",
                    exc,
                )
                return False, None

            if int(allowed_conc) == 1:
                logger.debug(
                    "Redis rate-limit slot acquired for user %s on %s",
                    user_id,
                    provider,
                )
                return True, api_key

            # ENH [RL-REFUND]: Concurrency full — refund the RPM slot so it's
            # not burned for 60 seconds while we wait. Then retry.
            await self._refund_rpm_slot(rpm_key, member)

            remaining = deadline - time.time()
            if remaining <= 0:
                logger.info(
                    "Rate limiter concurrency timeout for user %s on provider %s",
                    user_id,
                    provider,
                )
                return False, None
            await asyncio.sleep(min(0.5, remaining))

    async def _refund_rpm_slot(self, rpm_key: str, member: str) -> None:
        """ENH [RL-REFUND]: Remove an RPM slot from the sliding window.

        Called when the concurrency limiter rejects — without this, the RPM
        slot would be "burned" for 60 seconds even though the request never
        reached the LLM, effectively reducing the user's RPM budget.
        """
        try:
            await self.redis.eval(
                _RPM_REFUND_LUA,
                1,
                rpm_key,
                member,
            )
        except Exception as exc:
            # Non-fatal — the slot will expire naturally in 60s.
            logger.debug("RPM slot refund failed (will expire naturally): %s", exc)

    async def _get_limiter(self, provider: str, user_id: str, api_key: str) -> SingleKeyRateLimiter | None:
        """Get (or lazily create) the in-process limiter for this (provider, user_id)."""
        # FIX [M18]: key on per-user-per-provider.
        cache_key = f"{provider}:{user_id}"
        async with self.lock:
            if cache_key in self.limiters:
                return self.limiters[cache_key]

            config = RateLimiterConfig(
                enabled=getattr(self.app_config, "LLM_RATELIMIT_ENABLED", True),
                api_key=api_key,
                max_rpm=getattr(self.app_config, "LLM_MAX_RPM_PER_KEY", 25),
                max_concurrent=getattr(self.app_config, "LLM_MAX_CONCURRENT", 5),
                queue_timeout=getattr(self.app_config, "LLM_QUEUE_TIMEOUT", 60),
            )
            limiter = SingleKeyRateLimiter(config)
            self.limiters[cache_key] = limiter
            return limiter

    async def release(self, provider: str, user_id: str) -> None:
        """Release the concurrency slot acquired by :meth:`acquire`.

        FIX [M18]: takes ``user_id`` so the release matches the per-user key
        used during acquire. RPM slots are NOT released — they expire from
        the 60-second sliding window naturally.
        """
        provider = provider.strip().lower()
        if self.redis is not None:
            conc_key = self._redis_key(provider, user_id, suffix="conc")
            try:
                # DECR the concurrency counter; clamp at 0 so an accidental
                # double-release doesn't go negative and permit an extra
                # concurrent request.
                current = await self.redis.decr(conc_key)
                if current < 0:
                    # Race — reset to 0 to be safe.
                    await self.redis.set(conc_key, 0)
            except Exception as exc:
                logger.warning(
                    "Redis rate-limit concurrency release failed for user %s "
                    "on %s: %s. Concurrency counter may drift; will self-heal "
                    "via the 120s PEXPIRE.",
                    user_id,
                    provider,
                    exc,
                )
            return

        # Dev fallback path.
        cache_key = f"{provider}:{user_id}"
        limiter = self.limiters.get(cache_key)
        if limiter:
            limiter.release()

    def configured_provider_count(self) -> int:
        return len(get_supported_providers())

    def get_stats(self) -> dict:
        # Per-user stats are not aggregated here; callers should query Redis
        # directly for live per-user counters. The in-process fallbacks are
        # included for dev-mode visibility.
        return {f"{key}": limiter.get_stats() for key, limiter in self.limiters.items()}


def create_rate_limiter(app_config, redis_client=None) -> ProviderRateLimiter:
    """
    Factory function to create rate limiter from application config.

    Args:
        app_config: Application configuration class.
        redis_client: Optional async Redis client. When provided, the
            limiter uses Redis-backed sliding-window counters shared
            across all uvicorn workers (FIX [M19]). When ``None``, falls
            back to in-process per-worker limiting (dev only).

    Returns:
        Configured provider-aware rate limiter instance.
    """
    return ProviderRateLimiter(app_config, redis_client=redis_client)
