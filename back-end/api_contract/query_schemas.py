"""SQL query API contract models."""

from typing import Any, Literal

from pydantic import BaseModel, Field


class QueryResultData(BaseModel):
    """Tabular query result."""

    columns: list[str] = Field(default_factory=list)
    rows: list[list[Any]] = Field(default_factory=list)


class RunSqlQueryData(BaseModel):
    """Data returned after successful SQL execution."""

    result: QueryResultData
    row_count: int = Field(..., ge=0)
    total_rows: int | None = Field(default=None, ge=0)
    truncated: bool = False
    execution_time_ms: float = Field(..., ge=0)
    query_type: Literal["SELECT", "WITH", "OTHER"] = "SELECT"
