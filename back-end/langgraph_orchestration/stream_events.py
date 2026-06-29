"""Pure translation helpers for LangGraph stream parts and SSE events."""

from __future__ import annotations

from langchain_core.messages import AIMessage, AIMessageChunk


class ThinkTagParser:
    """Parse streamed ``<think>`` blocks without leaking split delimiters."""

    def __init__(self) -> None:
        self.in_think_block = False
        self.buffer = ""

    def process_chunk(self, chunk: str) -> list[tuple[str, str]]:
        if not chunk:
            return []
        self.buffer += chunk
        results: list[tuple[str, str]] = []
        while self.buffer:
            delimiter = "</think>" if self.in_think_block else "<think>"
            token_type = "thinking_token" if self.in_think_block else "token"
            delimiter_index = self.buffer.find(delimiter)
            if delimiter_index >= 0:
                if delimiter_index:
                    results.append((token_type, self.buffer[:delimiter_index]))
                self.buffer = self.buffer[delimiter_index + len(delimiter) :]
                self.in_think_block = not self.in_think_block
                continue

            partial_length = _delimiter_suffix_length(self.buffer, delimiter)
            safe_length = len(self.buffer) - partial_length
            if safe_length:
                results.append((token_type, self.buffer[:safe_length]))
                self.buffer = self.buffer[safe_length:]
            break
        return results

    def flush(self) -> list[tuple[str, str]]:
        if not self.buffer:
            return []
        token_type = "thinking_token" if self.in_think_block else "token"
        result = [(token_type, self.buffer)]
        self.buffer = ""
        return result


def _delimiter_suffix_length(value: str, delimiter: str) -> int:
    for length in range(min(len(delimiter) - 1, len(value)), 0, -1):
        if value.endswith(delimiter[:length]):
            return length
    return 0


def build_usage_metrics(budget_info: dict, **kwargs) -> dict:
    event = {
        "type": "usage_metrics",
        "activeContextBudget": budget_info.get("active_context_budget"),
        "totalContextWindow": budget_info.get("model_context_window"),
        "availableInputPayloadTokens": budget_info.get(
            "available_input_payload_tokens"
        ),
        "pressureTriggerTokens": budget_info.get("pressure_trigger_tokens"),
        "modelContextWindow": budget_info.get("model_context_window"),
        "reservedOutputTokens": budget_info.get("reserved_output_tokens"),
        "safetyMarginTokens": budget_info.get("reserved_safety_margin_tokens"),
        "systemPromptTokens": budget_info.get("system_prompt_tokens"),
        "toolSchemaTokens": budget_info.get("tool_schema_tokens"),
        "vampMemoryTokens": budget_info.get("vamp_memory_tokens"),
        "taskCheckpointTokens": budget_info.get("task_checkpoint_tokens"),
        "hotHistoryBudget": budget_info.get("hot_history_budget"),
        "tokenCountingMode": budget_info.get("token_counting_mode"),
        "tokenCountingReason": budget_info.get("token_counting_reason"),
        "inputPayloadTokens": budget_info.get("tail_tokens"),
    }
    event.update(kwargs)
    return event


def translate_stream_part(
    part: dict,
    think_parser: ThinkTagParser,
    budget_info: dict,
) -> tuple[list[dict], dict | None]:
    """Translate one LangGraph v2 part into public events.

    ``budget_info`` is updated in place because output-token counters span model
    calls inside one tool loop.
    """
    part_type = part.get("type")
    if part_type == "messages":
        data = part.get("data")
        if not isinstance(data, (tuple, list)) or not data:
            return [], None
        message = data[0]
        if not isinstance(message, (AIMessageChunk, AIMessage)):
            return [], None
        return _translate_message(message, think_parser, budget_info), None

    if part_type == "custom":
        event = part.get("data")
        if not isinstance(event, dict):
            return [], None
        completed_tool = None
        if event.get("type") == "tool_end":
            result = event.get("result")
            if (
                event.get("name") == "execute_query"
                and isinstance(result, dict)
                and result.get("success", True)
            ):
                completed_tool = event
        return [event], completed_tool

    if part_type == "updates":
        interrupt = extract_interrupt_event(part.get("data"))
        return ([interrupt] if interrupt else []), None

    return [], None


def _translate_message(
    message: AIMessage | AIMessageChunk,
    think_parser: ThinkTagParser,
    budget_info: dict,
) -> list[dict]:
    events: list[dict] = []
    response_metadata = getattr(message, "response_metadata", {}) or {}
    usage_metadata = getattr(message, "usage_metadata", {}) or {}
    metrics = response_metadata.get("metrics", {})
    usage = response_metadata.get("usage", {})
    stop_reason = response_metadata.get("stopReason")
    if stop_reason == "model_context_window_exceeded":
        raise RuntimeError("model_context_window_exceeded")

    input_tokens = usage_metadata.get("input_tokens") or usage.get("inputTokens")
    output_tokens = usage_metadata.get("output_tokens") or usage.get("outputTokens")
    total_tokens = usage_metadata.get("total_tokens") or usage.get("totalTokens")
    latency_ms = metrics.get("latencyMs")

    if input_tokens is not None:
        current_output = output_tokens or 0
        last_output = budget_info.get("_last_output_tokens", 0)
        if current_output < last_output:
            budget_info["_cumulative_output_tokens"] = (
                budget_info.get("_cumulative_output_tokens", 0) + last_output
            )
        budget_info["_last_output_tokens"] = current_output
        total_generated = (
            budget_info.get("_cumulative_output_tokens", 0) + current_output
        )
        budget_info["tail_tokens"] = max(
            0, budget_info.get("_baseline_tail", 0) + total_generated
        )

    if total_tokens is not None or latency_ms is not None:
        events.append(
            build_usage_metrics(
                budget_info,
                inputTokens=input_tokens,
                outputTokens=output_tokens,
                totalTokens=total_tokens,
                latencyMs=latency_ms,
                stopReason=stop_reason,
            )
        )

    content = message.content
    if isinstance(content, str):
        events.extend(_text_events(content, think_parser))
        return events
    if not isinstance(content, list):
        return events

    for block in content:
        if not isinstance(block, dict):
            if block:
                events.append({"type": "token", "content": str(block)})
            continue
        block_type = block.get("type")
        if block_type == "thinking":
            thinking = block.get("thinking", "")
            if thinking:
                events.append(
                    {"type": "thinking_token", "content": str(thinking)}
                )
        elif block_type == "reasoning_content":
            reasoning = block.get("reasoning_content", {})
            if isinstance(reasoning, dict):
                thinking = reasoning.get("text") or reasoning.get("reasoningText")
                if thinking:
                    events.append(
                        {"type": "thinking_token", "content": str(thinking)}
                    )
        elif block_type == "text":
            events.extend(_text_events(str(block.get("text", "")), think_parser))
    return events


def _text_events(text: str, parser: ThinkTagParser) -> list[dict]:
    return [
        {"type": token_type, "content": content}
        for token_type, content in parser.process_chunk(text)
    ]


def extract_interrupt_event(data) -> dict | None:
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
    return {"type": "agent_interrupt", "id": interrupt_id, "payload": payload}


def friendly_error(raw: str) -> str:
    lower = raw.lower()
    if "model_context_window_exceeded" in lower or "context window" in lower:
        return (
            "Model context window exceeded. The task checkpoint was preserved; "
            "continue the task to resume from compacted context."
        )
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
