# test_integration_checkpoint_persistence.py
import os
import pytest
import uuid
import json
import redis.asyncio as redis
from dotenv import load_dotenv
from app.features.agent_orchestration.application.stream_conversation import stream_conversation
from app.features.agent_orchestration.infrastructure.checkpointing import init_checkpointer, shutdown_checkpointer, get_checkpointer, UpstashRedisSaver
from app.core.config import Config

load_dotenv()

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.anyio
@pytest.mark.integration
async def test_integration_checkpoint_persistence():
    # Setup test env (pointing to Upstash Redis with SSL)
    redis_url = os.getenv("UPSTASH_REDIS_URL")
    if redis_url and redis_url.startswith("redis://"):
        redis_url = redis_url.replace("redis://", "rediss://", 1)

    # Clean checkpointer state
    await shutdown_checkpointer()
    
    try:
        # Initialize real UpstashRedisSaver
        await init_checkpointer(app_env="production", redis_url=redis_url)
        
        # Verify get_checkpointer returns UpstashRedisSaver
        cp = get_checkpointer()
        assert isinstance(cp, UpstashRedisSaver)
        
        # Generate unique thread ID
        test_conv_id = f"integration_chk_{uuid.uuid4().hex}"
        test_user_id = "integration_chk_user"
        
        # Run first turn - introduce name
        stream1 = stream_conversation(
            conversation_id=test_conv_id,
            message="My name is Alice.",
            user_id=test_user_id,
            provider="bedrock",
            model="openai.gpt-oss-120b-1:0"
        )
        
        chunks1 = []
        async for chunk in stream1:
            chunks1.append(chunk)
            
        full_response1 = ""
        for c in chunks1:
            if '"type": "token"' in c:
                data = json.loads(c.replace("data: ", ""))
                full_response1 += data.get("content", "")
        print(f"Alice agent turn 1 response: {full_response1}")
            
        # Run second turn - ask name
        stream2 = stream_conversation(
            conversation_id=test_conv_id,
            message="What is my name?",
            user_id=test_user_id,
            provider="bedrock",
            model="openai.gpt-oss-120b-1:0"
        )
        
        chunks2 = []
        async for chunk in stream2:
            chunks2.append(chunk)
            
        full_response2 = ""
        for c in chunks2:
            if '"type": "token"' in c:
                data = json.loads(c.replace("data: ", ""))
                full_response2 += data.get("content", "")
                
        print(f"Alice agent response: {full_response2}")
        assert "Alice" in full_response2
        
    finally:
        # Clean up Redis keys
        if redis_url:
            client = redis.from_url(redis_url, ssl_cert_reqs=None)
            try:
                # Find keys related to this test conversation and delete them
                keys = await client.keys(f"*integration_chk_*")
                if keys:
                    await client.delete(*keys)
            except Exception as e:
                print(f"Cleanup error: {e}")
            finally:
                await client.close()
                
        # Reset checkpointer state
        await shutdown_checkpointer()
