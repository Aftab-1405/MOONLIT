"""
Connection Handlers

Database connection handlers that return dicts (not framework responses).
All methods accept db_config explicitly.

Only remote-accessible databases are supported — connections to loopback
addresses (localhost, 127.0.0.1, ::1) are rejected since the cloud-hosted
backend cannot reach a user's locally-running DBMS.
"""

import re
import socket
import ipaddress
import logging
from typing import Dict

from config import get_config

logger = logging.getLogger(__name__)
Config = get_config()

# Loopback addresses that resolve to the server itself, not the user's machine.
_LOOPBACK = frozenset(Config.BLOCKED_DB_HOSTS)


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================


def _clear_cache():
    """Clear any cached database metadata."""
    try:
        from service.database.operations import DatabaseOperations

        DatabaseOperations.clear_cache()
    except Exception:
        logger.debug("Failed to clear DatabaseOperations cache")


def _validate_host(host: str) -> dict | None:
    """
    Return an error dict if *host* resolves to a private or loopback address, otherwise None.

    The app runs in the cloud — a private/loopback address would resolve to the
    cloud's internal network or localhost, not the user's machine, posing an SSRF risk
    and failing to reach the intended database.
    """
    if not host:
        return {"status": "error", "message": "Host is required."}

    # First simple text check
    if host.strip().lower() in _LOOPBACK or host.strip().lower() == "[::1]":
        return {
            "status": "error",
            "message": (
                f"Host '{host}' is a loopback address and cannot be used. "
                "Please provide a publicly accessible remote host."
            ),
        }

    try:
        clean_host = host.strip()
        if clean_host.startswith("[") and clean_host.endswith("]"):
            clean_host = clean_host[1:-1]
            
        addr_infos = socket.getaddrinfo(clean_host, None)
        for family, _, _, _, sockaddr in addr_infos:
            ip_str = sockaddr[0]
            ip = ipaddress.ip_address(ip_str)
            if ip.is_private or ip.is_loopback or ip.is_link_local:
                return {
                    "status": "error",
                    "message": (
                        f"Host '{host}' resolves to a private internal IP ({ip_str}) "
                        "and cannot be used for security reasons. "
                        "Please provide a publicly accessible remote host."
                    ),
                }
    except Exception:
        # If it fails to resolve here, we let it pass to let the DB adapter handle DNS errors natively
        pass

    return None


def _parse_connection_string(connection_string: str) -> Dict[str, str]:
    """Parse connection string to extract database name and host."""
    from urllib.parse import urlparse
    try:
        # standard urlparse
        parsed = urlparse(connection_string)
        host = parsed.hostname
        if not host:
            # Fallback to regex if hostname is empty (e.g. invalid URL structure)
            host_match = re.search(r"@([^/:]+)", connection_string)
            host = host_match.group(1) if host_match else "remote"
            
        db = parsed.path.lstrip('/')
        if not db:
            db_match = re.search(r"/([^/?]+)(\?|$)", connection_string)
            db = db_match.group(1) if db_match else "remote_db"
            
        return {
            "database": db,
            "host": host,
        }
    except Exception:
        db_match = re.search(r"/([^/?]+)(\?|$)", connection_string)
        host_match = re.search(r"@([^/:]+)", connection_string)
        return {
            "database": db_match.group(1) if db_match else "remote_db",
            "host": host_match.group(1) if host_match else "remote",
        }


# =============================================================================
# HOST/PORT CONNECTION FUNCTIONS
# These support any remote host. Loopback addresses are rejected.
# =============================================================================


