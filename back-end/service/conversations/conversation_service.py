"""
Conversation Service - Handles conversation management, AI streaming, and Firestore persistence.

Consumes the LangGraph agent's SSE-encoded JSON events, passes them through
to the HTTP client, and persists completed messages to Firestore.
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator, Optional

from fastapi.concurrency import run_in_threadpool

logger = logging.getLogger(__name__)

_SUMMARY_BULLET_TYPES = {
    "decision",
    "config_fact",
    "api_fact",
    "database_fact",
    "testing_fact",
    "security_fact",
    "runtime_fact",
    "vamp_fact",
    "analysis_fact",
    "user_identity",
    "user_preference",
    "user_relationship",
    "personal_context",
    "open_item",
    "overview",
    "other",
}

def _build_tool_trace_summary(timeline: list[dict]) -> str | None:
    tools = [item for item in timeline if item.get("type") == "tool"]
    if not tools:
        return None
    summary_parts = []
    for t in tools:
        name = t.get("name", "unknown")
        status = t.get("status", "unknown")
        summary_parts.append(f"{name} ({status})")
    return "Tool activity: " + ", ".join(summary_parts)


class ConversationService:
    """Service for managing conversations and AI interactions."""

    # ── Conversation CRUD ────────────────────────────────────────────

    @staticmethod
    def create_or_get_conversation_id(provided_id: Optional[str] = None) -> str:
        if provided_id:
            return provided_id
        return str(uuid.uuid4())

    @staticmethod
    def get_conversation_data(conversation_id: str, user_id: str) -> Optional[dict]:
        from service.conversations.conversation_repository import (
            ConversationRepository,
        )

        return ConversationRepository.get_for_user(conversation_id, user_id)

    @staticmethod
    def verify_conversation_owner(conversation_id: str, user_id: str) -> bool:
        from service.conversations.conversation_repository import (
            ConversationRepository,
        )

        return ConversationRepository.verify_owner(conversation_id, user_id)

    @staticmethod
    def delete_user_conversation(conversation_id: str, user_id: str) -> None:
        from service.conversations.conversation_repository import (
            ConversationRepository,
        )
        from service.conversations.memory_cleanup import (
            get_default_memory_cleaner,
            run_memory_cleanup_sync,
        )

        if ConversationRepository.get_for_user(conversation_id, user_id) is None:
            raise ValueError("Conversation not found")

        memory_cleaner = get_default_memory_cleaner()
        try:
            run_memory_cleanup_sync(memory_cleaner, conversation_id, user_id)
        except Exception as cleanup_err:
            logger.warning(
                "Failed to clean up external memory during conversation delete: %s",
                cleanup_err,
            )
            ConversationRepository.create_memory_cleanup_retry(
                conversation_id, user_id, cleanup_err
            )

        ConversationRepository.delete(conversation_id, user_id)

    @staticmethod
    def retry_external_memory_cleanups() -> int:
        from service.conversations.conversation_repository import (
            ConversationRepository,
        )
        from service.conversations.memory_cleanup import (
            get_default_memory_cleaner,
        )

        return ConversationRepository.retry_qdrant_cleanups(
            get_default_memory_cleaner()
        )

    @staticmethod
    def rename_user_conversation(conversation_id: str, user_id: str, title: str) -> str:
        from service.conversations.conversation_repository import (
            ConversationRepository,
        )

        return ConversationRepository.rename(conversation_id, user_id, title)

    @staticmethod
    def get_user_conversations(user_id: str) -> list:
        from service.conversations.conversation_repository import (
            ConversationRepository,
        )

        return ConversationRepository.get_by_user(user_id)

    # ── AI Streaming (LangGraph SSE) ─────────────────────────────────

    @staticmethod
    async def create_streaming_generator(
        conversation_id: str,
        prompt: str | None,
        user_id: str,
        db_config: dict = None,
        enable_reasoning: bool = True,
        reasoning_effort: str = "medium",
        response_style: str = "balanced",
        max_rows: int = None,
        api_key: str = None,
        provider: str | None = None,
        model: str | None = None,
        resume: dict | None = None,
        task_mode: str = "normal",
    ) -> AsyncGenerator[str, None]:
        """
        Consume SSE events from the LangGraph agent, pass them through
        to the client, and persist the completed message to Firestore.

        Yields:
            SSE ``data: {…}\\n\\n`` strings.
        """
        from service.conversations.agent_streaming import (
            get_default_agent_streamer,
        )
        from service.conversations.conversation_repository import (
            ConversationRepository,
        )

        prompt_stored = False
        response_stored = False
        current_turn_id = None
        current_turn_index = None
        # Ordered timeline mirrors the frontend's eventTimeline exactly.
        # Each entry is one of:
        #   { "type": "text",     "content": str }
        #   { "type": "thinking", "content": str }
        #   { "type": "tool",     "name": str, "status": str, "args": str, "result": str }
        ordered_timeline: list[dict] = []
        was_aborted = False
        # has_fatal_error: True only when an unrecoverable error occurred BEFORE
        # any content was produced (e.g. PermissionError, startup failure).
        # A mid-stream error event from the agent does NOT set this — we still
        # want to persist whatever content was already accumulated.
        has_fatal_error = False
        last_usage_metrics = None

        try:
            # Load conversation history for the checkpointer
            # (The LangGraph checkpointer handles per-thread state automatically
            #  via thread_id, but we still verify ownership.)
            conv_data = await run_in_threadpool(
                ConversationRepository.get, conversation_id
            )
            if conv_data and conv_data.get("user_id") != user_id:
                raise PermissionError("User does not own this conversation")

            if resume is not None and conv_data and conv_data.get("messages"):
                last_msg = conv_data["messages"][-1]
                current_turn_id = last_msg.get("turn_id")
                current_turn_index = last_msg.get("turn_index")

            def ensure_turn_metadata() -> tuple[str, int]:
                nonlocal current_turn_id, current_turn_index
                if current_turn_id is None:
                    import uuid

                    current_turn_id = str(uuid.uuid4())
                if current_turn_index is None:
                    existing_messages = (
                        conv_data.get("messages", []) if conv_data else []
                    )
                    max_turn_index = -1
                    for msg in existing_messages:
                        ti = msg.get("turn_index")
                        if ti is not None:
                            try:
                                max_turn_index = max(max_turn_index, int(ti))
                            except (ValueError, TypeError):
                                pass
                    current_turn_index = max_turn_index + 1
                return current_turn_id, current_turn_index

            async def store_prompt_once() -> None:
                nonlocal prompt_stored
                if not prompt or prompt_stored:
                    return
                turn_id, turn_index = ensure_turn_metadata()
                await run_in_threadpool(
                    ConversationRepository.store_message,
                    conversation_id,
                    "user",
                    prompt,
                    user_id,
                    turn_id=turn_id,
                    turn_index=turn_index,
                    message_role="user",
                    is_final_assistant_response=False,
                )
                prompt_stored = True

            # Establish the conversation and persist the user turn before
            # orchestration touches task/checkpoint state. The previous lazy
            # write caused Firestore update(404) races on brand-new chats and
            # lost prompts when setup failed before the first model event.
            await store_prompt_once()

            # Persist task_mode to Firestore conversation
            if prompt_stored or conv_data:
                task_mode_stored = (conv_data.get("task_mode", "normal") if conv_data else None) or task_mode or "normal"
                if (
                    resume is not None
                    and task_mode == "normal"
                    and task_mode_stored != "normal"
                ):
                    task_mode = task_mode_stored
                try:
                    from service.firestore.firestore_service import FirestoreService

                    db = FirestoreService.get_db()
                    await run_in_threadpool(
                        db.collection("conversations").document(conversation_id).update,
                        {"task_mode": task_mode},
                    )
                except Exception as e:
                    logger.warning("Failed to save task_mode in Firestore: %s", e)

            # Stream from the LangGraph agent
            agent_streamer = get_default_agent_streamer()
            async for sse_line in agent_streamer.stream(
                conversation_id,
                prompt,
                user_id,
                db_config=db_config,
                response_style=response_style,
                max_rows=max_rows,
                api_key=api_key,
                provider=provider or "bedrock",
                model=model,
                enable_reasoning=enable_reasoning,
                reasoning_effort=reasoning_effort,
                resume=resume,
                task_mode=task_mode,
            ):
                # Parse the SSE data line to track content/tools for persistence
                event = _parse_sse_event(sse_line)
                if event is None:
                    # Forward unparseable lines as-is (shouldn't happen)
                    yield sse_line
                    continue

                event_type = event.get("type")

                # Core user prompt storage trigger
                if (
                    prompt
                    and not prompt_stored
                    and event_type
                    in (
                        "token",
                        "tool_start",
                        "thinking_token",
                        "agent_interrupt",
                        "workflow_status",
                        "skills_activated",
                    )
                ):
                    await store_prompt_once()

                if event_type == "token":
                    await store_prompt_once()
                    chunk = event.get("content", "")
                    if chunk:
                        if ordered_timeline and ordered_timeline[-1]["type"] == "text":
                            ordered_timeline[-1]["content"] += chunk
                        else:
                            ordered_timeline.append({"type": "text", "content": chunk})

                elif event_type == "tool_start":
                    await store_prompt_once()
                    # Mark any open thinking blocks as complete
                    for item in ordered_timeline:
                        if item["type"] == "thinking":
                            item["is_complete"] = True
                    ordered_timeline.append(
                        {
                            "type": "tool",
                            "name": event.get("name", ""),
                            "status": "running",
                            "args": json.dumps(event.get("args", {}), default=str),
                            "result": "null",
                        }
                    )

                elif event_type == "tool_end":
                    name = event.get("name", "")
                    for item in reversed(ordered_timeline):
                        if (
                            item["type"] == "tool"
                            and item["name"] == name
                            and item["status"] == "running"
                        ):
                            item["status"] = "done"
                            item["args"] = json.dumps(
                                event.get("args", {}), default=str
                            )
                            item["result"] = json.dumps(
                                event.get("result", {}), default=str
                            )
                            break

                elif event_type == "thinking_token":
                    await store_prompt_once()
                    chunk = event.get("content", "")
                    if chunk:
                        if (
                            ordered_timeline
                            and ordered_timeline[-1]["type"] == "thinking"
                        ):
                            ordered_timeline[-1]["content"] += chunk
                        else:
                            ordered_timeline.append(
                                {
                                    "type": "thinking",
                                    "content": chunk,
                                    "is_complete": False,
                                }
                            )

                elif event_type == "workflow_status":
                    await store_prompt_once()
                    stage = event.get("stage", "status")
                    status_val = event.get("status")
                    content = event.get("content", "Preparing context...")
                    step_id = f"workflow-{stage}"

                    existing_item = None
                    for item in ordered_timeline:
                        if item.get("type") == "thinking" and item.get("id") == step_id:
                            existing_item = item
                            break

                    if existing_item:
                        existing_item["content"] = content
                        existing_item["is_complete"] = status_val == "done"
                    else:
                        ordered_timeline.append(
                            {
                                "type": "thinking",
                                "id": step_id,
                                "content": content,
                                "is_complete": (status_val == "done"),
                            }
                        )

                elif event_type == "skills_activated":
                    await store_prompt_once()
                    skills = event.get("skills", [])
                    if skills:
                        existing_item = None
                        for item in ordered_timeline:
                            if item.get("type") == "skill":
                                existing_item = item
                                break
                        if existing_item:
                            existing_skills = existing_item.get("skills", [])
                            existing_item["skills"] = list(
                                dict.fromkeys([*existing_skills, *skills])
                            )
                        else:
                            ordered_timeline.append(
                                {
                                    "type": "skill",
                                    "skills": skills,
                                    "id": f"skill-{len(ordered_timeline)}",
                                }
                            )

                elif event_type == "error":
                    # Agent-emitted error events are informational — do NOT block
                    # Firestore persistence. The agent may have already produced
                    # useful content before the error occurred.
                    logger.warning(
                        "Agent emitted error event for conversation %s",
                        conversation_id,
                    )
                    error_message = event.get("message") or event.get("content")
                    if error_message:
                        ordered_timeline.append(
                            {
                                "type": "text",
                                "content": f"Error: {error_message}",
                            }
                        )

                elif event_type == "usage_metrics":
                    last_usage_metrics = {
                        "inputTokens": event.get("inputTokens"),
                        "outputTokens": event.get("outputTokens"),
                        "totalTokens": event.get("totalTokens"),
                        "activeContextBudget": event.get("activeContextBudget"),
                        "totalContextWindow": event.get("totalContextWindow"),
                        "inputPayloadTokens": event.get("inputPayloadTokens"),
                        "availableInputPayloadTokens": event.get("availableInputPayloadTokens"),
                        "pressureTriggerTokens": event.get("pressureTriggerTokens"),
                        "modelContextWindow": event.get("modelContextWindow"),
                        "reservedOutputTokens": event.get("reservedOutputTokens"),
                        "safetyMarginTokens": event.get("safetyMarginTokens"),
                        "systemPromptTokens": event.get("systemPromptTokens"),
                        "toolSchemaTokens": event.get("toolSchemaTokens"),
                        "vampMemoryTokens": event.get("vampMemoryTokens"),
                        "taskCheckpointTokens": event.get("taskCheckpointTokens"),
                        "hotHistoryBudget": event.get("hotHistoryBudget"),
                        "tokenCountingMode": event.get("tokenCountingMode"),
                        "tokenCountingReason": event.get("tokenCountingReason"),
                        "contextPhase": event.get("contextPhase"),
                        "summaryThresholdTokens": event.get("summaryThresholdTokens"),
                        "summaryCompleteTurns": event.get("summaryCompleteTurns"),
                    }

                elif event_type == "agent_interrupt" and prompt and not prompt_stored:
                    await store_prompt_once()

                # event_type "done" — pass-through only

                yield sse_line

        except asyncio.CancelledError:
            was_aborted = True
            logger.info("Stream cancelled for conversation %s", conversation_id)
            raise

        except GeneratorExit:
            was_aborted = True
            logger.info(f"Stream aborted for conversation {conversation_id}")

        except PermissionError:
            # Permission errors before content: do not save anything
            has_fatal_error = True
            yield _make_sse_error(
                "You don't have permission to access this conversation."
            )

        except Exception as err:
            # Unexpected errors: if content was already produced, still try to
            # save it. Only block if nothing was accumulated at all.
            if not ordered_timeline and not prompt_stored:
                has_fatal_error = True
            logger.error(f"Streaming error: {err}", exc_info=True)
            yield _make_sse_error(_classify_error(str(err)))

        finally:
            # Store AI response when:
            # - The user prompt was stored (or this is a resume)
            # - No fatal error occurred before content was produced
            # - Not already stored
            # Note: we store even if ordered_timeline is empty — a text-only
            # response may have been emitted without timeline entries in edge cases.
            should_store_response = (
                (prompt_stored or resume is not None)
                and not response_stored
                and not has_fatal_error
            )
            if should_store_response:
                # Mark all open thinking blocks complete before persisting
                for item in ordered_timeline:
                    if item["type"] == "thinking":
                        item["is_complete"] = True
                if was_aborted:
                    for item in ordered_timeline:
                        if item["type"] == "text":
                            item["content"] = item["content"].rstrip()
                    ordered_timeline.append(
                        {"type": "text", "content": "\n\n_(Response stopped by user)_"}
                    )

                # Derive flat content for Firestore storage
                response_text = "".join(
                    item["content"]
                    for item in ordered_timeline
                    if item["type"] == "text"
                ).strip()
                tools_used = [
                    item for item in ordered_timeline if item["type"] == "tool"
                ]

                # Ensure response_text is not empty
                if not response_text and tools_used:
                    response_text = "(Used tools to gather information)"

                # Generate turn metadata if not already set
                ensure_turn_metadata()

                tool_trace_summary = _build_tool_trace_summary(ordered_timeline)

                # Store AI response in Firestore.
                # `content` (response_text) is always stored.
                # `timeline` embeds tool activity so `tools` and `thinking`
                # are omitted to avoid duplication.
                try:
                    await run_in_threadpool(
                        ConversationRepository.store_message,
                        conversation_id,
                        "ai",
                        response_text,
                        user_id,
                        tools=None,
                        thinking=None,
                        timeline=ordered_timeline if ordered_timeline else None,
                        append=(resume is not None),
                        usage=last_usage_metrics,
                        turn_id=current_turn_id,
                        turn_index=current_turn_index,
                        message_role="assistant",
                        is_final_assistant_response=(not was_aborted),
                        tool_trace_summary=tool_trace_summary,
                    )
                    response_stored = True
                    status = "partial (aborted)" if was_aborted else "complete"
                    logger.info(
                        "Stored AI response (%s): %d chars, %d timeline items for conversation %s",
                        status,
                        len(response_text),
                        len(ordered_timeline),
                        conversation_id,
                    )
                except Exception as store_err:
                    logger.error(
                        "Failed to store AI response for conversation %s: %s",
                        conversation_id,
                        store_err,
                        exc_info=True,
                    )
            elif has_fatal_error:
                logger.info(
                    "Skipped storing response due to fatal error for conversation %s",
                    conversation_id,
                )

    # ── Response headers ─────────────────────────────────────────────

    @staticmethod
    def get_streaming_headers(conversation_id: str) -> dict:
        return {
            "X-Conversation-Id": conversation_id,
            # Prevent any proxy (nginx, Vite dev server, CDN) from buffering
            # or re-encoding the SSE stream. Each directive targets a different
            # layer of the stack:
            #
            #   no-cache        — client must not cache the stream
            #   no-transform    — proxies must not compress / re-encode content
            "Cache-Control": "no-cache, no-transform",
            # Instructs nginx (and nginx-based proxies such as AWS ALB) not to
            # buffer the upstream response. Without this, nginx holds the full
            # SSE stream in memory until the connection closes before forwarding.
            "X-Accel-Buffering": "no",
            # Explicit encoding declaration. Combined with Accept-Encoding:
            # identity on the request side, this closes the loop: no proxy
            # along the path has a mandate to apply any content encoding.
            "Content-Encoding": "identity",
            "Connection": "keep-alive",
        }

    @staticmethod
    def check_quota_error(error_message: str) -> bool:
        lower = error_message.lower()
        return "quota" in lower or "429" in lower or "rate" in lower

    @staticmethod
    async def check_and_summarize(
        conversation_id: str,
        user_id: str,
        model: str = None,
        *,
        pressure_budget_tokens: int | None = None,
    ) -> dict:
        result = {
            "created": False,
            "reason": "not_started",
            "start_idx": None,
            "end_idx": None,
            "tail_tokens": 0,
            "threshold_tokens": None,
        }
        try:

            from config import get_config
            from langchain_core.messages import HumanMessage, SystemMessage
            from llm_provider.model_factory import (
                get_chat_model,
                get_default_model,
            )
            from llm_provider.model_capabilities import model_capability
            from llm_provider.token_budget import (
                calculate_dynamic_token_budget,
                count_converse_tokens_cached,
                output_reserve_for_task_mode,
            )

            from service.conversations.conversation_repository import (
                ConversationRepository,
            )
            from service.firestore.firestore_service import FirestoreService

            Config = get_config()
            selected_model = model or get_default_model(Config.LLM_PROVIDER)
            if pressure_budget_tokens is not None:
                # The orchestration layer already measured system, tools,
                # memory, checkpoint, output reserve, and safety margin. Do not
                # repeat provider token-count calls for the summarizer.
                active_context_budget = int(pressure_budget_tokens)
            else:
                from api_contract.runtime_ports import (
                    get_conversation_summarization_context_provider,
                )

                summarization_context = (
                    get_conversation_summarization_context_provider()
                )
                system_prompt = summarization_context.build_system_prompt("balanced")
                tools = summarization_context.get_tools()
                system_prompt_count = count_converse_tokens_cached(
                    selected_model,
                    cache_key=("system", "balanced", system_prompt),
                    system=system_prompt,
                    messages=[{"role": "user", "content": [{"text": ""}]}],
                )
                tool_schema_count = count_converse_tokens_cached(
                    selected_model,
                    cache_key=(
                        "tools",
                        tuple(getattr(tool, "name", str(tool)) for tool in tools),
                    ),
                    messages=[{"role": "user", "content": [{"text": ""}]}],
                    tools=tools,
                )
                budget_info = calculate_dynamic_token_budget(
                    selected_model,
                    system_prompt_tokens=system_prompt_count["tokens"],
                    tool_schema_tokens=tool_schema_count["tokens"],
                    output_reserve_tokens=output_reserve_for_task_mode("normal"),
                    token_counting_mode=(
                        "estimated"
                        if system_prompt_count["mode"] == "estimated"
                        or tool_schema_count["mode"] == "estimated"
                        else "exact"
                    ),
                )
                active_context_budget = int(budget_info["active_context_budget"])
            summary_trigger_tokens = int(float(active_context_budget) * 0.90)
            result["threshold_tokens"] = summary_trigger_tokens
            summary_chunk_token_limit = max(1, active_context_budget // 2)

            db = FirestoreService.get_db()
            doc_ref = db.collection(ConversationRepository.COLLECTION_NAME).document(
                conversation_id
            )

            while True:
                doc = doc_ref.get()
                if not doc.exists:
                    result["reason"] = "conversation_missing"
                    return result

                data = doc.to_dict()
                if data.get("user_id") != user_id:
                    result["reason"] = "user_mismatch"
                    return result

                messages = data.get("messages", [])
                start_idx = _coerce_message_cursor(
                    data.get("last_summarized_idx", 0),
                    message_count=len(messages),
                )
                result["start_idx"] = start_idx
                unsummarized_tail = messages[start_idx:]
                if not unsummarized_tail:
                    result["reason"] = "empty_tail"
                    return result

                # Calculate persisted-message pressure in the unsummarized tail.
                # This intentionally matches the UI pressure gate: provider usage
                # tokens are per-call billing metadata and can be much smaller
                # than the stored content/timeline that will be reloaded later.
                tail_tokens = sum(
                    _get_message_tokens_cheap(msg)
                    for msg in unsummarized_tail
                )
                result["tail_tokens"] = tail_tokens

                # Summarize when measured pressure reaches the same 90% trigger
                # surfaced to the frontend.
                if tail_tokens < summary_trigger_tokens:
                    result["reason"] = "below_threshold"
                    return result

                # Group messages into turns
                from langgraph_orchestration.conversation_access import group_messages_into_turns
                turns = group_messages_into_turns(messages)

                # Map messages to turn index
                turn_idx_by_msg_idx = {}
                for t_idx, turn in enumerate(turns):
                    for m_idx in turn:
                        turn_idx_by_msg_idx[m_idx] = t_idx

                # Find unsummarized turns
                start_turn_idx = turn_idx_by_msg_idx.get(start_idx, 0)
                unsummarized_turns = turns[start_turn_idx:]

                # Filter complete unsummarized turns (stop at first incomplete one)
                complete_unsummarized_turns = []
                for t in unsummarized_turns:
                    if _turn_is_complete(t, messages):
                        complete_unsummarized_turns.append(t)
                    else:
                        break

                if not complete_unsummarized_turns:
                    result["reason"] = "no_complete_turns"
                    return result

                # Chunk complete unsummarized turns by budget (limit chunk size to active_context_budget // 2)
                chunk_turns = []
                chunk_tokens = 0
                max_chunk_tokens = summary_chunk_token_limit

                for turn in complete_unsummarized_turns:
                    turn_tokens = sum(
                        _get_message_tokens_cheap(messages[idx])
                        for idx in turn
                    )
                    if chunk_turns and chunk_tokens + turn_tokens > max_chunk_tokens:
                        break
                    chunk_turns.append(turn)
                    chunk_tokens += turn_tokens

                if not chunk_turns:
                    chunk_turns = [complete_unsummarized_turns[0]]

                # The first chunk covers message range [start_idx, end_idx)
                chunk_end_msg_idx = chunk_turns[-1][-1]
                end_idx = chunk_end_msg_idx + 1

                claim_id = _claim_summary_range(
                    db,
                    doc_ref,
                    user_id=user_id,
                    start_idx=start_idx,
                    end_idx=end_idx,
                )
                if not claim_id:
                    result["reason"] = "claim_conflict"
                    return result

                block_to_summarize = messages[start_idx:end_idx]
                text_block = _build_summary_input(block_to_summarize)
                claim_heartbeat_stop = asyncio.Event()
                claim_heartbeat = asyncio.create_task(
                    _run_summary_claim_heartbeat(
                        doc_ref,
                        claim_id,
                        claim_heartbeat_stop,
                        Config.VAMP_SUMMARY_CLAIM_TTL_SECONDS,
                    ),
                    name=f"summary-claim-{claim_id}",
                )

                try:
                    summary_output_tokens = int(
                        model_capability(
                            selected_model,
                            "max_output_tokens",
                            Config.RESERVED_OUTPUT_TOKENS,
                        )
                    )
                    chat = get_chat_model(
                        Config.LLM_PROVIDER,
                        model=selected_model,
                        enable_reasoning=False,
                        max_tokens=summary_output_tokens,
                    )
                    prompt = [
                        SystemMessage(
                            content=(
                                "Your task is to create a detailed summary of the ENTIRE conversation block provided by the user message. "
                                "The block may be the full unsummarized tail from the beginning of the chat or a later chunk after earlier retained context. "
                                "Summarize every user/assistant exchange inside the provided <conversation_history> block, and do not summarize anything outside it.\n\n"
                                "Think through the provided messages privately, but do not output analysis text or analysis tags. Your response must be a single strict JSON object and nothing else.\n\n"
                                "1. Analyze the provided messages chronologically. For each section thoroughly identify:\n"
                                "   - The user's explicit requests and intents\n"
                                "   - Every explicitly stated personal fact that may help future conversation continuity, including the user's name, pronouns, preferred language, role or occupation, location or time zone, accessibility needs, relationships, background, goals, interests, habits, and stable preferences\n"
                                "   - Personal context embedded inside a technical request; do not discard it merely because it is not technical\n"
                                "   - Your approach to addressing the user's requests\n"
                                "   - Key decisions, technical concepts and code patterns\n"
                                "   - Specific details like:\n"
                                "     - file names and table names\n"
                                "     - full code or SQL snippets\n"
                                "     - function signatures\n"
                                "     - file edits\n"
                                "   - Errors that you ran into and how you fixed them\n"
                                "   - Pay special attention to specific user feedback that you received, especially if the user told you to do something differently.\n"
                                "   - Note any security-relevant instructions or constraints the user stated. Preserve the meaning precisely so the constraint continues to apply after compaction.\n"
                                "2. Perform a private message-by-message coverage check before answering. Every user message must be represented, and every explicit personal fact, preference, correction, constraint, decision, result, and unresolved request must appear in either the detailed summary or an appropriate memory bullet. Omission of such information is an incorrect summary.\n"
                                "3. Preserve personal facts with clear attribution such as 'The user stated...' Do not infer identity, relationships, preferences, health details, or other personal facts that were not explicitly stated.\n"
                                "4. Never reproduce authentication secrets in the summary or bullets, including passwords, API keys, access or refresh tokens, private keys, session cookies, one-time codes, or full payment-card data. If such a secret appeared, record only that sensitive credentials were provided and should be treated as redacted or rotated.\n"
                                "5. Do not introduce names, facts, table counts, query results, colors, row counts, or personal details unless they are explicitly present in the provided conversation block.\n\n"
                                "COMPACTION STYLE:\n"
                                "- Compact like a long-horizon coding/database agent: preserve task state, durable facts, verified tool results, decisions, user corrections, safety constraints, and the next action.\n"
                                "- Preserve conversational continuity as well as task continuity. User identity, preferences, relationships, goals, and relevant life context are durable memory, not filler.\n"
                                "- Do not preserve filler, greetings, casual acknowledgements, or decorative details unless they directly affect future work.\n"
                                "- Treat summaries as lossy memory with pointers back to original messages. Make the summary useful for resuming work, not for replaying the chat.\n"
                                "- Pin governance/safety/user constraints explicitly. Do not let constraints disappear during compaction.\n\n"
                                "Output a STRICT JSON OBJECT containing two fields: `summary_text` and `memory_bullets`. Do not wrap it in markdown/code fences. Do not include <analysis> tags. Escape all newlines inside JSON strings as \\n.\n\n"
                                "Field 1: `summary_text`\n"
                                "This must be a detailed markdown string with these exact sections:\n"
                                "1. Task State: What the user was trying to accomplish, current status, and whether work is complete, blocked, or continuing.\n"
                                "2. Durable Context: Stable database/project facts, schema facts, configuration, relevant IDs, model/context settings, and environment facts.\n"
                                "3. User Profile and Personal Context: Record every explicitly stated identity detail, preference, relationship, background fact, interest, goal, accessibility need, location/time-zone detail, communication preference, and other personal context useful for future continuity. Attribute each fact to the user, preserve exact qualifiers, and write \"None stated in this block.\" only when genuinely absent. Never include authentication or payment secrets.\n"
                                "4. Evidence and Tool Results: Exact verified query/tool results, SQL definitions, table/column names, counts, errors, and outputs needed to avoid redoing work. Mark preview results as previews.\n"
                                "5. Decisions, Assumptions, and Corrections: Business definitions chosen, user corrections, false starts, and what was changed because of feedback.\n"
                                "6. Pinned Constraints: Security, privacy, read-only, user-stated constraints, and any instruction that must survive compaction. If none, write \"None stated in this block.\"\n"
                                "7. User Message Coverage: List ALL user messages from the provided block that are not tool results. For each message, include its request and any personal facts or preferences it introduced. This section must not omit earlier user messages in the covered message range.\n"
                                "8. Open Items and Next Action: Pending tasks, active work, and the next useful action.\n\n"
                                "Field 2: `memory_bullets`\n"
                                "This must be a list of retrieval-focused bullet objects designed for Qdrant vector search.\n"
                                "   - Produce as many bullets as are naturally required to cover the block's durable information. Do not add filler and do not omit, merge away, or shorten a personal fact, preference, correction, constraint, decision, result, or open item to satisfy an arbitrary count.\n"
                                "   - Each bullet must contain one searchable atomic fact, personal detail, relationship, decision, config value, error, endpoint, table, column, formula, user preference, tool result, or open item.\n"
                                "   - Include enough noun context in each bullet so it can stand alone in vector search.\n"
                                "   - Include one broad overview bullet with type 'overview'.\n"
                                "   - Prioritize durable facts that help future turns answer correctly: database identity, schema facts, query definitions, real query results, user corrections, explicit preferences, errors, fixes, and open tasks.\n"
                                "   - Create separate retrievable bullets for explicit user identity facts, preferences, relationships, goals, or personal context. Phrase them with attribution and enough context to stand alone.\n"
                                "   - Do NOT create many bullets for decorative UI styling details. If styling is the actual task, compress it into one concise overview/config bullet instead of one bullet per color.\n"
                                "   - If the user corrected a false answer, include a bullet preserving the correction and the verified replacement result.\n"
                                "   - If a governance/security/user constraint appears, create a `security_fact` bullet for it.\n"
                                "   - Use `user_identity` for explicit identity/profile facts, `user_preference` for stable preferences, `user_relationship` for explicitly stated relationships, and `personal_context` for other durable personal facts or goals.\n"
                                "   - Each object must have: `bullet_id` (string e.g. 'b001'), `bullet_index` (int), `text` (string), `type` (string: 'decision', 'config_fact', 'api_fact', 'database_fact', 'testing_fact', 'security_fact', 'runtime_fact', 'vamp_fact', 'analysis_fact', 'user_identity', 'user_preference', 'user_relationship', 'personal_context', 'open_item', 'overview', 'other').\n\n"
                                "Here's an example of how your output should be structured:\n\n"
                                "<example>\n"
                                "{\n"
                                "  \"summary_text\": \"1. Task State:\\n   [Current task and status]\\n\\n2. Durable Context:\\n   [Project facts]\\n\\n3. User Profile and Personal Context:\\n   - The user stated that they prefer concise explanations.\\n...\",\n"
                                "  \"memory_bullets\": [\n"
                                "    {\"bullet_id\": \"b001\", \"bullet_index\": 1, \"text\": \"The user stated that they prefer concise explanations with concrete examples.\", \"type\": \"user_preference\"}\n"
                                "  ]\n"
                                "}\n"
                                "</example>\n\n"
                                "Please provide your summary based on the provided conversation block only, following this structure and ensuring precision and thoroughness in your response. Output ONLY valid JSON."
                            )
                        ),
                        HumanMessage(
                            content=f"Conversation block:\n<conversation_history>\n{text_block}\n</conversation_history>"
                        ),
                    ]

                    response = await chat.ainvoke(prompt)
                    raw_content = _ai_message_content_to_str(response.content).strip()

                    summary_body = ""
                    memory_bullets = []
                    try:
                        parsed = _parse_summary_json_response(raw_content)
                        summary_body = parsed.get("summary_text", "").strip()
                        memory_bullets = parsed.get("memory_bullets", [])
                        response_metadata = (
                            getattr(response, "response_metadata", {}) or {}
                        )
                        logger.info(
                            "Summarizer output conversation=%s bytes=%s bullets=%s "
                            "stop_reason=%s",
                            conversation_id,
                            len(raw_content.encode("utf-8")),
                            len(memory_bullets),
                            response_metadata.get("stopReason")
                            or response_metadata.get("stop_reason")
                            or response_metadata.get("finish_reason"),
                        )
                    except Exception as e:
                        if (
                            _summary_parse_failure_is_likely_truncation(
                                response, raw_content
                            )
                            and len(chunk_turns) > 1
                        ):
                            next_limit = max(1, chunk_tokens // 2)
                            if next_limit >= summary_chunk_token_limit:
                                next_limit = max(1, summary_chunk_token_limit // 2)
                            summary_chunk_token_limit = next_limit
                            _clear_summary_claim(doc_ref, claim_id)
                            result["reason"] = "retrying_smaller_summary_chunk"
                            logger.warning(
                                "Summarizer output was truncated for %s; retrying "
                                "with complete-turn chunk budget %s",
                                conversation_id,
                                summary_chunk_token_limit,
                            )
                            continue
                        logger.warning("Failed to parse JSON from summarizer: %s", e)
                        _clear_summary_claim(doc_ref, claim_id)
                        result["reason"] = (
                            "summary_output_truncated"
                            if _summary_parse_failure_is_likely_truncation(
                                response, raw_content
                            )
                            else "invalid_summary_json"
                        )
                        result["error"] = str(e)
                        return result

                    if not summary_body:
                        logger.warning(
                            "Skipping summary write for conversation %s: empty summary_body",
                            conversation_id,
                        )
                        _clear_summary_claim(doc_ref, claim_id)
                        result["reason"] = "empty_summary"
                        return result

                    new_summary = (
                        f"[Messages {start_idx + 1}-{end_idx}]\n{summary_body}"
                    )

                    if not Config.VAMP_MEMORY_ENABLED:
                        logger.info(
                            "Skipping summary write for %s: VAMP memory disabled",
                            conversation_id,
                        )
                        _clear_summary_claim(doc_ref, claim_id)
                        result["reason"] = "vamp_disabled"
                        return result

                    from service.conversations.summary_memory import (
                        get_default_summary_memory_writer,
                    )

                    # Check if explicit turn_index is present, otherwise fallback to index in turns list
                    covers_from_turn = messages[chunk_turns[0][0]].get("turn_index")
                    if covers_from_turn is None:
                        covers_from_turn = turns.index(chunk_turns[0])
                    else:
                        try:
                            covers_from_turn = int(covers_from_turn)
                        except (ValueError, TypeError):
                            covers_from_turn = turns.index(chunk_turns[0])

                    covers_to_turn = messages[chunk_turns[-1][-1]].get("turn_index")
                    if covers_to_turn is None:
                        covers_to_turn = turns.index(chunk_turns[-1])
                    else:
                        try:
                            covers_to_turn = int(covers_to_turn)
                        except (ValueError, TypeError):
                            covers_to_turn = turns.index(chunk_turns[-1])

                    covers_message_ids = [
                        messages[idx].get("id")
                        or messages[idx].get("message_id")
                        or idx
                        for idx in range(start_idx, end_idx)
                    ]

                    await get_default_summary_memory_writer().store_summary_block(
                        conversation_id,
                        user_id,
                        text=new_summary,
                        start_message_idx=start_idx,
                        end_message_idx=end_idx - 1,
                        memory_bullets=memory_bullets,
                        covers_from_turn=covers_from_turn,
                        covers_to_turn=covers_to_turn,
                        covers_message_ids=covers_message_ids,
                        created_from_unsummarized_tail=True,
                    )
                    if not _commit_summary_claim(
                        doc_ref, claim_id, end_idx, last_summarized_turn=covers_to_turn
                    ):
                        logger.warning(
                            "Summary claim commit skipped for %s: claim no longer active",
                            conversation_id,
                        )
                        result["reason"] = "claim_commit_skipped"
                        return result
                except Exception:
                    _clear_summary_claim(doc_ref, claim_id)
                    raise
                finally:
                    claim_heartbeat_stop.set()
                    claim_heartbeat.cancel()
                    try:
                        await claim_heartbeat
                    except asyncio.CancelledError:
                        pass
                result.update(
                    {
                        "created": True,
                        "reason": "created",
                        "end_idx": end_idx,
                        "covers_from_turn": covers_from_turn,
                        "covers_to_turn": covers_to_turn,
                    }
                )
                logger.info(
                    "Generated summary for conversation %s (messages %s to %s, turns %s to %s)",
                    conversation_id,
                    start_idx,
                    end_idx,
                    covers_from_turn,
                    covers_to_turn,
                )

                # Catch up additional full blocks in the same pass.
                # The loop re-evaluates persisted pressure after each commit.
        except Exception as e:
            logger.error(f"Error in background summarization: {e}", exc_info=True)
            result["reason"] = "error"
            result["error"] = str(e)
        return result


# ── module-level helpers ─────────────────────────────────────────────


def _run_firestore_transaction(db, work):
    """Run a small Firestore transaction, with a direct fallback for mocks."""
    if not hasattr(db, "transaction"):
        return work(None)

    from firebase_admin import firestore

    transaction = db.transaction()

    @firestore.transactional
    def _transactional(transaction):
        return work(transaction)

    return _transactional(transaction)


def _get_doc_in_transaction(doc_ref, transaction):
    try:
        return doc_ref.get(transaction=transaction)
    except TypeError:
        return doc_ref.get()


def _update_doc_in_transaction(doc_ref, transaction, updates: dict) -> None:
    if transaction is not None:
        transaction.update(doc_ref, updates)
    else:
        doc_ref.update(updates)


def _summary_claim_is_stale(pending: dict, ttl_seconds: int) -> bool:
    claimed_at = pending.get("claimed_at") if isinstance(pending, dict) else None
    if not claimed_at:
        return True
    try:
        claimed_dt = datetime.fromisoformat(str(claimed_at).replace("Z", "+00:00"))
        if claimed_dt.tzinfo is None:
            claimed_dt = claimed_dt.replace(tzinfo=timezone.utc)
    except Exception:
        return True
    return (datetime.now(timezone.utc) - claimed_dt).total_seconds() > ttl_seconds


def _claim_summary_range(
    db,
    doc_ref,
    *,
    user_id: str,
    start_idx: int,
    end_idx: int,
) -> str | None:
    """
    Claim a summary range before doing expensive LLM/vector work.

    Returns a claim id if this worker owns the range, otherwise None.
    """
    from config import get_config

    Config = get_config()

    claim_id = str(uuid.uuid4())
    claimed_at = datetime.now(timezone.utc).isoformat()

    def _work(transaction):
        doc = _get_doc_in_transaction(doc_ref, transaction)
        if not doc.exists:
            return None
        data = doc.to_dict()
        if data.get("user_id") != user_id:
            return None
        if int(data.get("last_summarized_idx", 0) or 0) != start_idx:
            return None

        pending = data.get("summary_pending")
        if pending and not _summary_claim_is_stale(
            pending, Config.VAMP_SUMMARY_CLAIM_TTL_SECONDS
        ):
            return None

        _update_doc_in_transaction(
            doc_ref,
            transaction,
            {
                "summary_pending": {
                    "claim_id": claim_id,
                    "start_idx": start_idx,
                    "end_idx": end_idx,
                    "claimed_at": claimed_at,
                }
            },
        )
        return claim_id

    return _run_firestore_transaction(db, _work)


def _commit_summary_claim(
    doc_ref, claim_id: str, end_idx: int, last_summarized_turn: int | None = None
) -> bool:
    """Advance last_summarized_idx and last_summarized_turn only if this worker still owns the claim."""
    from firebase_admin import firestore

    from service.firestore.firestore_service import FirestoreService

    db = FirestoreService.get_db()

    def _work(transaction):
        doc = _get_doc_in_transaction(doc_ref, transaction)
        if not doc.exists:
            return False
        data = doc.to_dict() or {}
        pending = data.get("summary_pending") or {}
        if pending.get("claim_id") != claim_id:
            return False

        updates = {
            "last_summarized_idx": end_idx,
            "summary_pending": firestore.DELETE_FIELD,
        }
        if last_summarized_turn is not None:
            updates["last_summarized_turn"] = last_summarized_turn

        _update_doc_in_transaction(
            doc_ref,
            transaction,
            updates,
        )
        return True

    return bool(_run_firestore_transaction(db, _work))


def _renew_summary_claim(doc_ref, claim_id: str) -> bool:
    """Refresh claim time only while the caller still owns the claim."""
    from service.firestore.firestore_service import FirestoreService

    db = FirestoreService.get_db()

    def _work(transaction):
        doc = _get_doc_in_transaction(doc_ref, transaction)
        if not doc.exists:
            return False
        pending = (doc.to_dict() or {}).get("summary_pending") or {}
        if pending.get("claim_id") != claim_id:
            return False
        refreshed = dict(pending)
        refreshed["claimed_at"] = datetime.now(timezone.utc).isoformat()
        _update_doc_in_transaction(
            doc_ref, transaction, {"summary_pending": refreshed}
        )
        return True

    return bool(_run_firestore_transaction(db, _work))


async def _run_summary_claim_heartbeat(
    doc_ref,
    claim_id: str,
    stop: asyncio.Event,
    ttl_seconds: int,
) -> None:
    interval = max(5, min(60, int(ttl_seconds) // 3))
    while not stop.is_set():
        try:
            await asyncio.wait_for(stop.wait(), timeout=interval)
            return
        except TimeoutError:
            pass
        try:
            if not await asyncio.to_thread(_renew_summary_claim, doc_ref, claim_id):
                logger.warning("Summary claim %s lost during heartbeat", claim_id)
                return
        except asyncio.CancelledError:
            raise
        except Exception:
            # A transient heartbeat failure does not invalidate the owned
            # claim; the next interval retries before the TTL expires.
            logger.exception("Could not renew summary claim %s", claim_id)


def _clear_summary_claim(doc_ref, claim_id: str) -> None:
    """Clear an active failed claim if it still belongs to this worker."""
    from firebase_admin import firestore

    from service.firestore.firestore_service import FirestoreService

    db = FirestoreService.get_db()

    def _work(transaction):
        doc = _get_doc_in_transaction(doc_ref, transaction)
        if not doc.exists:
            return None
        pending = (doc.to_dict() or {}).get("summary_pending") or {}
        if pending.get("claim_id") == claim_id:
            _update_doc_in_transaction(
                doc_ref,
                transaction,
                {"summary_pending": firestore.DELETE_FIELD},
            )
        return None

    _run_firestore_transaction(db, _work)


def _build_summary_input(messages: list) -> str:
    """
    Render a list of stored Firestore messages into a structured text block
    suitable for the summarization LLM.

    For AI messages, tool activity is extracted from the stored ``timeline``
    field and appended as a compact digest so the summarizer can see what
    the agent actually did (queries run, schemas inspected, row counts, etc.)
    and not just the conversational text it wrote.
    """
    lines: list[str] = []
    for msg in messages:
        sender = msg.get("sender", "user").upper()
        content = msg.get("content", "").strip()

        if sender == "AI":
            lines.append(f"AI: {content}" if content else "AI: (no text response)")
            # Build a compact tool digest from the stored timeline.
            timeline = msg.get("timeline", [])
            tool_items = [item for item in timeline if item.get("type") == "tool"]
            if tool_items:
                lines.append("  [Tool activity]")
                for tool in tool_items:
                    name = tool.get("name", "unknown_tool")
                    status = tool.get("status", "done")
                    # Parse result to extract a compact summary.
                    raw_result = tool.get("result", "null")
                    try:
                        import json as _json

                        result_obj = (
                            _json.loads(raw_result)
                            if isinstance(raw_result, str)
                            else raw_result
                        )
                    except Exception:
                        result_obj = raw_result
                    result_summary = _summarize_tool_result(name, result_obj, status)
                    lines.append(f"  - {name} → {result_summary}")
        else:
            lines.append(f"USER: {content}")

    return "\n".join(lines)


def _summarize_tool_result(tool_name: str, result, status: str) -> str:
    """
    Produce a one-line digest of a tool result for use in the summarization
    input. Handles common structured result shapes from Moonlit's tool set.
    """
    if status == "error":
        if isinstance(result, dict) and result.get("error"):
            return f"ERROR — {str(result['error'])[:120]}"
        return "ERROR"

    if not isinstance(result, dict):
        return str(result)[:120] if result else "(no result)"

    # execute_query
    if tool_name == "execute_query":
        row_count = result.get("row_count")
        total_rows = result.get("total_rows")
        truncated = result.get("truncated", False)
        query = result.get("query", "")
        summary = f"{row_count} row(s) returned"
        if total_rows and total_rows != row_count:
            summary += f" (of {total_rows} total{', truncated' if truncated else ''})"
        if query:
            q = query.strip().replace("\n", " ")
            summary += f" — query: {q[:120]}"
        return summary

    # get_schema_overview
    if tool_name == "get_schema_overview":
        tables = result.get("tables", [])
        if isinstance(tables, list):
            names = ", ".join(
                str(t.get("name", t) if isinstance(t, dict) else t) for t in tables[:10]
            )
            suffix = f" (+{len(tables) - 10} more)" if len(tables) > 10 else ""
            return f"{len(tables)} table(s): {names}{suffix}"

    # get_database_list
    if tool_name == "get_database_list":
        dbs = result.get("databases", [])
        if isinstance(dbs, list):
            return f"{len(dbs)} database(s): {', '.join(str(d) for d in dbs[:8])}"

    # get_table_indexes
    if tool_name == "get_table_indexes":
        indexes = result.get("indexes", [])
        return (
            f"{len(indexes)} index(es) found"
            if isinstance(indexes, list)
            else "indexes retrieved"
        )

    # get_connection_status
    if tool_name == "get_connection_status":
        connected = result.get("connected", False)
        db = result.get("database", "")
        db_type = result.get("db_type", "")
        return (
            f"connected={connected}, db={db} ({db_type})"
            if db
            else f"connected={connected}"
        )

    # Generic fallback — surface the most informative scalar fields.
    scalar_fields = {
        k: v for k, v in result.items() if isinstance(v, (str, int, float, bool)) and v
    }
    if scalar_fields:
        parts = [f"{k}={v}" for k, v in list(scalar_fields.items())[:4]]
        return ", ".join(parts)

    return "completed"




def _ai_message_content_to_str(content) -> str:
    """Normalize LangChain AIMessage.content to a plain string for Firestore."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                if block.get("type") == "reasoning_content":
                    # Skip reasoning/thinking blocks in the final summary
                    continue
                if block.get("type") == "text":
                    parts.append(block.get("text", ""))
                elif "text" in block:
                    parts.append(block["text"])
                else:
                    parts.append(str(block))
            elif block:
                parts.append(str(block))
        return "".join(parts)
    return str(content) if content else ""


