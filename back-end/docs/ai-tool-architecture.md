# AI Agent Tool Architecture

This document explains the Moonlit AI agent architecture and provides a step-by-step guide for adding new tools.

---

## Architecture Overview

Moonlit follows the industry-standard **LLM → Orchestration → Tools** pattern:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DB-GENIE AI AGENT                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────┐    ┌────────────────────┐    ┌───────────────────────┐  │
│   │     LLM      │───▶│   ORCHESTRATION    │───▶│        TOOLS          │  │
│   │  (Cerebras)  │◀───│   (llm_service)    │◀───│    (ai_tools.py)      │  │
│   └──────────────┘    └────────────────────┘    └───────────────────────┘  │
│                                                            │                 │
│                                                            ▼                 │
│                                                   ┌─────────────────┐       │
│                                                   │ DATABASE LAYER  │       │
│                                                   │   (Adapters)    │       │
│                                                   └─────────────────┘       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The Three Main Components

| Component | File(s) | Responsibility |
|-----------|---------|----------------|
| **LLM** | `llm_service.py` | Reasoning, decision-making, natural language |
| **Orchestration** | `llm_service.py` | Tool dispatch loop, context management |
| **Tools** | `ai_tools.py`, `tool_schemas.py`, adapters | Actual data retrieval and actions |

---

## Files Required to Add a New Tool

Adding a single tool requires modifications to **9 files**:

### Backend (8 files)

| # | File | Purpose |
|---|------|---------|
| 1 | `database/adapters/base_adapter.py` | Abstract method signature (interface) |
| 2 | `database/adapters/postgresql_adapter.py` | PostgreSQL-specific SQL |
| 3 | `database/adapters/mysql_adapter.py` | MySQL-specific SQL |
| 4 | `database/adapters/sqlite_adapter.py` | SQLite-specific SQL |
| 5 | `database/adapters/sqlserver_adapter.py` | SQL Server-specific SQL |
| 6 | `database/adapters/oracle_adapter.py` | Oracle-specific SQL |
| 7 | `services/ai_tools.py` | Tool definition + executor implementation |
| 8 | `services/tool_schemas.py` | Pydantic validation schemas |

### Frontend (1 file)

| # | File | Purpose |
|---|------|---------|
| 9 | `src/components/AIResponseSteps.jsx` | UI display (icons, summaries, details) |

---

## Step-by-Step: Adding a New Tool

### Example: Adding `get_table_stats`

This tool will return row count, table size, and last modified time.

---

### Step 1: Define Adapter Method (base_adapter.py)

Add the abstract method signature to `BaseDatabaseAdapter`:

```python
# back-end/database/adapters/base_adapter.py

def get_table_stats_query(self, table_name: str, db_name: str = None, schema: str = 'public') -> tuple:
    """
    Return SQL query and params to get table statistics.
    
    Query should return: row_count, table_size_bytes, last_modified
    
    Args:
        table_name: Table name
        db_name: Database name (MySQL)
        schema: Schema name (PostgreSQL)
        
    Returns:
        Tuple of (query_string, params_tuple)
    """
    return None, ()  # Default: not supported
```

---

### Step 2: Implement in Each Adapter

**PostgreSQL** (`postgresql_adapter.py`):

```python
def get_table_stats_query(self, table_name: str, db_name: str = None, schema: str = 'public') -> tuple:
    query = f"""
        SELECT 
            n_live_tup AS row_count,
            pg_total_relation_size(relid) AS table_size_bytes,
            last_vacuum AS last_modified
        FROM pg_stat_user_tables
        WHERE schemaname = '{schema}' AND relname = %s
    """
    return query, (table_name,)
```

**MySQL** (`mysql_adapter.py`):

```python
def get_table_stats_query(self, table_name: str, db_name: str = None, schema: str = 'public') -> tuple:
    query = """
        SELECT 
            TABLE_ROWS AS row_count,
            DATA_LENGTH + INDEX_LENGTH AS table_size_bytes,
            UPDATE_TIME AS last_modified
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
    """
    return query, (db_name, table_name)
```

Repeat for `sqlite_adapter.py`, `sqlserver_adapter.py`, `oracle_adapter.py`.

---

### Step 3: Add Tool Definition (ai_tools.py)

Add to `_RAW_TOOL_DEFINITIONS` list:

```python
# back-end/services/ai_tools.py

{
    "name": "get_table_stats",
    "description": "Get table statistics including row count, size, and last modified time.",
    "parameters": {
        "type": "object",
        "properties": {
            "table_name": {
                "type": "string",
                "description": "Name of the table to get statistics for."
            },
            "rationale": {
                "type": "string",
                "description": "A natural explanation of what you are checking."
            }
        },
        "required": ["table_name", "rationale"]
    }
}
```

---

### Step 4: Add Executor Case (ai_tools.py)

