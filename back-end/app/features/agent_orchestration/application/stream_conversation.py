"""
LangGraph agent — streams agentic conversation over SSE.

Builds a ReAct graph via :func:`graph.build_react_agent`, then streams with
``version='v2'`` unified stream parts (messages + custom tool events).

See: https://docs.langchain.com/oss/python/langgraph/streaming
"""

from __future__ import annotations

import asyncio
import logging
from typing import AsyncGenerator, Optional

from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage
from langchain_core.messages.utils import merge_message_runs
from langgraph.types import Command
from fastapi.concurrency import run_in_threadpool

class ThinkTagParser:
    """Parses <think> tags out of streamed text and emits them as thinking tokens."""
    def __init__(self):
        self.in_think_block = False
        self.buffer = ""

    def process_chunk(self, chunk: str) -> list[tuple[str, str]]:
        if not chunk:
            return []
        self.buffer += chunk
        results = []
        while self.buffer:
            if not self.in_think_block:
                think_idx = self.buffer.find("<think>")
                if think_idx != -1:
                    if think_idx > 0:
                        results.append(("token", self.buffer[:think_idx]))
                    self.in_think_block = True
                    self.buffer = self.buffer[think_idx + 7:]
                    continue
                else:
                    partial_match = False
                    for i in range(1, min(7, len(self.buffer)) + 1):
                        if self.buffer.endswith("<think>"[:i]):
                            if len(self.buffer) > i:
                                results.append(("token", self.buffer[:-i]))
                                self.buffer = self.buffer[-i:]
                            partial_match = True
                            break
                    if not partial_match:
                        results.append(("token", self.buffer))
                        self.buffer = ""
                    break
            else:
                end_idx = self.buffer.find("</think>")
                if end_idx != -1:
                    if end_idx > 0:
                        results.append(("thinking_token", self.buffer[:end_idx]))
                    self.in_think_block = False
                    self.buffer = self.buffer[end_idx + 8:]
                    continue
                else:
                    partial_match = False
                    for i in range(1, min(8, len(self.buffer)) + 1):
                        if self.buffer.endswith("</think>"[:i]):
                            if len(self.buffer) > i:
                                results.append(("thinking_token", self.buffer[:-i]))
                                self.buffer = self.buffer[-i:]
                            partial_match = True
                            break
                    if not partial_match:
                        results.append(("thinking_token", self.buffer))
                        self.buffer = ""
                    break
        return results

    def flush(self) -> list[tuple[str, str]]:
        if not self.buffer:
            return []
        token_type = "thinking_token" if self.in_think_block else "token"
        res = [(token_type, self.buffer)]
        self.buffer = ""
        return res


def generate_task_checkpoint_summary(chat_model, raw_trace: str, existing_summary: str = "") -> str:
    """Generate or merge a compact, LLM-based task checkpoint summary containing goals, facts, and open items."""
    try:
        from langchain_core.messages import HumanMessage
        
        summary_prompt = (
            "You are a precise task-trace summarizer. Create a compact, token-efficient checkpoint summary of the following database assistant task execution trace.\n"
            "Your summary must explicitly cover:\n"
            "1. Original user goal\n"
            "2. Completed steps\n"
            "3. Important facts discovered\n"
            "4. Important tool results\n"
            "5. Decisions made\n"
            "6. Pending work\n"
            "7. Next recommended action\n\n"
            "Format the output compactly with bullet points.\n\n"
            f"Execution trace:\n{raw_trace}"
        )
        response = chat_model.invoke([HumanMessage(content=summary_prompt)])
        new_summary = response.content.strip()
        
        if existing_summary:
            merge_prompt = (
                "You are an expert context compressor. Merge the following existing task checkpoint summary and the new trace summary into a single, cohesive, compact summary. "
                "Retain all critical facts, discoveries, pending work, and the current goal.\n\n"
                f"Existing Summary:\n{existing_summary}\n\n"
                f"New Trace Summary:\n{new_summary}"
            )
            merge_response = chat_model.invoke([HumanMessage(content=merge_prompt)])
            return merge_response.content.strip()
        return new_summary
    except Exception as e:
        logger.warning("Failed to generate LLM-based task checkpoint summary: %s. Falling back to raw concatenation.", e)
        if existing_summary:
            return existing_summary + "\n" + raw_trace
        return raw_trace


