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


# Safety limit — prevents runaway tool loops (applies to node transitions)
MAX_AGENT_STEPS = 50


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
) -> AsyncGenerator[str, None]:
    """
    Stream a full agent turn as SSE-encoded JSON events.

    Yields ``data: {…}\\n\\n`` strings ready for a ``StreamingResponse``.
    Event types: ``token``, ``tool_start``, ``tool_end``,
    ``thinking_token``, ``error``, ``done``.
    """
    last_completed_tool: dict | None = None
    think_parser = ThinkTagParser()

    try:
        selected_model = model or get_default_model(provider)

        # Compile the ReAct graph once per unique configuration,
        # then reuse it for every subsequent request with the same settings.
        # Compiling involves schema resolution, tool binding, and edge wiring
        # (50–200 ms) so doing it per-request wastes time and memory.
        cache_key = (provider, selected_model, enable_reasoning, reasoning_effort, response_style)

        if cache_key not in _agent_cache:
            chat_model = get_chat_model(
                provider,
                selected_model,
                api_key,
                enable_reasoning=enable_reasoning,
                reasoning_effort=reasoning_effort,
            )
            system_prompt = PromptBuilder.build_system_prompt(response_style)
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
        else:
            logger.info(
                "Cache hit — reusing compiled agent: provider=%s, model=%s, conversation=%s",
                provider,
                selected_model,
                conversation_id,
            )

        agent = _agent_cache[cache_key]

        # Namespace thread_id by user_id to prevent unauthenticated
        # checkpoint access. Without this, anyone guessing a conversation UUID
        # could access its Redis thread state via the stream endpoint.
        namespaced_thread_id = f"{user_id}:{conversation_id}"

        historical_context = None
        if message:
            try:
                from app.core.config import Config
                from app.features.vamp_memory.application.vamp_memory_service import VampMemoryService

                if Config.VAMP_MEMORY_ENABLED:
                    historical_context = await VampMemoryService().retrieve_context(
                        conversation_id,
                        user_id,
                        message,
                    )
            except Exception as exc:
                logger.warning(
                    "VAMP historical context retrieval failed for %s: %s",
                    conversation_id,
                    exc,
                )

        config = {
            "configurable": {
                "thread_id": namespaced_thread_id,
                "user_id": user_id,
                "db_config": db_config,
                "max_rows": max_rows,
                "tool_cache": {},
                "historical_context": historical_context,
            },
            "recursion_limit": MAX_AGENT_STEPS,
        }

        graph_input = None
        if resume is not None:
            if isinstance(resume, dict) and resume.get("interrupt_id"):
                # Strip interrupt_id from the payload before passing to Command(resume=...).
                # LangGraph forwards the value directly to the interrupt() call-site inside the tool,
                # so it must be the clean decision dict (e.g. {"approved": True}),
                # not the full SSE envelope that also contains interrupt_id.
                interrupt_id = resume["interrupt_id"]
                clean_payload = {k: v for k, v in resume.items() if k != "interrupt_id"}
                graph_input = Command(resume={interrupt_id: clean_payload})
            else:
                graph_input = Command(resume=resume)
        elif not await _has_checkpoint(get_checkpointer(), namespaced_thread_id):
            history = await _load_firestore_history(conversation_id)
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
                                    {"type": "thinking_token", "content": str(thinking)}
                                )
                        elif block_type == "reasoning_content":
                            # Check Bedrock specific LangChain mapping
                            reasoning_data = block.get("reasoning_content", {})
                            if isinstance(reasoning_data, dict):
                                # LangChain currently uses 'text', but AWS native uses 'reasoningText'
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
                interrupt_event = _extract_interrupt_event(part.get("data"))
                if interrupt_event:
                    yield sse_encode(interrupt_event)

        # Flush any remaining text in the think parser
        for token_type, content in think_parser.flush():
            yield sse_encode({"type": token_type, "content": content})

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
        from app.features.conversations.infrastructure.conversation_repository import ConversationRepository

        # Guard the synchronous Firestore call with a timeout.
        # run_in_threadpool occupies one of the MAX_WORKERS slots. Under high
        # concurrency, all slots can be held by active DB queries, causing this
        # await to deadlock the event loop indefinitely. A 5-second timeout
        # releases the event loop immediately on saturation — the thread
        # continues running to completion but its result is simply discarded.
        conv_data = await asyncio.wait_for(
            run_in_threadpool(ConversationRepository.get, conversation_id),
            timeout=5.0,
        )
        if not conv_data or not conv_data.get("messages"):
            return []

        last_summarized_idx = conv_data.get("last_summarized_idx", 0)
        recent_messages = conv_data["messages"][last_summarized_idx:]

        lc_messages = []
        for msg in recent_messages:
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
