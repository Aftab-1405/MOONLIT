import json
import fnmatch
from pathlib import Path
from typing import Callable, Sequence, TypedDict

import tiktoken

from config import get_config

Config = get_config()

_TOOL_SPEC_CACHE: dict[tuple, dict] = {}
_TOKEN_COUNT_RESULT_CACHE: dict[tuple, dict] = {}
_RUNTIME_COUNT_TOKENS_UNSUPPORTED: set[str] = set()


class TokenCountingError(RuntimeError):
    """Raised when exact provider token counting is required but unavailable."""


class TokenCountResult(TypedDict):
    tokens: int
    mode: str
    reason: str | None


def _is_mock_model(model_id: str | None) -> bool:
    return bool(model_id and str(model_id).startswith("mock"))


def _load_model_context_config() -> dict:
    config_path = Path(Config.MODEL_CONTEXT_WINDOWS_PATH)
    if not config_path.is_absolute():
        config_path = Path(__file__).parent.parent / config_path

    if config_path.exists():
        try:
            with open(config_path, "r") as f:
                loaded = json.load(f)
        except json.JSONDecodeError:
            return {}
        if isinstance(loaded, dict) and "models" in loaded:
            loaded = loaded["models"]
        return loaded if isinstance(loaded, dict) else {}
    return {}


def _context_window_from_entry(entry) -> int | None:
    if isinstance(entry, dict):
        entry = entry.get("context_window") or entry.get("contextWindow")
    try:
        return int(entry)
    except (TypeError, ValueError):
        return None


def _supports_count_tokens_from_entry(entry) -> bool | None:
    if not isinstance(entry, dict):
        return None
    value = entry.get("supports_count_tokens")
    if value is None:
        value = entry.get("supportsCountTokens")
    if value is None:
        return None
    return bool(value)


def _resolve_model_config_entry(model_id: str) -> tuple[object | None, str]:
    config_windows = _load_model_context_config()

    if model_id in config_windows:
        return config_windows[model_id], "config_file"

    for pattern, v in config_windows.items():
        if fnmatch.fnmatch(model_id, pattern):
            return v, "wildcard"

    for k, v in config_windows.items():
        if k in model_id or model_id in k:
            return v, "wildcard"

    return None, "fallback"


def get_model_context_window_with_source(model_id: str) -> tuple[int, str]:
    """Resolve context window and its resolution source."""
    entry, source = _resolve_model_config_entry(model_id)
    resolved = _context_window_from_entry(entry)
    if resolved is not None:
        return resolved, source

    return Config.UNKNOWN_MODEL_CONTEXT_WINDOW_TOKENS, "fallback"


def model_supports_count_tokens(model_id: str) -> bool:
    """Return whether provider-side exact CountTokens should be attempted."""
    if _is_mock_model(model_id):
        return True
    if model_id in _RUNTIME_COUNT_TOKENS_UNSUPPORTED:
        return False
    entry, _source = _resolve_model_config_entry(model_id)
    configured = _supports_count_tokens_from_entry(entry)
    return True if configured is None else configured

def get_model_context_window(model_id: str) -> int:
    """Resolve context window using selected model_id."""
    val, _ = get_model_context_window_with_source(model_id)
    return val

def calculate_token_budget(model_id: str) -> dict:
    """Calculate token budget based on context window.

    Compatibility wrapper for older call sites. The active budget is now the
    pressure trigger, not a fixed 80% haircut of usable input.
    """
    return calculate_dynamic_token_budget(model_id)


def output_reserve_for_task_mode(task_mode: str = "normal") -> int:
    """Return output-token reserve for the current agent task profile."""
    if task_mode in ("long_task", "approved_autonomous"):
        return 12000
    if task_mode == "tool_task":
        return 8192
    return Config.RESERVED_OUTPUT_TOKENS


def calculate_safety_margin(model_context_window: int) -> int:
    """Use a small proportional margin without wasting huge context windows."""
    return min(max(2048, int(model_context_window * 0.02)), 8192)