async def check_and_perform_compaction(agent, config, conversation_id, chat_model, active_context_budget):
    """Check if the current task trace in checkpointer state approaches token budget and compact it if needed."""
    try:
        from langchain_core.messages import RemoveMessage
        from app.core.token_budget import estimate_tokens
        from app.infrastructure.firestore.service import FirestoreService
        
        state = await agent.aget_state(config)
        if not state or "messages" not in state.values:
            return
        
        messages = list(state.values["messages"])
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
            
        if start_idx >= len(messages):
            return
            
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
                existing_summary = config["configurable"].get("task_checkpoint_summary", "")
                
                try:
                    from app.features.agent_orchestration.application.conversation_access import (
                        get_default_conversation_state_reader,
                    )

                    conv_data = get_default_conversation_state_reader().get_conversation(
                        conversation_id
                    )
                    if conv_data:
                        existing_summary = conv_data.get("task_checkpoint_summary", "") or existing_summary
                except Exception:
                    pass
                
                updated_summary = generate_task_checkpoint_summary(chat_model, raw_trace, existing_summary)
                
                db = FirestoreService.get_db()
                db.collection("conversations").document(conversation_id).update({
                    "task_checkpoint_summary": updated_summary
                })
                config["configurable"]["task_checkpoint_summary"] = updated_summary
                logger.info("Saved updated task_checkpoint_summary to Firestore in compaction: %s", conversation_id)
                
                remove_updates = [RemoveMessage(id=msg.id) for msg in dropped_messages if getattr(msg, "id", None)]
                if remove_updates:
                    await agent.aupdate_state(config, {"messages": remove_updates})
                    logger.info("Removed %d dropped messages from checkpointer state", len(remove_updates))
    except Exception as e:
        logger.warning("Failed during check_and_perform_compaction: %s", e)



from app.features.agent_orchestration.infrastructure.checkpointing import get_checkpointer
from app.features.agent_orchestration.graph.react_graph import build_react_agent
from app.llm.providers.model_factory import get_chat_model, get_default_model
from app.features.agent_orchestration.prompts.prompt_builder import PromptBuilder
from app.features.agent_orchestration.streaming.stream_protocol import sse_encode, sse_error, sse_done
from app.features.agent_orchestration.graph.tools import ALL_TOOLS

logger = logging.getLogger(__name__)

# Process-wide compiled-agent cache — avoids recompiling the LangGraph state
# machine on every request. Key: (provider, model, enable_reasoning,
# reasoning_effort, response_style). api_key is excluded because Bedrock
# resolves credentials from AWS env vars, not the key argument.
_agent_cache: dict[tuple, object] = {}


async def _count_converse_tokens_for_stream(
    model_id: str,
    *,
    cache_key: tuple | None = None,
    **kwargs,
) -> dict:
    from app.core.token_budget import (
        count_converse_tokens_cached,
        count_converse_tokens_with_fallback,
    )

    counter = count_converse_tokens_with_fallback
    if cache_key is not None:
        counter = lambda model_id, **inner_kwargs: count_converse_tokens_cached(
            model_id,
            cache_key=cache_key,
            **inner_kwargs,
        )

    if str(model_id).startswith("mock"):
        return counter(model_id, **kwargs)
    return await run_in_threadpool(counter, model_id, **kwargs)


def _merge_token_count_results(*results: dict | int | None) -> tuple[str, str | None]:
    for result in results:
        if isinstance(result, dict) and result.get("mode") == "estimated":
            return "estimated", result.get("reason") or "provider_unsupported"
    return "exact", None


def _token_count_value(result: dict | int | None) -> int:
    if isinstance(result, dict):
        return int(result.get("tokens") or 0)
    return int(result or 0)


# Safety limit — prevents runaway tool loops (applies to node transitions)
async def clear_checkpointer_thread(checkpointer, thread_id: str) -> None:
    """Completely clear all checkpoint data for the given thread_id."""
    try:
        from langgraph.checkpoint.redis.aio import AsyncRedisSaver
        from langgraph.checkpoint.redis.util import to_storage_safe_id
        
        if isinstance(checkpointer, AsyncRedisSaver):
            storage_safe_thread_id = to_storage_safe_id(thread_id)
            redis_client = checkpointer._redis
            
            patterns = [
                f"checkpoint:{storage_safe_thread_id}:*",
                f"checkpoint_latest:{storage_safe_thread_id}:*",
                f"writes:{storage_safe_thread_id}:*",
                f"checkpoint_writes:{storage_safe_thread_id}:*",
            ]
            for pattern in patterns:
                keys = []
                async for key in redis_client.scan_iter(match=pattern):
                    keys.append(key)
                if keys:
                    await redis_client.delete(*keys)
            logger.info("Cleared Redis checkpoint keys for thread %s", thread_id)
        elif hasattr(checkpointer, "storage"):
            # InMemorySaver
            if thread_id in checkpointer.storage:
                del checkpointer.storage[thread_id]
                logger.info("Cleared InMemorySaver checkpoint for thread %s", thread_id)
    except Exception as e:
        logger.warning("Failed to clear checkpoint for thread %s: %s", thread_id, e)


