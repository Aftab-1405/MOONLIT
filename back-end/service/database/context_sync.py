"""Database context-sync adapters."""

from api_contract.database_protocols import DatabaseContextSync


class UserContextDatabaseSync:
    """Database context sync backed by the context feature."""

    def get_connection(self, user_id: str) -> dict:
        from service.context.context_service import ContextService

        return ContextService.get_connection(user_id)

    def get_schema_context(self, user_id: str, database: str) -> dict | None:
        from service.context.context_service import ContextService

        return ContextService.get_schema_context(user_id, database)

    def get_recent_queries(self, user_id: str) -> list[dict]:
        from service.context.context_service import ContextService

        return ContextService.get_full_context(user_id).get("recent_queries", [])

    def set_connection(
        self,
        user_id: str,
        db_type: str,
        database: str,
        host: str,
        is_remote: bool,
        schema: str = "public",
    ) -> None:
        from service.context.context_service import ContextService

        ContextService.set_connection(
            user_id, db_type, database, host, is_remote, schema
        )

    def clear_connection(self, user_id: str) -> None:
        from service.context.context_service import ContextService

        ContextService.clear_connection(user_id)

    def update_schema(self, user_id: str, schema_name: str) -> None:
        from service.context.context_service import ContextService

        ContextService.update_schema(user_id, schema_name)

    def store_schema_context(
        self, user_id: str, database: str, tables: list, columns: dict
    ) -> None:
        from service.context.context_service import ContextService

        ContextService.store_schema_context(user_id, database, tables, columns)

    def add_query(
        self, user_id: str, query: str, database: str | None, row_count: int, status: str
    ) -> None:
        from service.context.context_service import ContextService

        ContextService.add_query(user_id, query, database, row_count, status)


def get_default_context_sync() -> DatabaseContextSync:
    """Return the configured database context-sync adapter."""
    return UserContextDatabaseSync()
