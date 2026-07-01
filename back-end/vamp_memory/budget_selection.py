import math
from typing import Iterable
from llm_provider.token_budget import estimate_model_tokens

def adaptive_k(total_summaries: int) -> int:
    """VAMP retrieval pool size."""
    return max(7, min(10, math.floor(total_summaries / 7)))


def dedupe_select_budget_then_sort(
    blocks: Iterable[dict],
    *,
    budget_tokens: int,
    model_id: str | None = None,
) -> list[dict]:
    budget = int(budget_tokens)

    by_id = {}
    for block in blocks:
        unit_id = block.get("unit_id") or block.get("summary_id")
        if not unit_id:
            continue

        existing = by_id.get(unit_id)
        if existing is None:
            by_id[unit_id] = block
            continue

        old_score = float(existing.get("_retrieval_score", 0.0) or 0.0)
        new_score = float(block.get("_retrieval_score", 0.0) or 0.0)
        if new_score > old_score:
            by_id[unit_id] = block

    candidates = list(by_id.values())

    candidates.sort(
        key=lambda b: (
            -float(b.get("_retrieval_score", 0.0) or 0.0),
            int(b.get("_retrieval_rank", 999999) or 999999),
            len(str(b.get("text", ""))),
        )
    )

    selected = []
    used = 0

    for block in candidates:
        text = str(block.get("text", ""))
        size = estimate_model_tokens(text, model_id)
        if size <= 0:
            continue

        if used + size <= budget:
            selected.append(block)
            used += size

    selected.sort(key=lambda b: (
        int(b.get("idx", 0) or 0),
        int(b.get("bullet_index", 0) or 0)
    ))
    return selected