def group_messages_into_turns(messages: list) -> list[list[int]]:
    """Groups message indices into turns, with explicit turn_index/turn_id or fallback."""
    turns = []
    current_turn = []
    
    # We will build turns based on turn_index or turn_id if they exist,
    # otherwise fallback to grouping where 'user' starts a new turn.
    for idx, msg in enumerate(messages):
        key = msg.get("turn_index") or msg.get("turn_id")
        
        # If we have a key, we group by key
        if key is not None:
            # If there's a current turn and the last message in it had the same key
            if current_turn:
                last_msg = messages[current_turn[-1]]
                last_key = last_msg.get("turn_index") or last_msg.get("turn_id")
                if last_key == key:
                    current_turn.append(idx)
                    continue
            # Otherwise, start a new turn
            if current_turn:
                turns.append(current_turn)
            current_turn = [idx]
        else:
            # Fallback grouping: 'user' starts a turn
            sender = str(msg.get("sender", "user")).lower()
            if sender == "user":
                if current_turn:
                    turns.append(current_turn)
                current_turn = [idx]
            else:
                if not current_turn:
                    current_turn = [idx]
                else:
                    current_turn.append(idx)
                    
    if current_turn:
        turns.append(current_turn)
    return turns


def get_message_tokens(msg: dict) -> int:
    """Get message token size, prioritizing Bedrock usage if available."""
    from app.core.token_budget import estimate_tokens
    import json
    usage = msg.get("usage")
    if isinstance(usage, dict):
        total = usage.get("totalTokens") or usage.get("total_tokens")
        if total is not None:
            return int(total)
        inp = usage.get("inputTokens") or usage.get("input_tokens") or 0
        out = usage.get("outputTokens") or usage.get("output_tokens") or 0
        if inp + out > 0:
            return inp + out
    content = msg.get("content", "")
    tokens = estimate_tokens(content)
    timeline = msg.get("timeline", [])
    if timeline:
        tokens += estimate_tokens(json.dumps(timeline))
    return tokens


