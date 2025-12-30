"""
Connection Service - Pure FastAPI Version

Database connection orchestration and status management.
No Flask dependencies.
"""

import logging

logger = logging.getLogger(__name__)


class ConnectionService:
    """Service for managing database connections."""
    
    @staticmethod
    def connect_database(connection_params: dict, user_id: str = None) -> dict:
        """
        Route connection request to appropriate handler.
        
        Args:
            connection_params: Dict containing connection parameters
                - db_type: 'mysql', 'postgresql', 'sqlite', 'sqlserver', or 'oracle'
                - connection_string: For remote connections
                - host, port, user, password: For local connections
                - database: For database name
            user_id: User ID for context tracking
                
        Returns:
            Dict with status, message, and db_config if successful
        """
        from database.connection_handlers import (
            connect_local_sqlite,
            connect_local_mysql,
            connect_local_postgresql,
            connect_remote_postgresql,
            connect_remote_mysql,
        )
        
        db_type = connection_params.get('db_type', 'mysql')
        connection_string = connection_params.get('connection_string')
        
        # Remote connections (via connection string)
        if connection_string:
            if db_type == 'postgresql':
                return connect_remote_postgresql(connection_string, user_id)
            elif db_type == 'mysql':
                return connect_remote_mysql(connection_string, user_id)
            else:
                return {
                    'status': 'error', 
                    'message': f'Remote {db_type} not supported via connection string'
                }
        
        # Local connections
        if db_type == 'sqlite':
            return connect_local_sqlite(
                connection_params.get('database'),
                user_id
            )
        
        if db_type == 'mysql':
            return connect_local_mysql(
                connection_params.get('host', 'localhost'),
                connection_params.get('port', 3306),
                connection_params.get('username'),
                connection_params.get('password'),
                connection_params.get('database'),
                user_id
            )
        
        if db_type == 'postgresql':
            return connect_local_postgresql(
                connection_params.get('host', 'localhost'),
                connection_params.get('port', 5432),
                connection_params.get('username'),
                connection_params.get('password'),
                connection_params.get('database'),
                user_id
            )
        
        return {'status': 'error', 'message': f'Unknown database type: {db_type}'}
    
    @staticmethod
    def get_connection_status(db_config: dict) -> dict:
        """
        Get current connection status.
        
        Args:
            db_config: Database configuration
            
        Returns:
            Dict with connection status
        """
        if not db_config:
            return {
                'status': 'disconnected',
                'connected': False,
                'message': 'Not connected to any database'
            }
        
        try:
            from database.connection_manager import get_connection_manager
            from database.adapters import get_adapter
            
            db_type = db_config.get('db_type', 'mysql')
            manager = get_connection_manager()
            adapter = get_adapter(db_type)
            
            conn = manager.get_connection(db_config)
            is_valid = adapter.validate_connection(conn)
            
            if is_valid:
                return {
                    'status': 'connected',
                    'connected': True,
                    'db_type': db_type,
                    'database': db_config.get('database'),
                    'is_remote': db_config.get('is_remote', False)
                }
            else:
                return {
                    'status': 'error',
                    'connected': False,
                    'message': 'Connection validation failed'
                }
        except Exception as e:
            logger.warning(f"Connection status check failed: {e}")
            return {
                'status': 'error',
                'connected': False,
                'message': str(e)
            }
    
    @staticmethod
    def check_connection_health(db_config: dict) -> dict:
        """
        Lightweight connection health check.
        
        Args:
            db_config: Database configuration
            
        Returns:
            Dict with health status
        """
        if not db_config:
            return {'status': 'error', 'connected': False}
        
        try:
            from database.connection_manager import get_connection_manager
            from database.adapters import get_adapter
            
            db_type = db_config.get('db_type', 'mysql')
            manager = get_connection_manager()
            adapter = get_adapter(db_type)
            
            conn = manager.get_connection(db_config)
            is_valid = adapter.validate_connection(conn)
            
            return {'status': 'success', 'connected': is_valid}
        except Exception as e:
            logger.debug(f"Health check failed: {e}")
            return {'status': 'error', 'connected': False}
