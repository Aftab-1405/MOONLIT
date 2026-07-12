"""Format retrieved VAMP memory bullets into a system-prompt context string.

The output is a sequence of ``[Memory block N | <staleness> | matched bullets]``
sections, one per summary block, ordered by their appearance in the input.
Staleness tiers (``recent`` / ``older``) let the LLM weight recently
summarised facts higher than older ones when there is a conflict.
"""

import re
from typing import Iterable

# CENH [7]: Wrap user-quoted text in <user_quote> tags to defuse
# prompt-injection. A malicious user could inject instructions into VAMP via
# earlier turns; this makes quoted content visually distinct from factual
# statements in the bullets. The LLM is told (via the surrounding
# <authority> tag in the system prompt) that text inside <user_quote> is
# reference data and must not be followed as an instruction.
_USER_QUOTE_PATTERN = re.compile(
    r'(user\s+(?:said|stated|asked|mentioned|wrote)\s*[:\-]?\s*)["\']([^"\']+)["\']',
    flags=re.IGNORECASE,
)


def _sanitize_bullet_text(text: str) -> str:
    """Wrap user-quoted text in <user_quote> tags.

    Matches phrases like ``user said: "..."`` or ``user asked '...'`` and
    wraps the quoted portion in ``<user_quote>...</user_quote>`` so the LLM
    can distinguish quoted content from factual statements in the bullet.
    This is a defense-in-depth measure against prompt-injection via VAMP.
    """
    if not text:
        return text
    return _USER_QUOTE_PATTERN.sub(
        r"\1<user_quote>\2</user_quote>",
        text,
    )


def format_historical_context(
    blocks: Iterable[dict],
    *,
    latest_summary_block_idx: int | None = None,
) -> str:
    """Format retrieved context units for direct system-prompt injection.

    Each block header carries a staleness tier so the model can weight
    recently summarised facts higher than older ones when there is a conflict:
      - recent : one of the two most recent summary blocks (by idx)
      - older  : summarised earlier, treat as background hints

    Recency is computed from the conversation's true
    ``latest_summary_block_idx`` when available (FIX [M25]). Previously
    ``max_idx`` was derived from the *selected* units only — when the token
    budget dropped the newest blocks, older blocks got mislabeled ``recent``
    and the model over-weighted stale facts. Now the caller can pass the
    authoritative ``latest_summary_block_idx`` from the conversation
    metadata; if not provided we fall back to the selected max for
    backwards compatibility.
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

    # FIX [M25]: Prefer the conversation metadata's authoritative
    # latest_summary_block_idx so recency labeling is stable across budget
    # selections. Fall back to the selected-set max only when the caller
    # could not supply the metadata.
    if latest_summary_block_idx is not None:
        max_idx = int(latest_summary_block_idx)
    else:
        max_idx = max(by_summary[sid]["idx"] for sid in sids_ordered)
    recent_threshold = max(0, max_idx - 1)  # last 2 blocks are "recent"

    sections = []
    for sid in sids_ordered:
        group = by_summary[sid]
        bullets = group["bullets"]

        if not bullets:
            continue

        idx = group["idx"]
        staleness = "recent" if idx >= recent_threshold else "older"
        bullets.sort(key=lambda b: int(b.get("bullet_index", 0) or 0))
        # CENH [7]: sanitize each bullet's text so user-quoted content is
        # wrapped in <user_quote> tags before formatting.
        lines = [f"- {_sanitize_bullet_text(b.get('text', '').strip())}" for b in bullets if b.get("text")]
        if lines:
            sections.append(f"[Memory block {idx} | {staleness} | matched bullets]\n" + "\n".join(lines))

    return "\n\n".join(sections)
