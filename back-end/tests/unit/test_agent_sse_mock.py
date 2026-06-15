import importlib
import pytest
import asyncio
import json
from langchain_core.messages import AIMessageChunk
from langchain_core.messages.tool import ToolCallChunk
from app.features.agent_orchestration.application.stream_conversation import stream_conversation

class MockAgent:
    async def astream(self, *args, **kwargs):
        yield {"type": "messages", "data": (AIMessageChunk(content="I will open the editor now."), {})}
        tool_chunk = ToolCallChunk(name="open_sql_editor", args='{"query": "SELECT * FROM users"}', id="call_123", index=0)
        yield {"type": "messages", "data": (AIMessageChunk(content="", tool_call_chunks=[tool_chunk]), {})}
        yield {"type": "custom", "data": {"type": "ui_action", "action": "open_sql_editor", "payload": {"query": "SELECT * FROM users"}}}
        yield {"type": "messages", "data": (AIMessageChunk(content={"tool_calls": [{"name": "fake"}]}), {})}
        yield {"type": "custom", "data": "This is just a string, not an object!"}

@pytest.mark.anyio
async def test_stream_parser():
    print("Testing agent stream parser...")
    
    sc = importlib.import_module("app.features.agent_orchestration.application.stream_conversation")
    from langgraph.checkpoint.memory import InMemorySaver
    from unittest.mock import MagicMock
    from app.features.conversations.infrastructure.firestore_service import FirestoreService
    from app.features.conversations.infrastructure.conversation_repository import ConversationRepository
    
    # Mock FirestoreService and ConversationRepository
    mock_db = MagicMock()
    FirestoreService.get_db = lambda: mock_db
    ConversationRepository.get = lambda *args, **kwargs: {"user_id": "test_user", "task_checkpoint_summary": ""}
    
    sc._agent_cache[("bedrock", "mock", True, "medium", "balanced")] = MockAgent()
    sc.get_checkpointer = lambda: InMemorySaver()
    sc._has_checkpoint = lambda *args: asyncio.sleep(0, result=False)
    sc._load_firestore_history = lambda *args: asyncio.sleep(0, result=[])

    stream = stream_conversation(
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

    assert any('"type": "token"' in c and 'I will open the editor now.' in c for c in chunks), "Missing text token!"
    assert any('"type": "ui_action"' in c and 'open_sql_editor' in c for c in chunks), "Missing ui_action!"
    print("\nSUCCESS: The stream parser successfully handled tool call chunks and UI actions without crashing.")

if __name__ == "__main__":
    asyncio.run(test_stream_parser())
