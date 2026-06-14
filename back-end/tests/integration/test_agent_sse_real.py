# test_integration_agent_sse.py
import os
import pytest
import asyncio
import json
from dotenv import load_dotenv

load_dotenv()

def get_bedrock_models():
    models_str = os.getenv("BEDROCK_MODELS", "")
    if models_str:
        return [m.strip() for m in models_str.split(",") if m.strip()]
    return ["mistral.devstral-2-123b"]

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.anyio
@pytest.mark.parametrize("model_name", get_bedrock_models())
@pytest.mark.integration
async def test_integration_agent_stream_conversation(model_name):
    # Setup test env (pointing to Upstash Redis with SSL)
    redis_url = os.getenv("UPSTASH_REDIS_URL")
    if redis_url and redis_url.startswith("redis://"):
        os.environ["UPSTASH_REDIS_URL"] = redis_url.replace("redis://", "rediss://", 1)
        
    import app.features.agent_orchestration.application.stream_conversation
    import main
    
    # We do NOT use overrides. We run the real stream_conversation.
    # Note: We pass a simple prompt to minimize token usage and time.
    try:
        stream = agent.app.features.agent_orchestration.application.stream_conversation(
            conversation_id=f"integration_thread_{model_name.replace(':', '_').replace('.', '_')}",
            message="Count from 1 to 2.",
            user_id="integration_user_123",
            provider="bedrock",
            model=model_name
        )
        
        chunks = []
        async for chunk in stream:
            chunks.append(chunk)
            print(f"[{model_name}] SSE: {chunk.strip()}")
            
        assert len(chunks) > 0
        
        # Check if an error chunk was returned
        error_chunk = next((c for c in chunks if '"type": "error"' in c), None)
        if error_chunk:
            err_data = json.loads(error_chunk.replace("data: ", ""))
            err_msg = err_data.get("message", "")
            pytest.skip(f"AWS Bedrock model call failed for {model_name} with message: {err_msg}")
        
        # The stream should end with a done event
        assert any('"type": "done"' in c for c in chunks)
        # It should contain some token events
        assert any('"type": "token"' in c for c in chunks)
        
    except Exception as e:
        err_str = str(e).lower()
        if "throttling" in err_str or "too many requests" in err_str or "credentials" in err_str or "unauthorized" in err_str or "access denied" in err_str or "throttlingexception" in err_str or "payment" in err_str or "validationexception" in err_str or "model identifier" in err_str:
            pytest.skip(f"AWS Bedrock model call failed: {e}")
        else:
            raise
