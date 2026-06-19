from typing import Iterable

def format_historical_context(blocks: Iterable[dict]) -> str:
    """Format retrieved context units for direct system-prompt injection."""
    by_summary = {}
    sids_ordered = []
    for unit in blocks:
        sid = unit.get("summary_id")
        if not sid:
            continue
        if sid not in by_summary:
            by_summary[sid] = {"bullets": []}
            sids_ordered.append(sid)
        
        is_parent = unit.get("is_parent")
        if is_parent is None:
            is_parent = "bullet_id" not in unit
            
        if not is_parent:
            by_summary[sid]["bullets"].append(unit)

    sections = []
    for sid in sids_ordered:
        group = by_summary[sid]
        bullets = group["bullets"]
        
        if not bullets:
            continue
            
        base_unit = bullets[0]
        idx = int(base_unit.get("idx", 0) or 0)
        
        bullets.sort(key=lambda b: int(b.get("bullet_index", 0) or 0))
        lines = [f"- {b.get('text', '').strip()}" for b in bullets if b.get('text')]
        if lines:
            sections.append(
                f"[Memory block {idx} | matched bullets]\n" + "\n".join(lines)
            )

    return "\n\n".join(sections)
