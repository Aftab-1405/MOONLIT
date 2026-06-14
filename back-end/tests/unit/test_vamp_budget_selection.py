import sys
import os
import pytest

# Add project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.features.vamp_memory.application.vamp_memory_service import VampMemoryService

class DummyRepo:
    pass

class DummyVectorStore:
    pass

def test_vamp_budget_selection():
    """
    Test that VampMemoryService._dedupe_select_budget_then_sort:
    1. Selects high-scoring blocks that fit within budget instead of dropping them.
    2. Sorts selected blocks chronologically by idx.
    3. Respects character budget limit.
    """
    vamp_service = VampMemoryService(
        summary_repo=DummyRepo(),
        vector_store=DummyVectorStore(),
        context_budget_chars=10000
    )

    # 1. Define dummy blocks
    # Block 1: old, large, low score (0.5)
    block_1 = {
        "idx": 1,
        "summary_id": "s1",
        "text": "A" * 6000,
        "_retrieval_score": 0.5,
        "_retrieval_rank": 2,
    }
    # Block 2: old, large, low score (0.6)
    block_2 = {
        "idx": 2,
        "summary_id": "s2",
        "text": "B" * 7000,
        "_retrieval_score": 0.6,
        "_retrieval_rank": 1,
    }
    # Block 24: newer, high score (0.9), contains target fact
    block_24 = {
        "idx": 24,
        "summary_id": "s24",
        "text": "C" * 5000,
        "_retrieval_score": 0.9,
        "_retrieval_rank": 0,
    }

    blocks = [block_1, block_2, block_24]

    # --- SIMULATION OF OLD CHRONOLOGICAL BUDGETING ---
    # Sorts by idx first: [block_1, block_2, block_24]
    # block_1 (6000) fits (used=6000)
    # block_2 (7000) does not fit (6000+7000=13000 > 10000) -> skipped
    # block_24 (5000) does not fit (6000+5000=11000 > 10000) -> skipped (dropped!)
    old_selected_ids = []
    used = 0
    for b in sorted(blocks, key=lambda x: x["idx"]):
        size = len(b["text"])
        if used + size <= 10000:
            old_selected_ids.append(b["summary_id"])
            used += size
    assert old_selected_ids == ["s1"]
    assert "s24" not in old_selected_ids

    # --- NEW SCORE-AWARE BUDGETING ---
    new_selected = vamp_service._dedupe_select_budget_then_sort(blocks, budget_chars=10000)
    new_selected_ids = [b["summary_id"] for b in new_selected]

    # Block 24 has score 0.9, fits within 10,000 budget (size 5000).
    # Then Block 2 and Block 1 are too large to fit in remaining 5000 space.
    assert "s24" in new_selected_ids
    assert "s1" not in new_selected_ids
    assert "s2" not in new_selected_ids
    assert len(new_selected) == 1

    # Verify final returned order is sorted by idx chronologically
    # Let's add multiple blocks that can fit to verify final chronological sorting.
    block_small_1 = {
        "idx": 5,
        "summary_id": "s5",
        "text": "D" * 2000,
        "_retrieval_score": 0.8,
        "_retrieval_rank": 1,
    }
    block_small_2 = {
        "idx": 15,
        "summary_id": "s15",
        "text": "E" * 2000,
        "_retrieval_score": 0.7,
        "_retrieval_rank": 2,
    }
    # block_24 is size 5000, score 0.9.
    # Total space = 5000 + 2000 + 2000 = 9000 <= 10000. All three fit.
    fitting_blocks = [block_small_2, block_small_1, block_24]
    selected_fit = vamp_service._dedupe_select_budget_then_sort(fitting_blocks, budget_chars=10000)

    # All three should be selected
    assert len(selected_fit) == 3
    # They must be sorted chronologically: idx 5, then idx 15, then idx 24
    assert selected_fit[0]["idx"] == 5
    assert selected_fit[1]["idx"] == 15
    assert selected_fit[2]["idx"] == 24
