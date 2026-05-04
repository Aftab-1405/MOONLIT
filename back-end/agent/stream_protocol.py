"""
SSE stream protocol — encode agent events as ``data: {...}\\n\\n`` lines.

Event types:
  token          – LLM content token
  tool_start     – tool invocation begun
  tool_end       – tool invocation finished (includes UI result)
  ui_action      – guided frontend action for the browser UI
  agent_interrupt – graph paused for human input; resume with /resume_agent
  thinking_token – reasoning/chain-of-thought token
  error          – recoverable error message
  done           – stream complete
"""

import json
from typing import Any, Dict


def sse_encode(event: Dict[str, Any]) -> str:
    """Encode *event* dict as a single SSE ``data:`` line."""
    return f"data: {json.dumps(event, default=str)}\n\n"


def sse_token(content: str) -> str:
    return sse_encode({"type": "token", "content": content})


def sse_tool_start(name: str, args: dict) -> str:
    return sse_encode({"type": "tool_start", "name": name, "args": args})


def sse_tool_end(name: str, args: dict, result: Any) -> str:
    return sse_encode(
        {"type": "tool_end", "name": name, "args": args, "result": result}
    )


def sse_thinking(content: str) -> str:
    return sse_encode({"type": "thinking_token", "content": content})


def sse_error(message: str) -> str:
    return sse_encode({"type": "error", "message": message})


def sse_done() -> str:
    return sse_encode({"type": "done"})


def sse_ui_action(action: str, payload: dict | None = None) -> str:
    """Encode a ui_action SSE event.

    The emitted event shape is:
        { "type": "ui_action", "action": "<action_name>", "payload": <payload> }

    ``payload`` is serialised to ``null`` when ``None`` is passed.
    """
    return sse_encode({"type": "ui_action", "action": action, "payload": payload})