def calculate_dynamic_token_budget(
    model_id: str,
    *,
    system_prompt_tokens: int = 0,
    tool_schema_tokens: int = 0,
    output_reserve_tokens: int | None = None,
    safety_margin_tokens: int | None = None,
    pressure_ratio: float = 0.90,
    token_counting_mode: str = "exact",
) -> dict:
    """Calculate measured input budget and pressure trigger.

    Required static prompt/tool sections are measured outside this function and
    passed in. VAMP and history then share the remaining payload budget.
    """
    model_context_window, resolution_source = get_model_context_window_with_source(model_id)

    reserved_system_tokens = max(0, int(system_prompt_tokens or 0))
    reserved_tool_schema_tokens = max(0, int(tool_schema_tokens or 0))
    reserved_output_tokens = (
        int(output_reserve_tokens)
        if output_reserve_tokens is not None
        else Config.RESERVED_OUTPUT_TOKENS
    )
    reserved_safety_margin_tokens = (
        int(safety_margin_tokens)
        if safety_margin_tokens is not None
        else calculate_safety_margin(model_context_window)
    )
    if token_counting_mode == "estimated" and safety_margin_tokens is None:
        estimated_margin = min(max(4096, int(model_context_window * 0.05)), 16384)
        reserved_safety_margin_tokens = max(
            reserved_safety_margin_tokens,
            estimated_margin,
        )

    usable_input_budget = max(
        Config.MIN_USABLE_INPUT_BUDGET_TOKENS,
        model_context_window
        - reserved_system_tokens
        - reserved_tool_schema_tokens
        - reserved_output_tokens
        - reserved_safety_margin_tokens,
    )
    pressure_trigger_tokens = int(usable_input_budget * pressure_ratio)
    vamp_memory_budget = int(usable_input_budget * 0.30)
    hot_history_budget = max(
        0,
        pressure_trigger_tokens - vamp_memory_budget,
    )

    return {
        "model_context_window": model_context_window,
        "resolution_source": resolution_source,
        "reserved_system_tokens": reserved_system_tokens,
        "reserved_vamp_memory_tokens": vamp_memory_budget,
        "reserved_tool_schema_tokens": reserved_tool_schema_tokens,
        "reserved_output_tokens": reserved_output_tokens,
        "reserved_safety_margin_tokens": reserved_safety_margin_tokens,
        "usable_input_budget": usable_input_budget,
        "available_input_payload_tokens": usable_input_budget,
        "pressure_trigger_tokens": hot_history_budget,
        "active_context_budget": hot_history_budget,
        "hot_history_budget": hot_history_budget,
        "pressure_ratio": pressure_ratio,
        "token_counting_mode": token_counting_mode,
    }
_TIKTOKEN_ENCODER = None

def _get_encoder():
    global _TIKTOKEN_ENCODER
    if _TIKTOKEN_ENCODER is None:
        _TIKTOKEN_ENCODER = tiktoken.get_encoding("cl100k_base")
    return _TIKTOKEN_ENCODER

def estimate_tokens(text: str) -> int:
    """Accurate local estimation of tokens using tiktoken (cl100k_base)."""
    if not text:
        return 0
    return len(_get_encoder().encode(str(text), disallowed_special=()))


def estimate_converse_tokens_conservative(
    *,
    system: str | Sequence[dict] | None = None,
    messages: Sequence[dict] | None = None,
    tools: Sequence | None = None,
) -> int:
    """Estimate a Converse request using the tiktoken fallback."""
    payload = _build_bedrock_converse_payload(
        system=system,
        messages=messages,
        tools=tools,
    )
    serialized = json.dumps(payload, default=str, separators=(",", ":"))
    # Serializing to JSON natively captures the structural overhead 
    # (brackets, keys) so we can just run the string through tiktoken.
    return estimate_tokens(serialized)


def _tool_to_bedrock_spec(tool_obj) -> dict:
    """Convert a LangChain BaseTool-like object into a Bedrock toolSpec."""
    tool_name = getattr(tool_obj, "name", "unknown_tool")
    tool_description = getattr(tool_obj, "description", "") or ""
    args_schema = getattr(tool_obj, "args_schema", None)
    args_obj = getattr(tool_obj, "args", None)
    cache_key = (tool_name, tool_description, id(args_schema), id(args_obj))
    if cache_key in _TOOL_SPEC_CACHE:
        return _TOOL_SPEC_CACHE[cache_key]

    if len(_TOOL_SPEC_CACHE) > 1000:
        _TOOL_SPEC_CACHE.clear()

    input_schema = {"type": "object", "properties": {}}
    if args_schema is not None:
        try:
            input_schema = args_schema.model_json_schema()
        except Exception:
            try:
                input_schema = args_schema.schema()
            except Exception:
                input_schema = {"type": "object", "properties": {}}
    elif args_obj:
        input_schema = {
            "type": "object",
            "properties": args_obj,
        }

    spec = {
        "toolSpec": {
            "name": tool_name,
            "description": tool_description,
            "inputSchema": {"json": input_schema},
        }
    }
    _TOOL_SPEC_CACHE[cache_key] = spec
    return spec


