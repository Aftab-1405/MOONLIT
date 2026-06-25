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

            # Persist task_mode to Firestore conversation
            if conv_data:
                task_mode_stored = conv_data.get("task_mode", "normal") or "normal"
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

                elif event_type == "usage_metrics":
                    last_usage_metrics = {
                        "inputTokens": event.get("inputTokens"),
                        "outputTokens": event.get("outputTokens"),
                        "totalTokens": event.get("totalTokens"),
                        "activeContextBudget": event.get("activeContextBudget"),
                        "totalContextWindow": event.get("totalContextWindow"),
                        "inputPayloadTokens": event.get("inputPayloadTokens"),
                        "availableInputPayloadTokens": event.get("availableInputPayloadTokens"),
                        "reservedOutputTokens": event.get("reservedOutputTokens"),
                        "safetyMarginTokens": event.get("safetyMarginTokens"),
                    }

                elif event_type == "agent_interrupt" and prompt and not prompt_stored:
                    await store_prompt_once()

                # event_type "done" — pass-through only

                yield sse_line

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
        thread_id: str | None = None,
    ):
        try:
            import json

            from config import get_config
            from langchain_core.messages import HumanMessage, SystemMessage
            from llm_provider.model_factory import (
                get_chat_model,
                get_default_model,
            )
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
            from api_contract.runtime_ports import (
                get_conversation_summarization_context_provider,
            )

            summarization_context = get_conversation_summarization_context_provider()
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
            active_context_budget = budget_info["active_context_budget"]
            summary_trigger_tokens = int(float(active_context_budget) * 0.90)

            db = FirestoreService.get_db()
            doc_ref = db.collection(ConversationRepository.COLLECTION_NAME).document(
                conversation_id
            )

            while True:
                doc = doc_ref.get()
                if not doc.exists:
                    return

                data = doc.to_dict()
                if data.get("user_id") != user_id:
                    return

                messages = data.get("messages", [])
                start_idx = data.get("last_summarized_idx", 0)
                unsummarized_tail = messages[start_idx:]
                if not unsummarized_tail:
                    return

                # Calculate measured pressure in the unsummarized tail.
                from llm_provider.token_budget import get_message_tokens
                tail_tokens = sum(
                    get_message_tokens(msg, model_id=selected_model)
                    for msg in unsummarized_tail
                )

                # Summarize when measured pressure reaches the same 90% trigger
                # surfaced to the frontend.
                if tail_tokens < summary_trigger_tokens:
                    return

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
                    return

                # Chunk complete unsummarized turns by budget (limit chunk size to active_context_budget // 2)
                chunk_turns = []
                chunk_tokens = 0
                max_chunk_tokens = active_context_budget // 2

                for turn in complete_unsummarized_turns:
                    from llm_provider.token_budget import get_message_tokens
                    turn_tokens = sum(
                        get_message_tokens(messages[idx], model_id=selected_model)
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
                    return

                block_to_summarize = messages[start_idx:end_idx]
                text_block = _build_summary_input(block_to_summarize)

                try:
                    chat = get_chat_model(
                        Config.LLM_PROVIDER, model=model, enable_reasoning=False
                    )
                    prompt = [
                        SystemMessage(
                            content=(
                                "Your task is to create a detailed summary of the RECENT portion of the conversation — the messages that follow earlier retained context. "
                                "The earlier messages are being kept intact and do NOT need to be summarized. Focus your summary on what was discussed, learned, and accomplished in the recent messages only.\n\n"
                                "Before providing your final summary, wrap your analysis in <analysis> tags to organize your thoughts and ensure you've covered all necessary points. In your analysis process:\n\n"
                                "1. Analyze the recent messages chronologically. For each section thoroughly identify:\n"
                                "   - The user's explicit requests and intents\n"
                                "   - Your approach to addressing the user's requests\n"
                                "   - Key decisions, technical concepts and code patterns\n"
                                "   - Specific details like:\n"
                                "     - file names and table names\n"
                                "     - full code or SQL snippets\n"
                                "     - function signatures\n"
                                "     - file edits\n"
                                "   - Errors that you ran into and how you fixed them\n"
                                "   - Pay special attention to specific user feedback that you received, especially if the user told you to do something differently.\n"
                                "   - Note any security-relevant instructions or constraints the user stated. These MUST be preserved verbatim in the summary so they continue to apply after compaction.\n"
                                "2. Double-check for technical accuracy and completeness, addressing each required element thoroughly.\n\n"
                                "After your <analysis> block, you must output a STRICT JSON OBJECT containing two fields: `summary_text` and `memory_bullets`. Do not include the JSON inside a <summary> block, output the raw JSON object.\n\n"
                                "Field 1: `summary_text`\n"
                                "This must be a detailed markdown string that includes the following sections:\n"
                                "1. Primary Request and Intent: Capture the user's explicit requests and intents from the recent messages\n"
                                "2. Key Technical Concepts: List important technical concepts, technologies, and frameworks discussed recently.\n"
                                "3. Files and Code Sections: Enumerate specific files and code sections examined, modified, or created. Include full code snippets where applicable and include a summary of why this file read or edit is important.\n"
                                "4. Errors and fixes: List errors encountered and how they were fixed.\n"
                                "5. Problem Solving: Document problems solved and any ongoing troubleshooting efforts.\n"
                                "6. All user messages: List ALL user messages from the recent portion that are not tool results. Preserve any security-relevant instructions or constraints verbatim so they remain in effect after compaction.\n"
                                "7. Pending Tasks: Outline any pending tasks from the recent messages.\n"
                                "8. Current Work: Describe precisely what was being worked on immediately before this summary request.\n"
                                "9. Optional Next Step: List the next step related to the most recent work. Include direct quotes from the most recent conversation.\n\n"
                                "Field 2: `memory_bullets`\n"
                                "This must be a list of retrieval-focused bullet objects designed for Qdrant vector search.\n"
                                "   - Each bullet must contain one searchable atomic fact, decision, config value, error, endpoint, table, column, formula, user preference, tool result, or open item.\n"
                                "   - Include enough noun context in each bullet so it can stand alone in vector search.\n"
                                "   - Include one broad overview bullet with type 'overview'.\n"
                                "   - Each object must have: `bullet_id` (string e.g. 'b001'), `bullet_index` (int), `text` (string), `type` (string: 'decision', 'config_fact', 'api_fact', 'database_fact', 'testing_fact', 'security_fact', 'runtime_fact', 'vamp_fact', 'analysis_fact', 'open_item', 'overview', 'other').\n\n"
                                "Here's an example of how your output should be structured:\n\n"
                                "<example>\n"
                                "<analysis>\n"
                                "[Your thought process, ensuring all points are covered thoroughly and accurately]\n"
                                "</analysis>\n"
                                "{\n"
                                "  \"summary_text\": \"1. Primary Request and Intent:\\n   [Detailed description]\\n\\n2. Key Technical Concepts:\\n   - [Concept 1]\\n...\",\n"
                                "  \"memory_bullets\": [\n"
                                "    {\"bullet_id\": \"b001\", \"bullet_index\": 1, \"text\": \"For the sales analysis, VIP customers are defined as having >5 orders.\", \"type\": \"decision\"}\n"
                                "  ]\n"
                                "}\n"
                                "</example>\n\n"
                                "Please provide your summary based on the RECENT messages only, following this structure and ensuring precision and thoroughness in your response. Output ONLY valid JSON after the analysis tags."
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
                        import json

                        if "```json" in raw_content:
                            json_str = (
                                raw_content.split("```json")[1].split("```")[0].strip()
                            )
                        elif "```" in raw_content:
                            json_str = (
                                raw_content.split("```")[1].split("```")[0].strip()
                            )
                        else:
                            json_str = raw_content
                        parsed = json.loads(json_str)
                        summary_body = parsed.get("summary_text", "").strip()
                        memory_bullets = parsed.get("memory_bullets", [])
                    except Exception as e:
                        logger.warning("Failed to parse JSON from summarizer: %s", e)
                        summary_body = raw_content
                        memory_bullets = []

                    if not summary_body:
                        logger.warning(
                            "Skipping summary write for conversation %s: empty summary_body",
                            conversation_id,
                        )
                        _clear_summary_claim(doc_ref, claim_id)
                        return

                    new_summary = (
                        f"[Messages {start_idx + 1}-{end_idx}]\n{summary_body}"
                    )

                    if not Config.VAMP_MEMORY_ENABLED:
                        logger.info(
                            "Skipping summary write for %s: VAMP memory disabled",
                            conversation_id,
                        )
                        _clear_summary_claim(doc_ref, claim_id)
                        return

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
                        return
                except Exception:
                    _clear_summary_claim(doc_ref, claim_id)
                    raise
                logger.info(
                    "Generated summary for conversation %s (messages %s to %s, turns %s to %s)",
                    conversation_id,
                    start_idx,
                    end_idx,
                    covers_from_turn,
                    covers_to_turn,
                )

                # Catch up additional full blocks in the same pass.
                # Re-evaluate tokens after summarizing
                pass
        except Exception as e:
            logger.error(f"Error in background summarization: {e}", exc_info=True)


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


def _find_safe_user_boundary(
    messages: list, start_idx: int, target_end_idx: int
) -> int | None:
    """Walk backward to end on a user message so blocks do not split a turn."""
    end_idx = min(target_end_idx, len(messages))
    if end_idx <= start_idx:
        return None

    while end_idx > start_idx and messages[end_idx - 1].get("sender") != "user":
        end_idx -= 1

    if end_idx <= start_idx:
        if target_end_idx - start_idx >= 2:
            return min(target_end_idx, len(messages))
        return None

    return end_idx


def _select_summary_end_idx(
    messages: list,
    start_idx: int,
    *,
    context_is_trimmed: bool,
    active_context_budget: int = 4000,
) -> int | None:
    """
    Choose the next Firestore slice to summarize using token budgets.
    """
    import json

    from llm_provider.token_budget import estimate_tokens

    unsummarized_count = len(messages) - start_idx
    if unsummarized_count <= 0:
        return None

    # Only trigger summarization if the unsummarized tail exceeds the active_context_budget.
    if not context_is_trimmed:
        return None

    # Walk backwards from the end to find the maximum unsummarized tail that fits in half the budget
    target_budget = active_context_budget // 2
    total_tokens = 0
    retain_from = len(messages)

    for i in range(len(messages) - 1, start_idx - 1, -1):
        msg = messages[i]
        content = msg.get("content", "")
        tokens = estimate_tokens(content)
        timeline = msg.get("timeline", [])
        if timeline:
            tokens += estimate_tokens(json.dumps(timeline))

        if total_tokens + tokens > target_budget:
            break

        total_tokens += tokens
        retain_from = i

    if retain_from <= start_idx:
        retain_from = start_idx + 2  # ensure we at least summarize something

    return _find_safe_user_boundary(messages, start_idx, retain_from)


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


def _should_schedule_background_summary(
    conv_data: dict | None,
    *,
    new_messages: list[dict] | None = None,
    assistant_message: dict | None = None,
    pressure_budget_tokens: int | None = None,
) -> bool:
    """Cheaply decide whether to launch exact background summarization.

    The exact summarizer still owns correctness. This gate avoids scheduling it
    after every turn when the unsummarized tail is nowhere near pressure.
    """
    return _get_background_summary_pressure(
        conv_data,
        new_messages=new_messages,
        assistant_message=assistant_message,
        pressure_budget_tokens=pressure_budget_tokens,
    )["should_schedule"]


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
