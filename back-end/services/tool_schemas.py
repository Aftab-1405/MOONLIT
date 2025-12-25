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

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


# =============================================================================
# TOOL ARGUMENT SCHEMAS (Input validation)
# =============================================================================

class BaseToolArgs(BaseModel):
    """Base class for all tool arguments."""
    rationale: str = Field(
        ..., 
        description="A natural, friendly sentence explaining what the AI is doing"
    )


class GetConnectionStatusArgs(BaseToolArgs):
    """Arguments for get_connection_status tool."""
    pass  # Only requires rationale


class GetDatabaseListArgs(BaseToolArgs):
    """Arguments for get_database_list tool."""
    pass  # Only requires rationale


class GetDatabaseSchemaArgs(BaseToolArgs):
    """Arguments for get_database_schema tool."""
    database: Optional[str] = Field(
        None,
        description="Database name. If not provided, uses current database."
    )


class GetTableColumnsArgs(BaseToolArgs):
    """Arguments for get_table_columns tool."""
    table_name: str = Field(
        ...,
        description="Name of the table to get columns for."
    )


class ExecuteQueryArgs(BaseToolArgs):
    """Arguments for execute_query tool."""
    query: str = Field(
        ...,
        description="SQL SELECT query to execute."
    )
    max_rows: Optional[int] = Field(
        100,
        description="Maximum number of rows to return.",
        ge=1,
        le=1000
    )
    
    @field_validator('query')
    @classmethod
    def validate_query_is_select(cls, v: str) -> str:
        """Ensure query starts with SELECT for safety."""
        if not v.strip().upper().startswith('SELECT'):
            raise ValueError("Only SELECT queries are allowed")
        return v


class GetRecentQueriesArgs(BaseToolArgs):
    """Arguments for get_recent_queries tool."""
    limit: Optional[int] = Field(
        5,
        description="Maximum number of queries to return.",
        ge=1,
        le=50
    )


class GetSampleDataArgs(BaseToolArgs):
    """Arguments for get_sample_data tool."""
    table_name: str = Field(
        ...,
        description="Name of the table to sample."
    )
    rows: Optional[int] = Field(
        5,
        description="Number of sample rows to return.",
        ge=1,
        le=100
    )


# Mapping of tool names to their argument schemas
TOOL_ARG_SCHEMAS = {
    "get_connection_status": GetConnectionStatusArgs,
    "get_database_list": GetDatabaseListArgs,
    "get_database_schema": GetDatabaseSchemaArgs,
    "get_table_columns": GetTableColumnsArgs,
    "execute_query": ExecuteQueryArgs,
    "get_recent_queries": GetRecentQueriesArgs,
    "get_sample_data": GetSampleDataArgs,
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
    connected: bool = False
    db_type: Optional[str] = None
    database: Optional[str] = None
    host: Optional[str] = None
    is_remote: Optional[bool] = None
    schema: Optional[str] = None


class DatabaseListResult(ToolResultBase):
    """Structured result for database list."""
    databases: List[str] = []
    current_database: Optional[str] = None
    count: int = 0


class SchemaResult(ToolResultBase):
    """Structured result for database schema."""
    database: Optional[str] = None
    table_count: int = 0
    tables: List[str] = []


class TableColumnsResult(ToolResultBase):
    """Structured result for table columns."""
    table: Optional[str] = None
    column_count: int = 0
    columns: List[str] = []


class QueryResult(ToolResultBase):
    """Structured result for query execution."""
    row_count: int = 0
    column_count: int = 0
    columns: List[str] = []
    truncated: bool = False
    preview: List[Dict[str, Any]] = []  # First 5 rows for LLM context (token-efficient)
    data: List[Dict[str, Any]] = []  # Full data for frontend SQL Editor display


class RecentQueriesResult(ToolResultBase):
    """Structured result for recent queries."""
    count: int = 0
    queries: List[str] = []  # Just the query strings


class SampleDataResult(ToolResultBase):
    """Structured result for sample data."""
    table: Optional[str] = None
    row_count: int = 0
    columns: List[str] = []
    preview: List[Dict[str, Any]] = []


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
    if 'error' in raw_result:
        return {
            "success": False,
            "error": raw_result['error']
        }
    
    try:
        if tool_name == "get_connection_status":
            return ConnectionStatusResult(
                connected=raw_result.get('connected', False),
                db_type=raw_result.get('db_type'),
                database=raw_result.get('database'),
                host=raw_result.get('host'),
                is_remote=raw_result.get('is_remote'),
                schema=raw_result.get('schema')
            ).model_dump()
        
        elif tool_name == "get_database_list":
            dbs = raw_result.get('databases', [])
            return DatabaseListResult(
                databases=dbs,
                current_database=raw_result.get('current_database'),
                count=len(dbs)
            ).model_dump()
        
        elif tool_name == "get_database_schema":
            tables = raw_result.get('tables', [])
            return SchemaResult(
                database=raw_result.get('database'),
                table_count=len(tables),
                tables=tables[:10] if len(tables) > 10 else tables  # Limit for display
            ).model_dump()
        
        elif tool_name == "get_table_columns":
            cols = raw_result.get('columns', [])
            # Handle both list of strings and list of dicts
            if cols and isinstance(cols[0], dict):
                col_names = [c.get('name', str(c)) for c in cols]
            else:
                col_names = cols
            return TableColumnsResult(
                table=raw_result.get('table'),
                column_count=len(col_names),
                columns=col_names
            ).model_dump()
        
        elif tool_name == "execute_query":
            # Full data embedded in result - no cache needed
            # LLM only sees preview (via result_summary in llm_service)
            # Frontend parses full data directly from tool result
            data = raw_result.get('data', [])
            columns = raw_result.get('columns', [])
            row_count = raw_result.get('row_count', len(data))
            
            return QueryResult(
                row_count=row_count,
                column_count=len(columns),
                columns=columns,
                truncated=raw_result.get('truncated', False),
                preview=data[:5],  # 5 rows for LLM context summary
                data=data  # Full data for frontend SQL Editor
            ).model_dump()
        
        elif tool_name == "get_recent_queries":
            queries = raw_result.get('queries', [])
            # Extract just query strings if queries are dicts
            if queries and isinstance(queries[0], dict):
                query_strings = [q.get('query', str(q)) for q in queries]
            else:
                query_strings = queries
            return RecentQueriesResult(
                count=len(query_strings),
                queries=query_strings[:5]  # Limit for display
            ).model_dump()
        
        elif tool_name == "get_sample_data":
            data = raw_result.get('data', [])
            return SampleDataResult(
                table=raw_result.get('table'),
                row_count=raw_result.get('row_count', len(data)),
                columns=raw_result.get('columns', []),
                preview=data[:5]  # First 5 rows
            ).model_dump()
        
        else:
            # Unknown tool - return as-is with success flag
            return {"success": True, "data": raw_result}
            
    except Exception as e:
        # If structuring fails, return raw with error note
        return {
            "success": True,
            "data": raw_result,
            "_structuring_error": str(e)
        }

