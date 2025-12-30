"""
Connection Handlers - Pure FastAPI Version

Database connection handlers that return dicts (not Flask responses).
All methods accept db_config explicitly - no Flask dependencies.
"""

import re
import logging
from typing import Dict

logger = logging.getLogger(__name__)


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _clear_cache():
    """Clear any cached database metadata."""
    try:
        from database.operations import DatabaseOperations
        DatabaseOperations.clear_cache()
    except Exception:
        logger.debug('Failed to clear DatabaseOperations cache')


def _parse_connection_string(connection_string: str) -> Dict[str, str]:
    """Parse connection string to extract database name and host."""
    db_match = re.search(r'/([^/?]+)(\?|$)', connection_string)
    host_match = re.search(r'@([^/:]+)', connection_string)
    
    return {
        'database': db_match.group(1) if db_match else 'remote_db',
        'host': host_match.group(1) if host_match else 'remote'
    }


def _sync_context(user_id: str, db_type: str, database: str, host: str, is_remote: bool, schema: str = 'public'):
    """Sync connection state to Firestore for AI context."""
    if not user_id:
        return
    try:
        from services.context_service import ContextService
        ContextService.set_connection(user_id, db_type, database, host, is_remote, schema)
        logger.info(f"Synced context for user {user_id}: {db_type}/{database}")
    except Exception as e:
        logger.warning(f"Failed to sync context: {e}")


def _cache_schema(user_id: str, db_config: dict, database: str, tables: list, db_type: str):
    """Cache schema in Firestore for AI context."""
    if not user_id:
        return
    try:
        from services.context_service import ContextService
        from database.connection_manager import get_connection_manager
        from database.adapters import get_adapter
        
        adapter = get_adapter(db_type)
        manager = get_connection_manager()
        
        columns = {}
        with manager.get_cursor(db_config) as cursor:
            for table in tables[:20]:
                try:
                    cols_query, cols_params = adapter.get_columns_for_table_cache(database, table)
                    cursor.execute(cols_query, cols_params)
                    columns[table] = [row[0] for row in cursor.fetchall()]
                except Exception:
                    columns[table] = []
        
        ContextService.cache_schema(user_id, database, tables, columns)
        logger.info(f"Cached schema for {database}: {len(tables)} tables")
    except Exception as e:
        logger.warning(f"Failed to cache schema: {e}")


# =============================================================================
# CONNECTION FUNCTIONS - Return dicts, not Flask responses
# =============================================================================

def connect_local_sqlite(file_path: str, user_id: str = None) -> dict:
    """Connect to a local SQLite database file."""
    from database.operations import DatabaseOperations
    from database.adapters import get_adapter
    from database.connection_manager import get_connection_manager
    
    if not file_path:
        return {'status': 'error', 'message': 'Database file path required'}
    
    _clear_cache()
    
    db_config = {
        'db_type': 'sqlite',
        'database': file_path
    }
    
    try:
        manager = get_connection_manager()
        conn = manager.get_connection(db_config)
        adapter = get_adapter('sqlite')
        
        if adapter.validate_connection(conn):
            dbs_result = DatabaseOperations.get_databases(db_config)
            _sync_context(user_id, 'sqlite', file_path, 'local', False)
            
            logger.info(f"Connected to SQLite: {file_path}")
            return {
                'status': 'connected',
                'message': 'Connected to SQLite database',
                'schemas': dbs_result.get('databases', []),
                'db_type': 'sqlite',
                'db_config': db_config
            }
        return {'status': 'error', 'message': 'Failed to connect to SQLite'}
    except Exception as err:
        logger.exception('Error connecting to SQLite')
        return {'status': 'error', 'message': str(err)}


