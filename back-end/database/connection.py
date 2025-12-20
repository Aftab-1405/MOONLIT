"""Optimized Database connection management"""

import mysql.connector
from mysql.connector import pooling
import threading
from concurrent.futures import ThreadPoolExecutor
from config import Config
import logging
from contextlib import contextmanager

logger = logging.getLogger(__name__)

# Thread-local storage for database connections
thread_local = threading.local()
executor = ThreadPoolExecutor(max_workers=Config.MAX_WORKERS)

# Connection pool for better performance
_connection_pool = None
_pool_lock = threading.Lock()

# Current database configuration
db_config = Config.MYSQL_CONFIG.copy()
# Whether the server/db credentials have been configured (set by connect flow)
server_configured = bool(db_config.get('host') and db_config.get('user'))

def _initialize_pool():
    """Initialize connection pool with optimized settings"""
    global _connection_pool
    # If there's no host/user configured, do not auto-create a pool.
    if not db_config.get('host') or not db_config.get('user'):
        raise RuntimeError('Database server not configured')

    if _connection_pool is None:
        with _pool_lock:
            if _connection_pool is None:  # Double-check locking
                pool_config = db_config.copy()
                pool_config.update({
                    'pool_name': 'db_pool',
                    'pool_size': min(Config.MAX_WORKERS * 2, 32),  # Optimized pool size
                    'pool_reset_session': True,
                    'autocommit': False,  # Explicit transaction control
                    'use_unicode': True,
                    'charset': 'utf8mb4',
                    'collation': 'utf8mb4_unicode_ci',
                    'sql_mode': 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO',
                    'connect_timeout': 10,
                    'buffered': True  # Enable buffered cursors by default
                })
                
                try:
                    _connection_pool = pooling.MySQLConnectionPool(**pool_config)
                    logger.info(f"Connection pool initialized with size {pool_config['pool_size']}")
                except Exception as e:
                    logger.error(f"Failed to initialize connection pool: {e}")
                    raise

def get_db_connection():
    """Get optimized database connection from pool"""
    global _connection_pool
    
    # Initialize pool if not already done
    if _connection_pool is None:
        # If server is not configured, raise a clear error instead of silently reconnecting
        if not db_config.get('host') or not db_config.get('user'):
            raise RuntimeError('Database server not configured')
        _initialize_pool()
    
    # Use thread-local connection if available and valid
    if hasattr(thread_local, 'connection'):
        try:
            # Test connection validity
            if thread_local.connection.is_connected():
                return thread_local.connection
        except Exception as e:
            # Connection is stale or check failed, remove it and log debug info
            logger.debug('Thread-local connection validity check failed: %s', e)
            try:
                delattr(thread_local, 'connection')
            except Exception:
                # ignore if attr removal fails
                pass
    
    # Get new connection from pool
    try:
        thread_local.connection = _connection_pool.get_connection()
        return thread_local.connection
    except Exception as e:
        logger.error(f"Failed to get connection from pool: {e}")
        # Fallback to direct connection
        # Only attempt a direct connect if server is configured
        if db_config.get('host') and db_config.get('user'):
            return mysql.connector.connect(**db_config)
        raise

@contextmanager
def get_cursor(dictionary=False, buffered=True):
    """Context manager for optimized cursor handling"""
    conn = get_db_connection()
    cursor = None
    try:
        cursor = conn.cursor(dictionary=dictionary, buffered=buffered)
        yield cursor
    except Exception as e:
        if conn.in_transaction:
            conn.rollback()
        raise e
    finally:
        if cursor:
            cursor.close()

def get_executor():
    """Get thread pool executor"""
    return executor

def update_db_config(database_name):
    """Update database configuration with selected database"""
    global db_config, _connection_pool
    
    db_config['database'] = database_name
    
    # Reset pool to use new database
    with _pool_lock:
        if _connection_pool:
            try:
                # Close existing pool connections
                _connection_pool._remove_connections()
            except Exception as e:
                logger.debug('Failed to remove connections from existing pool: %s', e)
        _connection_pool = None
    
    # Clear thread-local connections
    if hasattr(thread_local, 'connection'):
        try:
            thread_local.connection.close()
        except Exception as e:
            logger.debug('Failed to close thread-local connection during config update: %s', e)
        try:
            delattr(thread_local, 'connection')
        except Exception:
            # ignore if attribute already removed
            pass

    # Clear any cached DB metadata that may have been populated for the
    # previous database selection so callers will fetch fresh metadata.
    try:
        from database.operations import DatabaseOperations
        DatabaseOperations.clear_cache()
    except Exception:
        logger.debug('Failed to clear DatabaseOperations cache during update_db_config')

def get_current_db_name():
    """Get currently selected database name"""
    return db_config.get('database')


def is_server_configured():
    """Return True when host/user credentials are present in db_config."""
    return bool(db_config.get('host') and db_config.get('user'))

def close_all_connections():
    """Close all connections and cleanup"""
    global _connection_pool
    
    # Close thread-local connection
    if hasattr(thread_local, 'connection'):
        try:
            thread_local.connection.close()
        except Exception as e:
            logger.debug('Failed to close thread-local connection during shutdown: %s', e)
        try:
            delattr(thread_local, 'connection')
        except Exception:
            # ignore if attribute already removed
            pass
    
    # Close pool connections
    with _pool_lock:
        if _connection_pool:
            try:
                _connection_pool._remove_connections()
            except Exception as e:
                logger.debug('Failed to remove connections from pool during shutdown: %s', e)
            _connection_pool = None
    
    # Shutdown executor
    executor.shutdown(wait=True)
    # Clear sensitive configuration so the server will not auto-reconnect
    try:
        db_config.update({
            'host': None,
            'port': None,
            'user': None,
            'password': None,
            'database': None
        })
    except Exception:
        pass