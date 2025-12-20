"""
SQLite Database Adapter

Implements database operations for SQLite using sqlite3 (built-in).
"""

import sqlite3
import logging
from typing import Any, Dict, Optional
from contextlib import contextmanager
from .base_adapter import BaseDatabaseAdapter
import threading

logger = logging.getLogger(__name__)


class SQLiteConnectionPool:
    """
    Simple connection pool for SQLite.

    SQLite doesn't have a native connection pool, so we create a simple one.
    Note: SQLite has limitations with concurrent writes.
    """

    def __init__(self, database: str, max_connections: int = 10):
        self.database = database
        self.max_connections = max_connections
        self._connections = []
        self._lock = threading.Lock()

    def get_connection(self):
        """Get a connection from the pool or create a new one."""
        with self._lock:
            if self._connections:
                return self._connections.pop()
            else:
                conn = sqlite3.connect(self.database, check_same_thread=False)
                conn.row_factory = sqlite3.Row  # Enable column access by name
                return conn

    def return_connection(self, connection):
        """Return a connection to the pool."""
        with self._lock:
            if len(self._connections) < self.max_connections:
                self._connections.append(connection)
            else:
                connection.close()

    def closeall(self):
        """Close all connections in the pool."""
        with self._lock:
            for conn in self._connections:
                conn.close()
            self._connections.clear()


class SQLiteAdapter(BaseDatabaseAdapter):
    """SQLite database adapter."""

    @property
    def db_type(self) -> str:
        return 'sqlite'

    @property
    def default_port(self) -> Optional[int]:
        return None  # SQLite doesn't use ports

    @property
    def requires_server(self) -> bool:
        return False  # SQLite is file-based

    def create_connection_pool(self, config: Dict) -> Any:
        """Create SQLite connection pool."""
        try:
            # For SQLite, 'database' is the file path
            database_path = config.get('database') or config.get('path') or ':memory:'

            pool = SQLiteConnectionPool(database_path, max_connections=10)
            logger.info(f"Created SQLite connection pool for {database_path}")
            return pool

        except Exception as err:
            logger.error(f"Failed to create SQLite pool: {err}")
            raise

    def get_connection_from_pool(self, pool: Any) -> Any:
        """Get SQLite connection from pool."""
        try:
            return pool.get_connection()
        except Exception as err:
            logger.error(f"Failed to get SQLite connection from pool: {err}")
            raise

    def close_pool(self, pool: Any) -> bool:
        """Close SQLite connection pool."""
        try:
            pool.closeall()
            logger.info("Closed SQLite connection pool")
            return True
        except Exception as err:
            logger.error(f"Failed to close SQLite pool: {err}")
            return False

    @contextmanager
    def get_cursor(self, connection: Any, dictionary: bool = False, buffered: bool = True):
        """Get SQLite cursor from connection."""
        cursor = None
        try:
            if dictionary:
                connection.row_factory = sqlite3.Row
            cursor = connection.cursor()
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
        """
        SQLite doesn't have multiple databases per connection.
        Return query to get attached databases.
        """
        return "PRAGMA database_list"

    def get_tables_query(self) -> str:
        """SQL query to list SQLite tables."""
        return """
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
            AND name NOT LIKE 'sqlite_%'
        """

    def get_table_schema_query(self) -> str:
        """SQL query to get SQLite table schema."""
        # SQLite uses PRAGMA table_info
        return "PRAGMA table_info(%s)"

    def get_system_databases(self) -> set:
        """SQLite doesn't have system databases like MySQL/PostgreSQL."""
        return {'temp'}

    def validate_connection(self, connection: Any) -> bool:
        """Validate SQLite connection is alive."""
        try:
            if connection:
                cursor = connection.cursor()
                cursor.execute("SELECT 1")
                cursor.fetchone()
                cursor.close()
                return True
        except Exception as e:
            logger.debug(f"SQLite connection validation failed: {e}")
        return False

    def format_column_info(self, raw_column: Any) -> Dict:
        """
        Format SQLite column information.

        SQLite PRAGMA table_info returns:
        (cid, name, type, notnull, dflt_value, pk)
        """
        if isinstance(raw_column, dict):
            return {
                'name': raw_column.get('name', ''),
                'type': raw_column.get('type', ''),
                'nullable': not raw_column.get('notnull', 0),
                'key': 'PRI' if raw_column.get('pk', 0) else '',
                'default': raw_column.get('dflt_value'),
                'extra': ''
            }
        else:
            # Tuple format: (cid, name, type, notnull, dflt_value, pk)
            return {
                'name': raw_column[1],
                'type': raw_column[2],
                'nullable': not raw_column[3],
                'key': 'PRI' if raw_column[5] else '',
                'default': raw_column[4],
                'extra': ''
            }