def _coerce_message_cursor(value, *, message_count: int) -> int:
    """Return a safe message cursor for slicing conversation history."""
    try:
        cursor = int(value or 0)
    except (TypeError, ValueError):
        cursor = 0
    return max(0, min(cursor, max(0, int(message_count or 0))))


def _extract_balanced_json_object(text: str) -> str:
    """Extract the first balanced JSON object from model output."""
    start = text.find("{")
    if start < 0:
        raise ValueError("No JSON object found in summarizer output")

    depth = 0
    in_string = False
    escaped = False
    for idx in range(start, len(text)):
        char = text[idx]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[start : idx + 1]

    raise ValueError("Unbalanced JSON object in summarizer output")


def _normalize_summary_memory_bullets(bullets: list[dict]) -> list[dict]:
    """Apply deterministic quality gates to VAMP retrieval bullets."""
    normalized: list[dict] = []

    for raw_idx, bullet in enumerate(bullets, start=1):
        if not isinstance(bullet, dict):
            raise ValueError(f"memory_bullets[{raw_idx}] must be an object")

        text = " ".join(str(bullet.get("text") or "").split())
        if not text:
            raise ValueError(f"memory_bullets[{raw_idx}] missing text")

        bullet_type = str(bullet.get("type") or "other").strip()
        if bullet_type not in _SUMMARY_BULLET_TYPES:
            bullet_type = "other"

        normalized.append(
            {
                **bullet,
                # IDs are storage metadata. Assigning them server-side keeps
                # every model-generated bullet even when the model repeats IDs.
                "bullet_id": f"b{len(normalized) + 1:03d}",
                "bullet_index": len(normalized) + 1,
                "text": text,
                "type": bullet_type,
            }
        )

    if not normalized:
        raise ValueError("Summarizer JSON missing durable memory_bullets")

    if not any(b.get("type") == "overview" for b in normalized):
        normalized[0]["type"] = "overview"

    for idx, bullet in enumerate(normalized, start=1):
        bullet["bullet_index"] = idx

    return normalized