def _build_bedrock_converse_payload(
    *,
    system: str | Sequence[dict] | None = None,
    messages: Sequence[dict] | None = None,
    tools: Sequence | None = None,
) -> dict:
    converse_payload: dict = {"messages": list(messages or [])}
    if system:
        if isinstance(system, str):
            converse_payload["system"] = [{"text": system}]
        else:
            converse_payload["system"] = list(system)
    if tools:
        converse_payload["toolConfig"] = {
            "tools": [_tool_to_bedrock_spec(tool_obj) for tool_obj in tools]
        }
    return converse_payload


def count_bedrock_converse_tokens(
    model_id: str,
    *,
    system: str | Sequence[dict] | None = None,
    messages: Sequence[dict] | None = None,
    tools: Sequence | None = None,
) -> int:
    """Count exact tokens using Amazon Bedrock CountTokens for Converse input."""
    if _is_mock_model(model_id):
        payload = _build_bedrock_converse_payload(
            system=system,
            messages=messages,
            tools=tools,
        )
        return estimate_tokens(json.dumps(payload, default=str))

    from llm_provider.bedrock_client import _resolve_model_id, get_bedrock_client
    resolved_model = _resolve_model_id(model_id)

    converse_payload = _build_bedrock_converse_payload(
        system=system,
        messages=messages,
        tools=tools,
    )

    try:
        response = get_bedrock_client().count_tokens(
            modelId=resolved_model,
            input={"converse": converse_payload},
        )
        return int(response["inputTokens"])
    except Exception as exc:
        raise TokenCountingError(
            f"Bedrock CountTokens failed for model {resolved_model}: {exc}"
        ) from exc


def _is_unsupported_count_tokens_error(exc: Exception) -> bool:
    text = str(exc).lower()
    return (
        "doesn't support counting tokens" in text
        or "does not support counting tokens" in text
        or "unsupported" in text and "count" in text and "token" in text
    )


def count_converse_tokens_with_fallback(
    model_id: str,
    *,
    system: str | Sequence[dict] | None = None,
    messages: Sequence[dict] | None = None,
    tools: Sequence | None = None,
) -> TokenCountResult:
    """Count tokens exactly when possible, otherwise use conservative estimates.

    Unsupported provider-side CountTokens must not block chat for otherwise
    usable models. The mode/reason fields let callers and UI disclose precision.
    """
    if not model_supports_count_tokens(model_id):
        return {
            "tokens": estimate_converse_tokens_conservative(
                system=system,
                messages=messages,
                tools=tools,
            ),
            "mode": "estimated",
            "reason": "provider_unsupported_config",
        }

    try:
        return {
            "tokens": count_bedrock_converse_tokens(
                model_id,
                system=system,
                messages=messages,
                tools=tools,
            ),
            "mode": "exact",
            "reason": None,
        }
    except TokenCountingError as exc:
        if _is_unsupported_count_tokens_error(exc):
            _RUNTIME_COUNT_TOKENS_UNSUPPORTED.add(model_id)
            reason = "provider_unsupported"
        else:
            import logging

            logging.getLogger(__name__).warning(
                "Token counting failed, falling back to estimation: %s", exc
            )
            reason = "provider_error"

        return {
            "tokens": estimate_converse_tokens_conservative(
                system=system,
                messages=messages,
                tools=tools,
            ),
            "mode": "estimated",
            "reason": reason,
        }


def count_converse_tokens_cached(
    model_id: str,
    *,
    cache_key: tuple,
    system: str | Sequence[dict] | None = None,
    messages: Sequence[dict] | None = None,
    tools: Sequence | None = None,
) -> TokenCountResult:
    """Cached variant for static prompt/tool sections."""
    full_key = (model_id, cache_key)
    cached = _TOKEN_COUNT_RESULT_CACHE.get(full_key)
    if cached is not None:
        return dict(cached)
    result = count_converse_tokens_with_fallback(
        model_id,
        system=system,
        messages=messages,
        tools=tools,
    )
    if len(_TOKEN_COUNT_RESULT_CACHE) > 1000:
        _TOKEN_COUNT_RESULT_CACHE.clear()
    _TOKEN_COUNT_RESULT_CACHE[full_key] = dict(result)
    return result


