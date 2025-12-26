"""
Database Connection Handlers

Cleanly separated handlers for different database connection scenarios.

ORGANIZATION:
- LOCAL CONNECTIONS: Direct connections to databases on user's local machine
  - _connect_local_sqlite()
  - _connect_local_mysql()
  - _connect_local_postgresql()

- REMOTE CONNECTIONS: Connection string-based connections to cloud providers
  - _connect_remote_postgresql() - Neon, Supabase, Railway, Render, etc.
  - _connect_remote_mysql() - PlanetScale, TiDB Cloud, Aiven, etc.

- DATABASE SELECTION: Selecting a database on an existing connection
  - _handle_db_selection()
"""

import re
import logging
from typing import Dict, Any, Optional, List
from flask import session, jsonify
from collections import defaultdict

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


def _sync_connection_context(db_type: str, database: str, host: str, is_remote: bool, schema: str = 'public'):
    """
    Sync connection state to Firestore for AI context.
    
    This is called after successful connection to update the AI's knowledge
    of the user's current database state.
    """
    try:
        user_id = session.get('user')
        if not user_id:
            logger.debug('No user_id in session, skipping context sync')
            return
        
        from services.context_service import ContextService
        ContextService.set_connection(user_id, db_type, database, host, is_remote, schema)
        logger.info(f"Synced connection context for user {user_id}: {db_type}/{database}")
    except Exception as e:
        logger.warning(f"Failed to sync connection context: {e}")


def _cache_schema_context(database: str, tables: list, db_type: str):
    """
    Cache schema in Firestore for AI context.
    
    This is called after fetching schema to cache it for AI tools.
    """
    try:
        user_id = session.get('user')
        if not user_id:
            return
        
        from services.context_service import ContextService
        from database.operations import DatabaseOperations
        
        # Get columns for each table
        columns = {}
        for table in tables[:20]:  # Limit to 20 tables to avoid timeout
            try:
                table_schema = DatabaseOperations.get_table_schema(table, database)
                columns[table] = [col.get('name', col.get('Field', str(col))) for col in table_schema]
            except Exception:
                columns[table] = []
        
        ContextService.cache_schema(user_id, database, tables, columns)
        logger.info(f"Cached schema for user {user_id}: {database} ({len(tables)} tables)")
    except Exception as e:
        logger.warning(f"Failed to cache schema context: {e}")


def _parse_connection_string(connection_string: str) -> Dict[str, str]:
    """Parse connection string to extract database name and host."""
    db_match = re.search(r'/([^/?]+)(\?|$)', connection_string)
    host_match = re.search(r'@([^/:]+)', connection_string)
    
    return {
        'database': db_match.group(1) if db_match else 'remote_db',
        'host': host_match.group(1) if host_match else 'remote'
    }


def _fetch_remote_schema_info(adapter, db_name: str, schema: str = 'public') -> tuple:
    """Fetch schema information for remote database and build AI notification."""
    from database.session_utils import get_db_cursor
    
    tables = []
    schema_info = ""
    
    try:
        schema_queries = adapter.get_schema_info_for_ai(schema)
        
        with get_db_cursor() as cursor:
            # Get all tables
            cursor.execute(schema_queries['tables'])
            tables = [row[0] for row in cursor.fetchall()]
            
            if tables:
                schema_info = f"Connected to database: {db_name}\n\n"
                schema_info += f"Database contains {len(tables)} tables in '{schema}' schema:\n\n"
                
                # Get all columns
                cursor.execute(schema_queries['columns'])
                columns_data = cursor.fetchall()
                
                # Group columns by table
                table_columns = defaultdict(list)
                for table_name, col_name, col_type in columns_data:
                    table_columns[table_name].append((col_name, col_type))
                
                for table in tables:
                    schema_info += f"Table: {table}\n"
                    for col_name, col_type in table_columns.get(table, []):
                        schema_info += f"  - {col_name}: {col_type}\n"
                    schema_info += "\n"
            else:
                schema_info = f"Connected to database: {db_name}. No tables found in {schema} schema."
                
    except Exception as err:
        logger.warning(f"Failed to fetch schema: {err}")
        
    return tables, schema_info





