"""Token-budget preparation for streamed agent requests."""

from __future__ import annotations

import asyncio
import logging

from fastapi.concurrency import run_in_threadpool

from langgraph_orchestration.conversation_access import (
    get_default_conversation_summarizer,
)
from langgraph_orchestration.react_graph import (
    format_ongoing_task_checkpoint,
    format_retrieved_long_term_memory,
)
from llm_provider.token_budget import (
    calculate_dynamic_token_budget,
    count_converse_tokens_cached,
    count_converse_tokens_with_fallback,
    output_reserve_for_task_mode,
)

logger = logging.getLogger(__name__)


async def prepare_stream_budget(
    *,
    selected_model: str,
    response_style: str,
    system_prompt: str,
    request_tools: list,
    historical_context: str | None,
    task_checkpoint_summary: str,
    task_mode: str,
    conversation: dict | None,
    message: str | None,
) -> dict:
    """Count independent payload sections concurrently and compute one budget."""
    count_tasks = [
        _count_tokens(
            selected_model,
            cache_key=("system", response_style, system_prompt),
            system=system_prompt,
            messages=[{"role": "user", "content": [{"text": ""}]}],
        ),
        _count_tokens(
            selected_model,
            cache_key=(
                "tools",
                tuple(getattr(tool, "name", str(tool)) for tool in request_tools),
            ),
            messages=[{"role": "user", "content": [{"text": ""}]}],
            tools=request_tools,
        ),
    ]
    if historical_context:
        count_tasks.append(
            _count_tokens(
                selected_model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "text": format_retrieved_long_term_memory(
                                    historical_context
                                )
                            }
                        ],
                    }
                ],
            )
        )
    if task_checkpoint_summary:
        count_tasks.append(
            _count_tokens(
                selected_model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "text": format_ongoing_task_checkpoint(
                                    task_checkpoint_summary
                                )
                            }
                        ],
                    }
                ],
            )
        )

    results = await asyncio.gather(*count_tasks)
    system_count, tool_count = results[:2]
    index = 2
    memory_count: dict | int = {"tokens": 0, "mode": "exact"}
    if historical_context:
        memory_count = results[index]
        index += 1
    checkpoint_count: dict | int = {"tokens": 0, "mode": "exact"}
    if task_checkpoint_summary:
        checkpoint_count = results[index]

    counting_mode, counting_reason = _merge_count_results(
        system_count, tool_count, memory_count, checkpoint_count
    )
    if counting_mode == "exact":
        counting_mode = "hybrid"
        counting_reason = "history_local_estimate"
    elif counting_reason:
        counting_reason = f"{counting_reason};history_local_estimate"
    if counting_mode != "exact":
        logger.warning(
            "Using conservative token estimates: model=%s reason=%s",
            selected_model,
            counting_reason,
        )

    system_tokens = _token_value(system_count)
    tool_tokens = _token_value(tool_count)
    memory_tokens = _token_value(memory_count)
    checkpoint_tokens = _token_value(checkpoint_count)
    budget = calculate_dynamic_token_budget(
        selected_model,
        system_prompt_tokens=system_tokens,
        tool_schema_tokens=tool_tokens,
        output_reserve_tokens=output_reserve_for_task_mode(task_mode),
        token_counting_mode=counting_mode,
    )
    hot_history_budget = max(
        0,
        budget["hot_history_budget"] - memory_tokens - checkpoint_tokens,
    )
    budget.update(
        {
            "active_context_budget": hot_history_budget,
            "system_prompt_tokens": system_tokens,
            "tool_schema_tokens": tool_tokens,
            "vamp_memory_tokens": memory_tokens,
            "task_checkpoint_tokens": checkpoint_tokens,
            "hot_history_budget": hot_history_budget,
            "token_counting_mode": counting_mode,
            "token_counting_reason": counting_reason,
        }
    )
    try:
        pressure = get_default_conversation_summarizer().get_background_summary_pressure(
            conversation,
            new_messages=[{"role": "user", "text": message}] if message else [],
            pressure_budget_tokens=hot_history_budget,
        )
        budget["tail_tokens"] = pressure["tail_tokens"]
    except Exception as exc:
        logger.warning("Failed to calculate tail_tokens for usage metrics: %s", exc)
        budget["tail_tokens"] = 0
    return budget


async def _count_tokens(
    model_id: str,
    *,
    cache_key: tuple | None = None,
    **kwargs,
) -> dict:
    counter = count_converse_tokens_with_fallback
    if cache_key is not None:
        counter = lambda current_model, **current_kwargs: count_converse_tokens_cached(
            current_model,
            cache_key=cache_key,
            **current_kwargs,
        )
    if str(model_id).startswith("mock"):
        return counter(model_id, **kwargs)
    return await run_in_threadpool(counter, model_id, **kwargs)


def _merge_count_results(*results: dict | int | None) -> tuple[str, str | None]:
    for result in results:
        if isinstance(result, dict) and result.get("mode") == "estimated":
            return "estimated", result.get("reason") or "provider_unsupported"
    return "exact", None


def _token_value(result: dict | int | None) -> int:
    if isinstance(result, dict):
        return int(result.get("tokens") or 0)
    return int(result or 0)