async def stream_conversation(
    conversation_id: str,
    message: str | None,
    user_id: str,
    *,
    db_config: Optional[dict] = None,
    response_style: str = "balanced",
    max_rows: Optional[int] = None,
    api_key: Optional[str] = None,
    provider: str = "bedrock",
    model: Optional[str] = None,
    enable_reasoning: bool = True,
    reasoning_effort: str = "medium",
    resume: Optional[dict] = None,
    task_mode: str = "normal",
) -> AsyncGenerator[str, None]:
    """
    Stream a full agent turn as SSE-encoded JSON events.

    Yields ``data: {…}\\n\\n`` strings ready for a ``StreamingResponse``.
    Event types: ``token``, ``tool_start``, ``tool_end``,
    ``thinking_token``, ``error``, ``done``.
    """
    last_completed_tool: dict | None = None
    think_parser = ThinkTagParser()
    step_limit_reached = False

    try:
        selected_model = model or get_default_model(provider)

        # Compile the ReAct graph once per unique configuration
        cache_key = (provider, selected_model, enable_reasoning, reasoning_effort, response_style)
        system_prompt = PromptBuilder.build_system_prompt(response_style)
        chat_model = None
        if not (str(selected_model).startswith("mock") and cache_key in _agent_cache):
            chat_model = get_chat_model(
                provider,
                selected_model,
                api_key,
                enable_reasoning=enable_reasoning,
                reasoning_effort=reasoning_effort,
            )

        if cache_key not in _agent_cache:
            checkpointer = get_checkpointer()
            compiled_agent = build_react_agent(
                chat_model,
                ALL_TOOLS,
                system_prompt=system_prompt,
                checkpointer=checkpointer,
            )
            _agent_cache[cache_key] = compiled_agent
            logger.info(
                "Compiled and cached new agent: provider=%s, model=%s, conversation=%s",
                provider,
                selected_model,
                conversation_id,
            )

        agent = _agent_cache[cache_key]
        checkpointer = get_checkpointer()

        # Namespace thread_id by user_id to prevent unauthenticated checkpoint access.
        namespaced_thread_id = f"{user_id}:{conversation_id}"

        # Clear checkpointer and task_checkpoint_summary if it is a new user turn.
        # Skip clearing when the agent is continuing a paused long task.
        is_continue_task = (
            isinstance(resume, dict) and resume.get("continue_task", False)
        )
        is_new_turn = (resume is None) and (message is not None)
        if is_new_turn and not is_continue_task and not str(selected_model).startswith("mock"):
            # Only clear if the conversation is NOT paused mid-task.
            try:
                from app.infrastructure.firestore.service import FirestoreService
                db = FirestoreService.get_db()
                conv_ref = db.collection("conversations").document(conversation_id)
                conv_snap = await asyncio.wait_for(
                    run_in_threadpool(conv_ref.get),
                    timeout=2.0,
                )
                existing_task_status = (
                    conv_snap.to_dict().get("task_status", "")
                    if conv_snap.exists
                    else ""
                )
            except Exception:
                existing_task_status = ""

            if existing_task_status != "paused_step_limit":
                await clear_checkpointer_thread(checkpointer, namespaced_thread_id)
                try:
                    from app.infrastructure.firestore.service import FirestoreService
                    db = FirestoreService.get_db()
                    await asyncio.wait_for(
                        run_in_threadpool(
                            db.collection("conversations").document(conversation_id).update,
                            {
                                "task_checkpoint_summary": "",
                                "task_status": "",
                            },
                        ),
                        timeout=2.0,
                    )
                except Exception as e:
                    logger.warning("Failed to clear task_checkpoint_summary in Firestore: %s", e)
            else:
                logger.info(
                    "Preserving checkpoint for paused task %s — new message continues the task.",
                    conversation_id,
                )
        elif is_continue_task:
            logger.info(
                "continue_task=True: skipping checkpoint clear for conversation %s",
                conversation_id,
            )

        historical_context = None
        if message and not str(selected_model).startswith("mock"):
            try:
                from app.core.config import get_config
                from app.features.agent_orchestration.application.historical_context import (
                    get_default_historical_context_provider,
                )

                Config = get_config()
                if Config.VAMP_MEMORY_ENABLED:
                    historical_context = await asyncio.wait_for(
                        get_default_historical_context_provider().retrieve_context(
                            conversation_id,
                            user_id,
                            message,
                        ),
                        timeout=3.0,
                    )
            except Exception as exc:
                logger.warning(
                    "VAMP historical context retrieval failed for %s: %s",
                    conversation_id,
                    exc,
                )

        # Determine recursion limit dynamically by task mode.
        # For continue_task resumes: restore task_mode from persisted Firestore state
        # so the step budget scales correctly across continuation calls.
        from app.core.config import get_config
        Config = get_config()
        if is_continue_task and task_mode in (None, "normal", ""):
            try:
                from app.features.agent_orchestration.application.conversation_access import (
                    get_default_conversation_state_reader,
                )
                conv_data = await asyncio.to_thread(
                    get_default_conversation_state_reader().get_conversation,
                    conversation_id,
                )
                if conv_data:
                    stored_task_mode = conv_data.get("task_mode", "normal") or "normal"
                    if stored_task_mode != "normal":
                        task_mode = stored_task_mode
                        logger.info(
                            "Restored task_mode=%s from Firestore for continue_task on %s",
                            task_mode,
                            conversation_id,
                        )
            except Exception as tm_err:
                logger.warning("Could not restore task_mode from Firestore: %s", tm_err)

        task_mode = task_mode or "normal"
        if task_mode == "tool_task":
            recursion_limit = Config.AGENT_TOOL_TASK_STEPS
        elif task_mode == "long_task":
            recursion_limit = Config.AGENT_LONG_TASK_STEPS
        elif task_mode == "approved_autonomous":
            recursion_limit = Config.AGENT_APPROVED_AUTONOMOUS_STEPS
        else:
            recursion_limit = Config.AGENT_DEFAULT_STEPS
        recursion_limit = min(recursion_limit, Config.AGENT_TOTAL_STEP_BUDGET)

        # Load task_checkpoint_summary from Firestore if available
        task_checkpoint_summary = ""
        conv_data = None
        try:
            from app.features.agent_orchestration.application.conversation_access import (
                get_default_conversation_state_reader,
            )

            conv_data = await asyncio.to_thread(
                get_default_conversation_state_reader().get_conversation,
                conversation_id,
            )
            if conv_data:
                task_checkpoint_summary = conv_data.get("task_checkpoint_summary", "")
        except Exception as e:
            logger.warning("Failed to load task_checkpoint_summary for config: %s", e)

        from app.core.token_budget import (
            TokenCountingError,
            calculate_dynamic_token_budget,
            output_reserve_for_task_mode,
        )

        try:
            system_prompt_count = await _count_converse_tokens_for_stream(
                selected_model,
                cache_key=("system", response_style, system_prompt),
                system=system_prompt,
                messages=[{"role": "user", "content": [{"text": ""}]}],
            )
            tool_schema_count = await _count_converse_tokens_for_stream(
                selected_model,
                cache_key=(
                    "tools",
                    tuple(getattr(tool, "name", str(tool)) for tool in ALL_TOOLS),
                ),
                messages=[{"role": "user", "content": [{"text": ""}]}],
                tools=ALL_TOOLS,
            )
            vamp_memory_count = (
                await _count_converse_tokens_for_stream(
                    selected_model,
                    messages=[
                        {
                            "role": "user",
                            "content": [{"text": historical_context or ""}],
                        }
                    ],
                )
                if historical_context
                else {"tokens": 0, "mode": "exact", "reason": None}
            )
            task_checkpoint_count = (
                await _count_converse_tokens_for_stream(
                    selected_model,
                    messages=[
                        {
                            "role": "user",
                            "content": [{"text": task_checkpoint_summary or ""}],
                        }
                    ],
                )
                if task_checkpoint_summary
                else {"tokens": 0, "mode": "exact", "reason": None}
            )
        except TokenCountingError as count_err:
            logger.error("Exact token counting failed before model call: %s", count_err)
            yield sse_error("Unable to count request tokens exactly. Please try again.")
            yield sse_done()
            return

        token_counting_mode, token_counting_reason = _merge_token_count_results(
            system_prompt_count,
            tool_schema_count,
            vamp_memory_count,
            task_checkpoint_count,
        )
        if token_counting_mode == "estimated":
            logger.warning(
                "Using conservative token estimates because provider counting is unsupported: model=%s reason=%s",
                selected_model,
                token_counting_reason,
            )

        system_prompt_tokens = _token_count_value(system_prompt_count)
        tool_schema_tokens = _token_count_value(tool_schema_count)
        vamp_memory_tokens = _token_count_value(vamp_memory_count)
        task_checkpoint_tokens = _token_count_value(task_checkpoint_count)

        budget_info = calculate_dynamic_token_budget(
            selected_model,
            system_prompt_tokens=system_prompt_tokens,
            tool_schema_tokens=tool_schema_tokens,
            output_reserve_tokens=output_reserve_for_task_mode(task_mode),
            token_counting_mode=token_counting_mode,
        )
        active_context_budget = budget_info["pressure_trigger_tokens"]
        hot_history_budget = max(
            0,
            budget_info["hot_history_budget"]
            - vamp_memory_tokens
            - task_checkpoint_tokens,
        )
        budget_info.update(
            {
                "system_prompt_tokens": system_prompt_tokens,
                "tool_schema_tokens": tool_schema_tokens,
                "vamp_memory_tokens": vamp_memory_tokens,
                "task_checkpoint_tokens": task_checkpoint_tokens,
                "hot_history_budget": hot_history_budget,
                "token_counting_mode": token_counting_mode,
                "token_counting_reason": token_counting_reason,
            }
        )

        config = {
            "configurable": {
                "thread_id": namespaced_thread_id,
                "user_id": user_id,
                "db_config": db_config,
                "max_rows": max_rows,
                "tool_cache": {},
                "historical_context": historical_context,
                "task_checkpoint_summary": task_checkpoint_summary,
            },
            "recursion_limit": recursion_limit,
        }

        graph_input = None
        if resume is not None:
            if is_continue_task:
                # "Continue task" — inject a new HumanMessage into the existing thread
                # rather than resuming an interrupt. This lets the agent pick up right
                # where it left off using the saved task_checkpoint_summary context.
                continuation_message = (
                    resume.get("message")
                    or "Continue the task from where you left off. Check the task checkpoint summary above for context."
                )
                graph_input = {"messages": [HumanMessage(content=continuation_message)]}
                logger.info(
                    "continue_task: injecting continuation message into thread %s",
                    namespaced_thread_id,
                )
            elif isinstance(resume, dict) and resume.get("interrupt_id"):
                interrupt_id = resume["interrupt_id"]
                clean_payload = {k: v for k, v in resume.items() if k != "interrupt_id"}
                graph_input = Command(resume={interrupt_id: clean_payload})
            else:
                graph_input = Command(resume=resume)
        elif not await _has_checkpoint(checkpointer, namespaced_thread_id):
            try:
                from app.features.conversations.application.conversation_service import (
                    _get_background_summary_pressure,
                )

                summary_pressure = _get_background_summary_pressure(
                    conv_data,
                    pressure_budget_tokens=budget_info["pressure_trigger_tokens"],
                )
                if summary_pressure["should_schedule"]:
                    from app.features.agent_orchestration.application.conversation_access import (
                        get_default_conversation_summarizer,
                    )

                    yield sse_encode(
                        {
                            "type": "usage_metrics",
                            "inputPayloadTokens": summary_pressure["tail_tokens"],
                            "activeContextBudget": summary_pressure["pressure_budget"],
                            "pressureTriggerTokens": summary_pressure["pressure_budget"],
                            "availableInputPayloadTokens": budget_info["available_input_payload_tokens"],
                            "modelContextWindow": budget_info["model_context_window"],
                            "totalContextWindow": budget_info["model_context_window"],
                            "reservedOutputTokens": budget_info["reserved_output_tokens"],
                            "safetyMarginTokens": budget_info["reserved_safety_margin_tokens"],
                            "systemPromptTokens": budget_info["system_prompt_tokens"],
                            "toolSchemaTokens": budget_info["tool_schema_tokens"],
                            "vampMemoryTokens": budget_info["vamp_memory_tokens"],
                            "taskCheckpointTokens": budget_info["task_checkpoint_tokens"],
                            "hotHistoryBudget": budget_info["hot_history_budget"],
                            "tokenCountingMode": budget_info["token_counting_mode"],
                            "tokenCountingReason": budget_info["token_counting_reason"],
                            "contextPhase": "pre_summary",
                            "summaryThresholdTokens": summary_pressure["threshold_tokens"],
                            "summaryCompleteTurns": summary_pressure["complete_turn_count"],
                        }
                    )
                    yield sse_encode(
                        {
                            "type": "workflow_status",
                            "stage": "summarizing_context",
                            "status": "running",
                            "content": "Summarizing conversation context before continuing.",
                        }
                    )
                    await get_default_conversation_summarizer().check_and_summarize(
                        conversation_id,
                        user_id,
                        selected_model,
                        thread_id=namespaced_thread_id,
                    )
                    yield sse_encode(
                        {
                            "type": "workflow_status",
                            "stage": "summarizing_context",
                            "status": "done",
                            "content": "Conversation context summarized.",
                        }
                    )

                    # Reload VAMP historical context to include the newly generated summary block
                    try:
                        from app.features.agent_orchestration.application.historical_context import (
                            get_default_historical_context_provider,
                        )
                        Config = get_config()
                        if Config.VAMP_MEMORY_ENABLED:
                            historical_context = await asyncio.wait_for(
                                get_default_historical_context_provider().retrieve_context(
                                    conversation_id,
                                    user_id,
                                    message,
                                ),
                                timeout=3.0,
                            )
                            config["configurable"]["historical_context"] = historical_context
                            logger.info("Reloaded historical_context in config after summarization.")
                    except Exception as hc_err:
                        logger.warning("Failed to reload historical context after summarization: %s", hc_err)
            except Exception as sum_err:
                logger.warning("Pre-call summarization failed: %s", sum_err)

            history = await _load_firestore_history(conversation_id, message, hot_history_budget)
            initial_messages = history + [HumanMessage(content=message or "")]
            initial_messages = merge_message_runs(initial_messages)
            if history:
                logger.info(
                    "Seeded %s messages from Firestore for conversation %s",
                    len(history),
                    conversation_id,
                )
            graph_input = {"messages": initial_messages}
        else:
            initial_messages = [HumanMessage(content=message or "")]
            graph_input = {"messages": initial_messages}

        try:
            async for part in agent.astream(
                graph_input,
                config=config,
                stream_mode=["messages", "custom", "updates"],
                version="v2",
                durability="async",
            ):
                if part["type"] == "messages":
                    msg_chunk, _metadata = part["data"]
                    if not isinstance(msg_chunk, AIMessageChunk):
                        continue

                    response_metadata = getattr(msg_chunk, "response_metadata", {}) or {}
                    usage_metadata = getattr(msg_chunk, "usage_metadata", {}) or {}
                    
                    metrics = response_metadata.get("metrics", {})
                    usage = response_metadata.get("usage", {})
                    stop_reason = response_metadata.get("stopReason")
                    
                    if stop_reason == "model_context_window_exceeded":
                        logger.warning("model_context_window_exceeded in bedrock response")
                        yield sse_encode({"type": "error", "content": "Model context window exceeded. Please summarize or start a new conversation."})
                        break
                        
                    input_tokens = usage_metadata.get("input_tokens") or usage.get("inputTokens")
                    output_tokens = usage_metadata.get("output_tokens") or usage.get("outputTokens")
                    total_tokens = usage_metadata.get("total_tokens") or usage.get("totalTokens")
                    latency_ms = metrics.get("latencyMs")
                    
                    if total_tokens is not None or latency_ms is not None:
                        yield sse_encode({
                            "type": "usage_metrics",
                            "inputTokens": input_tokens,
                            "outputTokens": output_tokens,
                            "totalTokens": total_tokens,
                            "latencyMs": latency_ms,
                            "stopReason": stop_reason,
                            "activeContextBudget": budget_info["active_context_budget"],
                            "totalContextWindow": budget_info["model_context_window"],
                            "inputPayloadTokens": input_tokens,
                            "availableInputPayloadTokens": budget_info["available_input_payload_tokens"],
                            "pressureTriggerTokens": budget_info["pressure_trigger_tokens"],
                            "modelContextWindow": budget_info["model_context_window"],
                            "reservedOutputTokens": budget_info["reserved_output_tokens"],
                            "safetyMarginTokens": budget_info["reserved_safety_margin_tokens"],
                            "systemPromptTokens": budget_info["system_prompt_tokens"],
                            "toolSchemaTokens": budget_info["tool_schema_tokens"],
                            "vampMemoryTokens": budget_info["vamp_memory_tokens"],
                            "taskCheckpointTokens": budget_info["task_checkpoint_tokens"],
                            "hotHistoryBudget": budget_info["hot_history_budget"],
                            "tokenCountingMode": budget_info["token_counting_mode"],
                            "tokenCountingReason": budget_info["token_counting_reason"],
                        })

                    content = msg_chunk.content
                    if isinstance(content, list):
                        for block in content:
                            if not isinstance(block, dict):
                                if block:
                                    yield sse_encode(
                                        {"type": "token", "content": str(block)}
                                    )
                                continue
                            block_type = block.get("type")
                            if block_type == "thinking":
                                thinking = block.get("thinking", "")
                                if thinking:
                                    yield sse_encode(
                                        {"type": "thinking_token", "content": str(thinking)}
                                    )
                            elif block_type == "reasoning_content":
                                reasoning_data = block.get("reasoning_content", {})
                                if isinstance(reasoning_data, dict):
                                    thinking = reasoning_data.get("text") or reasoning_data.get("reasoningText") or ""
                                    if thinking:
                                        yield sse_encode(
                                            {"type": "thinking_token", "content": str(thinking)}
                                        )
                            elif block_type == "text":
                                text = block.get("text", "")
                                if text:
                                    for token_type, content in think_parser.process_chunk(str(text)):
                                        yield sse_encode({"type": token_type, "content": content})
                    elif isinstance(content, str) and content:
                        for token_type, text_content in think_parser.process_chunk(content):
                            yield sse_encode({"type": token_type, "content": text_content})

                elif part["type"] == "custom":
                    custom_event = part["data"]
                    if not isinstance(custom_event, dict):
                        continue
                    if custom_event.get("type") == "tool_end":
                        result = custom_event.get("result")
                        if isinstance(result, dict) and result.get("success", True):
                            last_completed_tool = custom_event
                    yield sse_encode(custom_event)

                elif part["type"] == "updates":
                    # Check for token pressure and perform compaction immediately
                    try:
                        await check_and_perform_compaction(
                            agent,
                            config,
                            conversation_id,
                            chat_model,
                            active_context_budget,
                        )
                    except Exception as comp_err:
                        logger.warning("Auto-compaction during updates failed: %s", comp_err)
                    
                    interrupt_event = _extract_interrupt_event(part.get("data"))
                    if interrupt_event:
                        yield sse_encode(interrupt_event)
        except Exception as graph_err:
            is_recursion = False
            try:
                from langgraph.errors import GraphRecursionError
                if isinstance(graph_err, GraphRecursionError):
                    is_recursion = True
            except ImportError:
                pass
            if not is_recursion and "recursion" in str(graph_err).lower():
                is_recursion = True

            if is_recursion:
                step_limit_reached = True
                logger.warning("Agent step limit reached for conversation %s: %s", conversation_id, graph_err)
                try:
                    await check_and_perform_compaction(
                        agent,
                        config,
                        conversation_id,
                        chat_model,
                        active_context_budget,
                    )
                except Exception as comp_err:
                    logger.warning("Compaction failed during GraphRecursionError handling: %s", comp_err)
                try:
                    from app.infrastructure.firestore.service import FirestoreService
                    db = FirestoreService.get_db()
                    db.collection("conversations").document(conversation_id).update({
                        "task_status": "paused_step_limit",
                        "task_mode": task_mode,
                    })
                except Exception as db_err:
                    logger.error("Failed to save task status: %s", db_err)
                yield sse_encode({
                    "type": "agent_step_limit_reached",
                    "task_id": conversation_id,
                    "conversation_id": conversation_id,
                    "can_continue": True,
                    "steps_used": recursion_limit,
                    "task_mode": task_mode,
                    "message": (
                        f"The agent reached its step budget ({recursion_limit} steps). "
                        "The task context has been saved. Click \"Continue\" to resume."
                    ),
                })
                yield sse_done()
                return
            else:
                raise

        # Flush any remaining text in the think parser
        for token_type, content in think_parser.flush():
            yield sse_encode({"type": token_type, "content": content})

        if not step_limit_reached and not str(selected_model).startswith("mock"):
            try:
                from app.infrastructure.firestore.service import FirestoreService

                db = FirestoreService.get_db()
                await asyncio.wait_for(
                    run_in_threadpool(
                        db.collection("conversations").document(conversation_id).update,
                        {
                            "task_status": "",
                            "task_mode": task_mode,
                        },
                    ),
                    timeout=2.0,
                )
            except Exception as status_err:
                logger.warning("Failed to clear completed task status: %s", status_err)

        yield sse_done()

    except Exception as e:
        if _is_rate_limit_error(str(e)) and _can_complete_from_tool(last_completed_tool):
            logger.warning(
                "Model rate limit after successful %s; completing stream from tool result.",
                last_completed_tool.get("name"),
            )
            yield sse_encode(
                {
                    "type": "token",
                    "content": _tool_completion_fallback(last_completed_tool),
                }
            )
            yield sse_done()
            return

        logger.error("Agent stream error: %s", e, exc_info=True)
        yield sse_error(_friendly_error(str(e)))
        yield sse_done()

    finally:
        # Save task_checkpoint_summary to Firestore if task is ongoing/interrupted/paused
        if 'agent' in locals() and 'config' in locals() and 'active_context_budget' in locals() and 'chat_model' in locals():
            try:
                await check_and_perform_compaction(agent, config, conversation_id, chat_model, active_context_budget)
            except Exception as summary_err:
                logger.warning("Could not persist task_checkpoint_summary in finally: %s", summary_err)


