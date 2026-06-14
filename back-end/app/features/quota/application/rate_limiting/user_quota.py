"""
User Quota Service - Per-user rate limiting using Redis.

Tracks per-user request counts across multiple timeframes (minute, hour, day)
to ensure fair usage distribution.
"""

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class UserQuotaConfig:
    """Configuration for per-user quota."""

    enabled: bool
    per_minute: int
    per_hour: int
    per_day: int


@dataclass
class QuotaUsage:
    """Current quota usage for a user."""

    minute: dict  # {"used": int, "limit": int, "resets_in": int}
    hour: dict
    day: dict

    def to_dict(self) -> dict:
        return {"minute": self.minute, "hour": self.hour, "day": self.day}


class UserQuotaService:
    """
    Per-user quota tracking using Redis.

    Uses Redis keys with TTL for automatic expiration:
    - quota:{user_id}:minute (TTL 60s)
    - quota:{user_id}:hour (TTL 3600s)
    - quota:{user_id}:day (TTL 86400s)
    """

    def __init__(self, redis_client, config: UserQuotaConfig):
        self.redis = redis_client
        self.config = config

        self.limits = {
            "minute": (config.per_minute, 60),
            "hour": (config.per_hour, 3600),
            "day": (config.per_day, 86400),
        }

        if config.enabled:
            logger.info(
                f"👤 UserQuotaService initialized: "
                f"{config.per_minute}/min, {config.per_hour}/hr, {config.per_day}/day"
            )

    def _get_key(self, user_id: str, timeframe: str) -> str:
        """Generate Redis key for user quota."""
        return f"quota:{user_id}:{timeframe}"

    async def check_and_increment(self, user_id: str) -> tuple[bool, QuotaUsage]:
        """
        Check if user is within quota and increment counters.

        Args:
            user_id: The user's ID

        Returns:
            tuple: (allowed: bool, usage: QuotaUsage)
            - allowed=True: Request can proceed
            - allowed=False: Quota exceeded
        """
        if not self.config.enabled:
            # Quota disabled - always allow
            return True, QuotaUsage(
                minute={"used": 0, "limit": self.config.per_minute, "resets_in": 0},
                hour={"used": 0, "limit": self.config.per_hour, "resets_in": 0},
                day={"used": 0, "limit": self.config.per_day, "resets_in": 0},
            )

        if not self.redis:
            logger.warning("Redis not available, skipping quota check")
            return True, QuotaUsage(
                minute={"used": 0, "limit": self.config.per_minute, "resets_in": 0},
                hour={"used": 0, "limit": self.config.per_hour, "resets_in": 0},
                day={"used": 0, "limit": self.config.per_day, "resets_in": 0},
            )

        usage_data = {}
        exceeded_timeframe = None

        # Atomic Increment first (eliminates TOCTOU race condition)
        pipe = self.redis.pipeline()
        for timeframe, (limit, ttl) in self.limits.items():
            key = self._get_key(user_id, timeframe)
            pipe.incr(key)
        
        try:
            incr_results = await pipe.execute()
        except Exception:
            # Fallback for synchronous mock redis (in tests)
            incr_results = []
            for timeframe in self.limits.keys():
                key = self._get_key(user_id, timeframe)
                val = await self.redis.incr(key)
                incr_results.append(val)

        # Check if any limit was exceeded
        for i, (timeframe, (limit, ttl)) in enumerate(self.limits.items()):
            current_count = incr_results[i]
            if current_count > limit:
                exceeded_timeframe = timeframe

            usage_data[timeframe] = {
                "used": current_count,
                "limit": limit,
            }

        if exceeded_timeframe:
            # Revert the increments since the request is denied
            pipe = self.redis.pipeline()
            for timeframe in self.limits.keys():
                key = self._get_key(user_id, timeframe)
                pipe.decr(key)
            try:
                await pipe.execute()
            except Exception:
                for timeframe in self.limits.keys():
                    key = self._get_key(user_id, timeframe)
                    await self.redis.decr(key)

            logger.warning(f"User {user_id} exceeded {exceeded_timeframe} quota")
            # We don't have exact TTLs here for the rejected payload, but 0 is fine
            for tf in self.limits.keys():
                usage_data[tf]["used"] -= 1
                usage_data[tf]["resets_in"] = 0
            
            return False, QuotaUsage(
                minute=usage_data.get("minute", {}),
                hour=usage_data.get("hour", {}),
                day=usage_data.get("day", {}),
            )

        # Set expirations for newly created keys
        pipe = self.redis.pipeline()
        for i, (timeframe, (limit, ttl)) in enumerate(self.limits.items()):
            key = self._get_key(user_id, timeframe)
            current_count = incr_results[i]
            if current_count == 1:
                pipe.expire(key, ttl)
            pipe.ttl(key)
            
        try:
            ttl_results = await pipe.execute()
        except Exception:
            ttl_results = []
            for i, (timeframe, (limit, ttl)) in enumerate(self.limits.items()):
                key = self._get_key(user_id, timeframe)
                if incr_results[i] == 1:
                    await self.redis.expire(key, ttl)
                ttl_results.append(await self.redis.ttl(key))
                
        # ttl_results will contain the results of expire and ttl commands.
        # Since expire returns a bool and ttl returns an int, the ttl is always the last result for each timeframe.
        # If current_count == 1, there are 2 commands (expire, ttl). If > 1, only 1 command (ttl).
        result_idx = 0
        for i, (timeframe, (limit, ttl)) in enumerate(self.limits.items()):
            if incr_results[i] == 1:
                result_idx += 1 # Skip expire result
            remaining_ttl = ttl_results[result_idx]
            result_idx += 1
            if remaining_ttl < 0:
                remaining_ttl = ttl
            usage_data[timeframe]["resets_in"] = remaining_ttl

        usage = QuotaUsage(
            minute=usage_data.get("minute", {}),
            hour=usage_data.get("hour", {}),
            day=usage_data.get("day", {}),
        )

        logger.debug(
            f"User {user_id} quota: {usage.minute['used']}/min, {usage.hour['used']}/hr"
        )
        return True, usage

    async def get_usage(self, user_id: str) -> QuotaUsage:
        """
        Get current quota usage for a user (without incrementing).

        Args:
            user_id: The user's ID

        Returns:
            QuotaUsage with current counts and reset times
        """
        if not self.config.enabled or not self.redis:
            return QuotaUsage(
                minute={"used": 0, "limit": self.config.per_minute, "resets_in": 0},
                hour={"used": 0, "limit": self.config.per_hour, "resets_in": 0},
                day={"used": 0, "limit": self.config.per_day, "resets_in": 0},
            )

        usage_data = {}

        for timeframe, (limit, ttl) in self.limits.items():
            key = self._get_key(user_id, timeframe)

            current = await self.redis.get(key)
            current_count = int(current) if current else 0

            remaining_ttl = await self.redis.ttl(key)
            if remaining_ttl < 0:
                remaining_ttl = ttl

            usage_data[timeframe] = {
                "used": current_count,
                "limit": limit,
                "resets_in": remaining_ttl,
            }

        return QuotaUsage(
            minute=usage_data.get("minute", {}),
            hour=usage_data.get("hour", {}),
            day=usage_data.get("day", {}),
        )


def create_user_quota_service(redis_client, app_config) -> UserQuotaService:
    """
    Factory function to create UserQuotaService from application config.

    Args:
        redis_client: Redis client instance (can be None)
        app_config: Application configuration class

    Returns:
        Configured UserQuotaService instance
    """
    config = UserQuotaConfig(
        enabled=getattr(app_config, "USER_QUOTA_ENABLED", True),
        per_minute=getattr(app_config, "USER_QUOTA_PER_MINUTE", 4),
        per_hour=getattr(app_config, "USER_QUOTA_PER_HOUR", 100),
        per_day=getattr(app_config, "USER_QUOTA_PER_DAY", 500),
    )
    return UserQuotaService(redis_client, config)