def count_text_tokens_exact(model_id: str, text: str) -> int:
    """Count a single text block exactly with the active provider."""
    return count_bedrock_converse_tokens(
        model_id,
        messages=[{"role": "user", "content": [{"text": text or ""}]}],
    )


def count_text_tokens_with_fallback(model_id: str, text: str) -> TokenCountResult:
    """Count a single text block, falling back for unsupported provider counters."""
    return count_converse_tokens_with_fallback(
        model_id,
        messages=[{"role": "user", "content": [{"text": text or ""}]}],
    )


def get_default_token_counter() -> Callable[[str], int]:
    """Return text token counter used by summarization and history budgeting."""
    from llm_provider.model_factory import get_default_model

    model_id = get_default_model(Config.LLM_PROVIDER)
    return lambda text: count_text_tokens_with_fallback(model_id, text)["tokens"]


def truncate_messages_to_budget(messages: list, active_context_budget: int) -> tuple[list, list]:
    """Truncates messages to fit the budget, preserving turn boundaries.
    Returns (dropped_messages, kept_messages).
    """
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

    original_start_idx = start_idx
    while start_idx > 0:
        if getattr(messages[start_idx], "type", "") == "human":
            break
        start_idx -= 1

    if start_idx == 0 and len(messages) > 0 and getattr(messages[0], "type", "") != "human":
        start_idx = original_start_idx
        while start_idx < len(messages):
            msg = messages[start_idx]
            if getattr(msg, "type", "") == "human":
                break
            if getattr(msg, "type", "") == "ai" and not getattr(msg, "tool_calls", None):
                break
            start_idx += 1

    dropped_messages = messages[:start_idx]
    kept_messages = messages[start_idx:]
    return dropped_messages, kept_messages


def get_message_tokens(msg: dict, *, model_id: str | None = None) -> int:
    """Get message token size, prioritizing Bedrock usage if available."""
    usage = msg.get("usage")
    if isinstance(usage, dict):
        out = usage.get("outputTokens") or usage.get("output_tokens") or 0
        if out > 0:
            return out
    content = msg.get("content", "")
    tokens = estimate_tokens(content)
    timeline = msg.get("timeline", [])
    if timeline:
        tokens += estimate_tokens(json.dumps(timeline))
    return tokens

# Static Pre-computation
STATIC_SYSTEM_TOKENS = 0
STATIC_TOOL_TOKENS = 0

def eagerly_initialize_static_budgets():
    """
    Pre-computes and caches the Bedrock tool specs and exact token counts 
    for the static system prompt and ALL_TOOLS to prevent runtime latency.
    """
    global STATIC_SYSTEM_TOKENS, STATIC_TOOL_TOKENS
    import logging
    logger = logging.getLogger(__name__)

    try:
        from langgraph_orchestration.prompt_builder import PromptBuilder
        from langgraph_orchestration.tools import ALL_TOOLS
        from config import get_config
        
        provider = get_config().LLM_PROVIDER
        from llm_provider.model_factory import get_default_model
        model_id = get_default_model(provider)

        # 1. Pre-compute and cache Bedrock tool specs
        for tool in ALL_TOOLS:
            _tool_to_bedrock_spec(tool)

        # 2. Pre-compute system prompt tokens
        system_prompt = PromptBuilder.build_system_prompt("balanced")
        sys_res = count_converse_tokens_cached(
            model_id,
            cache_key=("system", "balanced", system_prompt),
            system=system_prompt,
            messages=[{"role": "user", "content": [{"text": ""}]}],
        )
        STATIC_SYSTEM_TOKENS = int(sys_res.get("tokens", 0))

        # 3. Pre-compute tool schema tokens
        tool_res = count_converse_tokens_cached(
            model_id,
            cache_key=(
                "tools",
                tuple(getattr(tool, "name", str(tool)) for tool in ALL_TOOLS),
            ),
            messages=[{"role": "user", "content": [{"text": ""}]}],
            tools=ALL_TOOLS,
        )
        STATIC_TOOL_TOKENS = int(tool_res.get("tokens", 0))
        
        logger.info(f"Pre-computed static budgets: system={STATIC_SYSTEM_TOKENS}, tools={STATIC_TOOL_TOKENS}")
    except Exception as e:
        logger.warning(f"Failed to eagerly initialize static token budgets: {e}")

