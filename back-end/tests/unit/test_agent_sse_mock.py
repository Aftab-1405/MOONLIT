import pytest
import asyncio
import json
from langchain_core.messages import AIMessageChunk
from langchain_core.messages.tool import ToolCallChunk
from agent.agent import stream_conversation

# Let's test the SSE generation logic directly!
# We don't need to spin up the whole LangGraph, we can just mock the astream generator.

class MockAgent:
    async def astream(self, *args, **kwargs):
        # 1. Yield some text
        yield {
            "type": "messages",
            "data": (AIMessageChunk(content="I will open the editor now."), {})
        }
        
        # 2. Yield a tool call chunk (simulating what an LLM does when calling a tool)
        tool_chunk = ToolCallChunk(
            name="open_sql_editor",
            args='{"query": "SELECT * FROM users"}',
            id="call_123",
            index=0
        )
        yield {
            "type": "messages",
            "data": (AIMessageChunk(content="", tool_call_chunks=[tool_chunk]), {})
        }
        
        # 3. Yield the custom UI action from the ToolNode
        yield {
            "type": "custom",
            "data": {
                "type": "ui_action",
                "action": "open_sql_editor",
                "payload": {"query": "SELECT * FROM users"}
            }
        }
        
        # 4. Yield a malformed message chunk (content is a dict)
        yield {
            "type": "messages",
            "data": (AIMessageChunk(content={"tool_calls": [{"name": "fake"}]}), {})
        }
        
        # 5. Yield a malformed custom event (not a dict)
        yield {
            "type": "custom",
            "data": "This is just a string, not an object!"
        }

@pytest.mark.anyio
async def test_stream_parser():
    print("Testing agent stream parser...")
    
    # Patch the cache so we don't compile the real agent
    import agent.agent
    agent.agent._agent_cache[("bedrock", "mock", True, "medium", "balanced")] = MockAgent()
    
    # Patch checkpointer
    import agent.checkpointing
    from langgraph.checkpoint.memory import InMemorySaver
    async def mock_init(*args, **kwargs): pass
    agent.checkpointing.init_checkpointer = mock_init
    agent.checkpointing.get_checkpointer = lambda: InMemorySaver()
    agent.agent.get_checkpointer = lambda: InMemorySaver()
    agent.agent._has_checkpoint = lambda *args: asyncio.sleep(0, result=False)
    agent.agent._load_firestore_history = lambda *args: asyncio.sleep(0, result=[])

    stream = agent.agent.stream_conversation(
        conversation_id="test_sse_123",
        message="Open the editor.",
        user_id="test_user",
        provider="bedrock",
        model="mock",
        enable_reasoning=True,
        reasoning_effort="medium"
    )
    
    chunks = []
    async for chunk in stream:
        chunks.append(chunk)
        print(f"Emitted: {chunk.strip()}")

    # Assertions
    assert any('"type": "token"' in c and 'I will open the editor now.' in c for c in chunks), "Missing text token!"
    assert any('"type": "ui_action"' in c and 'open_sql_editor' in c for c in chunks), "Missing ui_action!"
    print("\nSUCCESS: The stream parser successfully handled tool call chunks and UI actions without crashing.")

if __name__ == "__main__":
    asyncio.run(test_stream_parser())
