import os
os.environ["FIREBASE_PROJECT_ID"] = "mock"
os.environ["FIREBASE_WEB_PROJECT_ID"] = "mock"

import pytest
import asyncio
import httpx
from services.rate_limiting.user_quota import UserQuotaService, UserQuotaConfig

# Mock Firestore initialization
import services.firestore_service
services.firestore_service.FirestoreService.initialize = lambda: None

from main import create_app
from dependencies import get_current_user
from repositories.conversation_repository import ConversationRepository

# A mock redis that simulates network latency
class MockAsyncRedis:
    def __init__(self):
        self.store = {}
        self.ttl_store = {}
    
    async def get(self, key):
        await asyncio.sleep(0.01) # Simulate network delay
        return self.store.get(key)
        
    async def ttl(self, key):
        return self.ttl_store.get(key, 60)
        
    def pipeline(self):
        class MockPipeline:
            def __init__(self, parent):
                self.parent = parent
                self.ops = []
            def incr(self, key):
                self.ops.append(("incr", key))
            def decr(self, key):
                self.ops.append(("decr", key))
            def expire(self, key, ttl):
                self.ops.append(("expire", key, ttl))
            def ttl(self, key):
                self.ops.append(("ttl", key))
            async def execute(self):
                await asyncio.sleep(0.01) # Simulate network delay
                results = []
                for op in self.ops:
                    if op[0] == "incr":
                        key = op[1]
                        val = int(self.parent.store.get(key, 0)) + 1
                        self.parent.store[key] = str(val)
                        results.append(val)
                    elif op[0] == "decr":
                        key = op[1]
                        val = int(self.parent.store.get(key, 0)) - 1
                        self.parent.store[key] = str(val)
                        results.append(val)
                    elif op[0] == "expire":
                        self.parent.ttl_store[op[1]] = op[2]
                        results.append(True)
                    elif op[0] == "ttl":
                        results.append(self.parent.ttl_store.get(op[1], 60))
                return results
        return MockPipeline(self)

@pytest.mark.anyio
async def test_rate_limit_race():
    redis = MockAsyncRedis()
    config = UserQuotaConfig(enabled=True, per_minute=5, per_hour=100, per_day=1000)
    service = UserQuotaService(redis, config)
    
    user_id = "hacker_user"
    
    # Fire 50 concurrent requests when limit is 5
    tasks = [service.check_and_increment(user_id) for _ in range(50)]
    results = await asyncio.gather(*tasks)
    
    success_count = sum(1 for allowed, usage in results if allowed)
    
    print(f"\n--- RACING THE RATE LIMITER ---")
    print(f"Configured Limit: {config.per_minute} per minute")
    print(f"Successful Requests: {success_count} (Should be exactly {config.per_minute})")
    
    # Assert that the rate limiter is secure and no race conditions bypassed the limit
    assert success_count == config.per_minute, f"Rate limit was bypassed! Allowed {success_count} requests when limit is {config.per_minute}"
    print("Rate limiter is secure.")

@pytest.mark.anyio
async def test_rate_limit_race_integration():
    app = create_app()
    
    mock_redis = MockAsyncRedis()
    
    # Configure low quota limit for testing
    limit = 5
    config = UserQuotaConfig(enabled=True, per_minute=limit, per_hour=100, per_day=1000)
    app.state.user_quota = UserQuotaService(mock_redis, config)
    
    # Mock user auth
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "rate_limit_hacker",
        "email": "hacker@rate.limit",
        "name": "Rate Limit Hacker",
        "verified": True
    }
    
    # Mock conversation check to avoid database connection
    original_get = ConversationRepository.get
    ConversationRepository.get = staticmethod(lambda cid: {
        "user_id": "rate_limit_hacker",
        "title": "Test Conversation",
        "messages": []
    })
    
    # Mock checkpointer to prevent env errors
    import agent.checkpointing
    import agent.agent
    from langgraph.checkpoint.memory import InMemorySaver
    
    original_get_cp = agent.checkpointing.get_checkpointer
    original_agent_get_cp = getattr(agent.agent, "get_checkpointer", None)
    agent.checkpointing.get_checkpointer = lambda: InMemorySaver()
    agent.agent.get_checkpointer = lambda: InMemorySaver()
    
    async def make_request(async_client):
        return await async_client.post(
            "/api/v1/resume_agent",
            json={
                "conversation_id": "dummy",
                "provider": "bedrock",
                "resume": {"action": "some_action"}
            },
            cookies={"csrf_token": "csrf_val"},
            headers={"x-csrf-token": "csrf_val"}
        )
        
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as async_client:
            # Fire 50 concurrent requests when limit is 5
            tasks = [make_request(async_client) for _ in range(50)]
            responses = await asyncio.gather(*tasks)
    finally:
        ConversationRepository.get = original_get
        agent.checkpointing.get_checkpointer = original_get_cp
        if original_agent_get_cp is not None:
            agent.agent.get_checkpointer = original_agent_get_cp
            
    status_codes = [r.status_code for r in responses]
    too_many_requests = status_codes.count(429)
    
    print(f"Integration Status codes: {status_codes}")
    print(f"Integration Rate limited (429): {too_many_requests}")
    
    # Assert that rate limits are triggered and at least (50 - limit) responses are 429
    assert too_many_requests >= (50 - limit), f"Rate limit bypassed in integration! Allowed {50 - too_many_requests} when limit is {limit}"

if __name__ == "__main__":
    asyncio.run(test_rate_limit_race())
