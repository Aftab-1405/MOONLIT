"""Optimized secure database operations and queries - READ-ONLY VERSION
Multi-user support: Uses session-based database configuration.
"""

import mysql.connector
from database.session_utils import get_db_cursor, get_current_database, is_database_selected
from database.security import DatabaseSecurity
import logging
import time
from typing import Dict, List, Tuple, Optional
from functools import lru_cache
from concurrent.futures import ThreadPoolExecutor
import threading
from config import Config

logger = logging.getLogger(__name__)

# Alias for backward compatibility
get_cursor = get_db_cursor


class DatabaseOperationError(Exception):
    """Specific exception type for database operation failures."""
    pass

class DatabaseOperations:
    """Optimized secure database operations class - READ-ONLY VERSION"""
    
    # Cache for database and table information
    _info_cache = {}
    _cache_lock = threading.Lock()
    
    @staticmethod
    def get_databases() -> Dict:
        """Fetch available databases - SECURE VERSION

        Multi-user safe: Uses session-based connection, no global caching.
        Note: Removed @lru_cache to support per-user database configurations.
        """
        try:
            with get_cursor() as cursor:
                cursor.execute("SHOW DATABASES")
                databases = [db[0] for db in cursor.fetchall()]

            # Filter out system databases for security
            system_dbs = {'information_schema', 'mysql', 'performance_schema', 'sys'}
            user_databases = [db for db in databases if db.lower() not in system_dbs]

            logger.info(f"Retrieved {len(user_databases)} user databases")
            return {'status': 'success', 'databases': user_databases}

        except mysql.connector.Error as err:
            logger.error(f"Database error in get_databases: {err}")
            return {'status': 'error', 'message': 'Failed to retrieve databases'}
        except Exception as err:
            logger.error(f"Unexpected error in get_databases: {err}")
            return {'status': 'error', 'message': 'Internal server error'}
    
    @staticmethod
    def get_tables(db_name: str) -> List[str]:
        """Optimized get all tables in a database - SECURE VERSION"""
        try:
            # Validate database name (cached)
            validated_db = DatabaseSecurity.validate_database_name(db_name)
            
            # Check cache first
            cache_key = f"tables_{validated_db}"
            with DatabaseOperations._cache_lock:
                if cache_key in DatabaseOperations._info_cache:
                    return DatabaseOperations._info_cache[cache_key]
            
            with get_cursor() as cursor:
                # Optimized query using information_schema
                cursor.execute(
                    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = %s AND TABLE_TYPE = 'BASE TABLE'", 
                    (validated_db,)
                )
                tables = [table[0] for table in cursor.fetchall()]
            
            # Cache the result
            with DatabaseOperations._cache_lock:
                DatabaseOperations._info_cache[cache_key] = tables
            
            logger.info(f"Retrieved {len(tables)} tables from database {validated_db}")
            return tables
            
        except ValueError as err:
            logger.warning(f"Validation error in get_tables: {err}")
            raise err
        except mysql.connector.Error as err:
            logger.error(f"Database error in get_tables: {err}")
            raise DatabaseOperationError("Failed to retrieve tables")
    
    @staticmethod
    def get_table_schema(table_name: str, db_name: str) -> List[Dict]:
        """Optimized get table schema - SECURE VERSION"""
        try:
            # Validate inputs (cached)
            validated_table = DatabaseSecurity.validate_table_name(table_name)
            validated_db = DatabaseSecurity.validate_database_name(db_name)
            
            # Check cache first
            cache_key = f"schema_{validated_db}_{validated_table}"
            with DatabaseOperations._cache_lock:
                if cache_key in DatabaseOperations._info_cache:
                    return DatabaseOperations._info_cache[cache_key]
            
            with get_cursor(dictionary=True) as cursor:
                # Optimized single query for schema
                query = """
                    SELECT COLUMN_NAME as name, DATA_TYPE as type, IS_NULLABLE as nullable, 
                           COLUMN_DEFAULT as default_value, COLUMN_KEY as key_type
                    FROM information_schema.COLUMNS 
                    WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
                    ORDER BY ORDINAL_POSITION
                """
                cursor.execute(query, (validated_db, validated_table))
                columns = cursor.fetchall()
            
            # Cache the result
            with DatabaseOperations._cache_lock:
                DatabaseOperations._info_cache[cache_key] = columns
            
            logger.info(f"Retrieved schema for table {validated_table}")
            return columns
            
        except ValueError as err:
            logger.warning(f"Validation error in get_table_schema: {err}")
            raise err
        except mysql.connector.Error as err:
            logger.error(f"Database error in get_table_schema: {err}")
            raise DatabaseOperationError("Failed to retrieve table schema")
    
    @staticmethod
    def get_table_row_count(table_name: str, db_name: str) -> int:
        """Optimized get table row count - SECURE VERSION"""
        try:
            validated_table = DatabaseSecurity.validate_table_name(table_name)
            validated_db = DatabaseSecurity.validate_database_name(db_name)
            
            with get_cursor() as cursor:
                # Use faster SHOW TABLE STATUS for approximate count
                cursor.execute(
                    "SELECT TABLE_ROWS FROM information_schema.TABLES WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s",
                    (validated_db, validated_table)
                )
                result = cursor.fetchone()
                
                return result[0] if result else 0
            
        except ValueError as err:
            logger.warning(f"Validation error in get_table_row_count: {err}")
            raise err
        except mysql.connector.Error as err:
            logger.error(f"Database error in get_table_row_count: {err}")
            raise DatabaseOperationError("Failed to retrieve row count")
    
    @staticmethod
    def clear_cache():
        """Clear all cached data"""
        with DatabaseOperations._cache_lock:
            DatabaseOperations._info_cache.clear()
        DatabaseOperations.get_databases.cache_clear()
        DatabaseSecurity.clear_cache()

