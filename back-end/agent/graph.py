"""
Compile the Moonlit ReAct agent graph (tool-calling loop).

Uses ``langgraph.prebuilt.create_react_agent`` with the v2 graph schema by default.
"""

from __future__ import annotations

from typing import Sequence

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.tools import BaseTool
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph.state import CompiledStateGraph
from langgraph.prebuilt import create_react_agent

from agent.memory_config import ACTIVE_MESSAGE_WINDOW


def build_react_agent(
    chat_model: BaseChatModel,
    tools: Sequence[BaseTool],
    *,
    system_prompt: str,
    checkpointer: BaseCheckpointSaver | None,
) -> CompiledStateGraph:
    """
    Build the compiled ReAct agent used for database assistant turns.

    ``version='v2'`` selects the current prebuilt graph schema (LangGraph >= 1.1).
    """
    from langchain_core.messages import SystemMessage

    def state_modifier(state):
        messages = list(state["messages"])
        if len(messages) > ACTIVE_MESSAGE_WINDOW:
            original_start_idx = len(messages) - ACTIVE_MESSAGE_WINDOW
            start_idx = original_start_idx
            # Walk backwards to find a clean conversational boundary (HumanMessage).
            # This prevents slicing the array exactly between a ToolCall and a ToolResult,
            # which would cause a hard crash on the LLM provider API (orphaned tool calls).
            while start_idx > 0:
                if messages[start_idx].type == "human":
                    break
                start_idx -= 1

            # If we walked all the way back to 0 and still didn't find a HumanMessage,
            # we must cut the history to prevent infinite growth. We jump back to the target
            # boundary and walk forward until we find a safe starting message.
            if start_idx == 0 and messages[0].type != "human":
                start_idx = original_start_idx
                while start_idx < len(messages):
                    msg = messages[start_idx]
                    if msg.type == "human":
                        break
                    # An AI message without pending tool calls is also a safe starting point
                    if msg.type == "ai" and not getattr(msg, "tool_calls", None):
                        break
                    start_idx += 1

            messages = messages[start_idx:]

        # Inject the latest compressed summary block (if any) as a SystemMessage
        # immediately after the main system prompt. This runs every invocation so
        # the agent always has the most recent long-term memory in-context without
        # a tool call — while keeping older blocks retrieval-only via get_conversation_summary.
        config = state.get("configurable", {})
        latest_summary: str | None = config.get("latest_summary")
        prefix = [SystemMessage(content=system_prompt)]
        if latest_summary:
            prefix.append(
                SystemMessage(
                    content=(
                        "<recent_memory>\n"
                        "The following is a compressed summary of earlier conversation history "
                        "that is no longer in your active message window. "
                        "Use it as background context — do not reference it explicitly unless asked.\n\n"
                        + latest_summary
                        + "\n</recent_memory>"
                    )
                )
            )
        return prefix + messages

    return create_react_agent(
        chat_model,
        list(tools),
        checkpointer=checkpointer,
        prompt=state_modifier,
        version="v2",
    )
