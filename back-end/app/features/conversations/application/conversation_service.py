"""
Conversation Service - Handles conversation management, AI streaming, and Firestore persistence.

Consumes the LangGraph agent's SSE-encoded JSON events, passes them through
to the HTTP client, and persists completed messages to Firestore.
"""

import json
import uuid
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional, AsyncGenerator

from fastapi.concurrency import run_in_threadpool

from app.features.agent_orchestration.infrastructure.memory_config import (
    ACTIVE_MESSAGE_WINDOW,
    HOT_FIRESTORE_MESSAGES,
    SUMMARY_BLOCK_SIZE,
)

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
        from app.features.conversations.infrastructure.conversation_repository import ConversationRepository

        return ConversationRepository.get_for_user(conversation_id, user_id)

    @staticmethod
    def delete_user_conversation(conversation_id: str, user_id: str) -> None:
        from app.features.conversations.infrastructure.conversation_repository import ConversationRepository

        ConversationRepository.delete(conversation_id, user_id)

    @staticmethod
    def rename_user_conversation(
        conversation_id: str, user_id: str, title: str
    ) -> str:
        from app.features.conversations.infrastructure.conversation_repository import ConversationRepository

        return ConversationRepository.rename(conversation_id, user_id, title)

    @staticmethod
    def get_user_conversations(user_id: str) -> list:
        from app.features.conversations.infrastructure.conversation_repository import ConversationRepository

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
        from app.features.conversations.infrastructure.conversation_repository import ConversationRepository
        from app.features.agent_orchestration.application.stream_conversation import stream_conversation

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
        has_error = False
        last_usage_metrics = None

        try:
            # Load conversation history for the checkpointer
            # (The LangGraph checkpointer handles per-thread state automatically
            #  via thread_id, but we still verify ownership.)
            conv_data = ConversationRepository.get(conversation_id)
            if conv_data and conv_data.get("user_id") != user_id:
                raise PermissionError("User does not own this conversation")

            if resume is not None and conv_data and conv_data.get("messages"):
                last_msg = conv_data["messages"][-1]
                current_turn_id = last_msg.get("turn_id")
                current_turn_index = last_msg.get("turn_index")

            # Persist task_mode to Firestore conversation
            if conv_data:
                task_mode_stored = conv_data.get("task_mode", "normal") or "normal"
                if resume is not None and task_mode == "normal" and task_mode_stored != "normal":
                    task_mode = task_mode_stored
                try:
                    from app.features.conversations.infrastructure.firestore_service import FirestoreService
                    db = FirestoreService.get_db()
                    db.collection("conversations").document(conversation_id).update({
                        "task_mode": task_mode
                    })
                except Exception as e:
                    logger.warning("Failed to save task_mode in Firestore: %s", e)

            # Stream from the LangGraph agent
            async for sse_line in stream_conversation(
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
                if prompt and not prompt_stored and event_type in ("token", "tool_start", "thinking_token", "agent_interrupt"):
                    if current_turn_id is None:
                        import uuid
                        current_turn_id = str(uuid.uuid4())
                    if current_turn_index is None:
                        existing_messages = conv_data.get("messages", []) if conv_data else []
                        max_turn_index = -1
                        for msg in existing_messages:
                            ti = msg.get("turn_index")
                            if ti is not None:
                                try:
                                    max_turn_index = max(max_turn_index, int(ti))
                                except (ValueError, TypeError):
                                    pass
                        current_turn_index = max_turn_index + 1

                    await run_in_threadpool(
                        ConversationRepository.store_message,
                        conversation_id, "user", prompt, user_id,
                        turn_id=current_turn_id,
                        turn_index=current_turn_index,
                        message_role="user",
                        is_final_assistant_response=False,
                    )
                    prompt_stored = True

                if event_type == "token":
                    if prompt and not prompt_stored:
                        await run_in_threadpool(
                            ConversationRepository.store_message,
                            conversation_id, "user", prompt, user_id
                        )
                        prompt_stored = True
                    chunk = event.get("content", "")
                    if chunk:
                        if ordered_timeline and ordered_timeline[-1]["type"] == "text":
                            ordered_timeline[-1]["content"] += chunk
                        else:
                            ordered_timeline.append({"type": "text", "content": chunk})

                elif event_type == "tool_start":
                    if prompt and not prompt_stored:
                        await run_in_threadpool(
                            ConversationRepository.store_message,
                            conversation_id, "user", prompt, user_id
                        )
                        prompt_stored = True
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
                        if item["type"] == "tool" and item["name"] == name and item["status"] == "running":
                            item["status"] = "done"
                            item["args"] = json.dumps(
                                event.get("args", {}), default=str
                            )
                            item["result"] = json.dumps(
                                event.get("result", {}), default=str
                            )
                            break

                elif event_type == "thinking_token":
                    if prompt and not prompt_stored:
                        await run_in_threadpool(
                            ConversationRepository.store_message,
                            conversation_id, "user", prompt, user_id
                        )
                        prompt_stored = True
                    chunk = event.get("content", "")
                    if chunk:
                        if ordered_timeline and ordered_timeline[-1]["type"] == "thinking":
                            ordered_timeline[-1]["content"] += chunk
                        else:
                            ordered_timeline.append({"type": "thinking", "content": chunk, "is_complete": False})

                elif event_type == "error":
                    has_error = True

                elif event_type == "usage_metrics":
                    last_usage_metrics = {
                        "inputTokens": event.get("inputTokens"),
                        "outputTokens": event.get("outputTokens"),
                        "totalTokens": event.get("totalTokens"),
                        "activeContextBudget": event.get("activeContextBudget"),
                        "totalContextWindow": event.get("totalContextWindow"),
                    }

                elif event_type == "agent_interrupt" and prompt and not prompt_stored:
                    await run_in_threadpool(
                        ConversationRepository.store_message,
                        conversation_id, "user", prompt, user_id
                    )
                    prompt_stored = True

                # event_type "done" — pass-through only

                yield sse_line

        except GeneratorExit:
            was_aborted = True
            logger.info(f"Stream aborted for conversation {conversation_id}")

        except PermissionError:
            has_error = True
            yield _make_sse_error(
                "You don't have permission to access this conversation."
            )

        except Exception as err:
            has_error = True
            logger.error(f"Streaming error: {err}", exc_info=True)
            yield _make_sse_error(_classify_error(str(err)))

        finally:
            should_store_response = (prompt_stored or resume is not None) and not response_stored and not has_error
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

                # Derive flat fields for backward compat and Firestore storage
                response_text = "".join(
                    item["content"] for item in ordered_timeline if item["type"] == "text"
                ).strip()
                thinking_text = "".join(
                    item["content"] for item in ordered_timeline if item["type"] == "thinking"
                ).strip()
                tools_used = [
                    item for item in ordered_timeline if item["type"] == "tool"
                ]

                if ordered_timeline:
                    if not response_text and tools_used:
                        response_text = "(Used tools to gather information)"

                    # Generate turn info if not already generated
                    if current_turn_id is None:
                        import uuid
                        current_turn_id = str(uuid.uuid4())
                    if current_turn_index is None:
                        existing_messages = conv_data.get("messages", []) if conv_data else []
                        max_turn_index = -1
                        for msg in existing_messages:
                            ti = msg.get("turn_index")
                            if ti is not None:
                                try:
                                    max_turn_index = max(max_turn_index, int(ti))
                                except (ValueError, TypeError):
                                    pass
                        current_turn_index = max_turn_index + 1

                    tool_trace_summary = _build_tool_trace_summary(ordered_timeline)

                    # `content` is always stored — the summarisation loop reads it.
                    # `thinking` and `tools` are intentionally omitted when a timeline
                    # is present: all that data is already embedded in the timeline
                    # nodes, so storing it again would double the Firestore payload.
                    await run_in_threadpool(
                        ConversationRepository.store_message,
                        conversation_id,
                        "ai",
                        response_text,
                        user_id,
                        tools=None,
                        thinking=None,
                        timeline=ordered_timeline,
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
                        f"Stored AI response ({status}): {len(response_text)} chars, "
                        f"{len(ordered_timeline)} timeline items"
                    )

                    # Fire and forget the summarization task so it doesn't block stream cleanup
                    asyncio.create_task(
                        ConversationService.check_and_summarize(
                            conversation_id,
                            user_id,
                            model,
                            thread_id=f"{user_id}:{conversation_id}",
                        )
                    )
            elif has_error:
                logger.info(
                    f"Skipped storing error response for conversation {conversation_id}"
                )

    # ── Response headers ─────────────────────────────────────────────

    @staticmethod
    def get_streaming_headers(conversation_id: str) -> dict:
        return {
            "X-Conversation-Id": conversation_id,
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
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
            from app.features.conversations.infrastructure.conversation_repository import ConversationRepository
            from app.llm.providers.model_factory import get_chat_model, get_default_model
            from app.core.config import Config
            from langchain_core.messages import HumanMessage, SystemMessage
            from app.features.conversations.infrastructure.firestore_service import FirestoreService
            from app.core.token_budget import calculate_token_budget
            import json

            selected_model = model or get_default_model(Config.LLM_PROVIDER)
            budget_info = calculate_token_budget(selected_model)
            active_context_budget = budget_info["active_context_budget"]

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
                
                # Calculate total tokens in unsummarized tail
                tail_tokens = sum(_get_message_tokens(msg) for msg in unsummarized_tail)

                # Only summarize if unsummarized_tail_tokens >= active_context_budget
                if tail_tokens < active_context_budget:
                    return

                # Group messages into turns
                turns = _group_messages_into_turns(messages)

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
                    turn_tokens = sum(_get_message_tokens(messages[idx]) for idx in turn)
                    if chunk_turns and chunk_tokens + turn_tokens > max_chunk_tokens:
                        break
                    chunk_turns.append(turn)
                    chunk_tokens += turn_tokens

                if not chunk_turns:
                    chunk_turns = [complete_unsummarized_turns[0]]

                # The first chunk covers message range [start_idx, end_idx)
                chunk_start_msg_idx = chunk_turns[0][0]
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
                                "You are a precise memory archivist for a database assistant called Moonlit. "
                                "Your output will be injected verbatim into the AI agent's context on future turns, "
                                "so it must be immediately usable — not a narrative retelling.\n\n"
                                "OUTPUT FORMAT — produce a strict JSON object containing two fields:\n"
                                "1. `summary_text`: A single string containing four sections (Entities & Values, Decisions & Context, Tool Activity, Open Items) formatted as markdown bulleted lists.\n"
                                "   - Entities & Values: `name (type)`.\n"
                                "   - Decisions & Context: verb-first, present tense fact.\n"
                                "   - Tool Activity: `tool_name → outcome`.\n"
                                "   - Open Items: unresolved items.\n"
                                "2. `memory_bullets`: A list of bullet objects. Each bullet must contain one atomic memory fact, decision, config value, error, endpoint, table, column, tool decision, or final resolved detail.\n"
                                "   - Keep bullets short and retrieval-focused. Preserve exact values.\n"
                                "   - Good bullet: `Backend service port is 7800.` Bad bullet: `Deployment configuration was discussed.`\n"
                                "   - Every summary block can optionally include one broad overview bullet with type 'overview' describing the general topics covered (e.g., {\"bullet_id\": \"b000\", \"bullet_index\": 0, \"text\": \"Overview: This block covers...\", \"type\": \"overview\"}).\n"
                                "   - Each object must have: `bullet_id` (string e.g. 'b001'), `bullet_index` (int), `text` (string), `type` (string: 'decision', 'config_fact', 'api_fact', 'database_fact', 'testing_fact', 'security_fact', 'runtime_fact', 'vamp_fact', 'overview', 'other').\n\n"
                                "Output ONLY valid JSON. Do not include markdown codeblocks around the JSON."
                            )
                        ),
                        HumanMessage(content=f"Conversation block:\n<conversation_history>\n{text_block}\n</conversation_history>"),
                    ]

                    response = await chat.ainvoke(prompt)
                    raw_content = _ai_message_content_to_str(response.content).strip()
                    
                    summary_body = ""
                    memory_bullets = []
                    try:
                        import json
                        if "```json" in raw_content:
                            json_str = raw_content.split("```json")[1].split("```")[0].strip()
                        elif "```" in raw_content:
                            json_str = raw_content.split("```")[1].split("```")[0].strip()
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

                    from app.features.vamp_memory.application.vamp_memory_service import VampMemoryService

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

                    covers_message_ids = [messages[idx].get("id") or messages[idx].get("message_id") or idx for idx in range(start_idx, end_idx)]

                    await VampMemoryService().store_summary_block(
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
                    if not _commit_summary_claim(doc_ref, claim_id, end_idx, last_summarized_turn=covers_to_turn):
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
    from app.core.config import Config

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


def _commit_summary_claim(doc_ref, claim_id: str, end_idx: int, last_summarized_turn: int | None = None) -> bool:
    """Advance last_summarized_idx and last_summarized_turn only if this worker still owns the claim."""
    from app.features.conversations.infrastructure.firestore_service import FirestoreService
    from firebase_admin import firestore

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
    from app.features.conversations.infrastructure.firestore_service import FirestoreService
    from firebase_admin import firestore

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
                        result_obj = _json.loads(raw_result) if isinstance(raw_result, str) else raw_result
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
            names = ", ".join(str(t.get("name", t) if isinstance(t, dict) else t) for t in tables[:10])
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
        return f"{len(indexes)} index(es) found" if isinstance(indexes, list) else "indexes retrieved"

    # get_connection_status
    if tool_name == "get_connection_status":
        connected = result.get("connected", False)
        db = result.get("database", "")
        db_type = result.get("db_type", "")
        return f"connected={connected}, db={db} ({db_type})" if db else f"connected={connected}"

    # Generic fallback — surface the most informative scalar fields.
    scalar_fields = {k: v for k, v in result.items() if isinstance(v, (str, int, float, bool)) and v}
    if scalar_fields:
        parts = [f"{k}={v}" for k, v in list(scalar_fields.items())[:4]]
        return ", ".join(parts)

    return "completed"


def _find_safe_user_boundary(messages: list, start_idx: int, target_end_idx: int) -> int | None:
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
    from app.core.token_budget import estimate_tokens
    import json
    
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


def _group_messages_into_turns(messages: list) -> list[list[int]]:
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

def _get_message_tokens(msg: dict) -> int:
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

def _turn_is_complete(turn: list[int], messages: list) -> bool:
    has_user = any(str(messages[idx].get("sender", "")).lower() == "user" for idx in turn)
    has_ai = any(str(messages[idx].get("sender", "")).lower() == "ai" for idx in turn)
    has_final_ai = any(messages[idx].get("is_final_assistant_response") is True for idx in turn)
    # If any message in this turn is marked as final assistant response, then it is complete.
    # Otherwise, fallback to checking if we have both user and ai messages.
    if has_final_ai:
        return True
    return has_user and has_ai