def fetch_database_info(db_name: str) -> Tuple[Optional[str], Optional[str]]:
    """Optimized fetch detailed information about a database - SECURE VERSION (NO SAMPLE DATA)"""
    try:
        validated_db = DatabaseSecurity.validate_database_name(db_name)
        tables = DatabaseOperations.get_tables(validated_db)
        
        if not tables:
            return f"The database {validated_db} has no tables.", ""
        
        db_info = f"The database {validated_db} has been selected. It contains {len(tables)} tables:\n"
        detailed_info = ""
        
        # Use ThreadPoolExecutor for parallel processing of table info
        with ThreadPoolExecutor(max_workers=min(len(tables), 10)) as executor:
            # Submit all table processing tasks
            future_to_table = {
                executor.submit(_process_table_info, table, validated_db): table 
                for table in tables
            }
            
            # Collect results
            table_results = {}
            for future in future_to_table:
                table = future_to_table[future]
                try:
                    table_results[table] = future.result()
                except Exception as e:
                    logger.error(f"Error processing table {table}: {e}")
                    table_results[table] = None
        
        # Build output in original table order
        for table in tables:
            result = table_results.get(table)
            if result:
                db_info += f"Table {table}:\n"
                detailed_info += result
        
        return db_info, detailed_info
        
    except ValueError as err:
        logger.warning(f"Validation error in fetch_database_info: {err}")
        return None, str(err)
    except Exception as err:
        logger.error(f"Error in fetch_database_info: {err}")
        return None, str(err)

def _process_table_info(table: str, db_name: str) -> str:
    """Helper function to process individual table information - NO SAMPLE DATA"""
    try:
        schema = DatabaseOperations.get_table_schema(table, db_name)
        row_count = DatabaseOperations.get_table_row_count(table, db_name)
        
        result = f"Table {table}:\n"
        
        # Add schema info
        for column in schema:
            result += f"  {column['name']} {column['type']}\n"
        
        result += f"  count: {row_count}\n"
        
        return result
        
    except Exception as e:
        logger.error(f"Error processing table {table}: {e}")
        return f"Table {table}: Error retrieving information\n"

def execute_sql_query(sql_query: str) -> Dict:
    """Execute SQL query securely - READ-ONLY VERSION WITH TIMING"""
    try:
        # Check query length limit
        if len(sql_query) > Config.MAX_QUERY_LENGTH:
            logger.warning(f"Query too long: {len(sql_query)} characters (max: {Config.MAX_QUERY_LENGTH})")
            return {
                'status': 'error',
                'message': f'Query too long. Maximum allowed length is {Config.MAX_QUERY_LENGTH} characters.'
            }

        # Analyze query for security issues (with caching)
        analysis = DatabaseSecurity.analyze_sql_query(sql_query)

        if not analysis['is_safe']:
            logger.warning(f"Unsafe query blocked: {analysis['warnings']}")
            return {
                'status': 'error',
                'message': f"Query blocked for security reasons: {', '.join(analysis['warnings'])}"
            }

        # ONLY ALLOW SELECT QUERIES - NO DML OPERATIONS
        if analysis['query_type'] != 'SELECT':
            logger.warning(f"Non-SELECT query blocked: {analysis['query_type']}")
            return {
                'status': 'error',
                'message': f'⚠️ READ-ONLY MODE: Only SELECT queries are allowed. {analysis["query_type"]} operations are blocked for security. This system is designed for data exploration and analysis only.',
                'query_type_blocked': analysis['query_type']
            }

        # Execute query with timing and timeout
        start_time = time.time()

        with get_cursor(buffered=True) as cursor:
            # Set query timeout
            cursor.execute(f"SET SESSION MAX_EXECUTION_TIME={Config.QUERY_TIMEOUT_SECONDS * 1000}")
            cursor.execute(sql_query)
            
            # Only SELECT queries reach this point
            rows = cursor.fetchall()

            end_time = time.time()
            execution_time = round((end_time - start_time) * 1000, 2)  # Convert to milliseconds

            # Check result size limit
            row_count = len(rows)
            truncated = False
            if row_count > Config.MAX_QUERY_RESULTS:
                logger.warning(f"Query returned {row_count} rows, truncating to {Config.MAX_QUERY_RESULTS}")
                rows = rows[:Config.MAX_QUERY_RESULTS]
                truncated = True

            result = {
                'fields': cursor.column_names,
                'rows': rows
            }

            message = f'Query executed successfully in {execution_time}ms. '
            if truncated:
                message += f'Results truncated to {Config.MAX_QUERY_RESULTS} rows (total: {row_count} rows). '
            else:
                message += f'Data retrieved ({row_count} rows). '

            logger.info(f"SELECT query executed successfully in {execution_time}ms, returned {row_count} rows{' (truncated)' if truncated else ''}")
            return {
                'status': 'success',
                'result': result,
                'message': message,
                'row_count': len(rows),
                'total_rows': row_count,
                'truncated': truncated,
                'execution_time_ms': execution_time,
                'query_type': 'SELECT'
            }
            
    except ValueError as err:
        logger.warning(f"Query validation error: {err}")
        return {'status': 'error', 'message': str(err)}
    except mysql.connector.Error as err:
        logger.error(f"Database error: {err}")
        return {'status': 'error', 'message': f'Database error: {str(err)}'}
    except Exception as err:
        logger.error(f"Unexpected error in execute_sql_query: {err}")
        return {'status': 'error', 'message': 'Internal server error'}

# Legacy functions for backward compatibility
def get_databases():
    """Legacy function - redirects to optimized secure version"""
    return DatabaseOperations.get_databases()