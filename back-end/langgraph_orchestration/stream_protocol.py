"""
SSE stream protocol — encode agent events as ``data: {...}\\n\\n`` lines.

Event types:
  token          – LLM content token
  tool_start     – tool invocation begun
  tool_end       – tool invocation finished (includes UI result)
  ui_action      – guided frontend action for the browser UI
  agent_interrupt – graph paused for human input; resume with /resume_agent
  agent_step_limit_reached – total safety budget exhausted; task can be resumed
  thinking_token – reasoning/chain-of-thought token
  skills_activated – skill instructions loaded by the agent via read_skill
  error          – recoverable error message
  done           – stream complete
"""

import json
from typing import Dict, Any


def sse_encode(event: Dict[str, Any]) -> str:
    """Encode *event* dict as a single SSE ``data:`` line."""
    return f"data: {json.dumps(event, default=str)}\n\n"


def sse_error(message: str) -> str:
    return sse_encode({"type": "error", "message": message})


def sse_done() -> str:
    return sse_encode({"type": "done"})
