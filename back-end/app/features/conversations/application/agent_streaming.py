"""Agent streaming adapters for conversations."""

from typing import AsyncGenerator

from app.features.conversations.domain.protocols import ConversationAgentStreamer


class AgentOrchestrationStreamer:
    """Conversation agent streamer backed by the agent orchestration feature."""

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
        from app.features.agent_orchestration.application.stream_conversation import (
            stream_conversation,
        )

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


def get_default_agent_streamer() -> ConversationAgentStreamer:
    """Return the configured agent streamer for conversations."""
    return AgentOrchestrationStreamer()