def connect_mysql(
    host: str,
    port: int,
    user: str,
    password: str,
    database: str = None,
) -> dict:
    """Connect to a remote MySQL server using host/port credentials."""
    err = _validate_host(host)
    if err:
        return err

    from service.database.operations import DatabaseOperations
    from service.database.adapters import get_adapter
    from service.database.connection_manager import get_connection_manager

    _clear_cache()

    db_config = {
        "db_type": "mysql",
        "host": host,
        "port": int(port) if port else Config.DEFAULT_MYSQL_PORT,
        "user": user,
        "password": password,
    }
    if database:
        db_config["database"] = database

    try:
        manager = get_connection_manager()
        conn = manager.get_connection(db_config)
        adapter = get_adapter("mysql")

        if adapter.validate_connection(conn):
            dbs_result = DatabaseOperations.get_databases(db_config)

            if dbs_result.get("status") == "success":
                logger.info(f"Connected to MySQL: {host}:{port}")
                return {
                    "status": "connected",
                    "message": f"Connected to MySQL at {host}:{port}",
                    "schemas": dbs_result["databases"],
                    "db_type": "mysql",
                    "db_config": db_config,
                    "selectedDatabase": database,
                }

            return {
                "status": "connected",
                "message": "Connected, but failed to fetch databases",
                "schemas": [],
                "db_type": "mysql",
                "db_config": db_config,
            }
        return {"status": "error", "message": "Failed to connect to MySQL"}
    except Exception as err:
        logger.exception("Error connecting to MySQL")
        return {"status": "error", "message": str(err)}


def connect_postgresql(
    host: str,
    port: int,
    user: str,
    password: str,
    database: str = None,
) -> dict:
    """Connect to a remote PostgreSQL server using host/port credentials."""
    err = _validate_host(host)
    if err:
        return err

    from service.database.operations import DatabaseOperations
    from service.database.adapters import get_adapter
    from service.database.connection_manager import get_connection_manager

    _clear_cache()

    db_config = {
        "db_type": "postgresql",
        "host": host,
        "port": int(port) if port else Config.DEFAULT_POSTGRESQL_PORT,
        "user": user,
        "password": password,
    }
    if database:
        db_config["database"] = database

    try:
        manager = get_connection_manager()
        conn = manager.get_connection(db_config)
        adapter = get_adapter("postgresql")

        if adapter.validate_connection(conn):
            dbs_result = DatabaseOperations.get_databases(db_config)

            if dbs_result.get("status") == "success":
                logger.info(f"Connected to PostgreSQL: {host}:{port}")
                return {
                    "status": "connected",
                    "message": f"Connected to PostgreSQL at {host}:{port}",
                    "schemas": dbs_result["databases"],
                    "db_type": "postgresql",
                    "db_config": db_config,
                    "selectedDatabase": database,
                }

            return {
                "status": "connected",
                "message": "Connected, but failed to fetch databases",
                "schemas": [],
                "db_type": "postgresql",
                "db_config": db_config,
            }
        return {"status": "error", "message": "Failed to connect to PostgreSQL"}
    except Exception as err:
        logger.exception("Error connecting to PostgreSQL")
        return {"status": "error", "message": str(err)}


def connect_sqlserver(
    host: str,
    port: int,
    user: str,
    password: str,
    database: str = None,
) -> dict:
    """Connect to a remote SQL Server database using host/port credentials."""
    err = _validate_host(host)
    if err:
        return err

    from service.database.adapters import get_adapter
    from service.database.connection_manager import get_connection_manager

    _clear_cache()

    db_config = {
        "db_type": "sqlserver",
        "host": host,
        "port": int(port) if port else Config.DEFAULT_SQLSERVER_PORT,
        "user": user,
        "password": password,
    }
    if database:
        db_config["database"] = database

    try:
        manager = get_connection_manager()
        conn = manager.get_connection(db_config)
        adapter = get_adapter("sqlserver")

        if adapter.validate_connection(conn):
            databases = []
            try:
                with manager.get_cursor(db_config) as cursor:
                    cursor.execute(adapter.get_databases_query())
                    all_dbs = [row[0] for row in cursor.fetchall()]
                    system_dbs = adapter.get_system_databases()
                    databases = [db for db in all_dbs if db.lower() not in system_dbs]
            except Exception as e:
                logger.warning(f"Failed to fetch SQL Server databases: {e}")
                if database:
                    databases = [database]

            logger.info(f"Connected to SQL Server: {host}:{port}")
            return {
                "status": "connected",
                "message": f"Connected to SQL Server at {host}:{port}",
                "schemas": databases,
                "db_type": "sqlserver",
                "db_config": db_config,
                "selectedDatabase": database,
            }
        return {"status": "error", "message": "Failed to connect to SQL Server"}
    except Exception as err:
        logger.exception("Error connecting to SQL Server")
        return {"status": "error", "message": str(err)}


