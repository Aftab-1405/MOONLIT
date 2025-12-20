"""
Session-based Database Utilities

Helper functions for managing per-user database configurations stored in Flask sessions.
"""

from typing import Optional, Dict
from flask import session
from database.connection_manager import get_connection_manager
from contextlib import contextmanager
import logging

logger = logging.getLogger(__name__)

# Session keys
SESSION_DB_CONFIG_KEY = 'db_config'
SESSION_DB_NAME_KEY = 'current_database'


def get_db_config_from_session() -> Optional[Dict]:
    """
    Get database configuration from Flask session.

    Returns:
        Database configuration dict or None if not configured
    """
    return session.get(SESSION_DB_CONFIG_KEY)


def set_db_config_in_session(host: str, port: int, user: str, password: str, database: Optional[str] = None, db_type: str = 'mysql'):
    """
    Store database configuration in Flask session.

    Args:
        host: Database host
        port: Database port
        user: Database user
        password: Database password
        database: Database name (optional)
        db_type: Database type ('mysql', 'postgresql', or 'sqlite'), defaults to 'mysql'
    """
    config = {
        'db_type': db_type.lower(),
        'host': host,
        'port': int(port),
        'user': user,
        'password': password
    }

    if database:
        config['database'] = database

    session[SESSION_DB_CONFIG_KEY] = config
    session.modified = True

    logger.info(f"{db_type.upper()} config stored in session for user {user}@{host}")


def update_database_in_session(database: str):
    """
    Update the database name in the session config.

    Args:
        database: Database name to select

    Raises:
        ValueError: If no database configuration exists in session
    """
    config = get_db_config_from_session()

    if not config:
        raise ValueError("No database configuration found in session. Please connect to a database server first.")

    config['database'] = database
    session[SESSION_DB_CONFIG_KEY] = config
    session[SESSION_DB_NAME_KEY] = database
    session.modified = True

    logger.info(f"Database '{database}' selected in session")


def get_current_database() -> Optional[str]:
    """
    Get the currently selected database name from session.

    Returns:
        Database name or None
    """
    config = get_db_config_from_session()
    if config:
        return config.get('database')
    return None


def clear_db_config_from_session():
    """
    Clear database configuration from Flask session.
    """
    if SESSION_DB_CONFIG_KEY in session:
        del session[SESSION_DB_CONFIG_KEY]
    if SESSION_DB_NAME_KEY in session:
        del session[SESSION_DB_NAME_KEY]

    session.modified = True
    logger.info("Database config cleared from session")


def get_db_type() -> Optional[str]:
    """
    Get the database type from session configuration.

    Returns:
        Database type ('mysql', 'postgresql', 'sqlite') or None
    """
    config = get_db_config_from_session()
    if config:
        return config.get('db_type', 'mysql')
    return None


def is_db_configured() -> bool:
    """
    Check if database configuration exists in session.

    Returns:
        True if configured, False otherwise
    """
    config = get_db_config_from_session()
    if not config:
        return False

    db_type = config.get('db_type', 'mysql').lower()

    # SQLite only needs database path
    if db_type == 'sqlite':
        return config.get('database') is not None

    # MySQL and PostgreSQL need host and user
    return config.get('host') and config.get('user')


def is_database_selected() -> bool:
    """
    Check if a specific database is selected in session.

    Returns:
        True if database is selected, False otherwise
    """
    return get_current_database() is not None


@contextmanager
def get_db_cursor(dictionary=False, buffered=True):
    """
    Context manager for getting a database cursor using session configuration.

    Args:
        dictionary: If True, return rows as dictionaries
        buffered: If True, fetch all rows immediately

    Yields:
        MySQL cursor

    Raises:
        ValueError: If no database configuration in session
    """
    config = get_db_config_from_session()

    if not config:
        raise ValueError("No database configuration found in session. Please connect to a database first.")

    manager = get_connection_manager()

    with manager.get_cursor(config, dictionary=dictionary, buffered=buffered) as cursor:
        yield cursor


def get_db_connection():
    """
    Get a database connection using session configuration.

    Returns:
        MySQL connection

    Raises:
        ValueError: If no database configuration in session
    """
    config = get_db_config_from_session()

    if not config:
        raise ValueError("No database configuration found in session. Please connect to a database first.")

    manager = get_connection_manager()
    return manager.get_connection(config)


def close_user_pool():
    """
    Close the connection pool for the current user's database configuration.

    Returns:
        True if pool was closed, False if no pool existed
    """
    config = get_db_config_from_session()

    if not config:
        return False

    manager = get_connection_manager()
    return manager.close_pool(config)


def get_connection_stats() -> Dict:
    """
    Get connection pool statistics.

    Returns:
        Dict with pool statistics
    """
    manager = get_connection_manager()
    return manager.get_pool_stats()
