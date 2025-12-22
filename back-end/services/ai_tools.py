"""
AI Tools Module

Defines tools (functions) that the AI can call to get real-time context.
Implements the tool executor that processes AI function calls.

Separation of Concerns:
- Tool definitions (schemas) are separate from implementations
- Tool executor is the bridge between AI and actual services
- Each tool implementation delegates to appropriate service
"""

import json
import logging
from typing import Dict, Any, List, Optional
from flask import session

logger = logging.getLogger(__name__)

# =============================================================================
# TOOL DEFINITIONS (Schemas)
# =============================================================================

# Raw tool definitions
_RAW_TOOL_DEFINITIONS = [
    {
        "name": "get_connection_status",
        "description": "Check if user is connected to a database and get connection details like database type, name, host, and whether it's a remote connection.",
        "parameters": {
            "type": "object",
            "properties": {
                "rationale": {
                    "type": "string",
                    "description": "A natural, friendly sentence explaining to the user what you are checking. Example: 'Let me check your current connection status...'"
                }
            },
            "required": ["rationale"]
        }
    },
    {
        "name": "get_database_list",
        "description": "Get list of all databases available on the connected server.",
        "parameters": {
            "type": "object",
            "properties": {
                "rationale": {
                    "type": "string",
                    "description": "A natural, friendly sentence explaining what you are looking up. Example: 'I'll list the available databases for you...'"
                }
            },
            "required": ["rationale"]
        }
    },
    {
        "name": "get_database_schema",
        "description": "Get all tables and their columns for the current database or a specified database.",
        "parameters": {
            "type": "object",
            "properties": {
                "database": {
                    "type": "string",
                    "description": "Database name. If not provided, uses current database."
                },
                "rationale": {
                    "type": "string",
                    "description": "A natural, friendly sentence explaining what you are fetching. Example: 'Let me fetch the schema for the sales database...'"
                }
            },
            "required": ["rationale"]
        }
    },
    {
        "name": "get_table_columns",
        "description": "Get detailed column information for a specific table including column names and data types.",
        "parameters": {
            "type": "object",
            "properties": {
                "table_name": {
                    "type": "string",
                    "description": "Name of the table to get columns for."
                },
                "rationale": {
                    "type": "string",
                    "description": "A natural, friendly sentence explaining what you are checking. Example: 'I'll look up the columns for table Users...'"
                }
            },
            "required": ["table_name", "rationale"]
        }
    },
    {
        "name": "execute_query",
        "description": "Execute a SQL SELECT query against the connected database. Only SELECT queries are allowed for safety.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "SQL SELECT query to execute."
                },
                "max_rows": {
                    "type": "integer",
                    "description": "Maximum number of rows to return. Default is 100."
                },
                "rationale": {
                    "type": "string",
                    "description": "A natural, friendly sentence explaining the query. Example: 'Running a query to fetch top 5 customers...'"
                }
            },
            "required": ["query", "rationale"]
        }
    },
    {
        "name": "get_recent_queries",
        "description": "Get user's recent SQL query history.",
        "parameters": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of queries to return. Default is 5."
                },
                "rationale": {
                    "type": "string",
                    "description": "A natural, friendly sentence explaining you are checking history. Example: 'Let me look at your recent queries...'"
                }
            },
            "required": ["rationale"]
        }
    },
    {
        "name": "get_sample_data",
        "description": "Get sample rows from a table to understand its data.",
        "parameters": {
            "type": "object",
            "properties": {
                "table_name": {
                    "type": "string",
                    "description": "Name of the table to sample."
                },
                "rows": {
                    "type": "integer",
                    "description": "Number of sample rows to return. Default is 5."
                },
                "rationale": {
                    "type": "string",
                    "description": "A natural, friendly sentence explaining the sampling. Example: 'I'll fetch a few rows from table Users to see the data structure...'"
                }
            },
            "required": ["table_name", "rationale"]
        }
    }
]

# Export tools in OpenAI-compatible format (Cerebras, OpenAI, etc.)
ai_tools_list = [
    {
        "type": "function",
        "function": tool
    }
    for tool in _RAW_TOOL_DEFINITIONS
]


# =============================================================================
# TOOL EXECUTOR
# =============================================================================