def connect_oracle(
    host: str,
    port: int,
    user: str,
    password: str,
    service_name: str = None,
) -> dict:
    """Connect to a remote Oracle database server using host/port credentials."""
    err = _validate_host(host)
    if err:
        return err

    from service.database.adapters import get_adapter
    from service.database.connection_manager import get_connection_manager

    _clear_cache()

    db_config = {
        "db_type": "oracle",
        "host": host,
        "port": int(port) if port else Config.DEFAULT_ORACLE_PORT,
        "user": user,
        "password": password,
        "service_name": service_name or "ORCL",
        "database": user.upper() if user else "SYSTEM",  # Oracle schema = user
    }

    try:
        manager = get_connection_manager()
        conn = manager.get_connection(db_config)
        adapter = get_adapter("oracle")

        if adapter.validate_connection(conn):
            schemas = []
            try:
                with manager.get_cursor(db_config) as cursor:
                    cursor.execute(adapter.get_databases_query())
                    schemas = [row[0] for row in cursor.fetchall()]
            except Exception as e:
                logger.warning(f"Failed to fetch Oracle schemas: {e}")
                schemas = [user.upper()] if user else []

            schema_name = user.upper() if user else "SYSTEM"
            logger.info(f"Connected to Oracle: {host}:{port}/{service_name}")
            return {
                "status": "connected",
                "message": f"Connected to Oracle at {host}:{port}/{service_name}",
                "schemas": schemas,
                "db_type": "oracle",
                "db_config": db_config,
                "selectedDatabase": schema_name,
            }
        return {"status": "error", "message": "Failed to connect to Oracle"}
    except Exception as err:
        logger.exception("Error connecting to Oracle")
        return {"status": "error", "message": str(err)}


# =============================================================================
# CONNECTION STRING FUNCTIONS (remote only)
# =============================================================================


def connect_remote_postgresql(connection_string: str) -> dict:
    """Connect to a remote PostgreSQL database using a connection string."""
    from service.database.adapters import get_adapter
    from service.database.connection_manager import get_connection_manager

    _clear_cache()

    parsed = _parse_connection_string(connection_string)
    db_name = parsed["database"]
    host = parsed["host"]

    err = _validate_host(host)
    if err:
        return err

    db_config = {
        "db_type": "postgresql",
        "connection_string": connection_string,
        "database": db_name,
        "is_remote": True,
    }

    try:
        manager = get_connection_manager()
        conn = manager.get_connection(db_config)
        adapter = get_adapter("postgresql")

        if adapter.validate_connection(conn):
            logger.info(f"Connected to remote PostgreSQL: {db_name} at {host}")

            all_databases = []
            try:
                with manager.get_cursor(db_config) as cursor:
                    cursor.execute(adapter.get_databases_for_remote())
                    all_databases = [row[0] for row in cursor.fetchall()]
            except Exception:
                all_databases = [db_name]

            tables = []
            try:
                with manager.get_cursor(db_config) as cursor:
                    query, params = adapter.get_all_tables_for_cache(db_name, "public")
                    cursor.execute(query, params)
                    tables = [row[0] for row in cursor.fetchall()]
            except Exception as e:
                logger.warning(f"Failed to fetch tables: {e}")

            message = f"Connected to remote PostgreSQL: {db_name}"
            if tables:
                message += f" ({len(tables)} tables)"

            return {
                "status": "connected",
                "message": message,
                "schemas": all_databases,
                "selectedDatabase": db_name,
                "is_remote": True,
                "tables": tables,
                "db_type": "postgresql",
                "db_config": db_config,
            }
        return {"status": "error", "message": "Failed to connect to remote PostgreSQL"}
    except Exception as err:
        logger.exception("Error connecting to remote PostgreSQL")
        return {"status": "error", "message": str(err)}


