# File: api/routes/conversation.py
"""Conversation/chat related API routes."""

import logging
from typing import Optional

from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.concurrency import run_in_threadpool

from app.core.config import Config
from app.core.dependencies import get_current_user, get_db_config
from app.features.conversations.application.conversation_service import ConversationService
from app.llm.providers.model_factory import (
    get_supported_providers,
    get_provider_models,
    get_default_model,
    get_provider_api_keys,
)
from app.core.request_schemas import (
    AgentResumeRequest,
    ChatRequest,
    RenameConversationRequest,
)
from app.features.agent_orchestration.schemas.streaming import STREAMING_RESPONSES

logger = logging.getLogger(__name__)
router = APIRouter(tags=["conversation"])

# Conversation endpoints intentionally keep legacy flat response dictionaries.
# The frontend conversation hooks consume top-level keys such as `conversation`
# and `conversations`, unlike newer ApiSuccess(data=...) routes.


def _build_provider_options() -> tuple[list[dict], str]:
    supported = get_supported_providers()
    options = []
    for provider_name in supported:
        models = get_provider_models(provider_name)
        options.append(
            {
                "name": provider_name,
                "label": provider_name.capitalize(),
                "models": models,
                "default_model": models[0] if models else None,
                "has_api_key": bool(get_provider_api_keys(provider_name)),
            }
        )

    selected_options = [opt for opt in options if opt["has_api_key"]]
    if not selected_options:
        return [], Config.LLM_PROVIDER

    default_provider = (
        Config.LLM_PROVIDER
        if any(opt["name"] == Config.LLM_PROVIDER for opt in selected_options)
        else selected_options[0]["name"]
    )
    return selected_options, default_provider


@router.post(
    "/pass_user_prompt_to_llm",
    response_class=StreamingResponse,
    responses=STREAMING_RESPONSES,
)
async def chat(
    request: Request,
    data: ChatRequest,
    user: dict = Depends(get_current_user),
    db_config: Optional[dict] = Depends(get_db_config),
):
    """Handle user input and stream AI response."""
    prompt = data.prompt
    enable_reasoning = data.enable_reasoning
    reasoning_effort = data.reasoning_effort
    response_style = data.response_style
    max_rows = data.max_rows
    provider = data.provider or Config.LLM_PROVIDER
    model = data.model

    conversation_id = ConversationService.create_or_get_conversation_id(
        data.conversation_id
    )
    user_id = user.get("uid") or user

    supported = set(get_supported_providers())
    if provider not in supported:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_provider",
                "message": f"Unsupported provider '{provider}'. Supported values: {sorted(supported)}",
            },
        )

    logger.info(
        "LLM selection requested: provider=%s, model=%s, conversation_id=%s",
        provider,
        model or "(default)",
        conversation_id,
    )

    # Ownership check for existing conversation IDs
    if data.conversation_id:
        try:
            _ = await run_in_threadpool(
                ConversationService.get_conversation_data, conversation_id, user_id
            )
        except PermissionError as e:
            raise HTTPException(status_code=403, detail=str(e))

    # 1. Check user quota (fast, Redis-based)
    user_quota = request.app.state.user_quota
    quota_allowed, usage = await user_quota.check_and_increment(user_id)

    if not quota_allowed:
        logger.warning(f"User {user_id} quota exceeded")
        raise HTTPException(
            status_code=429,
            detail={
                "error": "quota_exceeded",
                "message": "You have exceeded your rate limit. Please wait.",
                "usage": usage.to_dict(),
            },
        )

    # 2. Acquire a provider-specific LLM rate limiter slot and API key
    llm_rate_limiter = request.app.state.llm_rate_limiter
    success, api_key = await llm_rate_limiter.acquire(provider)

    if not success:
        logger.warning(
            "LLM rate limit timeout for user %s on provider %s",
            user_id,
            provider,
        )
        raise HTTPException(
            status_code=429,
            detail={
                "error": "server_busy",
                "message": "Server is busy. Please try again in a moment.",
            },
        )

    try:

        async def sse_generator():
            try:
                async for sse_line in ConversationService.create_streaming_generator(
                    conversation_id,
                    prompt,
                    user_id,
                    db_config=db_config,
                    enable_reasoning=enable_reasoning,
                    reasoning_effort=reasoning_effort,
                    response_style=response_style,
                    max_rows=max_rows,
                    api_key=api_key,
                    provider=provider,
                    model=model,
                    task_mode=getattr(data, "task_mode", "normal") or "normal",
                ):
                    yield sse_line
            finally:
                llm_rate_limiter.release(provider)

        headers = ConversationService.get_streaming_headers(conversation_id)

        return StreamingResponse(
            sse_generator(),
            media_type="text/event-stream",
            headers=headers,
        )
    except Exception as e:
        llm_rate_limiter.release(provider)
        logger.error(f"Error initializing chat: {e}")
        if ConversationService.check_quota_error(str(e)):
            raise HTTPException(status_code=429, detail="Rate limit exceeded")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/resume_agent",
    response_class=StreamingResponse,
    responses=STREAMING_RESPONSES,
)
async def resume_agent(
    request: Request,
    data: AgentResumeRequest,
    user: dict = Depends(get_current_user),
    db_config: Optional[dict] = Depends(get_db_config),
):
    """Resume a LangGraph conversation paused by a human-in-the-loop interrupt."""
    conversation_id = data.conversation_id
    user_id = user.get("uid") or user
    provider = data.provider or Config.LLM_PROVIDER
    model = data.model

    supported = set(get_supported_providers())
    if provider not in supported:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_provider",
                "message": f"Unsupported provider '{provider}'. Supported values: {sorted(supported)}",
            },
        )

    try:
        _ = await run_in_threadpool(
            ConversationService.get_conversation_data, conversation_id, user_id
        )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    user_quota = request.app.state.user_quota
    quota_allowed, usage = await user_quota.check_and_increment(user_id)
    if not quota_allowed:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "quota_exceeded",
                "message": "You have exceeded your rate limit. Please wait.",
                "usage": usage.to_dict(),
            },
        )

    llm_rate_limiter = request.app.state.llm_rate_limiter
    success, api_key = await llm_rate_limiter.acquire(provider)
    if not success:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "server_busy",
                "message": "Server is busy. Please try again in a moment.",
            },
        )

    try:

        async def sse_generator():
            try:
                async for sse_line in ConversationService.create_streaming_generator(
                    conversation_id,
                    None,
                    user_id,
                    db_config=db_config,
                    enable_reasoning=data.enable_reasoning,
                    reasoning_effort=data.reasoning_effort,
                    response_style=data.response_style,
                    max_rows=data.max_rows,
                    api_key=api_key,
                    provider=provider,
                    model=model,
                    resume=data.resume,
                    task_mode=getattr(data, "task_mode", "normal") or "normal",
                ):
                    yield sse_line
            finally:
                llm_rate_limiter.release(provider)

        headers = ConversationService.get_streaming_headers(conversation_id)

        return StreamingResponse(
            sse_generator(),
            media_type="text/event-stream",
            headers=headers,
        )
    except Exception as e:
        llm_rate_limiter.release(provider)
        logger.error(f"Error resuming agent: {e}")
        if ConversationService.check_quota_error(str(e)):
            raise HTTPException(status_code=429, detail="Rate limit exceeded")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/llm/options")
