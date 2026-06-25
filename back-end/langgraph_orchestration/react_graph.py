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

    from llm_provider.token_budget import calculate_token_budget, estimate_tokens

    def state_modifier(state, config=None):
        messages = list(state["messages"])

        configurable = {}
        if isinstance(config, dict):
            configurable = config.get("configurable", {}) or {}
        if not configurable:
            configurable = state.get("configurable", {})

        active_context_budget = configurable.get("active_context_budget")
        if active_context_budget is None:
            model_id = configurable.get("model", "")
            if not model_id:
                try:
                    model_id = chat_model.model_id
                except AttributeError:
                    model_id = getattr(chat_model, "model", "")

            from llm_provider.token_budget import calculate_token_budget
            budget_info = calculate_token_budget(model_id)
            active_context_budget = budget_info["active_context_budget"]

        from llm_provider.token_budget import truncate_messages_to_budget
        _, messages = truncate_messages_to_budget(messages, active_context_budget)

        # Get existing task checkpoint summary
        task_checkpoint_summary = configurable.get("task_checkpoint_summary", "")
        # Dropped messages are summarized asynchronously by check_and_perform_compaction
        # at the end of each stream turn. The task_checkpoint_summary already stored in
        # config["configurable"] captures prior context and is injected below.

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

        return prefix + messages

    return create_react_agent(
        chat_model,
        list(tools),
        checkpointer=checkpointer,
        prompt=state_modifier,
        version="v2",
    )