def connect_remote_mysql(connection_string: str) -> dict:
    """Connect to a remote MySQL database using a connection string."""
    from service.database.adapters import get_adapter
    from service.database.connection_manager import get_connection_manager

    _clear_cache()

    parsed = _parse_connection_string(connection_string)
    db_name = parsed["database"]
    host = parsed["host"]

    err = _validate_host(host)
    if err:
        return err

    db_config = {
        "db_type": "mysql",
        "connection_string": connection_string,
        "database": db_name,
        "is_remote": True,
    }

    try:
        manager = get_connection_manager()
        conn = manager.get_connection(db_config)
        adapter = get_adapter("mysql")

        if adapter.validate_connection(conn):
            logger.info(f"Connected to remote MySQL: {db_name} at {host}")

            all_databases = []
            try:
                with manager.get_cursor(db_config) as cursor:
                    cursor.execute(adapter.get_databases_query())
                    all_databases = [row[0] for row in cursor.fetchall()]
                    system_dbs = adapter.get_system_databases()
                    all_databases = [
                        db for db in all_databases if db.lower() not in system_dbs
                    ]
            except Exception:
                all_databases = [db_name]

            tables = []
            try:
                with manager.get_cursor(db_config) as cursor:
                    cursor.execute(
                        """
                        SELECT TABLE_NAME FROM information_schema.TABLES
                        WHERE TABLE_SCHEMA = %s AND TABLE_TYPE = 'BASE TABLE'
                        ORDER BY TABLE_NAME
                        """,
                        (db_name,),
                    )
                    tables = [row[0] for row in cursor.fetchall()]
            except Exception as e:
                logger.warning(f"Failed to fetch tables: {e}")

            message = f"Connected to remote MySQL: {db_name}"
            if tables:
                message += f" ({len(tables)} tables)"

            return {
                "status": "connected",
                "message": message,
                "schemas": all_databases,
                "selectedDatabase": db_name,
                "is_remote": True,
                "tables": tables,
                "db_type": "mysql",
                "db_config": db_config,
            }
        return {"status": "error", "message": "Failed to connect to remote MySQL"}
    except Exception as err:
        logger.exception("Error connecting to remote MySQL")
        return {"status": "error", "message": str(err)}


def connect_remote_oracle(connection_string: str) -> dict:
    """
    Connect to a remote Oracle database using a connection string.

    Expected format: user/password@host:port/service_name
    """
    from service.database.adapters import get_adapter
    from service.database.connection_manager import get_connection_manager
    import re as _re

    _clear_cache()

    match = _re.match(r"([^/]+)/([^@]+)@([^:]+):?(\d+)?/(.+)", connection_string)
    if match:
        user, _password, _host, _port, _service_name = match.groups()
        schema_name = user.upper()
    else:
        schema_name = "REMOTE"
        _host = ""

    if _host:
        err = _validate_host(_host)
        if err:
            return err

    db_config = {
        "db_type": "oracle",
        "connection_string": connection_string,
        "database": schema_name,
        "is_remote": True,
    }

    try:
        manager = get_connection_manager()
        conn = manager.get_connection(db_config)
        adapter = get_adapter("oracle")

        if adapter.validate_connection(conn):
            logger.info(f"Connected to remote Oracle: {schema_name}")

            schemas = []
            try:
                with manager.get_cursor(db_config) as cursor:
                    cursor.execute(adapter.get_databases_query())
                    schemas = [row[0] for row in cursor.fetchall()]
            except Exception:
                schemas = [schema_name]

            tables = []
            try:
                tables_query, tables_params = adapter.get_all_tables_for_cache(
                    schema_name
                )
                with manager.get_cursor(db_config) as cursor:
                    cursor.execute(tables_query, tables_params)
                    tables = [row[0] for row in cursor.fetchall()]
            except Exception as e:
                logger.warning(f"Failed to fetch Oracle tables: {e}")

            message = f"Connected to remote Oracle: {schema_name}"
            if tables:
                message += f" ({len(tables)} tables)"

            return {
                "status": "connected",
                "message": message,
                "schemas": schemas,
                "selectedDatabase": schema_name,
                "is_remote": True,
                "tables": tables,
                "db_type": "oracle",
                "db_config": db_config,
            }
        return {"status": "error", "message": "Failed to connect to remote Oracle"}
    except Exception as err:
        logger.exception("Error connecting to remote Oracle")
        return {"status": "error", "message": str(err)}