def connect_local_mysql(host: str, port: int, user: str, password: str, 
                        database: str = None, user_id: str = None) -> dict:
    """Connect to a local MySQL server."""
    from database.operations import DatabaseOperations
    from database.adapters import get_adapter
    from database.connection_manager import get_connection_manager
    
    _clear_cache()
    
    db_config = {
        'db_type': 'mysql',
        'host': host or 'localhost',
        'port': int(port) if port else 3306,
        'user': user,
        'password': password
    }
    if database:
        db_config['database'] = database
    
    try:
        manager = get_connection_manager()
        conn = manager.get_connection(db_config)
        adapter = get_adapter('mysql')
        
        if adapter.validate_connection(conn):
            dbs_result = DatabaseOperations.get_databases(db_config)
            
            if dbs_result.get('status') == 'success':
                _sync_context(user_id, 'mysql', database or 'mysql', host, False)
                
                logger.info(f"Connected to MySQL: {host}:{port}")
                return {
                    'status': 'connected',
                    'message': f'Connected to MySQL at {host}:{port}',
                    'schemas': dbs_result['databases'],
                    'db_type': 'mysql',
                    'db_config': db_config
                }
            
            return {
                'status': 'connected',
                'message': 'Connected, but failed to fetch databases',
                'schemas': [],
                'db_type': 'mysql',
                'db_config': db_config
            }
        return {'status': 'error', 'message': 'Failed to connect to MySQL'}
    except Exception as err:
        logger.exception('Error connecting to MySQL')
        return {'status': 'error', 'message': str(err)}


def connect_local_postgresql(host: str, port: int, user: str, password: str,
                             database: str = None, user_id: str = None) -> dict:
    """Connect to a local PostgreSQL server."""
    from database.operations import DatabaseOperations
    from database.adapters import get_adapter
    from database.connection_manager import get_connection_manager
    
    _clear_cache()
    
    db_config = {
        'db_type': 'postgresql',
        'host': host or 'localhost',
        'port': int(port) if port else 5432,
        'user': user,
        'password': password
    }
    if database:
        db_config['database'] = database
    
    try:
        manager = get_connection_manager()
        conn = manager.get_connection(db_config)
        adapter = get_adapter('postgresql')
        
        if adapter.validate_connection(conn):
            dbs_result = DatabaseOperations.get_databases(db_config)
            
            if dbs_result.get('status') == 'success':
                _sync_context(user_id, 'postgresql', database or 'postgres', host, False)
                
                logger.info(f"Connected to PostgreSQL: {host}:{port}")
                return {
                    'status': 'connected',
                    'message': f'Connected to PostgreSQL at {host}:{port}',
                    'schemas': dbs_result['databases'],
                    'db_type': 'postgresql',
                    'db_config': db_config
                }
            
            return {
                'status': 'connected',
                'message': 'Connected, but failed to fetch databases',
                'schemas': [],
                'db_type': 'postgresql',
                'db_config': db_config
            }
        return {'status': 'error', 'message': 'Failed to connect to PostgreSQL'}
    except Exception as err:
        logger.exception('Error connecting to PostgreSQL')
        return {'status': 'error', 'message': str(err)}


def connect_remote_postgresql(connection_string: str, user_id: str = None) -> dict:
    """Connect to a remote PostgreSQL database using connection string."""
    from database.adapters import get_adapter
    from database.connection_manager import get_connection_manager
    
    _clear_cache()
    
    parsed = _parse_connection_string(connection_string)
    db_name = parsed['database']
    host = parsed['host']
    
    db_config = {
        'db_type': 'postgresql',
        'connection_string': connection_string,
        'database': db_name,
        'is_remote': True
    }
    
    try:
        manager = get_connection_manager()
        conn = manager.get_connection(db_config)
        adapter = get_adapter('postgresql')
        
        if adapter.validate_connection(conn):
            logger.info(f"Connected to remote PostgreSQL: {db_name} at {host}")
            
            # Get databases
            all_databases = []
            try:
                with manager.get_cursor(db_config) as cursor:
                    cursor.execute(adapter.get_databases_for_remote())
                    all_databases = [row[0] for row in cursor.fetchall()]
            except Exception:
                all_databases = [db_name]
            
            # Get tables
            tables = []
            try:
                with manager.get_cursor(db_config) as cursor:
                    query, params = adapter.get_all_tables_for_cache(db_name, 'public')
                    cursor.execute(query, params)
                    tables = [row[0] for row in cursor.fetchall()]
            except Exception as e:
                logger.warning(f"Failed to fetch tables: {e}")
            
            _sync_context(user_id, 'postgresql', db_name, host, True)
            _cache_schema(user_id, db_config, db_name, tables, 'postgresql')
            
            message = f'Connected to remote PostgreSQL: {db_name}'
            if tables:
                message += f' ({len(tables)} tables)'
            
            return {
                'status': 'connected',
                'message': message,
                'schemas': all_databases,
                'selectedDatabase': db_name,
                'is_remote': True,
                'tables': tables,
                'db_type': 'postgresql',
                'db_config': db_config
            }
        return {'status': 'error', 'message': 'Failed to connect to remote PostgreSQL'}
    except Exception as err:
        logger.exception('Error connecting to remote PostgreSQL')
        return {'status': 'error', 'message': str(err)}


