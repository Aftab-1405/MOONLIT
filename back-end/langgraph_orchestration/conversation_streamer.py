"""Conversation streaming adapter backed by LangGraph orchestration."""

from typing import AsyncGenerator

from api_contract.conversations_protocols import ConversationAgentStreamer
from langgraph_orchestration.stream_conversation import stream_conversation


class LangGraphConversationAgentStreamer:
    """Conversation agent streamer backed by LangGraph."""

    async def stream(
        self,
        conversation_id: str,
        prompt: str | None,
        user_id: str,
        *,
        db_config: dict | None = None,
        response_style: str = "balanced",
        max_rows: int | None = None,
        api_key: str | None = None,
        provider: str = "bedrock",
        model: str | None = None,
        enable_reasoning: bool = True,
        reasoning_effort: str = "medium",
        resume: dict | None = None,
        task_mode: str = "normal",
    ) -> AsyncGenerator[str, None]:
        async for sse_line in stream_conversation(
            conversation_id,
            prompt,
            user_id,
            db_config=db_config,
            response_style=response_style,
            max_rows=max_rows,
            api_key=api_key,
            provider=provider,
            model=model,
            enable_reasoning=enable_reasoning,
            reasoning_effort=reasoning_effort,
            resume=resume,
            task_mode=task_mode,
        ):
            yield sse_line
