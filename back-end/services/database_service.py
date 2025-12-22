"""
Database Service

High-level database operations with AI context integration.
Centralizes all database business logic that involves AI notification.
"""

import re
import time
import logging
from typing import Dict, Optional, List
from flask import session

logger = logging.getLogger(__name__)


class DatabaseService:
    """Service for database operations with AI integration."""
    
    @staticmethod
    def switch_remote_database(new_db_name: str, conversation_id: str = None) -> dict:
        """
        Switch to different database on remote server.
        
        Args:
            new_db_name: Name of database to switch to
            conversation_id: Optional conversation ID (deprecated)
            
        Returns:
            Dict with status, message, tables, selectedDatabase
        """
        from database.session_utils import (
            get_db_config_from_session, 
            set_connection_string_in_session, 
            get_db_cursor,
            get_db_connection
        )
        from database.operations import DatabaseOperations
        from database.adapters import get_adapter
        
        # Validate request
        if not new_db_name:
            return {'status': 'error', 'message': 'Database name is required'}
        
        # Get current config from session
        config = get_db_config_from_session()
        if not config:
            return {'status': 'error', 'message': 'No database connected'}
        
        connection_string = config.get('connection_string')
        if not connection_string:
            return {'status': 'error', 'message': 'This feature is only for connection string based connections'}
        
        # Modify connection string to use new database
        # Pattern: postgresql://user:pass@host/OLD_DB?params -> postgresql://user:pass@host/NEW_DB?params
        new_connection_string = re.sub(
            r'(/[^/?]+)(\?|$)',  # Match /database_name followed by ? or end
            f'/{new_db_name}\\2',  # Replace with /new_database_name
            connection_string
        )
        
        # Clear old connection pool
        DatabaseService._clear_connection_cache()
        
        # Store new connection string in session
        set_connection_string_in_session(new_connection_string, 'postgresql', new_db_name)
        
        # Test new connection and get schema info
        try:
            conn = get_db_connection()
            adapter = get_adapter('postgresql')
            
            if adapter.validate_connection(conn):
                tables = DatabaseService._fetch_and_notify_schema(
                    get_db_cursor, 
                    new_db_name, 
                    conversation_id, 
                    action="Switched"
                )
                
                # Update context in Firestore for AI
                user_id = session.get('user')
                if user_id:
                    try:
                        from services.context_service import ContextService
                        # Get host from config
                        host = config.get('host', 'remote')
                        ContextService.set_connection(user_id, 'postgresql', new_db_name, host, True)
                        logger.debug(f"Updated context for database switch to {new_db_name}")
                    except Exception as e:
                        logger.warning(f"Failed to update context on database switch: {e}")
                
                logger.info(f"User switched to database: {new_db_name}")
                return {
                    'status': 'connected',
                    'message': f'Switched to database: {new_db_name}',
                    'selectedDatabase': new_db_name,
                    'tables': tables
                }
            
            return {'status': 'error', 'message': 'Failed to connect to the new database'}
        except Exception as err:
            logger.exception('Error switching remote database')
            return {'status': 'error', 'message': str(err)}
    
    @staticmethod
    def select_schema_with_notification(schema_name: str, conversation_id: str = None) -> dict:
        """
        Select PostgreSQL schema + update AI context.
        
        Args:
            schema_name: Name of schema to select
            conversation_id: Optional conversation ID (deprecated)
            
        Returns:
            Dict with status, schema, tables, message
        """
        from database.session_utils import (
            get_db_config_from_session, 
            set_schema_in_session, 
            get_db_cursor
        )
        from database.adapters import get_adapter
        
        if not schema_name:
            return {'status': 'error', 'message': 'Schema name is required'}
        
        config = get_db_config_from_session()
        if not config:
            return {'status': 'error', 'message': 'No database connected'}
        
        db_type = config.get('db_type', 'mysql')
        if db_type != 'postgresql':
            return {'status': 'error', 'message': 'Schema selection is only available for PostgreSQL'}
        
        # Update session with selected schema
        set_schema_in_session(schema_name)
        
        # Get tables in the selected schema
        adapter = get_adapter(db_type)
        tables = []
        try:
            with get_db_cursor() as cursor:
                cursor.execute(adapter.get_tables_query(schema_name))
                tables = [row[0] for row in cursor.fetchall()]
        except Exception as err:
            logger.error(f"Error fetching tables for schema {schema_name}: {err}")
        
        # Update context in Firestore for AI
        user_id = session.get('user')
        if user_id:
            try:
                from services.context_service import ContextService
                ContextService.update_schema(user_id, schema_name)
            except Exception as e:
                logger.warning(f"Failed to update schema context: {e}")
        
        logger.info(f"User selected schema: {schema_name} with {len(tables)} tables")
        
        return {
            'status': 'success',
            'message': f'Selected schema: {schema_name}',
            'schema': schema_name,
            'tables': tables
        }
    
    @staticmethod
    def get_schemas() -> dict:
        """
        Get all schemas in the currently connected PostgreSQL database.
        
        Returns:
            Dict with status, schemas list, and current_schema
        """
        from database.session_utils import get_db_config_from_session, get_db_cursor
        from database.adapters import get_adapter
        
        config = get_db_config_from_session()
        if not config:
            return {'status': 'error', 'message': 'No database connected'}
        
        db_type = config.get('db_type', 'mysql')
        if db_type != 'postgresql':
            return {'status': 'error', 'message': 'Schema selection is only available for PostgreSQL'}
        
        adapter = get_adapter(db_type)
        
        schemas = []
        with get_db_cursor() as cursor:
            cursor.execute(adapter.get_schemas_query())
            schemas = [row[0] for row in cursor.fetchall()]
        
        return {
            'status': 'success', 
            'schemas': schemas,
            'current_schema': config.get('schema', 'public')
        }
    
    @staticmethod
    def get_tables() -> dict:
        """
        Get all tables in the currently selected database/schema.
        
        Returns:
            Dict with status, tables, database, schema
        """
        from database.operations import DatabaseOperations
        from database.session_utils import get_db_config_from_session, get_current_database
        
        db_name = get_current_database()
        if not db_name:
            return {'status': 'error', 'message': 'No database selected'}
        
        config = get_db_config_from_session()
        schema = config.get('schema', 'public') if config else 'public'
        
        tables = DatabaseOperations.get_tables(db_name, schema=schema)
        return {'status': 'success', 'tables': tables, 'database': db_name, 'schema': schema}
    
    @staticmethod
    def get_table_info_with_schema(table_name: str) -> dict:
        """
        Get table schema + row count.
        
        Args:
            table_name: Name of table to get info for
            
        Returns:
            Dict with status, table_name, schema, row_count
        """
        from database.operations import DatabaseOperations
        from database.session_utils import get_current_database
        
        if not table_name:
            return {'status': 'error', 'message': 'Table name is required'}
        
        db_name = get_current_database()
        if not db_name:
            return {'status': 'error', 'message': 'No database selected'}
        
        schema = DatabaseOperations.get_table_schema(table_name, db_name)
        row_count = DatabaseOperations.get_table_row_count(table_name, db_name)
        
        return {
            'status': 'success',
            'table_name': table_name,
            'schema': schema,
            'row_count': row_count
        }
    
    @staticmethod
    def disconnect_database() -> dict:
        """
        Close connection pool + clear session + clear Firestore context.
        
        Returns:
            Dict with status and message
        """
        from database.session_utils import clear_db_config_from_session, close_user_pool
        from database.operations import DatabaseOperations
        
        try:
            # Close this user's connection pool
            closed = close_user_pool()
            
            # Clear database config from session
            clear_db_config_from_session()
            
            # Clear any cached DB metadata
            try:
                DatabaseOperations.clear_cache()
            except Exception:
                logger.debug('Failed to clear DatabaseOperations cache after disconnect')
            
            # Clear Firestore context for AI
            user_id = session.get('user')
            if user_id:
                try:
                    from services.context_service import ContextService
                    ContextService.clear_connection(user_id)
                except Exception as e:
                    logger.warning(f"Failed to clear context on disconnect: {e}")
            
            logger.info(f"User disconnected from database (pool closed: {closed})")
            return {'status': 'success', 'message': 'Disconnected from database server.'}
        except Exception as e:
            logger.exception('Error disconnecting DB')
            return {'status': 'error', 'message': str(e)}
    
    @staticmethod
    def execute_query_with_notification(sql_query: str, conversation_id: str = None, 
                                         max_rows: int = 1000, timeout: int = 30) -> dict:
        """
        Execute SQL query + log to context for AI.
        
        Args:
            sql_query: SQL query to execute
            conversation_id: Optional conversation ID (deprecated, context uses user_id)
            max_rows: Maximum rows to return
            timeout: Query timeout in seconds
            
        Returns:
            Query result dict
        """
        from database.operations import execute_sql_query
        from database.session_utils import get_current_database
        
        result = execute_sql_query(sql_query, max_rows=max_rows, timeout_seconds=timeout)
        
        # Log query to Firestore context for AI
        db_name = get_current_database()
        user_id = session.get('user')
        
        if user_id:
            try:
                from services.context_service import ContextService
                row_count = result.get('row_count', result.get('affected_rows', 0))
                status = 'success' if result['status'] == 'success' else 'error'
                ContextService.add_query(user_id, sql_query, db_name, row_count, status)
            except Exception as e:
                logger.warning(f"Failed to log query to context: {e}")
        
        return result
    
    @staticmethod
    def get_databases_with_remote_flag() -> dict:
        """
        Get list of databases with is_remote flag.
        
        Returns:
            Dict with status, databases list, and is_remote flag
        """
        from database.operations import DatabaseOperations
        from database.session_utils import is_remote_connection
        
        result = DatabaseOperations.get_databases()
        
        # Add is_remote flag for frontend
        if is_remote_connection():
            result['is_remote'] = True
        
        return result
    
    @staticmethod
    def _clear_connection_cache():
        """Clear connection pools and caches."""
        from database.operations import DatabaseOperations
        from database.session_utils import close_user_pool
        
        try:
            DatabaseOperations.clear_cache()
            close_user_pool()
        except Exception:
            pass
    
    @staticmethod
    def _fetch_and_notify_schema(get_db_cursor, db_name: str, conversation_id: str = None, action: str = "Connected") -> List[str]:
        """
        Fetch schema info and cache to Firestore for AI.
        
        Args:
            get_db_cursor: Context manager for getting cursor
            db_name: Database name
            conversation_id: Deprecated, uses user_id from session
            action: Action description for logging
            
        Returns:
            List of table names
        """
        tables = []
        columns = {}
        
        try:
            with get_db_cursor() as cursor:
                cursor.execute("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                    ORDER BY table_name
                """)
                tables = [row[0] for row in cursor.fetchall()]
                
                # Fetch columns for each table (limit to 20 for performance)
                for table in tables[:20]:
                    try:
                        cursor.execute("""
                            SELECT column_name
                            FROM information_schema.columns
                            WHERE table_schema = 'public' AND table_name = %s
                            ORDER BY ordinal_position
                        """, (table,))
                        columns[table] = [row[0] for row in cursor.fetchall()]
                    except Exception:
                        columns[table] = []
                        
        except Exception as schema_err:
            logger.warning(f"Failed to fetch schema: {schema_err}")
        
        # Cache schema to Firestore for AI context
        user_id = session.get('user')
        if user_id and tables:
            try:
                from services.context_service import ContextService
                ContextService.set_connection(user_id, 'postgresql', db_name, 'remote', True)
                ContextService.cache_schema(user_id, db_name, tables, columns)
                logger.info(f"{action} - Cached schema for {db_name}: {len(tables)} tables")
            except Exception as e:
                logger.warning(f"Failed to cache schema context: {e}")
        
        return tables