def _parse_summary_json_response(raw_content: str) -> dict:
    """Parse strict summarizer JSON and validate required fields."""
    cleaned = raw_content.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned.removeprefix("```json").strip()
    elif cleaned.startswith("```"):
        cleaned = cleaned.removeprefix("```").strip()
    if cleaned.endswith("```"):
        cleaned = cleaned[: -3].strip()

    parsed = json.loads(_extract_balanced_json_object(cleaned))
    if not isinstance(parsed, dict):
        raise ValueError("Summarizer JSON root must be an object")
    if not isinstance(parsed.get("summary_text"), str):
        raise ValueError("Summarizer JSON missing string summary_text")
    bullets = parsed.get("memory_bullets")
    if not isinstance(bullets, list) or not bullets:
        raise ValueError("Summarizer JSON missing non-empty memory_bullets")
    parsed["memory_bullets"] = _normalize_summary_memory_bullets(bullets)
    return parsed


def _summary_parse_failure_is_likely_truncation(response, raw_content: str) -> bool:
    """Identify provider output-limit failures without altering model content."""
    metadata = getattr(response, "response_metadata", {}) or {}
    stop_reason = str(
        metadata.get("stopReason")
        or metadata.get("stop_reason")
        or metadata.get("finish_reason")
        or ""
    ).lower()
    if "max_token" in stop_reason or stop_reason in {"length", "max_length"}:
        return True

    stripped = str(raw_content or "").strip()
    return bool(stripped.startswith("{") and not stripped.endswith("}"))


