"""
Structured Output Schemas for AI Tools

Pydantic models that define:
1. Tool argument validation (input to tools)
2. Tool result structures (output from tools)

Benefits:
- Guaranteed valid JSON parsing (no more json.loads failures)
- Type validation before tool execution
- Consistent result format for frontend display
- Better error messages when validation fails
"""

from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator


SUPPORTED_UI_ACTIONS = {
    "open_sql_editor",
    "open_database_modal",
    "open_settings_modal",
    "navigate_new_chat",
}

SUPPORTED_DB_TYPES = {"mysql", "postgresql", "sqlserver", "oracle"}
SUPPORTED_SETTINGS_SECTIONS = {"appearance", "ai", "database", "context"}
# =============================================================================
# TOOL ARGUMENT SCHEMAS (Input validation)
# =============================================================================


class BaseToolArgs(BaseModel):
    """Base class for all tool arguments."""
    pass


class GetConnectionStatusArgs(BaseToolArgs):
    """Arguments for get_connection_status tool."""

    pass  # Only requires rationale


class GetDatabaseListArgs(BaseToolArgs):
    """Arguments for get_database_list tool."""

    pass  # Only requires rationale


class ExecuteQueryArgs(BaseToolArgs):
    """Arguments for execute_query tool."""

    query: str = Field(..., description="SQL SELECT query to execute.")
    max_rows: Optional[int] = Field(
        100, description="Maximum number of rows to return (capped at 1000).", ge=1, le=1000
    )
    @field_validator("max_rows", mode="before")
    @classmethod
    def cap_max_rows(cls, v: Any) -> Any:
        if isinstance(v, int):
            return max(1, min(v, 1000))
        return v

    @field_validator("query")
    @classmethod
    def validate_query_is_read_only(cls, v: str) -> str:
        from service.database.security import DatabaseSecurity

        analysis = DatabaseSecurity.analyze_sql_query(v)
        if not analysis["is_safe"]:
            reason = "; ".join(analysis["warnings"]) or "query is not read-only"
            raise ValueError(reason)

        return v


class GetTableIndexesArgs(BaseToolArgs):
    """Arguments for get_table_indexes tool."""

    table_name: str = Field(..., description="Name of the table to get indexes for.")


class AnalyzeQueryResultArgs(BaseToolArgs):
    """Arguments for deterministic analysis of a persisted query result."""

    execution_id: str = Field(..., min_length=1)
    operation: Literal["profile", "data_quality", "correlation"]
    columns: Optional[List[str]] = Field(default=None, max_length=50)


class GetSchemaOverviewArgs(BaseToolArgs):
    """Arguments for get_schema_overview tool."""

    target_tables: Optional[List[str]] = Field(
        None,
        description="Optional list of table names to fetch the overview for. If not provided, fetches all tables.",
    )


