"""Shared API contract models."""

from typing import Any, Generic, Literal, TypeVar

from pydantic import BaseModel, Field


DataT = TypeVar("DataT")


class ErrorDetail(BaseModel):
    """Single structured validation or domain error detail."""

    field: str | None = None
    code: str | None = None
    message: str


class ApiError(BaseModel):
    """Standard JSON error envelope."""

    status: Literal["error"] = "error"
    error: str = Field(..., description="Stable machine-readable error code.")
    message: str = Field(..., description="Human-readable error message.")
    details: dict[str, Any] = Field(default_factory=dict)


class PaginationMeta(BaseModel):
    """Optional pagination metadata for list endpoints."""

    page: int = Field(..., ge=1)
    page_size: int = Field(..., ge=1)
    total_items: int = Field(..., ge=0)
    total_pages: int = Field(..., ge=0)


class ApiSuccess(BaseModel, Generic[DataT]):
    """Standard JSON success envelope."""

    status: Literal["success"] = "success"
    data: DataT
    message: str | None = None


COMMON_ERROR_RESPONSES = {
    400: {"model": ApiError, "description": "Bad request."},
    401: {"model": ApiError, "description": "Authentication required."},
    403: {"model": ApiError, "description": "Forbidden."},
    422: {"model": ApiError, "description": "Request validation failed."},
    500: {"model": ApiError, "description": "Internal server error."},
}