async def _has_checkpoint(checkpointer, thread_id: str) -> bool:
    try:
        result = await checkpointer.aget_tuple(
            {"configurable": {"thread_id": thread_id}}
        )
        return result is not None
    except Exception as e:
        logger.warning("Could not check checkpointer state for %s: %s", thread_id, e)
        return False


async def _load_firestore_history(conversation_id: str, message: str | None, active_context_budget: int) -> list:
    try:
        from app.features.agent_orchestration.application.conversation_access import (
            get_default_conversation_state_reader,
        )
        from app.core.token_budget import estimate_tokens
        import json

        conversation_reader = get_default_conversation_state_reader()
        conv_data = await asyncio.wait_for(
            run_in_threadpool(conversation_reader.get_conversation, conversation_id),
            timeout=5.0,
        )
        if not conv_data or not conv_data.get("messages"):
            return []

        messages = conv_data.get("messages", [])
        last_summarized_idx = conv_data.get("last_summarized_idx", 0)

        # Find the highest summarized turn index
        last_summarized_turn = -1
        for idx in range(min(last_summarized_idx, len(messages))):
            t_idx = messages[idx].get("turn_index")
            if t_idx is not None and t_idx > last_summarized_turn:
                last_summarized_turn = t_idx

        # Select raw active tail from unsummarized turns only
        recent_messages = [msg for msg in messages if msg.get("turn_index", -1) > last_summarized_turn]

        # Select active tail from newest backward until token budget is reached.
        recent_turns = group_messages_into_turns(recent_messages)
        new_msg_tokens = estimate_tokens(message or "")
        remaining_budget = active_context_budget - new_msg_tokens
        if remaining_budget < 0:
            remaining_budget = 0

        selected_turn_indices = []
        accumulated_tokens = 0
        for turn in reversed(recent_turns):
            turn_tokens = sum(get_message_tokens(recent_messages[idx]) for idx in turn)
            if accumulated_tokens + turn_tokens > remaining_budget:
                break
            selected_turn_indices.append(turn)
            accumulated_tokens += turn_tokens

        selected_turn_indices.reverse()
        selected_msg_indices = []
        for turn in selected_turn_indices:
            selected_msg_indices.extend(turn)

        selected_messages = [recent_messages[idx] for idx in selected_msg_indices]

        lc_messages = []
        for msg in selected_messages:
            sender = msg.get("sender")
            content = msg.get("content", "")
            if not content and not msg.get("timeline"):
                continue
            if sender == "user":
                lc_messages.append(HumanMessage(content=content or ""))
            elif sender == "ai":
                lc_messages.append(AIMessage(content=content or ""))

        return lc_messages

    except Exception as e:
        logger.warning(
            "Failed to load Firestore history for seeding (conversation %s): %s",
            conversation_id,
            e,
        )
        return []


