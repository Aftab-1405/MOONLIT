import importlib
import os
os.environ["FIREBASE_PROJECT_ID"] = "mock"
os.environ["FIREBASE_WEB_PROJECT_ID"] = "mock"

import pytest
import asyncio
from fastapi.testclient import TestClient
import httpx
import main
from app.core.dependencies import get_current_user, verify_session_cookie_value
from app.features.conversations.infrastructure.conversation_repository import ConversationRepository
from app.features.quota.application.rate_limiting.user_quota import UserQuotaService, UserQuotaConfig

# Mock Firebase initialization during import
import app.features.conversations.infrastructure.firestore_service
app.features.conversations.infrastructure.firestore_service.FirestoreService.initialize = lambda: None

app = main.create_app()

@pytest.fixture
def client():
    """Provides a TestClient with overridden auth dependency by default."""
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "test_user_123",
        "email": "test@example.com",
        "name": "Test User",
        "verified": True
    }
    
    with TestClient(app) as c:
        yield c
    
    app.dependency_overrides.clear()

def test_ssrf_on_db_connection(client):
    # Attempting to scan internal services via host parameter
    ssrf_hosts = [
        "169.254.169.254", # AWS metadata
        "localhost",       # Loopback
        "127.0.0.1",       # Loopback IP
        "10.0.0.1",        # VPC Internal
        "169.254.169.254.nip.io", # DNS Rebinding to AWS Metadata
        "::1",
        "0.0.0.0",
        "[::1]"
    ]
    
    client.cookies.set("csrf_token", "csrf_token_value")
    
    for host in ssrf_hosts:
        db_payload = {
            "db_type": "postgresql",
            "host": host,
            "port": 5432,
            "database": "postgres",
            "username": "admin",
            "password": "password"
        }
        response = client.post(
            "/api/v1/connect_db", 
            json=db_payload,
            headers={"x-csrf-token": "csrf_token_value"}
        )
        # Should be blocked explicitly by SSRF protection and return 400
        assert response.status_code == 400
        assert "cannot be used" in response.text or "not allowed" in response.text or "resolves to a private" in response.text.lower()

def test_ssrf_via_connection_strings(client):
    # Attempt SSRF via connection_string parameter (bypassing the host check via missing '@' formatting)
    ssrf_conn_strings = [
        "postgresql://localhost:5432/postgres",
        "postgresql://127.0.0.1:5432/postgres",
        "postgresql://169.254.169.254:5432/postgres",
        "postgresql://10.0.0.1:5432/postgres",
        "mysql://localhost:3306/mysql",
        "mysql://127.0.0.1:3306/mysql",
        "file:///etc/passwd",
        "postgresql://[::1]:5432/postgres",
        "postgresql://0.0.0.0:5432/postgres"
    ]
    
    client.cookies.set("csrf_token", "csrf_token_value")
    
    for conn_str in ssrf_conn_strings:
        db_payload = {
            "db_type": "postgresql",
            "connection_string": conn_str
        }
        response = client.post(
            "/api/v1/connect_db", 
            json=db_payload,
            headers={"x-csrf-token": "csrf_token_value"}
        )
        # Should be blocked explicitly by SSRF protection and return 400
        assert response.status_code == 400
        assert any(x in response.text.lower() for x in ["cannot be used", "not allowed", "private", "error", "loopback"])

def test_timing_based_port_scan_detection(client):
    import time
    client.cookies.set("csrf_token", "csrf_token_value")
    
    # 1. Send connection attempt to open port (22)
    start_time_open = time.time()
    client.post(
        "/api/v1/connect_db",
        json={"db_type": "postgresql", "host": "127.0.0.1", "port": 22},
        headers={"x-csrf-token": "csrf_token_value"}
    )
    duration_open = time.time() - start_time_open
    
    # 2. Send connection attempt to closed port (19999)
    start_time_closed = time.time()
    client.post(
        "/api/v1/connect_db",
        json={"db_type": "postgresql", "host": "127.0.0.1", "port": 19999},
        headers={"x-csrf-token": "csrf_token_value"}
    )
    duration_closed = time.time() - start_time_closed
    
    # Verify that response time delta is <= 2s (indicating the request was blocked instantly by security filters without actual connection attempt)
    delta = abs(duration_open - duration_closed)
    assert delta <= 2.0, f"VULNERABILITY: Timing delta of {delta:.2f}s suggests timing-based port scanning is possible!"

