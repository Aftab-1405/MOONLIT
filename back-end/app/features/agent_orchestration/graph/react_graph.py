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

from app.features.agent_orchestration.infrastructure.memory_config import ACTIVE_MESSAGE_WINDOW


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

    from app.core.token_budget import calculate_token_budget, estimate_tokens

    def state_modifier(state, config=None):
        messages = list(state["messages"])
        
        configurable = {}
        if isinstance(config, dict):
            configurable = config.get("configurable", {}) or {}
        if not configurable:
            configurable = state.get("configurable", {})
            
        model_id = configurable.get("model", "")
        if not model_id:
            try:
                model_id = chat_model.model_id
            except AttributeError:
                model_id = getattr(chat_model, "model", "")
                
        budget_info = calculate_token_budget(model_id)
        active_context_budget = budget_info["active_context_budget"]
        
        total_tokens = 0
        start_idx = len(messages)
        
        for i in range(len(messages) - 1, -1, -1):
            msg = messages[i]
            content = msg.content if hasattr(msg, "content") else str(msg)
            tokens = estimate_tokens(content)
            
            tool_calls = getattr(msg, "tool_calls", [])
            if tool_calls:
                tokens += estimate_tokens(str(tool_calls))
                
            if total_tokens + tokens > active_context_budget:
                break
                
            total_tokens += tokens
            start_idx = i

        original_start_idx = start_idx
        while start_idx > 0:
            if messages[start_idx].type == "human":
                break
            start_idx -= 1

        if start_idx == 0 and len(messages) > 0 and messages[0].type != "human":
            start_idx = original_start_idx
            while start_idx < len(messages):
                msg = messages[start_idx]
                if msg.type == "human":
                    break
                if msg.type == "ai" and not getattr(msg, "tool_calls", None):
                    break
                start_idx += 1

        dropped_messages = messages[:start_idx]
        messages = messages[start_idx:]

        # Get existing task checkpoint summary
        task_checkpoint_summary = configurable.get("task_checkpoint_summary", "")
        if dropped_messages:
            lines = []
            for msg in dropped_messages:
                if msg.type == "human":
                    lines.append(f"USER: {msg.content}")
                elif msg.type == "ai":
                    content = msg.content
                    if content:
                        lines.append(f"AI: {content}")
                    if getattr(msg, "tool_calls", None):
                        for tc in msg.tool_calls:
                            lines.append(f"Tool '{tc.get('name')}' called.")
                elif msg.type == "tool":
                    lines.append(f"Tool Result ({msg.name}): {str(msg.content)[:200]}...")
            
            if lines:
                raw_trace = "\n".join(lines)
                try:
                    from app.features.agent_orchestration.application.stream_conversation import generate_task_checkpoint_summary
                    task_checkpoint_summary = generate_task_checkpoint_summary(chat_model, raw_trace, task_checkpoint_summary)
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).warning("Failed to generate task checkpoint summary in react_graph: %s", e)
                    if task_checkpoint_summary:
                        task_checkpoint_summary += "\n" + raw_trace
                    else:
                        task_checkpoint_summary = raw_trace

        # Inject retrieved VAMP historical context (if any) as a SystemMessage
        # immediately after the main system prompt. This runs every invocation so
        # the agent receives relevant long-term memory without relying on a
        # model-chosen memory tool call.
        historical_context: str | None = configurable.get("historical_context")
        prefix = [SystemMessage(content=system_prompt)]
        if historical_context:
            prefix.append(
                SystemMessage(
                    content=(
                        "<historical_context>\n"
                        "The following memory blocks were retrieved deterministically "
                        "before this LLM call. Use them as factual background, but do "
                        "not reference the memory system unless asked.\n\n"
                        + historical_context
                        + "\n</historical_context>"
                    )
                )
            )
            
        if task_checkpoint_summary:
            prefix.append(
                SystemMessage(
                    content=(
                        "<task_checkpoint_summary>\n"
                        "The following events occurred earlier in the active context/task but were compressed to save tokens:\n\n"
                        + task_checkpoint_summary
                        + "\n</task_checkpoint_summary>"
                    )
                )
            )
            
        # Clean up orphan tool calls (from interrupted runs or crashes)
        # to prevent LangGraph INVALID_CHAT_HISTORY errors.
        valid_tool_call_ids = {
            msg.tool_call_id for msg in messages if getattr(msg, "type", "") == "tool" and getattr(msg, "tool_call_id", None)
        }
        
        cleaned_messages = []
        for msg in messages:
            if getattr(msg, "type", "") == "ai" and getattr(msg, "tool_calls", None):
                filtered_tool_calls = [
                    tc for tc in msg.tool_calls if tc.get("id") in valid_tool_call_ids
                ]
                if len(filtered_tool_calls) != len(msg.tool_calls):
                    from langchain_core.messages import AIMessage
                    cleaned_messages.append(AIMessage(
                        content=msg.content,
                        tool_calls=filtered_tool_calls,
                        response_metadata=getattr(msg, "response_metadata", {}),
                        id=getattr(msg, "id", None),
                        name=getattr(msg, "name", None)
                    ))
                else:
                    cleaned_messages.append(msg)
            else:
                cleaned_messages.append(msg)
                
        return prefix + cleaned_messages

    return create_react_agent(
        chat_model,
        list(tools),
        checkpointer=checkpointer,
        prompt=state_modifier,
        version="v2",
    )
