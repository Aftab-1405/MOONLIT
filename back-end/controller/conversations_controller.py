# File: api/routes/conversation.py
"""Conversation/chat related API routes."""

import asyncio
import contextlib
import logging
from typing import Optional

from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.concurrency import run_in_threadpool
from google.api_core.exceptions import (
    DeadlineExceeded,
    ResourceExhausted,
    ServiceUnavailable,
    TooManyRequests,
)

from config import get_config
Config = get_config()
from dependencies import get_current_user, get_db_config
from service.conversations.conversation_service import ConversationService
from service.llm import LLMOptionsService
from api_contract.conversations import (
    AgentResumeRequest,
    ChatRequest,
    RenameConversationRequest,
)
from api_contract.streaming import STREAMING_RESPONSES

logger = logging.getLogger(__name__)
router = APIRouter(tags=["conversation"])

_TRANSIENT_FIRESTORE_ERRORS = (
    DeadlineExceeded,
    ResourceExhausted,
    ServiceUnavailable,
    TooManyRequests,
)


def _firestore_unavailable_response(exc: Exception) -> HTTPException:
    logger.warning("Firestore temporarily unavailable: %s", exc)
    return HTTPException(
        status_code=503,
        detail={
            "error": "firestore_unavailable",
            "message": "Conversation storage is temporarily unavailable. Please retry.",
        },
        headers={"Retry-After": "2"},
    )

# Conversation endpoints intentionally keep legacy flat response dictionaries.
# The frontend conversation hooks consume top-level keys such as `conversation`
# and `conversations`, unlike newer ApiSuccess(data=...) routes.


def _build_provider_options() -> tuple[list[dict], str]:
    return LLMOptionsService.build_provider_options()


async def _stream_with_heartbeats(source, *, interval_seconds: float = 15.0):
    """Forward an SSE source while keeping idle proxies from closing it.

    Model calls, database queries, embeddings, and checkpoint compaction can be
    silent for longer than common proxy idle limits. A producer task allows us
    to send SSE comments without cancelling the underlying async generator.
    """
    queue: asyncio.Queue = asyncio.Queue()
    finished = object()

    async def produce():
        try:
            async for item in source:
                await queue.put(("item", item))
        except BaseException as exc:
            await queue.put(("error", exc))
        finally:
            await queue.put(("finished", finished))

    producer = asyncio.create_task(produce())
    try:
        while True:
            try:
                kind, value = await asyncio.wait_for(
                    queue.get(), timeout=interval_seconds
                )
            except asyncio.TimeoutError:
                yield ": heartbeat\n\n"
                continue

            if kind == "item":
                yield value
            elif kind == "error":
                raise value
            else:
                break
    finally:
        if not producer.done():
            producer.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await producer


