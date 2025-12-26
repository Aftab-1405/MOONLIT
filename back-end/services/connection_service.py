"""
Connection Service

Database connection orchestration and status management.
Centralizes all connection-related business logic.
"""

import time
import logging
from typing import Dict
from flask import session

logger = logging.getLogger(__name__)


class ConnectionService:
    """Service for managing database connections."""
    
    @staticmethod
    def connect_database(connection_params: dict):
        """
        Route connection request to appropriate handler.
        
        Args:
            connection_params: Dict containing connection parameters
                - db_type: 'mysql', 'postgresql', 'sqlite', 'sqlserver', or 'oracle'
                - connection_string: For remote connections
                - host, port, user, password: For local connections
                - db_name: For SQLite or database selection
                - service_name: For Oracle connections
                
        Returns:
            Flask Response with JSON body
        """
        from flask import jsonify
        from database.connection_handlers import (
            _connect_local_sqlite,
            _connect_local_mysql,
            _connect_local_postgresql,
            _connect_remote_postgresql,
            _connect_remote_mysql,
            _connect_local_sqlserver,
            _connect_remote_sqlserver,
            _connect_local_oracle,
            _connect_remote_oracle,
            _handle_db_selection
        )
        
        db_type = connection_params.get('db_type', 'mysql')
        connection_string = connection_params.get('connection_string')
        
        # =====================================================================
        # REMOTE CONNECTIONS (via connection string)
        # =====================================================================
        if connection_string:
            if db_type == 'postgresql':
                return _connect_remote_postgresql(connection_string)
            elif db_type == 'mysql':
                return _connect_remote_mysql(connection_string)
            elif db_type == 'sqlserver':
                return _connect_remote_sqlserver(connection_string)
            elif db_type == 'oracle':
                return _connect_remote_oracle(connection_string)
            else:
                return jsonify({
                    'status': 'error', 
                    'message': f'Remote connection via connection string is not supported for {db_type}. Use host/port/user/password instead.'
                })
        
        # =====================================================================
        # LOCAL CONNECTIONS
        # =====================================================================
        
        # SQLite: Only file path required
        if db_type == 'sqlite':
            return _connect_local_sqlite(connection_params.get('db_name'))
        
        # MySQL/PostgreSQL: Host, port, user, password required
        host = connection_params.get('host')
        port = connection_params.get('port')
        user = connection_params.get('user')
        password = connection_params.get('password')
        
        if all([host, port, user, password]):
            if db_type == 'mysql':
                return _connect_local_mysql(host, port, user, password, connection_params.get('db_name'))
            elif db_type == 'postgresql':
                return _connect_local_postgresql(host, port, user, password, connection_params.get('db_name'))
            elif db_type == 'sqlserver':
                return _connect_local_sqlserver(host, port, user, password, connection_params.get('db_name'))
            elif db_type == 'oracle':
                return _connect_local_oracle(host, port, user, password, connection_params.get('service_name') or connection_params.get('db_name'))
            else:
                return jsonify({'status': 'error', 'message': f'Unsupported database type: {db_type}'})
        
        # =====================================================================
        # DATABASE SELECTION (on existing connection)
        # =====================================================================
        if connection_params.get('db_name'):
            conversation_id = session.get('conversation_id')
            return _handle_db_selection(connection_params.get('db_name'), conversation_id)
        
        # Invalid request
        return jsonify({
            'status': 'error', 
            'message': 'Invalid connection parameters. Provide either: (1) connection_string for remote, (2) host/port/user/password for local MySQL/PostgreSQL, (3) db_name for SQLite or database selection.'
        })
    
    @staticmethod
    def get_connection_status() -> dict:
        """
        Get current database connection status.
        
        Returns:
            Dict with connected, databases, current_database, is_remote, db_type
        """
        from database.session_utils import (
            is_db_configured, 
            get_current_database,
            is_remote_connection,
            get_db_type
        )
        from database.operations import DatabaseOperations
        
        # Check if user has database configuration in their session
        connected = is_db_configured()
        
        result = {'status': 'ok', 'connected': bool(connected)}
        
        # If connected, attempt to retrieve the database list (non-fatal)
        if connected:
            try:
                dbs = DatabaseOperations.get_databases()
                if isinstance(dbs, dict) and dbs.get('status') == 'success':
                    result['databases'] = dbs.get('databases', [])
                else:
                    result['databases'] = []
            except Exception as e:
                logger.debug('get_connection_status: failed to fetch databases: %s', e)
                result['databases'] = []
        
        # Provide current selected database name if present
        try:
            result['current_database'] = get_current_database()
        except Exception:
            result['current_database'] = None
        
        # Check if connected via remote connection string
        try:
            result['is_remote'] = is_remote_connection()
        except Exception:
            result['is_remote'] = False
        
        # Provide database type for frontend feature detection
        try:
            db_type = get_db_type()
            result['db_type'] = db_type or 'unknown'
        except Exception:
            result['db_type'] = 'unknown'
        
        return result
    
    @staticmethod
    def check_connection_health() -> dict:
        """
        Lightweight connection health check.
        
        Returns:
            Dict with status, connected boolean, and timestamp
        """
        from database.session_utils import is_db_configured, get_db_connection
        
        current_time = time.time()
        
        # Check if user has database configuration in their session
        if not is_db_configured():
            return {
                'status': 'ok',
                'connected': False,
                'timestamp': current_time
            }
        
        # Try to ping the connection using user's session config
        connected = False
        try:
            conn = get_db_connection()
            if conn and hasattr(conn, 'is_connected') and conn.is_connected():
                # MySQL: Perform a lightweight query to verify connection
                cursor = conn.cursor()
                cursor.execute("SELECT 1")
                cursor.fetchone()
                cursor.close()
                connected = True
            elif conn:
                # PostgreSQL or other: Just check if connection exists
                # For psycopg2, we can try a simple query
                try:
                    cursor = conn.cursor()
                    cursor.execute("SELECT 1")
                    cursor.fetchone()
                    cursor.close()
                    connected = True
                except Exception:
                    connected = False
        except Exception as e:
            logger.debug(f'Heartbeat check failed: {e}')
            connected = False
        
        return {
            'status': 'ok',
            'connected': connected,
            'timestamp': current_time
        }
