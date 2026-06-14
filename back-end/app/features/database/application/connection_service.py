"""
Connection Service

Database connection orchestration and status management.
"""

import logging
import re

logger = logging.getLogger(__name__)


class ConnectionService:
    """Service for managing database connections."""

    @staticmethod
    def connect_database(connection_params: dict, user_id: str = None) -> dict:
        """
        Route connection request to appropriate handler.

        Args:
            connection_params: Dict containing connection parameters
                - db_type: 'mysql', 'postgresql', 'sqlserver', or 'oracle'
                - connection_string: For connection-string-based connections
                - host, port, username, password: For host/port connections
                - database: Database name
            user_id: User ID for context tracking

        Returns:
            Dict with status, message, and db_config if successful
        """
        from app.features.database.infrastructure import connection_handlers

        db_type = connection_params.get("db_type", "mysql")
        connection_string = connection_params.get("connection_string")

        _REMOTE_STRING_HANDLERS = {
            "postgresql": connection_handlers.connect_remote_postgresql,
            "mysql": connection_handlers.connect_remote_mysql,
            "sqlserver": connection_handlers.connect_remote_sqlserver,
            "oracle": connection_handlers.connect_remote_oracle,
        }

        _HOST_PORT_HANDLERS = {
            "mysql": connection_handlers.connect_mysql,
            "postgresql": connection_handlers.connect_postgresql,
            "sqlserver": connection_handlers.connect_sqlserver,
            "oracle": connection_handlers.connect_oracle,
        }

        if connection_string:
            handler = _REMOTE_STRING_HANDLERS.get(db_type)
            if not handler:
                return {
                    "status": "error",
                    "message": f"Remote {db_type} via connection string is not supported.",
                }
            result = handler(connection_string)
            ConnectionService._sync_context_from_result(result, user_id)
            return result

        handler = _HOST_PORT_HANDLERS.get(db_type)
        if not handler:
            return {"status": "error", "message": f"Unknown database type: {db_type}"}

        result = handler(
            connection_params.get("host"),
            connection_params.get("port"),
            connection_params.get("username"),
            connection_params.get("password"),
            connection_params.get("database"),
        )
        ConnectionService._sync_context_from_result(result, user_id)
        return result

    @staticmethod
    def select_database(db_config: dict, db_name: str, user_id: str = None) -> dict:
        """
        Select a database and update user context after the database layer succeeds.

        Args:
            db_config: Current database configuration
            db_name: Name of database to select
            user_id: User ID for context tracking

        Returns:
            Dict with status and updated db_config
        """
        from app.features.database.infrastructure import connection_handlers

        result = connection_handlers.select_database(db_config, db_name)
        ConnectionService._sync_context_from_result(result, user_id)
        return result

    @staticmethod
    def _sync_context_from_result(result: dict, user_id: str = None) -> None:
        """Sync successful connection results to Firestore-owned context."""
        if not user_id or result.get("status") not in {"connected", "success"}:
            return

        db_config = result.get("db_config")
        if not db_config:
            return

        db_type = result.get("db_type") or db_config.get("db_type", "mysql")
        database = ConnectionService._context_database(result, db_config, db_type)
        host = ConnectionService._context_host(db_type, db_config)
        is_remote = bool(
            result.get("is_remote")
            or db_config.get("is_remote")
            or db_config.get("connection_string")
        )
        schema = db_config.get("schema", "public")

        try:
            from app.features.context.application.context_service import ContextService

            ContextService.set_connection(
                user_id, db_type, database, host, is_remote, schema
            )
            logger.info(f"Synced context for user {user_id}: {db_type}/{database}")
        except Exception as e:
            logger.warning(f"Failed to sync context: {e}")

        if database:
            tables = result.get("tables")
            if tables is None:
                tables = ConnectionService._fetch_tables_for_context(
                    db_config, database, db_type
                )

            ConnectionService._store_schema_context(
                user_id, db_config, database, tables or [], db_type
            )

    @staticmethod
    def _context_database(result: dict, db_config: dict, db_type: str) -> str:
        selected_database = (
            result.get("selected_database")
            or result.get("selectedDatabase")
            or db_config.get("database")
        )
        if selected_database:
            return selected_database

        default_databases = {
            "mysql": "mysql",
            "postgresql": "postgres",
            "sqlserver": "master",
            "oracle": "SYSTEM",
        }
        return default_databases.get(db_type, "remote_db")

    @staticmethod
    def _context_host(db_type: str, db_config: dict) -> str:
        host = db_config.get("host")
        if host:
            return host

        connection_string = db_config.get("connection_string") or ""
        if db_type == "sqlserver":
            match = re.search(r"Server=([^;,]+)", connection_string, re.IGNORECASE)
            return match.group(1) if match else "remote"

        if db_type == "oracle":
            match = re.search(r"@([^:]+):?", connection_string)
            return match.group(1) if match else "remote"

        match = re.search(r"@([^/:]+)", connection_string)
        return match.group(1) if match else "remote"

    @staticmethod
    def _fetch_tables_for_context(
        db_config: dict, database: str, db_type: str
    ) -> list[str]:
        try:
            from app.features.database.infrastructure.operations import DatabaseOperations

            schema = db_config.get("schema", "public")
            return DatabaseOperations.get_tables(db_config, database, schema=schema)
        except Exception as e:
            logger.warning(f"Failed to fetch tables for context: {e}")
            return []

    @staticmethod
    def _store_schema_context(
        user_id: str, db_config: dict, database: str, tables: list, db_type: str
    ) -> None:
        """Store database schema as AI context in Firestore."""
        try:
            from app.features.context.application.context_service import ContextService
            from app.features.database.infrastructure.connection_manager import get_connection_manager
            from app.features.database.infrastructure.adapters import get_adapter
            from config import get_config

            config = get_config()
            max_tables = config.SCHEMA_CONTEXT_MAX_TABLES

            adapter = get_adapter(db_type)
            manager = get_connection_manager()

            columns = {}
            tables_subset = tables[:max_tables]
            query, params = adapter.get_batch_columns_for_tables(database, tables_subset)

            if query:
                with manager.get_cursor(db_config) as cursor:
                    cursor.execute(query, params)
                    for row in cursor.fetchall():
                        table_name = row[0]
                        column_name = row[1]
                        column_key = row[2] if len(row) > 2 else ""

                        if table_name not in columns:
                            columns[table_name] = []

                        columns[table_name].append(
                            {"name": column_name, "is_primary_key": column_key == "PRI"}
                        )

            for table in tables_subset:
                if table not in columns:
                    columns[table] = []

            ContextService.store_schema_context(user_id, database, tables, columns)
            logger.info(
                f"Stored schema context for {database}: {len(tables)} tables (limit: {max_tables})"
            )
        except Exception as e:
            logger.warning(f"Failed to store schema context: {e}")
