import pytest
import asyncio
from langchain_core.messages import AIMessageChunk
from agent.agent import stream_conversation

# Test our parser inside agent.py
class MockAgent:
    async def astream(self, *args, **kwargs):
        chunks = ["Hel", "lo! <th", "ink>This is ", "some reasoning", "</", "th", "ink>And this is", " the final answer."]
        for c in chunks:
            yield {
                "type": "messages",
                "data": (AIMessageChunk(content=c), {})
            }

@pytest.mark.anyio
async def test_parser():
    import agent.agent
    agent.agent._agent_cache[("test_provider", "test_model", True, "medium", "balanced")] = MockAgent()
    
    import agent.checkpointing
    from langgraph.checkpoint.memory import InMemorySaver
    async def mock_init(*args, **kwargs): pass
    agent.checkpointing.init_checkpointer = mock_init
    agent.checkpointing.get_checkpointer = lambda: InMemorySaver()
    agent.agent.get_checkpointer = lambda: InMemorySaver()
    agent.agent._has_checkpoint = lambda *args: asyncio.sleep(0, result=False)
    agent.agent._load_firestore_history = lambda *args: asyncio.sleep(0, result=[])

    print("Running stream...")
    stream = agent.agent.stream_conversation(
        conversation_id="test",
        message="test",
        user_id="test_user",
        provider="test_provider",
        model="test_model",
        enable_reasoning=True,
        reasoning_effort="medium"
    )
    
    tokens = []
    thinking = []
    
    async for chunk in stream:
        if '"type": "token"' in chunk:
            # parse JSON to string safely, but simple split works for test
            import json
            data = json.loads(chunk.replace("data: ", ""))
            tokens.append(data["content"])
        elif '"type": "thinking_token"' in chunk:
            import json
            data = json.loads(chunk.replace("data: ", ""))
            thinking.append(data["content"])
            
    print("Tokens:", "".join(tokens))
    print("Thinking:", "".join(thinking))
    
    assert "".join(tokens) == "Hello! And this is the final answer."
    assert "".join(thinking) == "This is some reasoning"
    print("SUCCESS: Think tags intercepted and split properly!")

if __name__ == "__main__":
    asyncio.run(test_parser())
