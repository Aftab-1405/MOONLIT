import os
import pytest
import importlib
import json
from fastapi.testclient import TestClient

@pytest.fixture(scope="module")
def client():
    import dependencies
    import main
    
    orig_bypass = dependencies.Config.DEV_AUTH_BYPASS
    orig_debug = dependencies.Config.DEBUG
    orig_user = dependencies.Config.DEV_AUTH_USER_ID
    
    dependencies.Config.DEV_AUTH_BYPASS = True
    dependencies.Config.DEBUG = True
    dependencies.Config.DEV_AUTH_USER_ID = "integration_think_user"
    
    app = main.create_app()
    with TestClient(app) as c:
        yield c
        
    dependencies.Config.DEV_AUTH_BYPASS = orig_bypass
    dependencies.Config.DEBUG = orig_debug
    dependencies.Config.DEV_AUTH_USER_ID = orig_user

def csrf_headers(client):
    client.cookies.set("csrf_token", "csrf_val")
    return {"x-csrf-token": "csrf_val"}

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_agent_think_sse_stream(client):
    """Test that requesting reasoning returns thinking_tokens in the SSE stream."""
    models_str = os.getenv("BEDROCK_NATIVE_THINKING_MODELS", "moonshot.kimi-k2-thinking")
    thinking_models = [m.strip() for m in models_str.split(",") if m.strip()]
    if not thinking_models:
        pytest.skip("No thinking models configured")
        
    model = thinking_models[0]
    
    payload = {
        "prompt": "Say hello and think out loud.",
        "conversation_id": "test_think_integration",
        "provider": "bedrock",
        "model": model,
        "enable_reasoning": True,
        "reasoning_effort": "medium"
    }
    
    # We use stream=True on TestClient but we must iterate over iter_lines()
    with client.stream("POST", "/api/v1/pass_user_prompt_to_llm", json=payload, headers=csrf_headers(client)) as response:
        if response.status_code != 200:
            response.read()
            if response.status_code == 429:
                pytest.skip("Rate limited by LLM provider")
            if response.status_code in [500, 400, 401, 403]:
                content = response.text.lower()
                if "throttling" in content or "credentials" in content or "not found" in content or "invalid_provider" in content:
                    pytest.skip(f"LLM provider error: {response.text}")
            assert False, f"Expected 200, got {response.status_code}: {response.text}"
            
        has_thinking_token = False
        has_token = False
        
        for line in response.iter_lines():
            if line and line.startswith("data: "):
                try:
                    data = json.loads(line[6:])
                    chunk_type = data.get("type")
                    if chunk_type == "thinking_token":
                        has_thinking_token = True
                    elif chunk_type == "token":
                        has_token = True
                    elif chunk_type == "error":
                        pytest.skip(f"LLM Stream Error: {data.get('message')}")
                except json.JSONDecodeError:
                    pass
                    
        # Verify both types of tokens were returned
        assert has_token, "No standard tokens returned in stream"
        # Reasoning tokens are requested, but some models might not emit them despite being capable. 
        # But for an integration test of the thinking pipeline, we expect at least one if it works correctly.
        assert has_thinking_token, "No thinking tokens returned in stream despite enable_reasoning=True"