def _friendly_error(raw: str) -> str:
    lower = raw.lower()
    if "429" in lower or "rate_limit" in lower or "too_many_requests" in lower:
        return "Rate limit exceeded. Please wait a moment and try again."
    if "401" in lower or "authentication" in lower or "unauthorized" in lower:
        return "Authentication error. Please contact support."
    if "503" in lower or "service unavailable" in lower:
        return "AI service is temporarily unavailable. Please try again later."
    if "timeout" in lower or "timed out" in lower:
        return "Request timed out. Please try a simpler query."
    if "connection" in lower:
        return "Unable to connect to AI service. Check your internet connection."
    return "Something went wrong. Please try again."


def _is_rate_limit_error(raw: str) -> bool:
    lower = raw.lower()
    return "429" in lower or "rate_limit" in lower or "too_many_requests" in lower


def _can_complete_from_tool(tool_event: dict | None) -> bool:
    if not isinstance(tool_event, dict):
        return False
    return tool_event.get("type") == "tool_end" and tool_event.get("name") == "execute_query"


def _tool_completion_fallback(tool_event: dict) -> str:
    result = tool_event.get("result") if isinstance(tool_event, dict) else {}
    if not isinstance(result, dict):
        return "Query executed successfully. The results are open in the SQL workspace."

    row_count = result.get("row_count")
    total_rows = result.get("total_rows")
    truncated = result.get("truncated")

    if row_count is not None and total_rows not in (None, row_count):
        suffix = " The result was truncated for display." if truncated else ""
        return (
            f"Query executed successfully. The SQL workspace shows {row_count} rows "
            f"out of {total_rows} total.{suffix}"
        )
    if row_count is not None:
        return f"Query executed successfully. The SQL workspace shows {row_count} rows."
    return "Query executed successfully. The results are open in the SQL workspace."


def _extract_interrupt_event(data) -> dict | None:
    """Convert LangGraph ``__interrupt__`` updates into an SSE-safe event."""
    if not isinstance(data, dict) or "__interrupt__" not in data:
        return None

    interrupts = data.get("__interrupt__") or []
    if not interrupts:
        return None

    first = interrupts[0]
    payload = getattr(first, "value", first)
    interrupt_id = getattr(first, "id", None)
    if not isinstance(payload, dict):
        payload = {"message": str(payload)}

    return {
        "type": "agent_interrupt",
        "id": interrupt_id,
        "payload": payload,
    }
