# test_integration_rate_limit_race.py
import os
import pytest
import redis.asyncio as redis
from dotenv import load_dotenv
from services.rate_limiting.user_quota import UserQuotaService, UserQuotaConfig

# Load the environment variables from the project root .env
load_dotenv()

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.anyio
@pytest.mark.integration
async def test_integration_user_quota_real_redis():
    redis_url = os.getenv("UPSTASH_REDIS_URL", "redis://localhost:6379")
    if redis_url.startswith("redis://"):
        redis_url = redis_url.replace("redis://", "rediss://", 1)
        
    client = redis.from_url(redis_url, decode_responses=True, ssl_cert_reqs=None)
    
    # Verify ping works
    await client.ping()
    
    config = UserQuotaConfig(enabled=True, per_minute=2, per_hour=10, per_day=100)
    service = UserQuotaService(client, config)
    
    user_id = "test_user_integration_race"
    
    try:
        # Clean up any existing keys
        await client.delete(f"quota:{user_id}:minute")
        await client.delete(f"quota:{user_id}:hour")
        await client.delete(f"quota:{user_id}:day")
        
        # 1st request - allowed
        allowed, usage = await service.check_and_increment(user_id)
        assert allowed is True
        assert usage.minute["used"] == 1
        
        # 2nd request - allowed
        allowed, usage = await service.check_and_increment(user_id)
        assert allowed is True
        assert usage.minute["used"] == 2
        
        # 3rd request - exceeded
        allowed, usage = await service.check_and_increment(user_id)
        assert allowed is False
        
    finally:
        await client.delete(f"quota:{user_id}:minute")
        await client.delete(f"quota:{user_id}:hour")
        await client.delete(f"quota:{user_id}:day")
        await client.close()
