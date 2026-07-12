"""Automatic task-mode detection for agent runs.

The backend supports three task modes that scale the agent's step budget and
output-token reserve:

    normal     → 50 steps  (AGENT_DEFAULT_STEPS)
    tool_task  → 100 steps (AGENT_TOOL_TASK_STEPS)
    long_task  → 200 steps (AGENT_LONG_TASK_STEPS)

Today the mode is only ever set by the client. If the user does not pick a
mode explicitly, every request defaults to ``normal`` — even prompts that
clearly ask for a long, multi-step deliverable ("analyze the data and
produce a report", "build a dashboard", "write a comprehensive design
doc"). Those requests then hit the 50-step ceiling mid-flight and surface
a "Task Paused" dialog to the user, who must click "Continue Task" to
resume. That is a poor experience for an obvious long task.

This module performs a deterministic, rule-based classification of the
user's prompt and elevates the mode when:

  • the user has NOT explicitly chosen a mode (``task_mode == "normal"``
    AND no explicit override flag is set), and
  • the prompt matches one of the long-task or tool-task intent patterns.

The classifier is intentionally conservative:
  - It only ever UPGRADES ``normal`` → ``tool_task`` / ``long_task``.
    It never downgrades an explicit user choice.
  - It runs entirely on the user's current prompt — no LLM call, no
    latency, no extra tokens. Pattern-matching only.
  - It can be bypassed by setting ``AGENT_AUTO_TASK_MODE=false`` in the
    environment (operators who want strict manual control).

The classifier returns a dict so callers can log WHY the mode was elevated,
which makes the behavior observable in production logs.
"""

from __future__ import annotations

import logging
import re
from typing import Literal

logger = logging.getLogger(__name__)


TaskMode = Literal["normal", "tool_task", "long_task"]

# Intent lexicons
#
# These patterns are matched case-insensitively against the LOWER-CASED
# prompt. Patterns are deliberately phrased to minimize false positives —
# a single-word match ("report") is NOT enough; we require a verb-ish
# cue ("produce report", "generate report", "write report", etc.) to
# escalate to long_task.
#
# The lists below were tuned against common analyst / engineer requests
# observed in DB-agent products. Add patterns here as new intents emerge.

# Long-task cues: multi-step deliverables that almost always need >50
# agent steps (research + tool calls + synthesis + formatting).
_LONG_TASK_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.IGNORECASE)
    for p in [
        # Report / document generation
        r"\b(?:produce|generate|write|create|draft|prepare|build)\s+(?:a\s+|an\s+|the\s+)?(?:comprehensive|detailed|full|complete|in[-\s]?depth|executive|technical)?\s*(?:report|document|whitepaper|spec|specification|design\s+doc|proposal|plan|roadmap|runbook|playbook|guide|tutorial|manual)\b",
        # Analysis + deliverable combos
        r"\b(?:analyze|analyse)\b.{0,80}\b(?:and|then|&)\b.{0,80}\b(?:produce|generate|write|create|draft|prepare|build|deliver|present|summar(?:y|ize)|report)\b",
        r"\b(?:analyze|analyse)\b.{0,80}\b(?:produce|generate|write|create|draft|prepare|build|deliver|present|summar(?:y|ize)|report)\b",
        # "End-to-end" / "step by step" multi-step work
        r"\b(?:end[-\s]?to[-\s]?end|step[-\s]by[-\s]step|from\s+scratch|full\s+pipeline|complete\s+workflow)\b",
        # Build / scaffold a whole artifact
        r"\b(?:build|scaffold|implement|develop|create)\s+(?:a\s+|an\s+|the\s+)?(?:dashboard|application|app|service|api|pipeline|workflow|etl|data\s+model|schema\s+design|migration\s+script)\b",
        # Migration / refactoring (multi-step by nature)
        r"\b(?:migrate|refactor|rewrite|port)\s+.{0,80}\b(?:from|to|into|across)\b",
        # Audit / review + report
        r"\b(?:audit|review|assess|evaluate)\b.{0,80}\b(?:and|then)\b.{0,80}\b(?:report|document|summar(?:y|ize)|recommend|propose|fix)\b",
        # "Comprehensive" anything
        r"\bcomprehensive\s+(?:analysis|review|assessment|study|investigation|breakdown|overview|guide)\b",
        # Multi-source synthesis
        r"\b(?:synthe?size|consolidate|aggregate|cross[-\s]?reference)\b.{0,80}\b(?:from|across|multiple|all|various)\b",
        # Long-form content asks
        r"\b(?:write|create|generate)\s+(?:a\s+|an\s+)?(?:long[-\s]?form|multi[-\s]?part|multi[-\s]?section|in[-\s]?depth|detailed)\b",
        # Explicit "long task" / "deep dive" phrasing
        r"\b(?:long\s+task|deep\s+dive|deep\s+analysis|thorough\s+analysis|full\s+analysis)\b",
        # "and produce" / "and deliver" chains (multi-deliverable)
        r"\b(?:and|then|finally)\s+(?:produce|deliver|generate|create|write|build|present)\s+(?:a\s+|an\s+|the\s+)?\w+\s+(?:report|document|summary|plan|spec|proposal|dashboard|artifact|deliverable)\b",
    ]
)

