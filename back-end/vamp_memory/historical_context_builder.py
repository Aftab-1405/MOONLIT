from typing import Iterable

def format_historical_context(blocks: Iterable[dict]) -> str:
    """Format retrieved context units for direct system-prompt injection.

    Each block header carries a staleness tier so the model can weight
    recently summarised facts higher than older ones when there is a conflict:
      - recent : one of the two most recent summary blocks
      - older  : summarised earlier, treat as background hints
    """
    # Collect all units first so we can determine the max block index
    all_units = list(blocks)

    by_summary: dict[str, dict] = {}
    sids_ordered: list[str] = []
    for unit in all_units:
        sid = unit.get("summary_id")
        if not sid:
            continue
        if sid not in by_summary:
            by_summary[sid] = {"bullets": [], "idx": int(unit.get("idx", 0) or 0)}
            sids_ordered.append(sid)

        is_parent = unit.get("is_parent")
        if is_parent is None:
            is_parent = "bullet_id" not in unit

        if not is_parent:
            by_summary[sid]["bullets"].append(unit)

    if not sids_ordered:
        return ""

    max_idx = max(by_summary[sid]["idx"] for sid in sids_ordered)
    recent_threshold = max(0, max_idx - 1)   # last 2 blocks are "recent"

    sections = []
    for sid in sids_ordered:
        group = by_summary[sid]
        bullets = group["bullets"]

        if not bullets:
            continue

        idx = group["idx"]
        staleness = "recent" if idx >= recent_threshold else "older"
        bullets.sort(key=lambda b: int(b.get("bullet_index", 0) or 0))
        lines = [f"- {b.get('text', '').strip()}" for b in bullets if b.get("text")]
        if lines:
            sections.append(
                f"[Memory block {idx} | {staleness} | matched bullets]\n"
                + "\n".join(lines)
            )

    return "\n\n".join(sections)