def _parse_sse_event(sse_line: str) -> Optional[dict]:
    """Extract the JSON dict from a ``data: {…}\\n\\n`` SSE line."""
    line = sse_line.strip()
    if not line.startswith("data: "):
        return None
    payload = line[6:].strip()
    if not payload or payload == "[DONE]":
        return {"type": "done"}
    try:
        return json.loads(payload)
    except (json.JSONDecodeError, ValueError):
        return None


def _make_sse_error(message: str) -> str:
    """Build a single SSE error event string."""
    return f"data: {json.dumps({'type': 'error', 'message': message})}\n\n"


def _classify_error(raw: str) -> str:
    lower = raw.lower()
    if "rate_limit" in lower or "quota" in lower or "429" in lower:
        return "API rate limit exceeded. Please wait a moment and try again."
    if "authentication" in lower or "401" in lower:
        return "Authentication error. Please check API keys."
    return "AI service error. Please try again."




def _get_message_tokens_cheap(msg: dict) -> int:
    """Cheap pressure estimate for deciding whether to schedule exact summary."""
    import json

    from llm_provider.token_budget import estimate_tokens

    return estimate_tokens(_message_countable_text(msg, json_module=json))


def _get_background_summary_pressure(
    conv_data: dict | None,
    *,
    new_messages: list[dict] | None = None,
    assistant_message: dict | None = None,
    pressure_budget_tokens: int | None = None,
) -> dict:
    """Return cheap unsummarized-tail pressure used by summary scheduling."""
    messages = list((conv_data or {}).get("messages", []) or [])
    messages.extend(new_messages or [])
    if assistant_message:
        messages.append(assistant_message)

    start_idx = int((conv_data or {}).get("last_summarized_idx", 0) or 0)
    unsummarized_tail = messages[start_idx:]
    if not unsummarized_tail:
        return {
            "should_schedule": False,
            "tail_tokens": 0,
            "pressure_budget": pressure_budget_tokens or 12000,
            "threshold_tokens": int(float(pressure_budget_tokens or 12000) * 0.90),
            "complete_turn_count": 0,
            "start_idx": start_idx,
        }

    from langgraph_orchestration.conversation_access import group_messages_into_turns
    turns = group_messages_into_turns(unsummarized_tail)
    complete_turn_count = sum(
        1 for turn in turns if _turn_is_complete(turn, unsummarized_tail)
    )

    pressure_budget = pressure_budget_tokens
    if assistant_message and isinstance(assistant_message.get("usage"), dict):
        usage = assistant_message["usage"]
        pressure_budget = pressure_budget or (
            usage.get("pressureTriggerTokens")
            or usage.get("activeContextBudget")
            or usage.get("availableInputPayloadTokens")
        )

    if pressure_budget is None:
        pressure_budget = 12000

    cheap_tail_tokens = sum(_get_message_tokens_cheap(msg) for msg in unsummarized_tail)
    threshold_tokens = int(float(pressure_budget) * 0.90)
    should_schedule = complete_turn_count > 0 and cheap_tail_tokens >= threshold_tokens
    return {
        "should_schedule": should_schedule,
        "tail_tokens": cheap_tail_tokens,
        "pressure_budget": int(pressure_budget),
        "threshold_tokens": threshold_tokens,
        "complete_turn_count": complete_turn_count,
        "start_idx": start_idx,
    }




