"""
LangGraph agent — streams agentic conversation over SSE.

Builds a ReAct graph via :func:`graph.build_react_agent`, then streams with
``version='v2'`` unified stream parts (messages + custom tool events).

See: https://docs.langchain.com/oss/python/langgraph/streaming
"""

from __future__ import annotations

import logging
from typing import AsyncGenerator, Optional

from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage
from langgraph.types import Command
from fastapi.concurrency import run_in_threadpool

from .checkpointing import get_checkpointer
from .graph import build_react_agent
from .model_factory import get_chat_model, get_default_model
from .prompt_builder import PromptBuilder
from .stream_protocol import sse_encode, sse_error, sse_done
from .tools import ALL_TOOLS

logger = logging.getLogger(__name__)

# Safety limit — prevents runaway tool loops
MAX_AGENT_STEPS = 25


async def stream_conversation(
    conversation_id: str,
    message: str | None,
    user_id: str,
    *,
    db_config: Optional[dict] = None,
    response_style: str = "balanced",
    max_rows: Optional[int] = None,
    api_key: Optional[str] = None,
    provider: str = "gemini",
    model: Optional[str] = None,
    enable_reasoning: bool = True,
    reasoning_effort: str = "medium",
    resume: Optional[dict] = None,
) -> AsyncGenerator[str, None]:
    """
    Stream a full agent turn as SSE-encoded JSON events.

    Yields ``data: {…}\\n\\n`` strings ready for a ``StreamingResponse``.
    Event types: ``token``, ``tool_start``, ``tool_end``,
    ``thinking_token``, ``error``, ``done``.
    """
    last_completed_tool: dict | None = None

    try:
        selected_model = model or get_default_model(provider)
        chat_model = get_chat_model(
            provider,
            selected_model,
            api_key,
            enable_reasoning=enable_reasoning,
            reasoning_effort=reasoning_effort,
        )
        logger.info(
            "Agent invocation: provider=%s, model=%s, conversation=%s",
            provider,
            selected_model,
            conversation_id,
        )

        system_prompt = PromptBuilder.build_system_prompt(response_style)
        checkpointer = get_checkpointer()
        agent = build_react_agent(
            chat_model,
            ALL_TOOLS,
            system_prompt=system_prompt,
            checkpointer=checkpointer,
        )

        config = {
            "configurable": {
                "thread_id": conversation_id,
                "user_id": user_id,
                "db_config": db_config,
                "max_rows": max_rows,
                "tool_cache": {},
            },
            "recursion_limit": MAX_AGENT_STEPS,
        }

        graph_input = None
        if resume is not None:
            graph_input = Command(resume=resume)
        elif not await _has_checkpoint(checkpointer, conversation_id):
            history = await _load_firestore_history(conversation_id)
            initial_messages = history + [HumanMessage(content=message)]
            if history:
                logger.info(
                    "Seeded %s messages from Firestore for conversation %s",
                    len(history),
                    conversation_id,
                )
            graph_input = {"messages": initial_messages}
        else:
            initial_messages = [HumanMessage(content=message)]
            graph_input = {"messages": initial_messages}

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
                                    {"type": "thinking_token", "content": thinking}
                                )
                        elif block_type == "text":
                            text = block.get("text", "")
                            if text:
                                yield sse_encode({"type": "token", "content": text})
                elif content:
                    yield sse_encode({"type": "token", "content": content})

            elif part["type"] == "custom":
                custom_event = part["data"]
                if isinstance(custom_event, dict) and custom_event.get("type") == "tool_end":
                    result = custom_event.get("result")
                    if isinstance(result, dict) and result.get("success", True):
                        last_completed_tool = custom_event
                yield sse_encode(custom_event)

            elif part["type"] == "updates":
                interrupt_event = _extract_interrupt_event(part.get("data"))
                if interrupt_event:
                    yield sse_encode(interrupt_event)

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


async def _has_checkpoint(checkpointer, thread_id: str) -> bool:
    try:
        result = await checkpointer.aget_tuple(
            {"configurable": {"thread_id": thread_id}}
        )
        return result is not None
    except Exception as e:
        logger.warning("Could not check checkpointer state for %s: %s", thread_id, e)
        return False


async def _load_firestore_history(conversation_id: str) -> list:
    try:
        from repositories import ConversationRepository

        conv_data = await run_in_threadpool(ConversationRepository.get, conversation_id)
        if not conv_data or not conv_data.get("messages"):
            return []

        lc_messages = []
        for msg in conv_data["messages"]:
            sender = msg.get("sender")
            content = msg.get("content", "")
            if not content:
                continue
            if sender == "user":
                lc_messages.append(HumanMessage(content=content))
            elif sender == "ai":
                lc_messages.append(AIMessage(content=content))

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
