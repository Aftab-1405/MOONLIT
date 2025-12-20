"""
Base Database Adapter

Abstract base class defining the interface that all database adapters must implement.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from contextlib import contextmanager


class BaseDatabaseAdapter(ABC):
    """Abstract base class for database adapters."""

    @property
    @abstractmethod
    def db_type(self) -> str:
        """Return the database type identifier (e.g., 'mysql', 'postgresql', 'sqlite')."""
        pass

    @property
    @abstractmethod
    def default_port(self) -> Optional[int]:
        """Return the default port for this database type (None for SQLite)."""
        pass

    @property
    @abstractmethod
    def requires_server(self) -> bool:
        """Return whether this database requires a server connection (False for SQLite)."""
        pass

    @abstractmethod
    def create_connection_pool(self, config: Dict) -> Any:
        """
        Create a connection pool for this database type.

        Args:
            config: Database configuration dict with keys:
                   - host (optional for SQLite)
                   - port (optional for SQLite)
                   - user (optional for SQLite)
                   - password (optional for SQLite)
                   - database (optional)
                   - Additional db-specific options

        Returns:
            Connection pool object (type varies by database)
        """
        pass

    @abstractmethod
    def get_connection_from_pool(self, pool: Any) -> Any:
        """
        Get a connection from the pool.

        Args:
            pool: Connection pool created by create_connection_pool()

        Returns:
            Database connection object
        """
        pass

    @abstractmethod
    def close_pool(self, pool: Any) -> bool:
        """
        Close a connection pool.

        Args:
            pool: Connection pool to close

        Returns:
            True if successful, False otherwise
        """
        pass

    @abstractmethod
    @contextmanager
    def get_cursor(self, connection: Any, dictionary: bool = False, buffered: bool = True):
        """
        Context manager to get a cursor from a connection.

        Args:
            connection: Database connection
            dictionary: If True, return rows as dictionaries (if supported)
            buffered: If True, fetch all rows immediately (if supported)

        Yields:
            Database cursor
        """
        pass

    @abstractmethod
    def get_databases_query(self) -> str:
        """
        Return SQL query to list all databases.

        Returns:
            SQL query string
        """
        pass

    @abstractmethod
    def get_tables_query(self) -> str:
        """
        Return SQL query to list all tables in a database.

        Returns:
            SQL query string with placeholder for database name
        """
        pass

    @abstractmethod
    def get_table_schema_query(self) -> str:
        """
        Return SQL query to get table schema information.

        Returns:
            SQL query string with placeholders for database and table names
        """
        pass

    @abstractmethod
    def get_system_databases(self) -> set:
        """
        Return set of system databases that should be filtered out.

        Returns:
            Set of system database names
        """
        pass

    @abstractmethod
    def validate_connection(self, connection: Any) -> bool:
        """
        Validate that a connection is alive.

        Args:
            connection: Database connection to validate

        Returns:
            True if connection is alive, False otherwise
        """
        pass

    @abstractmethod
    def format_column_info(self, raw_column: Any) -> Dict:
        """
        Format database-specific column information into standard format.

        Args:
            raw_column: Raw column information from database

        Returns:
            Dict with keys: name, type, nullable, key, default, extra
        """
        pass