async def get_llm_options(user: dict = Depends(get_current_user)):
    """Return available provider/model options for the current deployment."""
    _ = user  # keep route authenticated and avoid unused arg linting

    provider_options, default_provider = _build_provider_options()
    default_option = next(
        (option for option in provider_options if option["name"] == default_provider),
        None,
    )
    default_model = (
        default_option["default_model"]
        if default_option and default_option.get("default_model")
        else get_default_model(default_provider)
    )

    return {
        "status": "success",
        "default_provider": default_provider,
        "default_model": default_model,
        "providers": provider_options,
    }


@router.get("/get_conversation/{conversation_id}")
async def get_conversation(
    conversation_id: str, user: dict = Depends(get_current_user)
):
    """Get messages for a conversation (user must own it)."""
    try:
        user_id = user.get("uid") or user
        conv_data = await run_in_threadpool(
            ConversationService.get_conversation_data, conversation_id, user_id
        )
        if conv_data:
            # Keep this flat response shape; frontend conversation loaders read `conversation` directly.
            return {"status": "success", "conversation": conv_data}
        raise HTTPException(status_code=404, detail="Conversation not found")
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error fetching conversation")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/get_conversations")
async def get_conversations(user: dict = Depends(get_current_user)):
    """Get all conversations for logged-in user."""
    user_id = user.get("uid") or user
    conversations = await run_in_threadpool(
        ConversationService.get_user_conversations, user_id
    )
    # Keep this flat response shape; frontend conversation loaders read `conversations` directly.
    return {"status": "success", "conversations": conversations}


@router.delete("/delete_conversation/{conversation_id}")
async def delete_conversation(
    conversation_id: str, user: dict = Depends(get_current_user)
):
    """Delete a conversation."""
    try:
        user_id = user.get("uid") or user
        await run_in_threadpool(
            ConversationService.delete_user_conversation, conversation_id, user_id
        )
        return {"status": "success"}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/rename_conversation/{conversation_id}")
async def rename_conversation(
    conversation_id: str,
    data: RenameConversationRequest,
    user: dict = Depends(get_current_user),
):
    """Rename a conversation."""
    try:
        user_id = user.get("uid") or user
        title = await run_in_threadpool(
            ConversationService.rename_user_conversation,
            conversation_id,
            user_id,
            data.title,
        )
        return {"status": "success", "title": title}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error renaming conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))