Add to `AIToolExecutor.execute()` method:

```python
elif tool_name == "get_table_stats":
    table_name = parameters.get("table_name")
    return AIToolExecutor._get_table_stats(user_id, table_name, db_config=db_config)
```

---

### Step 5: Add Implementation Method (ai_tools.py)

Add the actual implementation:

```python
@staticmethod
def _get_table_stats(user_id: str, table_name: str, db_config: dict = None) -> Dict:
    """Get statistics for a specific table."""
    from services.context_service import ContextService
    from database.adapters import get_adapter
    
    if not table_name:
        return {"error": "Table name is required"}
    
    connection = ContextService.get_connection(user_id)
    if not connection.get('connected'):
        return {"error": "Not connected to any database"}
    
    db_type = connection.get('db_type', 'postgresql')
    database = connection.get('database')
    schema = connection.get('schema', 'public')
    
    try:
        adapter = get_adapter(db_type)
        query, params = adapter.get_table_stats_query(table_name, db_name=database, schema=schema)
        
        if query is None:
            return {"error": f"Table stats not supported for {db_type}"}
        
        with get_tool_connection(db_config) as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            row = cursor.fetchone()
            cursor.close()
        
        if row:
            return {
                "table": table_name,
                "row_count": row[0],
                "size_bytes": row[1],
                "last_modified": str(row[2]) if row[2] else None
            }
        return {"table": table_name, "row_count": 0, "size_bytes": 0, "last_modified": None}
        
    except Exception as e:
        return {"error": str(e)}
```

---

### Step 6: Add Pydantic Schemas (tool_schemas.py)

**Argument Schema:**

```python
class GetTableStatsArgs(BaseToolArgs):
    """Arguments for get_table_stats tool."""
    table_name: str = Field(..., description="Name of the table to get statistics for.")
```

**Add to mapping:**

```python
TOOL_ARG_SCHEMAS = {
    # ... existing tools ...
    "get_table_stats": GetTableStatsArgs,
}
```

**Result Schema:**

```python
class TableStatsResult(ToolResultBase):
    """Structured result for table statistics."""
    table: Optional[str] = None
    row_count: int = 0
    size_bytes: int = 0
    last_modified: Optional[str] = None
```

**Add to structure_tool_result:**

```python
elif tool_name == "get_table_stats":
    return TableStatsResult(
        table=raw_result.get('table'),
        row_count=raw_result.get('row_count', 0),
        size_bytes=raw_result.get('size_bytes', 0),
        last_modified=raw_result.get('last_modified')
    ).model_dump()
```

---

### Step 7: Add Frontend Display (AIResponseSteps.jsx)

**TOOL_CONFIG:**

```javascript
'get_table_stats': { 
  action: 'Fetching table stats', 
  pastAction: 'Fetched table stats', 
  icon: StorageRoundedIcon 
},
```

**getResultSummary:**

```javascript
'get_table_stats': () => `${result.row_count?.toLocaleString() ?? 0} rows`,
```

**getDetailedResult:**

```javascript
'get_table_stats': () => {
  const size = result.size_bytes ? `${(result.size_bytes / 1024 / 1024).toFixed(2)} MB` : 'unknown';
  return `Table ${result.table}: ${result.row_count?.toLocaleString()} rows, ${size}`;
},
```

---

## Quick Reference Checklist

```
□ base_adapter.py         - Add abstract method
□ postgresql_adapter.py   - Implement for PostgreSQL
□ mysql_adapter.py        - Implement for MySQL
□ sqlite_adapter.py       - Implement for SQLite
□ sqlserver_adapter.py    - Implement for SQL Server
□ oracle_adapter.py       - Implement for Oracle
□ ai_tools.py             - Tool definition + executor + implementation
□ tool_schemas.py         - Pydantic schemas + result structuring
□ AIResponseSteps.jsx     - TOOL_CONFIG + getResultSummary + getDetailedResult
```

---

## Current Tools (9 total)

| Tool | Purpose |
|------|---------|
| `get_connection_status` | Check database connection |
| `get_database_list` | List available databases |
| `get_database_schema` | Get all tables in a database |
| `get_table_columns` | Get column details for a table |
| `execute_query` | Run SELECT queries |
| `get_recent_queries` | Get query history |
| `get_table_indexes` | Get indexes on a table |
| `get_table_constraints` | Get constraints on a table |
| `get_foreign_keys` | Get FK relationships |

---

## Architecture Principles

1. **Separation of Concerns**: Adapters handle SQL dialect differences, tools handle business logic
2. **Type Safety**: Pydantic validates all inputs/outputs
3. **Read-Only by Default**: `execute_query` blocks write operations
4. **Graceful Degradation**: Adapters return `None` for unsupported features
5. **Consistent Structure**: All tools follow the same pattern for maintainability
