"""Database feature protocols."""

from typing import Protocol


class DatabaseContextSync(Protocol):
    """Port for synchronizing database state into user context."""

    def get_connection(self, user_id: str) -> dict:
        """Return the active database connection for a user."""

    def get_schema_context(self, user_id: str, database: str) -> dict | None:
        """Return cached schema context for a database if available."""

    def get_recent_queries(self, user_id: str) -> list[dict]:
        """Return recent query metadata for a user."""

    def set_connection(
        self,
        user_id: str,
        db_type: str,
        database: str,
        host: str,
        is_remote: bool,
        schema: str = "public",
    ) -> None:
        """Persist the active database connection."""

    def clear_connection(self, user_id: str) -> None:
        """Clear the active database connection."""

    def update_schema(self, user_id: str, schema_name: str) -> None:
        """Persist selected schema."""

    def store_schema_context(
        self, user_id: str, database: str, tables: list, columns: dict
    ) -> None:
        """Persist table/column schema context."""

    def add_query(
        self, user_id: str, query: str, database: str | None, row_count: int, status: str
    ) -> None:
        """Persist query history metadata."""