def connect_remote_sqlserver(connection_string: str) -> dict:
    """
    Connect to a remote SQL Server database using a connection string.

    Expected format: Driver={ODBC Driver 17 for SQL Server};Server=xxx;Database=xxx;UID=xxx;PWD=xxx
    """
    from service.database.adapters import get_adapter
    from service.database.connection_manager import get_connection_manager
    import re as _re

    _clear_cache()

    db_match = _re.search(r"(?:Database|Initial Catalog)=([^;]+)", connection_string, _re.IGNORECASE)
    server_match = _re.search(r"(?:Server|Data Source)=([^;,]+)", connection_string, _re.IGNORECASE)

    db_name = db_match.group(1).strip() if db_match else "master"
    host = server_match.group(1).strip() if server_match else "remote"

    err = _validate_host(host)
    if err:
        return err

    db_config = {
        "db_type": "sqlserver",
        "connection_string": connection_string,
        "database": db_name,
        "is_remote": True,
    }

    try:
        manager = get_connection_manager()
        conn = manager.get_connection(db_config)
        adapter = get_adapter("sqlserver")

        if adapter.validate_connection(conn):
            logger.info(f"Connected to remote SQL Server: {db_name} at {host}")

            all_databases = []
            try:
                with manager.get_cursor(db_config) as cursor:
                    cursor.execute(adapter.get_databases_query())
                    all_dbs = [row[0] for row in cursor.fetchall()]
                    system_dbs = adapter.get_system_databases()
                    all_databases = [
                        db for db in all_dbs if db.lower() not in system_dbs
                    ]
            except Exception:
                all_databases = [db_name]

            tables = []
            try:
                tables_query, tables_params = adapter.get_all_tables_for_cache(db_name)
                with manager.get_cursor(db_config) as cursor:
                    cursor.execute(tables_query, tables_params)
                    tables = [row[0] for row in cursor.fetchall()]
            except Exception as e:
                logger.warning(f"Failed to fetch SQL Server tables: {e}")

            message = f"Connected to remote SQL Server: {db_name}"
            if tables:
                message += f" ({len(tables)} tables)"

            return {
                "status": "connected",
                "message": message,
                "schemas": all_databases,
                "selectedDatabase": db_name,
                "is_remote": True,
                "tables": tables,
                "db_type": "sqlserver",
                "db_config": db_config,
            }
        return {"status": "error", "message": "Failed to connect to remote SQL Server"}
    except Exception as err:
        logger.exception("Error connecting to remote SQL Server")
        return {"status": "error", "message": str(err)}


# =============================================================================
# DATABASE SELECTION
# =============================================================================


def select_database(db_config: dict, db_name: str) -> dict:
    """
    Select a database on an existing connection.

    Args:
        db_config: Current database configuration
        db_name: Name of database to select
        Returns:
        Dict with status and updated db_config
    """
    from service.database.operations import fetch_database_info

    if not db_name:
        return {"status": "error", "message": "Database name required"}

    if not db_config:
        return {"status": "error", "message": "No database connected"}

    new_config = db_config.copy()
    new_config["database"] = db_name

    try:
        fetch_database_info(new_config, db_name)

        logger.info(f"Selected database: {db_name}")
        return {
            "status": "connected",
            "message": f"Connected to database {db_name}",
            "db_config": new_config,
        }
    except Exception as err:
        logger.exception(f"Error selecting database {db_name}")
        return {"status": "error", "message": str(err)}