# =============================================================================
# LOCAL CONNECTIONS
# =============================================================================

def _connect_local_sqlite(file_path: str):
    """
    Connect to a local SQLite database file.
    
    Args:
        file_path: Path to the SQLite database file
        
    Returns:
        JSON response with connection status
    """
    from database.session_utils import set_db_config_in_session, get_db_connection, clear_db_config_from_session
    from database.operations import DatabaseOperations
    from database.adapters import get_adapter
    
    if not file_path:
        return jsonify({'status': 'error', 'message': 'Database file path is required for SQLite connection.'})
    
    _clear_cache()
    
    # Store config in session
    set_db_config_in_session('', 0, '', '', database=file_path, db_type='sqlite')
    
    try:
        conn = get_db_connection()
        adapter = get_adapter('sqlite')
        
        if adapter.validate_connection(conn):
            dbs_result = DatabaseOperations.get_databases()
            
            # Sync context to Firestore for AI
            _sync_connection_context('sqlite', file_path, 'local', False)
            
            logger.info(f"User connected to SQLite database at {file_path}")
            return jsonify({
                'status': 'connected',
                'message': 'Connected to SQLite database',
                'schemas': dbs_result.get('databases', []),
                'db_type': 'sqlite'
            })
        return jsonify({'status': 'error', 'message': 'Failed to connect to SQLite database.'})
    except Exception as err:
        logger.exception('Error connecting to SQLite')
        clear_db_config_from_session()
        return jsonify({'status': 'error', 'message': str(err)})


def _connect_local_mysql(host: str, port: int, user: str, password: str, database: str = None):
    """
    Connect to a local MySQL server.
    
    Args:
        host: MySQL server host (e.g., 'localhost')
        port: MySQL server port (e.g., 3306)
        user: MySQL username
        password: MySQL password
        database: Optional database name to select
        
    Returns:
        JSON response with connection status and available databases
    """
    from database.session_utils import set_db_config_in_session, get_db_connection, clear_db_config_from_session
    from database.operations import DatabaseOperations
    from database.adapters import get_adapter
    
    _clear_cache()
    
    # Store config in session
    set_db_config_in_session(host, int(port), user, password, database=database, db_type='mysql')
    
    try:
        conn = get_db_connection()
        adapter = get_adapter('mysql')
        
        if adapter.validate_connection(conn):
            dbs_result = DatabaseOperations.get_databases()
            
            if dbs_result.get('status') == 'success':
                # Sync context to Firestore for AI
                _sync_connection_context('mysql', database or 'mysql', host, False)
                
                logger.info(f"User connected to MySQL server {host}:{port} with {len(dbs_result.get('databases', []))} databases")
                return jsonify({
                    'status': 'connected',
                    'message': f'Connected to MySQL server at {host}:{port}',
                    'schemas': dbs_result['databases'],
                    'db_type': 'mysql'
                })
            
            # Sync context even if database list failed
            _sync_connection_context('mysql', database or 'mysql', host, False)
            return jsonify({
                'status': 'connected',
                'message': 'Connected, but failed to fetch databases',
                'schemas': [],
                'db_type': 'mysql'
            })
        return jsonify({'status': 'error', 'message': 'Failed to connect to MySQL server.'})
    except Exception as err:
        logger.exception('Error connecting to local MySQL')
        clear_db_config_from_session()
        return jsonify({'status': 'error', 'message': str(err)})


