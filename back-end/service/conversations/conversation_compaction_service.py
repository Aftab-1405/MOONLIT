"""
Conversation Compaction Service - Handles historical message logs compaction, token-pressure budgeting,
and Firestore locking transactions for VAMP memory.
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

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
    """
    lines: list[str] = []
    for msg in messages:
        sender = msg.get("sender", "user").upper()
        content = msg.get("content", "").strip()

        if sender == "AI":
            lines.append(f"AI: {content}" if content else "AI: (no text response)")
            timeline = msg.get("timeline", [])
            tool_items = [item for item in timeline if item.get("type") == "tool"]
            if tool_items:
                lines.append("  [Tool activity]")
                for tool in tool_items:
                    name = tool.get("name", "unknown_tool")
                    status = tool.get("status", "done")
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

    if tool_name == "get_schema_overview":
        tables = result.get("tables", [])
        if isinstance(tables, list):
            names = ", ".join(
                str(t.get("name", t) if isinstance(t, dict) else t) for t in tables[:10]
            )
            suffix = f" (+{len(tables) - 10} more)" if len(tables) > 10 else ""
            return f"{len(tables)} table(s): {names}{suffix}"

    if tool_name == "get_database_list":
        dbs = result.get("databases", [])
        if isinstance(dbs, list):
            return f"{len(dbs)} database(s): {', '.join(str(d) for d in dbs[:8])}"

    if tool_name == "get_table_indexes":
        indexes = result.get("indexes", [])
        return (
            f"{len(indexes)} index(es) found"
            if isinstance(indexes, list)
            else "indexes retrieved"
        )

    if tool_name == "get_connection_status":
        connected = result.get("connected", False)
        db = result.get("database", "")
        db_type = result.get("db_type", "")
        return (
            f"connected={connected}, db={db} ({db_type})"
            if db
            else f"connected={connected}"
        )

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


def _get_message_tokens_cheap(msg: dict) -> int:
    """Cheap pressure estimate for deciding whether to schedule exact summary."""
    from llm_provider.token_budget import estimate_tokens

    return estimate_tokens(_message_countable_text(msg))


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


def _message_countable_text(msg: dict) -> str:
    """Return persisted message content that contributes to future context size."""
    parts = [str(msg.get("content") or "")]
    tool_calls = msg.get("tool_calls", [])
    if tool_calls:
        parts.append(json.dumps(tool_calls, default=str))
    tool_trace_summary = msg.get("tool_trace_summary")
    if tool_trace_summary:
        parts.append(str(tool_trace_summary))
    timeline = msg.get("timeline", [])
    if timeline:
        parts.append(json.dumps(timeline, default=str))
    return "\n".join(part for part in parts if part)


def _turn_is_complete(turn: list[int], messages: list) -> bool:
    has_user = any(
        str(messages[idx].get("sender", "")).lower() == "user" for idx in turn
    )
    has_ai = any(str(messages[idx].get("sender", "")).lower() == "ai" for idx in turn)
    has_final_ai = any(
        messages[idx].get("is_final_assistant_response") is True for idx in turn
    )
    if has_final_ai:
        return True
    return has_user and has_ai


class ConversationCompactionService:
    """Handles checkpointer budget evaluation, locking, and VAMP summarization."""

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

                tail_tokens = sum(
                    _get_message_tokens_cheap(msg)
                    for msg in unsummarized_tail
                )
                result["tail_tokens"] = tail_tokens

                if tail_tokens < summary_trigger_tokens:
                    result["reason"] = "below_threshold"
                    return result

                from langgraph_orchestration.conversation_access import group_messages_into_turns
                turns = group_messages_into_turns(messages)

                turn_idx_by_msg_idx = {}
                for t_idx, turn in enumerate(turns):
                    for m_idx in turn:
                        turn_idx_by_msg_idx[m_idx] = t_idx

                start_turn_idx = turn_idx_by_msg_idx.get(start_idx, 0)
                unsummarized_turns = turns[start_turn_idx:]

                complete_unsummarized_turns = []
                for t in unsummarized_turns:
                    if _turn_is_complete(t, messages):
                        complete_unsummarized_turns.append(t)
                    else:
                        break

                if not complete_unsummarized_turns:
                    result["reason"] = "no_complete_turns"
                    return result

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
                    from langgraph_orchestration.prompt_builder import SummarizationPromptBuilder

                    prompt = [
                        SystemMessage(
                            content=SummarizationPromptBuilder.get_system_prompt()
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

        except Exception as e:
            logger.error(f"Error in background summarization: {e}", exc_info=True)
            result["reason"] = "error"
            result["error"] = str(e)
        return result
