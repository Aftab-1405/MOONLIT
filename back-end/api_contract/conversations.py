"""Conversation request schemas."""

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator

from config import get_config

Config = get_config()


class BaseConversationRequest(BaseModel):
    """Base schema for conversation requests."""

    enable_reasoning: bool = Field(default=True)
    reasoning_effort: Literal["low", "medium", "high"] = Field(default="medium")
    response_style: Literal["concise", "balanced", "detailed"] = Field(
        default="balanced"
    )
    max_rows: Optional[int] = Field(
        default=Config.DEFAULT_REQUEST_MAX_ROWS, ge=1, le=Config.REQUEST_MAX_ROWS_LIMIT
    )
    provider: Optional[str] = Field(default=None, max_length=Config.LLM_PROVIDER_MAX_LENGTH)
    model: Optional[str] = Field(default=None, max_length=Config.LLM_MODEL_MAX_LENGTH)
    task_mode: Optional[str] = Field(default="normal", max_length=Config.TASK_MODE_MAX_LENGTH)

    @field_validator("provider")
    @classmethod
    def sanitize_provider(cls, v):
        if v is None:
            return None
        provider = v.strip().lower()
        return provider or None

    @field_validator("model")
    @classmethod
    def sanitize_model(cls, v):
        if v is None:
            return None
        model = v.strip()
        return model or None


class ChatRequest(BaseConversationRequest):
    """Schema for chat request."""

    prompt: str = Field(..., min_length=1, max_length=Config.CHAT_PROMPT_MAX_LENGTH)
    conversation_id: Optional[str] = Field(
        None, max_length=Config.CONVERSATION_ID_MAX_LENGTH
    )


    @field_validator("prompt")
    @classmethod
    def prompt_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("Prompt cannot be empty")
        return v.strip()

class AgentResumeRequest(BaseConversationRequest):
    """Schema for resuming a paused LangGraph conversation."""

    conversation_id: str = Field(
        ..., min_length=1, max_length=Config.CONVERSATION_ID_MAX_LENGTH
    )
    resume: dict[str, Any] = Field(...)


    @field_validator("resume")
    @classmethod
    def resume_not_empty(cls, v):
        if not isinstance(v, dict) or not v:
            raise ValueError("Resume payload cannot be empty")
        return v

class RenameConversationRequest(BaseModel):
    """Schema for renaming a saved conversation."""

    title: str = Field(
        ..., min_length=1, max_length=Config.CONVERSATION_TITLE_MAX_LENGTH
    )

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v):
        title = v.strip()
        if not title:
            raise ValueError("Conversation title cannot be empty")
        return title