def _connect_local_postgresql(host: str, port: int, user: str, password: str, database: str = None):
    """
    Connect to a local PostgreSQL server.
    
    Args:
        host: PostgreSQL server host (e.g., 'localhost')
        port: PostgreSQL server port (e.g., 5432)
        user: PostgreSQL username
        password: PostgreSQL password
        database: Optional database name to select
        
    Returns:
        JSON response with connection status and available databases
    """
    from database.session_utils import set_db_config_in_session, get_db_connection, clear_db_config_from_session
    from database.operations import DatabaseOperations
    from database.adapters import get_adapter
    
    _clear_cache()
    
    # Store config in session
    set_db_config_in_session(host, int(port), user, password, database=database, db_type='postgresql')
    
    try:
        conn = get_db_connection()
        adapter = get_adapter('postgresql')
        
        if adapter.validate_connection(conn):
            dbs_result = DatabaseOperations.get_databases()
            
            if dbs_result.get('status') == 'success':
                # Sync context to Firestore for AI
                _sync_connection_context('postgresql', database or 'postgres', host, False)
                
                logger.info(f"User connected to PostgreSQL server {host}:{port} with {len(dbs_result.get('databases', []))} databases")
                return jsonify({
                    'status': 'connected',
                    'message': f'Connected to PostgreSQL server at {host}:{port}',
                    'schemas': dbs_result['databases'],
                    'db_type': 'postgresql'
                })
            
            # Sync context even if database list failed
            _sync_connection_context('postgresql', database or 'postgres', host, False)
            return jsonify({
                'status': 'connected',
                'message': 'Connected, but failed to fetch databases',
                'schemas': [],
                'db_type': 'postgresql'
            })
        return jsonify({'status': 'error', 'message': 'Failed to connect to PostgreSQL server.'})
    except Exception as err:
        logger.exception('Error connecting to local PostgreSQL')
        clear_db_config_from_session()
        return jsonify({'status': 'error', 'message': str(err)})


# =============================================================================
# REMOTE CONNECTIONS (via connection string)
# =============================================================================

def _connect_remote_postgresql(connection_string: str):
    """
    Connect to a remote PostgreSQL database using connection string.
    
    Supports cloud providers: Neon, Supabase, Railway, Render, Timescale Cloud,
    AWS RDS, Google Cloud SQL, Azure Database, DigitalOcean, etc.
    
    Args:
        connection_string: PostgreSQL connection string 
            (e.g., 'postgresql://user:pass@host.neon.tech/dbname?sslmode=require')
        
    Returns:
        JSON response with connection status, tables, and available databases
    """
    from database.session_utils import (
        set_connection_string_in_session, 
        get_db_connection, 
        get_db_cursor,
        clear_db_config_from_session
    )
    from database.adapters import get_adapter
    
    _clear_cache()
    
    # Parse connection string
    parsed = _parse_connection_string(connection_string)
    db_name = parsed['database']
    host = parsed['host']
    
    # Store connection config in session
    set_connection_string_in_session(connection_string, 'postgresql', db_name)
    
    try:
        conn = get_db_connection()
        adapter = get_adapter('postgresql')
        
        if adapter.validate_connection(conn):
            logger.info(f"User connected to remote PostgreSQL: {db_name} at {host}")
            
            # Get list of all databases on this server
            all_databases = []
            try:
                with get_db_cursor() as cursor:
                    cursor.execute(adapter.get_databases_for_remote())
                    all_databases = [row[0] for row in cursor.fetchall()]
                    logger.info(f"Found {len(all_databases)} databases on remote server")
            except Exception as db_list_err:
                logger.warning(f"Could not list databases: {db_list_err}")
                all_databases = [db_name]
            
            # Fetch schema info
            tables, schema_info = _fetch_remote_schema_info(adapter, db_name)
            
            # Sync context to Firestore for AI
            _sync_connection_context('postgresql', db_name, host, True)
            _cache_schema_context(db_name, tables, 'postgresql')
            
            # Build response message
            message = f'Connected to remote PostgreSQL database: {db_name}'
            if tables:
                message += f' ({len(tables)} tables found)'
            if len(all_databases) > 1:
                message += f'. {len(all_databases)} databases available.'
            
            return jsonify({
                'status': 'connected',
                'message': message,
                'schemas': all_databases,
                'selectedDatabase': db_name,
                'is_remote': True,
                'tables': tables,
                'db_type': 'postgresql'
            })
        return jsonify({'status': 'error', 'message': 'Failed to connect to remote PostgreSQL database.'})
    except Exception as err:
        logger.exception('Error connecting to remote PostgreSQL')
        clear_db_config_from_session()
        return jsonify({'status': 'error', 'message': str(err)})