def test_idor_on_conversations(client):
    # Mock ConversationRepository.get to return a mock conversation belonging to user "victim_123"
    original_get = ConversationRepository.get
    
    # Store mocked conversations
    mocked_conversations = {
        "victim_conv_999": {
            "user_id": "victim_123",
            "title": "Victim's Private Data",
            "messages": [{"role": "user", "content": "My private secret"}]
        }
    }
    # Add 1 to 20 victim conversations
    for idx in range(1, 21):
        mocked_conversations[str(idx)] = {
            "user_id": "victim_123",
            "title": f"Victim Conversation {idx}",
            "messages": [{"role": "user", "content": f"Secret {idx}"}]
        }
        
    def mock_get(conversation_id):
        cid = str(conversation_id)
        if cid in mocked_conversations:
            return mocked_conversations[cid]
        return original_get(conversation_id)
        
    ConversationRepository.get = staticmethod(mock_get)
    
    try:
        # 1. Attempt to access victim's conversation as test_user_123
        response = client.get("/api/v1/get_conversation/victim_conv_999")
        # Should return 403 Forbidden because test_user_123 doesn't own it
        assert response.status_code == 403
        assert "User does not own this conversation" in response.text
        
        # 2. Add enumeration loop: iterate IDs 1 to 20 with User A's token
        # Assert all return 403 (not 200)
        for idx in range(1, 21):
            res = client.get(f"/api/v1/get_conversation/{idx}")
            assert res.status_code == 403, f"IDOR vulnerability! Enumerating conversation {idx} returned {res.status_code}"
            assert "User does not own this conversation" in res.text
            
        # 3. Add test for accessing messages inside another user's conversation
        # Verify that the response is rejected and private messages are not accessible
        res_msgs = client.get("/api/v1/get_conversation/victim_conv_999")
        assert res_msgs.status_code == 403
        assert "messages" not in res_msgs.text
    finally:
        ConversationRepository.get = original_get

def test_idor_on_non_conversation_resources(client):
    # Test for IDOR on non-conversation resources: user settings, DB configs, schema selections.
    client.cookies.set("csrf_token", "csrf_token_value")
    
    # 1. User Settings (POST): Send settings update with a forged uid/user_id in JSON payload
    settings_payload = {
        "theme": "dark",
        "uid": "victim_123",
        "user_id": "victim_123"
    }
    response_settings = client.post(
        "/api/v1/user/settings",
        json=settings_payload,
        headers={"x-csrf-token": "csrf_token_value"}
    )
    # The endpoint should return 200/422 but MUST NOT update settings of victim_123.
    # It must only affect the currently authenticated user (test_user_123).
    assert response_settings.status_code != 403
    
    # 2. DB Config (POST): Send db connection payload with external user_id field
    db_payload = {
        "db_type": "postgresql",
        "host": "localhost",
        "port": 5432,
        "database": "postgres",
        "username": "admin",
        "password": "password",
        "user_id": "victim_123"
    }
    response_db = client.post(
        "/api/v1/connect_db",
        json=db_payload,
        headers={"x-csrf-token": "csrf_token_value"}
    )
    assert response_db.status_code in [400, 422]
    
    # 3. Schema Selection (POST): Send schema selection payload with external user_id field
    schema_payload = {
        "schema_name": "public",
        "user_id": "victim_123"
    }
    response_schema = client.post(
        "/api/v1/select_schema",
        json=schema_payload,
        headers={"x-csrf-token": "csrf_token_value"}
    )
    assert response_schema.status_code in [400, 422]

def test_jwt_forgery_attempt():
    # Remove auth overrides so we test real Firebase cookie verification logic
    app.dependency_overrides.clear()
    
    # Mock verify_session_cookie_value in dependencies
    import app.core.dependencies as dependencies
    original_verify = dependencies.verify_session_cookie_value
    
    def mock_verify(cookie_val):
        if cookie_val == "valid_jwt_cookie":
            return {
                "uid": "test_user_123",
                "email": "test@example.com",
                "name": "Test User",
                "verified": True
            }
        # Simulate Firebase auth raising exception for invalid/forged signature
        raise Exception("Firebase session cookie signature is invalid")
        
    dependencies.verify_session_cookie_value = mock_verify
    
    try:
        # 1. Test with valid session cookie
        with TestClient(app) as test_client:
            test_client.cookies.set("firebase_session", "valid_jwt_cookie")
            response = test_client.get("/api/v1/user/context")
            # Should succeed or return 404 (due to missing DB) but NOT 401
            assert response.status_code != 401
            
        # 2. Test with forged/invalid session cookie
        with TestClient(app) as test_client:
            test_client.cookies.set("firebase_session", "forged_jwt_cookie_signature")
            response = test_client.get("/api/v1/user/context")
            # Should cleanly reject as 401 Unauthorized
            assert response.status_code == 401
    finally:
        dependencies.verify_session_cookie_value = original_verify