def connect_remote_mysql(connection_string: str, user_id: str = None) -> dict:
    """Connect to a remote MySQL database using connection string."""
    from database.adapters import get_adapter
    from database.connection_manager import get_connection_manager
    
    _clear_cache()
    
    parsed = _parse_connection_string(connection_string)
    db_name = parsed['database']
    host = parsed['host']
    
    db_config = {
        'db_type': 'mysql',
        'connection_string': connection_string,
        'database': db_name,
        'is_remote': True
    }
    
    try:
        manager = get_connection_manager()
        conn = manager.get_connection(db_config)
        adapter = get_adapter('mysql')
        
        if adapter.validate_connection(conn):
            logger.info(f"Connected to remote MySQL: {db_name} at {host}")
            
            # Get databases
            all_databases = []
            try:
                with manager.get_cursor(db_config) as cursor:
                    cursor.execute(adapter.get_databases_query())
                    all_databases = [row[0] for row in cursor.fetchall()]
                    system_dbs = adapter.get_system_databases()
                    all_databases = [db for db in all_databases if db.lower() not in system_dbs]
            except Exception:
                all_databases = [db_name]
            
            # Get tables
            tables = []
            try:
                with manager.get_cursor(db_config) as cursor:
                    cursor.execute(f"""
                        SELECT TABLE_NAME FROM information_schema.TABLES 
                        WHERE TABLE_SCHEMA = '{db_name}' AND TABLE_TYPE = 'BASE TABLE'
                        ORDER BY TABLE_NAME
                    """)
                    tables = [row[0] for row in cursor.fetchall()]
            except Exception as e:
                logger.warning(f"Failed to fetch tables: {e}")
            
            _sync_context(user_id, 'mysql', db_name, host, True)
            _cache_schema(user_id, db_config, db_name, tables, 'mysql')
            
            message = f'Connected to remote MySQL: {db_name}'
            if tables:
                message += f' ({len(tables)} tables)'
            
            return {
                'status': 'connected',
                'message': message,
                'schemas': all_databases,
                'selectedDatabase': db_name,
                'is_remote': True,
                'tables': tables,
                'db_type': 'mysql',
                'db_config': db_config
            }
        return {'status': 'error', 'message': 'Failed to connect to remote MySQL'}
    except Exception as err:
        logger.exception('Error connecting to remote MySQL')
        return {'status': 'error', 'message': str(err)}


def select_database(db_config: dict, db_name: str, user_id: str = None) -> dict:
    """
    Select a database on an existing connection.
    
    Args:
        db_config: Current database configuration
        db_name: Name of database to select
        user_id: User ID for context tracking
        
    Returns:
        Dict with status and updated db_config
    """
    from database.operations import fetch_database_info, DatabaseOperations
    
    if not db_name:
        return {'status': 'error', 'message': 'Database name required'}
    
    if not db_config:
        return {'status': 'error', 'message': 'No database connected'}
    
    # Create new config with selected database
    new_config = db_config.copy()
    new_config['database'] = db_name
    
    try:
        db_info, detailed_info = fetch_database_info(new_config, db_name)
        
        db_type = db_config.get('db_type', 'mysql')
        host = db_config.get('host', 'local')
        _sync_context(user_id, db_type, db_name, host, False)
        
        tables = DatabaseOperations.get_tables(new_config, db_name)
        if tables:
            _cache_schema(user_id, new_config, db_name, tables, db_type)
        
        logger.info(f"Selected database: {db_name}")
        return {
            'status': 'connected',
            'message': f'Connected to database {db_name}',
            'db_config': new_config
        }
    except Exception as err:
        logger.exception(f'Error selecting database {db_name}')
        return {'status': 'error', 'message': str(err)}