# Tool-task cues: requests that need a handful of tool calls but are
# not full multi-step deliverables. These get the 100-step budget.
_TOOL_TASK_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.IGNORECASE)
    for p in [
        # Schema exploration + query
        r"\b(?:explore|inspect|investigate|look\s+into|check|examine)\b.{0,80}\b(?:schema|tables|columns|database|data\s+model)\b",
        # Multi-table join / comparison
        r"\b(?:join|compare|contrast|correlate|cross[-\s]?reference)\s+.{0,40}\b(?:tables?|datasets?|sources?)\b",
        # "Find all" / "list every" (broad scan)
        r"\b(?:find\s+all|list\s+every|list\s+all|show\s+all|enumerate\s+all)\b",
        # Tune / optimize / diagnose
        r"\b(?:optimize|tune|diagnose|troubleshoot|debug|profile|benchmark)\b",
        # Generate + run SQL
        r"\b(?:generate|write|create|build)\s+(?:a\s+|an\s+|the\s+)?(?:query|sql|sql\s+query|complex\s+query|optimized\s+query)\b",
        # Data quality / integrity check
        r"\b(?:data\s+quality|integrity\s+check|consistency\s+check|valid(?:ate|ation)\s+(?:data|schema|constraints))\b",
        # "Explain" + "and then" (multi-step explanation)
        r"\b(?:explain|describe|walk\s+me\s+through)\b.{0,80}\b(?:and|then|also)\b",
        # Multi-question prompts (3+ questions in one message)
        r"\?.{0,200}\?.{0,200}\?",
    ]
)

# Short-circuit: prompts shorter than this many characters are never
# escalated. A 12-char prompt ("count users") is never a long task.
_MIN_PROMPT_LEN_FOR_ESCALATION = 24


def classify_task_mode(
    prompt: str | None,
    *,
    current_mode: TaskMode = "normal",
    allow_auto: bool = True,
) -> dict:
    """Classify the user's prompt and return the effective task mode.

    Args:
        prompt: The user's current prompt. ``None`` or empty string is treated
            as ``normal`` (the caller will short-circuit before reaching here
            in practice, but we defend against it anyway).
        current_mode: The mode the caller would use if no auto-detection ran.
            This is the user's explicit choice (or the default ``normal``).
            The classifier will only UPGRADE this value, never downgrade it.
        allow_auto: Master switch. Set to ``False`` to skip auto-detection
            entirely (e.g., when ``AGENT_AUTO_TASK_MODE=false``).

    Returns:
        dict with keys:
            - ``task_mode``: the effective mode to use
            - ``detected_intent``: ``"long_task"`` | ``"tool_task"`` | ``"none"``
            - ``matched_pattern``: the regex pattern that matched (for logging),
              or ``None`` if no match
            - ``source``: ``"user"`` (explicit choice preserved) |
              ``"auto"`` (auto-detected) | ``"default"`` (no escalation)
    """
    # If the user has already explicitly chosen a non-normal mode, respect it.
    if current_mode in ("tool_task", "long_task"):
        return {
            "task_mode": current_mode,
            "detected_intent": "none",
            "matched_pattern": None,
            "source": "user",
        }

    # If auto-detection is disabled, keep the default.
    if not allow_auto:
        return {
            "task_mode": current_mode,
            "detected_intent": "none",
            "matched_pattern": None,
            "source": "default",
        }

    # Empty / very short prompts never escalate.
    if not prompt or len(prompt.strip()) < _MIN_PROMPT_LEN_FOR_ESCALATION:
        return {
            "task_mode": current_mode,
            "detected_intent": "none",
            "matched_pattern": None,
            "source": "default",
        }

    normalized = prompt.strip()

    # Check long_task patterns first (they are more specific and imply
    # tool_task-level work PLUS a multi-step deliverable).
    for pattern in _LONG_TASK_PATTERNS:
        if pattern.search(normalized):
            return {
                "task_mode": "long_task",
                "detected_intent": "long_task",
                "matched_pattern": pattern.pattern,
                "source": "auto",
            }

    # Then check tool_task patterns.
    for pattern in _TOOL_TASK_PATTERNS:
        if pattern.search(normalized):
            return {
                "task_mode": "tool_task",
                "detected_intent": "tool_task",
                "matched_pattern": pattern.pattern,
                "source": "auto",
            }

    # No pattern matched — keep the default.
    return {
        "task_mode": current_mode,
        "detected_intent": "none",
        "matched_pattern": None,
        "source": "default",
    }


def should_auto_classify() -> bool:
    """Return True if the auto-classifier is enabled via config.

    Reads ``Config.AGENT_AUTO_TASK_MODE`` (env var ``AGENT_AUTO_TASK_MODE``).
    Defaults to True. Set to ``"false"`` to disable auto-detection entirely
    (operators who want strict manual control).

    Returns:
        ``True`` if the auto-classifier should run, ``False`` otherwise.
    """
    try:
        from config import get_config

        return bool(get_config().AGENT_AUTO_TASK_MODE)
    except Exception:
        import os

        return os.getenv("AGENT_AUTO_TASK_MODE", "true").lower() == "true"