def _connect_remote_mysql(connection_string: str):
    """
    Connect to a remote MySQL database using connection string.
    
    Supports cloud providers: PlanetScale, TiDB Cloud, Aiven, 
    AWS RDS, Google Cloud SQL, Azure Database, DigitalOcean, etc.
    
    Args:
        connection_string: MySQL connection string 
            (e.g., 'mysql://user:pass@host.planetscale.com/dbname?ssl={"rejectUnauthorized":true}')
        
    Returns:
        JSON response with connection status, tables, and available databases
    """
    from database.session_utils import (
        set_connection_string_in_session, 
        get_db_connection, 
        get_db_cursor,
        clear_db_config_from_session
    )
    from database.adapters import get_adapter
    
    _clear_cache()
    
    # Parse connection string
    parsed = _parse_connection_string(connection_string)
    db_name = parsed['database']
    host = parsed['host']
    
    # Store connection config in session
    set_connection_string_in_session(connection_string, 'mysql', db_name)
    
    try:
        conn = get_db_connection()
        adapter = get_adapter('mysql')
        
        if adapter.validate_connection(conn):
            logger.info(f"User connected to remote MySQL: {db_name} at {host}")
            
            # Get list of all databases (may be limited on some providers)
            all_databases = []
            try:
                with get_db_cursor() as cursor:
                    cursor.execute(adapter.get_databases_query())
                    all_databases = [row[0] for row in cursor.fetchall()]
                    # Filter out system databases
                    system_dbs = adapter.get_system_databases()
                    all_databases = [db for db in all_databases if db.lower() not in system_dbs]
                    logger.info(f"Found {len(all_databases)} databases on remote MySQL server")
            except Exception as db_list_err:
                logger.warning(f"Could not list databases: {db_list_err}")
                all_databases = [db_name]
            
            # Fetch tables in the current database
            tables = []
            try:
                with get_db_cursor() as cursor:
                    cursor.execute(f"""
                        SELECT TABLE_NAME 
                        FROM information_schema.TABLES 
                        WHERE TABLE_SCHEMA = '{db_name}' AND TABLE_TYPE = 'BASE TABLE'
                        ORDER BY TABLE_NAME
                    """)
                    tables = [row[0] for row in cursor.fetchall()]
                        
            except Exception as schema_err:
                logger.warning(f"Failed to fetch MySQL schema: {schema_err}")
            
            # Sync context to Firestore for AI
            _sync_connection_context('mysql', db_name, host, True)
            _cache_schema_context(db_name, tables, 'mysql')
            
            # Build response message
            message = f'Connected to remote MySQL database: {db_name}'
            if tables:
                message += f' ({len(tables)} tables found)'
            if len(all_databases) > 1:
                message += f'. {len(all_databases)} databases available.'
            
            return jsonify({
                'status': 'connected',
                'message': message,
                'schemas': all_databases,
                'selectedDatabase': db_name,
                'is_remote': True,
                'tables': tables,
                'db_type': 'mysql'
            })
        return jsonify({'status': 'error', 'message': 'Failed to connect to remote MySQL database.'})
    except Exception as err:
        logger.exception('Error connecting to remote MySQL')
        clear_db_config_from_session()
        return jsonify({'status': 'error', 'message': str(err)})


# =============================================================================
# SQL SERVER CONNECTIONS
# =============================================================================

def _connect_local_sqlserver(host: str, port: int, user: str, password: str, database: str = None):
    """
    Connect to a local SQL Server instance.
    
    Args:
        host: SQL Server host (e.g., 'localhost')
        port: SQL Server port (e.g., 1433)
        user: SQL Server username
        password: SQL Server password
        database: Optional database name to select
        
    Returns:
        JSON response with connection status and available databases
    """
    from database.session_utils import set_db_config_in_session, get_db_connection, clear_db_config_from_session
    from database.operations import DatabaseOperations
    from database.adapters import get_adapter
    
    _clear_cache()
    
    # Store config in session
    set_db_config_in_session(host, int(port), user, password, database=database, db_type='sqlserver')
    
    try:
        conn = get_db_connection()
        adapter = get_adapter('sqlserver')
        
        if adapter.validate_connection(conn):
            dbs_result = DatabaseOperations.get_databases()
            
            if dbs_result.get('status') == 'success':
                # Sync context to Firestore for AI
                _sync_connection_context('sqlserver', database or 'master', host, False)
                
                logger.info(f"User connected to SQL Server {host}:{port} with {len(dbs_result.get('databases', []))} databases")
                return jsonify({
                    'status': 'connected',
                    'message': f'Connected to SQL Server at {host}:{port}',
                    'schemas': dbs_result['databases'],
                    'db_type': 'sqlserver'
                })
            
            _sync_connection_context('sqlserver', database or 'master', host, False)
            return jsonify({
                'status': 'connected',
                'message': 'Connected, but failed to fetch databases',
                'schemas': [],
                'db_type': 'sqlserver'
            })
        return jsonify({'status': 'error', 'message': 'Failed to connect to SQL Server.'})
    except Exception as err:
        logger.exception('Error connecting to local SQL Server')
        clear_db_config_from_session()
        return jsonify({'status': 'error', 'message': str(err)})


