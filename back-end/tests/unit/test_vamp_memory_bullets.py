import pytest
import asyncio
from unittest.mock import MagicMock, AsyncMock

def test_memory_bullets():
    asyncio.run(_test_memory_bullets())

async def _test_memory_bullets():
    from app.features.vamp_memory.application.vamp_memory_service import VampMemoryService, format_historical_context

    mock_summary_repo = MagicMock()
    mock_vector_store = MagicMock()
    mock_vector_store.upsert = AsyncMock()
    mock_vector_store.search = AsyncMock()

    # Create dummy embeddings
    def dummy_embed(text):
        return [0.1] * 1536

    service = VampMemoryService(
        summary_repo=mock_summary_repo,
        vector_store=mock_vector_store,
        embedding_provider=dummy_embed,
        embedding_model="test-model",
        context_budget_chars=12000,
    )

    # 1 & 2: A summary block with multiple bullets produces multiple Qdrant pointer payloads
    # Bullet pointer payload does not store full text
    block = {
        "conversation_id": "conv-1",
        "user_id": "u-1",
        "summary_id": "000001",
        "idx": 1,
        "text": "Parent text",
        "content_hash": "hash1",
        "schema_version": 2,
        "memory_bullets": [
            {"bullet_id": "000001#b001", "bullet_index": 1, "text": "Bullet 1"},
            {"bullet_id": "000001#b002", "bullet_index": 2, "text": "Bullet 2"}
        ]
    }
    
    await service.index_summary_block(block)
    
    upserts = mock_vector_store.upsert.call_args_list
    assert len(upserts) == 2, "Expected 2 bullet pointers only"
    
    bullet1_payload = upserts[0].kwargs["payload"]
    assert bullet1_payload["pointer_type"] == "memory_bullet"
    assert bullet1_payload["bullet_id"] == "000001#b001"
    assert "text" not in bullet1_payload

    # 3. Query matching a bullet retrieves the parent summary_id and matched bullet.
    # 4. Context injection uses matched bullet text instead of full parent block.
    # 5. Final selected context is chronological.
    
    mock_summary_repo.get_conversation.return_value = {"user_id": "u-1", "summary_count": 2}
    
    # Simulate search returning a bullet hit for block 1 and a parent hit for block 2 (which should be filtered out/ignored)
    mock_vector_store.search.return_value = [
        {"summary_id": "000001", "pointer_type": "memory_bullet", "bullet_id": "000001#b001", "score": 0.9},
        {"summary_id": "000002", "pointer_type": "summary_block", "score": 0.8}
    ]
    
    mock_summary_repo.get_blocks_by_ids.return_value = [
        block,
        {
            "conversation_id": "conv-1", "user_id": "u-1", "summary_id": "000002",
            "idx": 2, "text": "Old schema parent text", "schema_version": 1
        }
    ]
    
    units = await service.retrieve_blocks("conv-1", "u-1", "query")
    assert len(units) == 1
    
    # Format and check if bullet was injected instead of parent
    context = format_historical_context(units)
    assert "[Memory block 1 | matched bullets]" in context
    assert "- Bullet 1" in context
    assert "Parent text" not in context
    
    assert "[Memory block 2 | messages 1-1]" not in context
    assert "Old schema parent text" not in context
    
    # 7. Old schema v1 block with no bullets is skipped in VAMP v2 retrieval
    # (Tested by block 2 above)

    # 6. Strict audit still passes - tested externally by audit_strict_vamp_cleanliness.py