def test_jwt_alg_none():
    # Remove auth overrides so we test real Firebase cookie verification logic
    app.dependency_overrides.clear()
    
    # Craft a JWT with alg=none and empty signature
    import base64
    import json
    
    def b64_encode(d):
        return base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip("=")
        
    header = {"alg": "none", "typ": "JWT"}
    payload = {
        "uid": "hacker_123",
        "email": "hacker@evil.com",
        "name": "Hacker",
        "verified": True
    }
    
    token = f"{b64_encode(header)}.{b64_encode(payload)}."
    
    with TestClient(app) as test_client:
        test_client.cookies.set("firebase_session", token)
        response = test_client.get("/api/v1/user/context")
        # Should cleanly reject as 401 Unauthorized
        assert response.status_code == 401

def test_jwt_algorithm_confusion():
    # Remove auth overrides so we test real Firebase cookie verification logic
    app.dependency_overrides.clear()
    
    import base64
    import json
    import hmac
    import hashlib
    
    def b64_encode(d):
        return base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip("=")
        
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "uid": "hacker_123",
        "email": "hacker@evil.com",
        "name": "Hacker",
        "verified": True
    }
    
    unsigned_token = f"{b64_encode(header)}.{b64_encode(payload)}"
    
    # Sign with a mock public key as secret
    mock_public_key = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----"
    signature = hmac.new(
        mock_public_key.encode(),
        unsigned_token.encode(),
        hashlib.sha256
    ).digest()
    
    signature_b64 = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    token = f"{unsigned_token}.{signature_b64}"
    
    with TestClient(app) as test_client:
        test_client.cookies.set("firebase_session", token)
        response = test_client.get("/api/v1/user/context")
        # Should cleanly reject as 401 Unauthorized
        assert response.status_code == 401

# A mock redis that simulates network latency and tracks values in memory
class MockAsyncRedisForDOS:
    def __init__(self):
        self.store = {}
        self.ttl_store = {}
    
    async def get(self, key):
        await asyncio.sleep(0.001)
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
                await asyncio.sleep(0.001)
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
async def test_concurrent_load_dos():
    mock_redis = MockAsyncRedisForDOS()
    
    # Setup custom quota limits on app state for testing rate limiting
    app.state.user_quota = UserQuotaService(
        redis_client=mock_redis,
        config=UserQuotaConfig(enabled=True, per_minute=5, per_hour=100, per_day=1000)
    )
    
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "dos_hacker",
        "email": "dos_hacker@moonlit.local",
        "name": "DOS Hacker",
        "verified": True
    }
    
    async def make_request(async_client):
        # We need to bypass CSRF for POST to /api/v1/resume_agent
        # By setting matching headers and cookies
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
        
    original_get = ConversationRepository.get
    ConversationRepository.get = staticmethod(lambda cid: {
        "user_id": "dos_hacker",
        "title": "Dummy Conversation",
        "messages": []
    })
    
    # Mock get_checkpointer in both modules to prevent Env/lifespan check failures
    checkpointing_module = importlib.import_module("app.features.agent_orchestration.infrastructure.checkpointing")
    from langgraph.checkpoint.memory import InMemorySaver
    
    original_get_cp = checkpointing_module.get_checkpointer
    original_agent_get_cp = getattr(checkpointing_module, "get_checkpointer", None)
    
    checkpointing_module.get_checkpointer = lambda: InMemorySaver()
    sc = importlib.import_module("app.features.agent_orchestration.application.stream_conversation")
    sc.get_checkpointer = lambda: InMemorySaver()
    
    try:
        print(f"TYPE OF APP: {type(app)}")
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as async_client:
            # Fire 30 concurrent requests (quota limit is 5 per minute)
            tasks = [make_request(async_client) for _ in range(30)]
            responses = await asyncio.gather(*tasks)
    finally:
        ConversationRepository.get = original_get
        checkpointing_module.get_checkpointer = original_get_cp
        if original_agent_get_cp is not None:
            sc = importlib.import_module("app.features.agent_orchestration.application.stream_conversation")
            sc.get_checkpointer = original_agent_get_cp
        
    status_codes = [r.status_code for r in responses]
    too_many_requests = status_codes.count(429)
    
    print(f"Status codes: {status_codes}")
    print(f"Rate limited (429): {too_many_requests}")
    
    # Assert that rate limits are triggered
    assert too_many_requests >= 20, f"Rate limit was bypassed! Status codes: {status_codes}"