class AIToolExecutor:
    """
    Executes AI tool calls and returns results.
    
    This class is the bridge between the AI and the application.
    It receives tool calls from AI and dispatches to appropriate handlers.
    """
    
    @staticmethod
    def execute(tool_name: str, parameters: Dict, user_id: str, db_config: dict = None) -> Dict:
        """
        Execute a tool and return the result.
        
        Args:
            tool_name: Name of the tool to execute
            parameters: Parameters passed by AI
            user_id: Current user ID
            db_config: Database connection config for query execution
            
        Returns:
            Dict with tool execution result
        """
        logger.info(f"Executing tool: {tool_name} with params: {parameters}")
        
        # Ensure parameters is a dict (can be None if AI calls tool without args)
        if parameters is None:
            parameters = {}
        
        try:
            if tool_name == "get_connection_status":
                return AIToolExecutor._get_connection_status(user_id)
            
            elif tool_name == "get_database_list":
                return AIToolExecutor._get_database_list(user_id)
            
            elif tool_name == "get_database_schema":
                database = parameters.get("database")
                return AIToolExecutor._get_database_schema(user_id, database)
            
            elif tool_name == "get_table_columns":
                table_name = parameters.get("table_name")
                return AIToolExecutor._get_table_columns(user_id, table_name)
            
            elif tool_name == "execute_query":
                query = parameters.get("query")
                # Ensure max_rows is an int (some models may pass as string)
                max_rows = parameters.get("max_rows", 100)
                if isinstance(max_rows, str):
                    max_rows = int(max_rows)
                return AIToolExecutor._execute_query(user_id, query, max_rows, db_config=db_config)
            
            elif tool_name == "get_recent_queries":
                limit = parameters.get("limit", 5)
                return AIToolExecutor._get_recent_queries(user_id, limit)
            
            elif tool_name == "get_sample_data":
                table_name = parameters.get("table_name")
                limit = parameters.get("limit", 5)
                return AIToolExecutor._get_sample_data(user_id, table_name, limit)
            
            else:
                return {"error": f"Unknown tool: {tool_name}"}
                
        except Exception as e:
            logger.exception(f"Error executing tool {tool_name}")
            return {"error": str(e)}
    
    # =========================================================================
    # Tool Implementations
    # =========================================================================
    
    @staticmethod
    def _get_connection_status(user_id: str) -> Dict:
        """Get current connection status from context."""
        from services.context_service import ContextService
        
        connection = ContextService.get_connection(user_id)
        
        if connection.get('connected'):
            return {
                "connected": True,
                "db_type": connection.get('db_type'),
                "database": connection.get('database'),
                "host": connection.get('host'),
                "is_remote": connection.get('is_remote'),
                "schema": connection.get('schema'),
                "connected_at": connection.get('connected_at')
            }
        else:
            return {
                "connected": False,
                "message": "Not connected to any database"
            }
    
    @staticmethod
    def _get_database_list(user_id: str) -> Dict:
        """Get list of databases from context (cannot query server without Flask session)."""
        from services.context_service import ContextService
        
        connection = ContextService.get_connection(user_id)
        if not connection.get('connected'):
            return {"error": "Not connected to any database server"}
        
        # We can only return the current database from context
        # Full database list requires Flask session which isn't available here
        current_db = connection.get('database')
        return {
            "databases": [current_db] if current_db else [],
            "current_database": current_db,
            "note": "Showing connected database. Full list available via UI sidebar."
        }
    
    @staticmethod
    def _get_database_schema(user_id: str, database: Optional[str] = None) -> Dict:
        """Get schema (tables and columns) for a database."""
        from services.context_service import ContextService
        
        # Get connection info
        connection = ContextService.get_connection(user_id)
        if not connection.get('connected'):
            return {"error": "Not connected to any database"}
        
        # Use current database if not specified
        target_db = database or connection.get('database')
        
        # Try to get from cache first
        cached_schema = ContextService.get_cached_schema(user_id, target_db)
        if cached_schema:
            return {
                "database": target_db,
                "tables": cached_schema.get('tables', []),
                "columns": cached_schema.get('columns', {}),
                "cached_at": cached_schema.get('cached_at'),
                "source": "cache"
            }
        
        # If not cached, fetch fresh (and cache it)
        return AIToolExecutor._fetch_and_cache_schema(user_id, target_db, connection.get('db_type'))
    
    @staticmethod
    def _fetch_and_cache_schema(user_id: str, database: str, db_type: str) -> Dict:
        """Fetch schema from database and cache it."""
        from services.context_service import ContextService
        from database.operations import DatabaseOperations
        from database.session_utils import get_db_cursor
        
        try:
            tables = DatabaseOperations.get_tables(database)
            columns = {}
            
            # Fetch columns for each table
            for table in tables:
                try:
                    table_schema = DatabaseOperations.get_table_schema(table, database)
                    columns[table] = [col.get('name', col.get('Field', str(col))) for col in table_schema]
                except Exception as e:
                    logger.warning(f"Could not get columns for table {table}: {e}")
                    columns[table] = []
            
            # Cache the schema
            ContextService.cache_schema(user_id, database, tables, columns)
            
            return {
                "database": database,
                "tables": tables,
                "columns": columns,
                "source": "fresh"
            }
        except Exception as e:
            logger.exception(f"Error fetching schema for {database}")
            return {"error": str(e)}
    
    @staticmethod
    def _get_table_columns(user_id: str, table_name: str) -> Dict:
        """Get columns for a specific table."""
        from services.context_service import ContextService
        from database.operations import DatabaseOperations
        from database.session_utils import get_current_database
        
        if not table_name:
            return {"error": "Table name is required"}
        
        connection = ContextService.get_connection(user_id)
        if not connection.get('connected'):
            return {"error": "Not connected to any database"}
        
        database = connection.get('database')
        
        try:
            # Try cache first
            cached = ContextService.get_cached_schema(user_id, database)
            if cached and table_name in cached.get('columns', {}):
                return {
                    "table": table_name,
                    "columns": cached['columns'][table_name],
                    "source": "cache"
                }
            
            # Fetch fresh
            schema = DatabaseOperations.get_table_schema(table_name, database)
            columns = [
                {
                    "name": col.get('name', col.get('Field')),
                    "type": col.get('type', col.get('Type')),
                    "nullable": col.get('nullable', col.get('Null'))
                }
                for col in schema
            ]
            
            return {
                "table": table_name,
                "columns": columns,
                "source": "fresh"
            }
        except Exception as e:
            return {"error": f"Could not get columns for table {table_name}: {str(e)}"}
    
    @staticmethod
    def _execute_query(user_id: str, query: str, max_rows: int = 100, 
                       db_config: dict = None) -> Dict:
        """Execute a SQL query using provided db_config."""
        from services.context_service import ContextService
        
        if not query:
            return {"error": "Query is required"}
        
        connection = ContextService.get_connection(user_id)
        if not connection.get('connected'):
            return {"error": "Not connected to any database"}
        
        # Safety check: Only allow SELECT queries
        query_upper = query.strip().upper()
        if not query_upper.startswith('SELECT'):
            return {"error": "Only SELECT queries are allowed through this tool. For other queries, use the SQL editor."}
        
        try:
            # Use explicitly passed db_config (preferred) or fall back to session-based
            if db_config:
                logger.info("Executing query with explicit db_config")
                result = AIToolExecutor._execute_query_with_db_config(
                    db_config, connection, query, max_rows
                )
            else:
                # Try session-based execution (might fail outside request context)
                from flask import has_request_context
                if has_request_context():
                    from database.operations import execute_sql_query
                    result = execute_sql_query(query, max_rows=max_rows)
                else:
                    return {"error": "No database config available. Please re-connect to the database."}
            
            # Log query to history
            database = connection.get('database')
            row_count = result.get('row_count', 0)
            status = 'success' if result.get('status') == 'success' else 'error'
            ContextService.add_query(user_id, query, database, row_count, status)
            
            if result.get('status') == 'success':
                return {
                    "success": True,
                    "columns": result.get('columns', []),
                    "data": result.get('result', [])[:max_rows],
                    "row_count": result.get('row_count', 0),
                    "truncated": result.get('row_count', 0) > max_rows
                }
            else:
                return {"error": result.get('message', 'Query execution failed')}
                
        except Exception as e:
            logger.error(f"Error executing query: {e}")
            return {"error": str(e)}
    
    @staticmethod
    def _execute_query_with_db_config(db_config: Dict, connection: Dict, 
                                       query: str, max_rows: int) -> Dict:
        """Execute query using explicitly passed db_config."""
        from database.security import DatabaseSecurity
        from config import Config
        import time
        
        if not db_config:
            return {
                'status': 'error',
                'message': 'No database connection available. Please connect to a database first.'
            }
        
        db_type = db_config.get('db_type', 'postgresql')
        
        # Security check
        analysis = DatabaseSecurity.analyze_sql_query(query)
        if not analysis['is_safe']:
            return {
                'status': 'error',
                'message': f"Query blocked for security reasons: {', '.join(analysis['warnings'])}"
            }
        
        if analysis['query_type'] != 'SELECT':
            return {
                'status': 'error',
                'message': f'READ-ONLY MODE: Only SELECT queries are allowed. {analysis["query_type"]} is blocked.'
            }
        
        try:
            start_time = time.time()
            
            # Check for connection string (remote databases like Neon, Supabase)
            connection_string = db_config.get('connection_string')
            
            # Create connection based on db_type
            if db_type == 'postgresql':
                import psycopg2
                
                if connection_string:
                    # Remote connection using DSN/connection string
                    logger.info("Connecting to remote PostgreSQL using connection string")
                    conn = psycopg2.connect(connection_string)
                else:
                    # Local connection using individual parameters
                    conn = psycopg2.connect(
                        host=db_config.get('host'),
                        port=db_config.get('port', 5432),
                        database=db_config.get('database'),
                        user=db_config.get('user'),
                        password=db_config.get('password')
                    )
                
                # Set schema if specified
                schema = connection.get('schema', 'public')
                cursor = conn.cursor()
                cursor.execute(f"SET search_path TO {schema}")
                
            elif db_type == 'mysql':
                import mysql.connector
                conn = mysql.connector.connect(
                    host=db_config.get('host'),
                    port=db_config.get('port', 3306),
                    database=db_config.get('database'),
                    user=db_config.get('user'),
                    password=db_config.get('password')
                )
                cursor = conn.cursor()
            else:
                return {
                    'status': 'error',
                    'message': f'Unsupported database type: {db_type}'
                }
            
            # Execute the query
            cursor.execute(query)
            rows = cursor.fetchall()
            
            end_time = time.time()
            execution_time = round((end_time - start_time) * 1000, 2)
            
            # Get column names
            if db_type == 'postgresql':
                column_names = [desc[0] for desc in cursor.description] if cursor.description else []
            else:
                column_names = list(cursor.column_names) if hasattr(cursor, 'column_names') else []
            
            # Limit rows
            actual_max_rows = max_rows if max_rows else Config.MAX_QUERY_RESULTS
            row_count = len(rows)
            truncated = row_count > actual_max_rows
            if truncated:
                rows = rows[:actual_max_rows]
            
            # Convert rows to list of dicts
            result_data = []
            for row in rows:
                row_dict = {}
                for i, col in enumerate(column_names):
                    value = row[i]
                    # Handle non-serializable types
                    if value is None:
                        pass  # None is JSON serializable
                    elif hasattr(value, 'isoformat'):  # datetime, date
                        value = value.isoformat()
                    elif isinstance(value, bytes):
                        value = value.decode('utf-8', errors='replace')
                    else:
                        # Handle Decimal and other numeric types
                        try:
                            from decimal import Decimal
                            if isinstance(value, Decimal):
                                value = float(value)
                        except:
                            pass
                    row_dict[col] = value
                result_data.append(row_dict)
            
            cursor.close()
            conn.close()
            
            logger.info(f"AI tool executed query: {row_count} rows in {execution_time}ms")
            
            return {
                'status': 'success',
                'columns': column_names,
                'result': result_data,
                'row_count': row_count,
                'truncated': truncated,
                'execution_time_ms': execution_time
            }
            
        except Exception as e:
            logger.error(f"Error in context-aware query execution: {e}")
            return {
                'status': 'error',
                'message': str(e)
            }
    
    @staticmethod
    def _get_recent_queries(user_id: str, limit: int = 5) -> Dict:
        """Get recent query history."""
        from services.context_service import ContextService
        
        queries = ContextService.get_recent_queries(user_id, limit)
        
        return {
            "queries": queries,
            "count": len(queries)
        }
    
    @staticmethod
    def _get_sample_data(user_id: str, table_name: str, limit: int = 5) -> Dict:
        """Get sample data from a table."""
        if not table_name:
            return {"error": "Table name is required"}
        
        # Use execute_query with a SELECT * LIMIT query
        query = f"SELECT * FROM {table_name} LIMIT {limit}"
        return AIToolExecutor._execute_query(user_id, query, limit)


# =============================================================================
# TOOL DISPLAY MESSAGES (for UI feedback)
# =============================================================================

TOOL_DISPLAY_MESSAGES = {
    "get_connection_status": {
        "running": "Checking connection status",
        "done": "Connection check complete"
    },
    "get_database_list": {
        "running": "Fetching database list",
        "done": "Database list retrieved"
    },
    "get_database_schema": {
        "running": "Fetching database schema",
        "done": "Schema retrieved"
    },
    "get_table_columns": {
        "running": "Reading table structure",
        "done": "Table structure retrieved"
    },
    "execute_query": {
        "running": "Executing query",
        "done": "Query executed"
    },
    "get_recent_queries": {
        "running": "Loading query history",
        "done": "Query history loaded"
    },
    "get_sample_data": {
        "running": "Fetching sample data",
        "done": "Sample data retrieved"
    }
}


def get_tool_message(tool_name: str, status: str) -> str:
    """Get display message for a tool execution."""
    tool_messages = TOOL_DISPLAY_MESSAGES.get(tool_name, {})
    return tool_messages.get(status, tool_name)
