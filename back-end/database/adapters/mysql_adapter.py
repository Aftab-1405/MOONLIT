"""
MySQL Database Adapter

Implements database operations for MySQL using mysql-connector-python.
"""

import mysql.connector
from mysql.connector import pooling
from typing import Any, Dict, Optional
from contextlib import contextmanager
import logging
from .base_adapter import BaseDatabaseAdapter
from config import Config

logger = logging.getLogger(__name__)


class MySQLAdapter(BaseDatabaseAdapter):
    """MySQL database adapter."""

    @property
    def db_type(self) -> str:
        return 'mysql'

    @property
    def default_port(self) -> Optional[int]:
        return 3306

    @property
    def requires_server(self) -> bool:
        return True

    def create_connection_pool(self, config: Dict) -> Any:
        """Create MySQL connection pool."""
        pool_config = {
            'host': config['host'],
            'port': config.get('port', 3306),
            'user': config['user'],
            'password': config['password'],
            'pool_name': f"mysql_pool_{id(config)}",
            'pool_size': min(Config.MAX_WORKERS * 2, 32),
            'pool_reset_session': True,
            'autocommit': False,
            'use_unicode': True,
            'charset': 'utf8mb4',
            'collation': 'utf8mb4_unicode_ci',
            'sql_mode': 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO',
            'connect_timeout': 10,
            'buffered': True
        }

        # Add database if specified
        if config.get('database'):
            pool_config['database'] = config['database']

        try:
            pool = pooling.MySQLConnectionPool(**pool_config)
            logger.info(f"Created MySQL connection pool for {config['user']}@{config['host']}")
            return pool
        except mysql.connector.Error as err:
            logger.error(f"Failed to create MySQL pool: {err}")
            raise

    def get_connection_from_pool(self, pool: Any) -> Any:
        """Get MySQL connection from pool."""
        try:
            return pool.get_connection()
        except mysql.connector.Error as err:
            logger.error(f"Failed to get MySQL connection from pool: {err}")
            raise

    def close_pool(self, pool: Any) -> bool:
        """Close MySQL connection pool."""
        try:
            # MySQL connector pools don't have a direct close method
            # Connections are closed when pool is garbage collected
            # We can force close all connections in the pool
            if hasattr(pool, '_cnx_queue'):
                while not pool._cnx_queue.empty():
                    try:
                        conn = pool._cnx_queue.get(block=False)
                        if conn:
                            conn.close()
                    except:
                        pass
            logger.info("Closed MySQL connection pool")
            return True
        except Exception as err:
            logger.error(f"Failed to close MySQL pool: {err}")
            return False

    @contextmanager
    def get_cursor(self, connection: Any, dictionary: bool = False, buffered: bool = True):
        """Get MySQL cursor from connection."""
        cursor = None
        try:
            cursor = connection.cursor(dictionary=dictionary, buffered=buffered)
            yield cursor
            connection.commit()
        except Exception as e:
            if connection:
                connection.rollback()
            raise e
        finally:
            if cursor:
                cursor.close()

    def get_databases_query(self) -> str:
        """SQL query to list MySQL databases."""
        return "SHOW DATABASES"

    def get_tables_query(self) -> str:
        """SQL query to list MySQL tables."""
        return """
            SELECT TABLE_NAME
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = %s AND TABLE_TYPE = 'BASE TABLE'
        """

    def get_table_schema_query(self) -> str:
        """SQL query to get MySQL table schema."""
        return """
            SELECT
                COLUMN_NAME,
                COLUMN_TYPE,
                IS_NULLABLE,
                COLUMN_KEY,
                COLUMN_DEFAULT,
                EXTRA
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
            ORDER BY ORDINAL_POSITION
        """

    def get_system_databases(self) -> set:
        """MySQL system databases to filter out."""
        return {'information_schema', 'mysql', 'performance_schema', 'sys'}

    def validate_connection(self, connection: Any) -> bool:
        """Validate MySQL connection is alive."""
        try:
            if connection and connection.is_connected():
                cursor = connection.cursor()
                cursor.execute("SELECT 1")
                cursor.fetchone()
                cursor.close()
                return True
        except Exception as e:
            logger.debug(f"MySQL connection validation failed: {e}")
        return False

    def format_column_info(self, raw_column: Any) -> Dict:
        """Format MySQL column information."""
        if isinstance(raw_column, dict):
            return {
                'name': raw_column.get('COLUMN_NAME', ''),
                'type': raw_column.get('COLUMN_TYPE', ''),
                'nullable': raw_column.get('IS_NULLABLE', 'NO') == 'YES',
                'key': raw_column.get('COLUMN_KEY', ''),
                'default': raw_column.get('COLUMN_DEFAULT'),
                'extra': raw_column.get('EXTRA', '')
            }
        else:
            # Tuple format: (name, type, nullable, key, default, extra)
            return {
                'name': raw_column[0],
                'type': raw_column[1],
                'nullable': raw_column[2] == 'YES',
                'key': raw_column[3],
                'default': raw_column[4],
                'extra': raw_column[5]
            }
