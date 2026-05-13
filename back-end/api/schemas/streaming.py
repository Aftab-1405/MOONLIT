"""SSE streaming API contract models."""

from typing import Annotated, Any, Literal, Union

from pydantic import BaseModel, Field, TypeAdapter

from api.schemas.common import ApiError


class TokenEvent(BaseModel):
    type: Literal["token"]
    content: str


class ThinkingTokenEvent(BaseModel):
    type: Literal["thinking_token"]
    content: str


class ToolStartEvent(BaseModel):
    type: Literal["tool_start"]
    name: str
    args: dict[str, Any] = Field(default_factory=dict)


class ToolEndEvent(BaseModel):
    type: Literal["tool_end"]
    name: str
    args: dict[str, Any] = Field(default_factory=dict)
    result: Any | None = None


class UiActionEvent(BaseModel):
    type: Literal["ui_action"]
    action: str
    payload: dict[str, Any] | None = None


class InterruptEvent(BaseModel):
    type: Literal["agent_interrupt"]
    id: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class StreamErrorEvent(BaseModel):
    type: Literal["error"]
    message: str


class DoneEvent(BaseModel):
    type: Literal["done"]


SseEvent = Annotated[
    Union[
        TokenEvent,
        ThinkingTokenEvent,
        ToolStartEvent,
        ToolEndEvent,
        UiActionEvent,
        InterruptEvent,
        StreamErrorEvent,
        DoneEvent,
    ],
    Field(discriminator="type"),
]


SSE_EVENT_SCHEMA = TypeAdapter(SseEvent).json_schema()


STREAMING_RESPONSES = {
    200: {
        "description": (
            "Server-sent event stream. Each data frame contains one JSON object "
            "matching one of the documented event models."
        ),
        "content": {
            "text/event-stream": {
                "schema": SSE_EVENT_SCHEMA,
                "examples": {
                    "token": {
                        "summary": "Content token",
                        "value": {"type": "token", "content": "Hello"},
                    },
                    "done": {"summary": "Stream complete", "value": {"type": "done"}},
                },
            }
        },
    },
    400: {"model": ApiError, "description": "Invalid request."},
    401: {"model": ApiError, "description": "Authentication required."},
    403: {"model": ApiError, "description": "Forbidden."},
    429: {"model": ApiError, "description": "Rate limit exceeded."},
    500: {"model": ApiError, "description": "Streaming initialization failed."},
}