def _message_countable_text(msg: dict, *, json_module) -> str:
    """Return persisted message content that contributes to future context size.

    Do not use provider usage totals here: those are per-request billing/context
    metrics and include system prompt, tool schemas, memory, and prior history.
    Counting them as a single Firestore message size causes premature summaries.
    """
    parts = [str(msg.get("content") or "")]
    tool_calls = msg.get("tool_calls", [])
    if tool_calls:
        parts.append(json_module.dumps(tool_calls, default=str))
    tool_trace_summary = msg.get("tool_trace_summary")
    if tool_trace_summary:
        parts.append(str(tool_trace_summary))
    timeline = msg.get("timeline", [])
    if timeline:
        parts.append(json_module.dumps(timeline, default=str))
    return "\n".join(part for part in parts if part)


def _turn_is_complete(turn: list[int], messages: list) -> bool:
    has_user = any(
        str(messages[idx].get("sender", "")).lower() == "user" for idx in turn
    )
    has_ai = any(str(messages[idx].get("sender", "")).lower() == "ai" for idx in turn)
    has_final_ai = any(
        messages[idx].get("is_final_assistant_response") is True for idx in turn
    )
    # If any message in this turn is marked as final assistant response, then it is complete.
    # Otherwise, fallback to checking if we have both user and ai messages.
    if has_final_ai:
        return True
    return has_user and has_ai