class OpenSqlEditorArgs(BaseToolArgs):
    """Arguments for open_sql_editor tool."""

    query: Optional[str] = Field(None, description="SQL query to pre-populate in the editor.")

    @field_validator("query")
    @classmethod
    def normalize_optional_query(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        query = v.strip()
        return query or None


class OpenDatabaseModalArgs(BaseToolArgs):
    """Arguments for open_database_modal tool."""

    db_type: Optional[str] = Field(None, description="Database type to pre-select (e.g. 'postgresql').")

    @field_validator("db_type")
    @classmethod
    def validate_db_type(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        db_type = v.strip().lower()
        if not db_type:
            return None
        if db_type not in SUPPORTED_DB_TYPES:
            raise ValueError(
                f"db_type must be one of: {', '.join(sorted(SUPPORTED_DB_TYPES))}"
            )
        return db_type


class OpenSettingsModalArgs(BaseToolArgs):
    """Arguments for open_settings_modal tool."""

    section: Optional[str] = Field(None, description="Settings section to navigate to on open.")

    @field_validator("section")
    @classmethod
    def validate_section(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        section = v.strip().lower()
        if not section:
            return None
        if section not in SUPPORTED_SETTINGS_SECTIONS:
            raise ValueError(
                "section must be one of: "
                f"{', '.join(sorted(SUPPORTED_SETTINGS_SECTIONS))}"
            )
        return section


class NavigateNewChatArgs(BaseToolArgs):
    """Arguments for navigate_new_chat tool."""

    pass  # Only requires rationale


# Mapping of tool names to their argument schemas
TOOL_ARG_SCHEMAS = {
    "get_connection_status": GetConnectionStatusArgs,
    "get_database_list": GetDatabaseListArgs,
    "execute_query": ExecuteQueryArgs,
    "get_table_indexes": GetTableIndexesArgs,
    "analyze_query_result": AnalyzeQueryResultArgs,
    "get_schema_overview": GetSchemaOverviewArgs,
    "open_sql_editor": OpenSqlEditorArgs,
    "open_database_modal": OpenDatabaseModalArgs,
    "open_settings_modal": OpenSettingsModalArgs,
    "navigate_new_chat": NavigateNewChatArgs,
}


# =============================================================================
# TOOL RESULT SCHEMAS (Output structure for frontend)
# =============================================================================


class ToolResultBase(BaseModel):
    """Base class for all tool results."""

    success: bool = True
    error: Optional[str] = None


class ConnectionStatusResult(ToolResultBase):
    """Structured result for connection status."""

    model_config = ConfigDict(populate_by_name=True)

    connected: bool = False
    db_type: Optional[str] = None
    database: Optional[str] = None
    host: Optional[str] = None
    is_remote: Optional[bool] = None
    schema_name: Optional[str] = Field(
        default=None, validation_alias="schema", serialization_alias="schema"
    )


class DatabaseListResult(ToolResultBase):
    """Structured result for database list."""

    databases: List[str] = Field(default_factory=list)
    current_database: Optional[str] = None
    count: int = 0


class QueryResult(ToolResultBase):
    """Structured result for query execution.

    Full data is included for the inline chat result table.
    LLM context should consume preview-only summaries to control token usage.
    """

    data: List[Dict[str, Any]] = Field(default_factory=list)
    row_count: int = 0  # Actual rows returned (after truncation)
    total_rows: Optional[int] = None  # Exact total only when known
    column_count: int = 0
    columns: List[str] = Field(default_factory=list)
    truncated: bool = False
    preview: List[Dict[str, Any]] = Field(default_factory=list)
    preview_row_count: int = 0
    preview_is_partial: bool = False
    full_result_location: str = "inline interactive chat table"
    preview_note: Optional[str] = None
    execution_id: Optional[str] = None
    conversation_id: Optional[str] = None


class TableIndexesResult(ToolResultBase):
    """Structured result for table indexes."""

    table: Optional[str] = None
    count: int = 0
    indexes: List[Dict[str, Any]] = Field(default_factory=list)


class SchemaOverviewResult(ToolResultBase):
    """Structured result for schema overview."""

    database: Optional[str] = None
    table_count: int = 0
    foreign_key_count: int = 0
    tables: List[str] = Field(default_factory=list)
    columns: Dict[str, List[Any]] = Field(default_factory=dict)
    foreign_keys: List[Dict[str, Any]] = Field(default_factory=list)


class UiActionResult(ToolResultBase):
    """Structured result for UI action tools."""

    action: str
    requiresConfirmation: bool = False


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================


def validate_tool_args(tool_name: str, args: Dict[str, Any]) -> BaseToolArgs:
    """
    Validate tool arguments using Pydantic schema.

    Args:
        tool_name: Name of the tool
        args: Raw arguments dict from AI

    Returns:
        Validated Pydantic model

    Raises:
        ValueError: If validation fails with descriptive message
    """
    schema_class = TOOL_ARG_SCHEMAS.get(tool_name)

    if not schema_class:
        raise ValueError(f"Unknown tool: {tool_name}")

    try:
        return schema_class(**args)
    except Exception as e:
        raise ValueError(f"Invalid arguments for {tool_name}: {str(e)}")


def structure_tool_result(tool_name: str, raw_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert raw tool result to structured format for frontend.

    Args:
        tool_name: Name of the tool
        raw_result: Raw result dict from tool execution

    Returns:
        Structured result dict with consistent format
    """
    # Handle errors uniformly
    if "error" in raw_result:
        return {"success": False, "error": raw_result["error"]}

    try:
        if tool_name == "get_connection_status":
            return ConnectionStatusResult(
                connected=raw_result.get("connected", False),
                db_type=raw_result.get("db_type"),
                database=raw_result.get("database"),
                host=raw_result.get("host"),
                is_remote=raw_result.get("is_remote"),
                schema_name=raw_result.get("schema"),
            ).model_dump(by_alias=True)

        elif tool_name == "get_database_list":
            dbs = raw_result.get("databases", [])
            return DatabaseListResult(
                databases=dbs,
                current_database=raw_result.get("current_database"),
                count=len(dbs),
            ).model_dump()

        elif tool_name == "execute_query":
            # Include full data for UI panels, plus preview for token-efficient context.
            data = raw_result.get("data", [])
            columns = raw_result.get("columns", [])
            row_count = raw_result.get("row_count", len(data))
            total_rows = raw_result.get("total_rows", row_count)
            preview_rows = data[:20]
            preview_row_count = len(preview_rows)
            preview_is_partial = bool(raw_result.get("truncated")) or (
                row_count > preview_row_count
            ) or (total_rows is not None and total_rows > preview_row_count)
            preview_note = (
                "Preview only. The full available query result is visible in the inline interactive chat table."
                if preview_is_partial
                else None
            )

            return QueryResult(
                data=data,
                row_count=row_count,
                total_rows=total_rows,
                column_count=len(columns),
                columns=columns,
                truncated=raw_result.get("truncated", False),
                preview=preview_rows,
                preview_row_count=preview_row_count,
                preview_is_partial=preview_is_partial,
                full_result_location="inline interactive chat table",
                preview_note=preview_note,
                execution_id=raw_result.get("execution_id"),
                conversation_id=raw_result.get("conversation_id"),
            ).model_dump()

        elif tool_name == "get_table_indexes":
            indexes = raw_result.get("indexes", [])
            return TableIndexesResult(
                table=raw_result.get("table"), count=len(indexes), indexes=indexes
            ).model_dump()

        elif tool_name == "get_schema_overview":
            tables = raw_result.get("tables", [])
            fks = raw_result.get("foreign_keys", [])
            return SchemaOverviewResult(
                database=raw_result.get("database"),
                table_count=len(tables),
                foreign_key_count=len(fks),
                tables=tables,
                columns=raw_result.get("columns", {}),
                foreign_keys=fks,
            ).model_dump()

        elif tool_name in SUPPORTED_UI_ACTIONS:
            structured = UiActionResult(
                action=tool_name,
                requiresConfirmation=bool(
                    raw_result.get("requiresConfirmation", False)
                ),
            ).model_dump()
            # Preserve the compact legacy shape unless confirmation metadata matters.
            if not structured["requiresConfirmation"]:
                structured.pop("requiresConfirmation", None)
            structured.pop("error", None)
            return structured

        else:
            # Unknown tool - return as-is with success flag
            return {"success": True, "data": raw_result}

    except Exception as e:
        # If structuring fails, return raw with error note
        return {"success": True, "data": raw_result, "_structuring_error": str(e)}