def _connect_remote_sqlserver(connection_string: str):
    """
    Connect to a remote SQL Server database using connection string.
    
    Supports: Azure SQL, AWS RDS, Google Cloud SQL
    
    Args:
        connection_string: ODBC connection string
            (e.g., 'Driver={ODBC Driver 17};Server=xxx.database.windows.net;Database=db;UID=user;PWD=pass')
        
    Returns:
        JSON response with connection status
    """
    from database.session_utils import (
        set_connection_string_in_session, 
        get_db_connection, 
        get_db_cursor,
        clear_db_config_from_session
    )
    from database.adapters import get_adapter
    
    _clear_cache()
    
    # Parse connection string for database name
    import re
    db_match = re.search(r'Database=([^;]+)', connection_string, re.IGNORECASE)
    server_match = re.search(r'Server=([^;,]+)', connection_string, re.IGNORECASE)
    
    db_name = db_match.group(1) if db_match else 'remote_db'
    host = server_match.group(1) if server_match else 'remote'
    
    # Store connection config in session
    set_connection_string_in_session(connection_string, 'sqlserver', db_name)
    
    try:
        conn = get_db_connection()
        adapter = get_adapter('sqlserver')
        
        if adapter.validate_connection(conn):
            logger.info(f"User connected to remote SQL Server: {db_name} at {host}")
            
            # Sync context to Firestore for AI
            _sync_connection_context('sqlserver', db_name, host, True)
            
            return jsonify({
                'status': 'connected',
                'message': f'Connected to remote SQL Server database: {db_name}',
                'schemas': [db_name],
                'selectedDatabase': db_name,
                'is_remote': True,
                'db_type': 'sqlserver'
            })
        return jsonify({'status': 'error', 'message': 'Failed to connect to remote SQL Server database.'})
    except Exception as err:
        logger.exception('Error connecting to remote SQL Server')
        clear_db_config_from_session()
        return jsonify({'status': 'error', 'message': str(err)})


# =============================================================================
# ORACLE CONNECTIONS
# =============================================================================

def _connect_local_oracle(host: str, port: int, user: str, password: str, service_name: str = None):
    """
    Connect to a local Oracle instance.
    
    Args:
        host: Oracle host (e.g., 'localhost')
        port: Oracle port (e.g., 1521)
        user: Oracle username
        password: Oracle password
        service_name: Oracle service name or SID (e.g., 'ORCL')
        
    Returns:
        JSON response with connection status and available schemas
    """
    from database.session_utils import set_db_config_in_session, get_db_connection, clear_db_config_from_session
    from database.operations import DatabaseOperations
    from database.adapters import get_adapter
    
    _clear_cache()
    
    # Store config in session (service_name stored as database)
    set_db_config_in_session(host, int(port), user, password, database=service_name, db_type='oracle')
    
    try:
        conn = get_db_connection()
        adapter = get_adapter('oracle')
        
        if adapter.validate_connection(conn):
            dbs_result = DatabaseOperations.get_databases()
            
            if dbs_result.get('status') == 'success':
                # Sync context to Firestore for AI
                _sync_connection_context('oracle', user.upper(), host, False)
                
                logger.info(f"User connected to Oracle {host}:{port} with {len(dbs_result.get('databases', []))} schemas")
                return jsonify({
                    'status': 'connected',
                    'message': f'Connected to Oracle at {host}:{port}',
                    'schemas': dbs_result['databases'],
                    'db_type': 'oracle'
                })
            
            _sync_connection_context('oracle', user.upper(), host, False)
            return jsonify({
                'status': 'connected',
                'message': 'Connected, but failed to fetch schemas',
                'schemas': [],
                'db_type': 'oracle'
            })
        return jsonify({'status': 'error', 'message': 'Failed to connect to Oracle.'})
    except Exception as err:
        logger.exception('Error connecting to local Oracle')
        clear_db_config_from_session()
        return jsonify({'status': 'error', 'message': str(err)})