async def _handle_agent_stream(
    request: Request,
    user_id: str,
    conversation_id: str,
    provider: str,
    model: Optional[str],
    stream_generator_kwargs: dict,
):
    supported = LLMOptionsService.supported_providers()
    if provider not in supported:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_provider",
                "message": f"Unsupported provider '{provider}'. Supported values: {sorted(supported)}",
            },
        )

    if conversation_id:
        try:
            _ = await run_in_threadpool(
                ConversationService.get_conversation_data, conversation_id, user_id
            )
        except PermissionError as e:
            raise HTTPException(status_code=403, detail=str(e))

    user_quota = request.app.state.user_quota
    quota_allowed, usage = await user_quota.check_and_increment(user_id)

    if not quota_allowed:
        logger.warning("User %s quota exceeded", user_id)
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

    rate_limiter_released = False
    try:
        async def sse_generator():
            nonlocal rate_limiter_released
            try:
                source = ConversationService.create_streaming_generator(
                    conversation_id=conversation_id,
                    user_id=user_id,
                    api_key=api_key,
                    provider=provider,
                    model=model,
                    **stream_generator_kwargs
                )
                async for sse_line in _stream_with_heartbeats(source):
                    yield sse_line
            finally:
                if not rate_limiter_released:
                    llm_rate_limiter.release(provider)
                    rate_limiter_released = True

        headers = ConversationService.get_streaming_headers(conversation_id)
        return StreamingResponse(
            sse_generator(),
            media_type="text/event-stream",
            headers=headers,
        )
    except Exception as e:
        if not rate_limiter_released:
            llm_rate_limiter.release(provider)
            rate_limiter_released = True
        logger.error("Error streaming agent: %s", e)
        if ConversationService.check_quota_error(str(e)):
            raise HTTPException(status_code=429, detail="Rate limit exceeded")
        raise HTTPException(status_code=500, detail="An internal server error occurred.")


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
    provider = data.provider or Config.LLM_PROVIDER
    conversation_id = ConversationService.create_or_get_conversation_id(
        data.conversation_id
    )
    user_id = user.get("uid") if isinstance(user, dict) else user

    logger.info(
        "LLM selection requested: provider=%s, model=%s, conversation_id=%s",
        provider,
        data.model or "(default)",
        conversation_id,
    )

    kwargs = {
        "prompt": data.prompt,
        "db_config": db_config,
        "enable_reasoning": data.enable_reasoning,
        "reasoning_effort": data.reasoning_effort,
        "response_style": data.response_style,
        "max_rows": data.max_rows,
        "task_mode": getattr(data, "task_mode", "normal") or "normal",
    }
    
    return await _handle_agent_stream(
        request=request,
        user_id=user_id,
        conversation_id=conversation_id,
        provider=provider,
        model=data.model,
        stream_generator_kwargs=kwargs
    )


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
    user_id = user.get("uid") if isinstance(user, dict) else user
    provider = data.provider or Config.LLM_PROVIDER
    
    kwargs = {
        "prompt": None,
        "db_config": db_config,
        "enable_reasoning": data.enable_reasoning,
        "reasoning_effort": data.reasoning_effort,
        "response_style": data.response_style,
        "max_rows": data.max_rows,
        "resume": data.resume,
        "task_mode": getattr(data, "task_mode", "normal") or "normal",
    }
    
    return await _handle_agent_stream(
        request=request,
        user_id=user_id,
        conversation_id=data.conversation_id,
        provider=provider,
        model=data.model,
        stream_generator_kwargs=kwargs
    )


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
        else LLMOptionsService.default_model(default_provider)
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
        user_id = user.get("uid") if isinstance(user, dict) else user
        conv_data = await run_in_threadpool(
            ConversationService.get_conversation_data, conversation_id, user_id
        )
        if conv_data:
            # Keep this flat response shape; frontend conversation loaders read `conversation` directly.
            return {"status": "success", "conversation": conv_data}
        raise HTTPException(status_code=404, detail="Conversation not found")
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except _TRANSIENT_FIRESTORE_ERRORS as e:
        raise _firestore_unavailable_response(e)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error fetching conversation")
        raise HTTPException(status_code=500, detail="An internal error occurred while fetching conversation.")


@router.get("/get_execution_result/{conversation_id}/{execution_id}")
async def fetch_execution_result(
    conversation_id: str, execution_id: str, user: dict = Depends(get_current_user)
):
    """Get a specific execution result from the subcollection."""
    try:
        user_id = user.get("uid") if isinstance(user, dict) else user
        
        # Verify ownership using a user_id-only projection. Downloading the
        # full message array once per artifact causes severe N+1 amplification.
        conversation_exists = await run_in_threadpool(
            ConversationService.verify_conversation_owner,
            conversation_id,
            user_id,
        )
        if not conversation_exists:
            raise HTTPException(status_code=404, detail="Conversation not found")
            
        from service.firestore.firestore_service import get_execution_result
        result_data = await run_in_threadpool(
            get_execution_result, conversation_id, execution_id
        )
        
        if not result_data:
            raise HTTPException(status_code=404, detail="Execution result not found")
            
        return {"status": "success", "data": result_data}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except _TRANSIENT_FIRESTORE_ERRORS as e:
        raise _firestore_unavailable_response(e)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error fetching execution result")
        raise HTTPException(status_code=500, detail="An internal error occurred.")


@router.get("/get_conversations")
async def get_conversations(user: dict = Depends(get_current_user)):
    """Get all conversations for logged-in user."""
    user_id = user.get("uid") if isinstance(user, dict) else user
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
        user_id = user.get("uid") if isinstance(user, dict) else user
        await run_in_threadpool(
            ConversationService.delete_user_conversation, conversation_id, user_id
        )
        return {"status": "success"}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error("Error deleting conversation: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred while deleting conversation.")


@router.patch("/rename_conversation/{conversation_id}")
async def rename_conversation(
    conversation_id: str,
    data: RenameConversationRequest,
    user: dict = Depends(get_current_user),
):
    """Rename a conversation."""
    try:
        user_id = user.get("uid") if isinstance(user, dict) else user
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
        logger.error("Error renaming conversation: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred while renaming conversation.")
