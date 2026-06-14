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
        # Ordered timeline mirrors the frontend's eventTimeline exactly.
        # Each entry is one of:
        #   { "type": "text",     "content": str }
        #   { "type": "thinking", "content": str }
        #   { "type": "tool",     "name": str, "status": str, "args": str, "result": str }
        ordered_timeline: list[dict] = []
        was_aborted = False
        has_error = False

        try:
            # Load conversation history for the checkpointer
            # (The LangGraph checkpointer handles per-thread state automatically
            #  via thread_id, but we still verify ownership.)
            conv_data = ConversationRepository.get(conversation_id)
            if conv_data and conv_data.get("user_id") != user_id:
                raise PermissionError("User does not own this conversation")

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
            ):
                # Parse the SSE data line to track content/tools for persistence
                event = _parse_sse_event(sse_line)
                if event is None:
                    # Forward unparseable lines as-is (shouldn't happen)
                    yield sse_line
                    continue

                event_type = event.get("type")

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
                        timeline=ordered_timeline,
                        append=(resume is not None),
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
            from app.llm.providers.model_factory import get_chat_model
            from app.features.agent_orchestration.infrastructure.checkpoint_utils import get_thread_message_count
            from app.core.config import Config
            from langchain_core.messages import HumanMessage, SystemMessage
            from app.features.conversations.infrastructure.firestore_service import FirestoreService

            namespaced_thread_id = thread_id or f"{user_id}:{conversation_id}"
            checkpoint_message_count = await get_thread_message_count(
                namespaced_thread_id
            )
            context_is_trimmed = checkpoint_message_count > ACTIVE_MESSAGE_WINDOW

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
                unsummarized_count = len(messages) - start_idx

                if unsummarized_count <= 0:
                    return

                end_idx = _select_summary_end_idx(
                    messages,
                    start_idx,
                    context_is_trimmed=context_is_trimmed,
                )
                if end_idx is None or end_idx <= start_idx:
                    logger.debug(
                        "Summarization deferred for %s: start=%s end=%s trimmed=%s total=%s",
                        conversation_id,
                        start_idx,
                        end_idx,
                        context_is_trimmed,
                        len(messages),
                    )
                    return

                claim_id = _claim_summary_range(
                    db,
                    doc_ref,
                    user_id=user_id,
                    start_idx=start_idx,
                    end_idx=end_idx,
                )
                if not claim_id:
                    logger.debug(
                        "Summarization deferred for %s: range %s-%s is already claimed",
                        conversation_id,
                        start_idx,
                        end_idx,
                    )
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

                    await VampMemoryService().store_summary_block(
                        conversation_id,
                        user_id,
                        text=new_summary,
                        start_message_idx=start_idx,
                        end_message_idx=end_idx - 1,
                        memory_bullets=memory_bullets,
                    )
                    if not _commit_summary_claim(doc_ref, claim_id, end_idx):
                        logger.warning(
                            "Summary claim commit skipped for %s: claim no longer active",
                            conversation_id,
                        )
                        return
                except Exception:
                    _clear_summary_claim(doc_ref, claim_id)
                    raise
                logger.info(
                    "Generated summary for conversation %s (messages %s to %s, trimmed=%s)",
                    conversation_id,
                    start_idx,
                    end_idx,
                    context_is_trimmed,
                )

                # Catch up additional full blocks in the same pass.
                context_is_trimmed = checkpoint_message_count > ACTIVE_MESSAGE_WINDOW
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


def _commit_summary_claim(doc_ref, claim_id: str, end_idx: int) -> bool:
    """Advance last_summarized_idx only if this worker still owns the claim."""
    from app.features.conversations.infrastructure.firestore_service import FirestoreService
    from firebase_admin import firestore

    db = FirestoreService.get_db()

    def _work(transaction):
        doc = _get_doc_in_transaction(doc_ref, transaction)
        if not doc.exists:
            return False
        pending = (doc.to_dict() or {}).get("summary_pending") or {}
        if pending.get("claim_id") != claim_id:
            return False
        _update_doc_in_transaction(
            doc_ref,
            transaction,
            {
                "last_summarized_idx": end_idx,
                "summary_pending": firestore.DELETE_FIELD,
            },
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
) -> int | None:
    """
    Choose the next Firestore slice to summarize.

    - Scheduled mode: full SUMMARY_BLOCK_SIZE blocks while context still fits.
    - Trim mode: summarize older messages before they fall out of the checkpoint
      window, keeping a small tail of recent Firestore entries unsummarized.
    """
    unsummarized_count = len(messages) - start_idx
    if unsummarized_count <= 0:
        return None

    if context_is_trimmed:
        min_remaining = min(
            HOT_FIRESTORE_MESSAGES,
            max(2, len(messages) // 2),
        )
        retain_from = len(messages) - min_remaining
        if retain_from <= start_idx:
            return None
            
        # Prevent generating tiny summaries on every turn. Wait until we have a chunk
        # of at least half the SUMMARY_BLOCK_SIZE (e.g. 10 messages).
        if retain_from - start_idx < (SUMMARY_BLOCK_SIZE // 2):
            return None
            
        return _find_safe_user_boundary(messages, start_idx, retain_from)

    if unsummarized_count < SUMMARY_BLOCK_SIZE:
        return None

    return _find_safe_user_boundary(
        messages, start_idx, start_idx + SUMMARY_BLOCK_SIZE
    )


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