def _connect_remote_oracle(connection_string: str):
    """
    Connect to a remote Oracle database using Easy Connect string.
    
    Supports: AWS RDS Oracle, local Oracle with Easy Connect
    Note: Oracle Cloud Autonomous DB with wallet is NOT supported.
    
    Args:
        connection_string: Oracle Easy Connect string
            (e.g., 'user/password@host:port/service_name')
        
    Returns:
        JSON response with connection status
    """
    from database.session_utils import (
        set_connection_string_in_session, 
        get_db_connection, 
        clear_db_config_from_session
    )
    from database.adapters import get_adapter
    
    _clear_cache()
    
    # Parse connection string for user and host
    import re
    user_match = re.search(r'^([^/]+)/', connection_string)
    host_match = re.search(r'@([^:/]+)', connection_string)
    service_match = re.search(r'/([^/]+)$', connection_string)
    
    user = user_match.group(1) if user_match else 'unknown'
    host = host_match.group(1) if host_match else 'remote'
    service_name = service_match.group(1) if service_match else 'remote_service'
    
    # Store connection config in session
    set_connection_string_in_session(connection_string, 'oracle', user.upper())
    
    try:
        conn = get_db_connection()
        adapter = get_adapter('oracle')
        
        if adapter.validate_connection(conn):
            logger.info(f"User connected to remote Oracle: {user}@{host}")
            
            # Sync context to Firestore for AI
            _sync_connection_context('oracle', user.upper(), host, True)
            
            return jsonify({
                'status': 'connected',
                'message': f'Connected to remote Oracle database at {host}',
                'schemas': [user.upper()],
                'selectedDatabase': user.upper(),
                'is_remote': True,
                'db_type': 'oracle'
            })
        return jsonify({'status': 'error', 'message': 'Failed to connect to remote Oracle database.'})
    except Exception as err:
        logger.exception('Error connecting to remote Oracle')
        clear_db_config_from_session()
        return jsonify({'status': 'error', 'message': str(err)})


# =============================================================================
# DATABASE SELECTION (on existing connection)
# =============================================================================

def _handle_db_selection(db_name: str, conversation_id: str = None):
    """
    Select a database on an existing connection.
    
    Used after connecting to a server to select a specific database.
    Multi-user safe: Each user's database selection is isolated in their session.
    
    Args:
        db_name: Name of the database to select
        conversation_id: Optional conversation ID (deprecated)
        
    Returns:
        JSON response with selection status
    """
    from database.operations import fetch_database_info, DatabaseOperations
    from database.session_utils import update_database_in_session, get_db_config_from_session
    
    # Update database in session
    try:
        update_database_in_session(db_name)
    except ValueError as e:
        return jsonify({'status': 'error', 'message': str(e)})
    
    # Fetch database info and sync to context
    try:
        db_info, detailed_info = fetch_database_info(db_name)
        
        # Sync context to Firestore for AI
        config = get_db_config_from_session()
        db_type = config.get('db_type', 'mysql') if config else 'mysql'
        host = config.get('host', 'local') if config else 'local'
        _sync_connection_context(db_type, db_name, host, False)
        
        # Cache schema for AI
        tables = DatabaseOperations.get_tables(db_name)
        if tables:
            _cache_schema_context(db_name, tables, db_type)
        
        logger.info(f"User selected database: {db_name}")
        return jsonify({'status': 'connected', 'message': f'Connected to database {db_name}'})
    except Exception as err:
        logger.exception('Error selecting database %s', db_name)
        return jsonify({'status': 'error', 'message': str(err)})
