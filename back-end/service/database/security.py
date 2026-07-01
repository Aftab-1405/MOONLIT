# File: database/security.py
"""Optimized Database security utilities - READ-ONLY VERSION"""

import re
import logging
from typing import Dict
from functools import lru_cache

logger = logging.getLogger(__name__)


class DatabaseSecurity:
    """Optimized database security utilities - READ-ONLY VERSION"""

    # Pre-compiled regex patterns for better performance
    # Use concise character class \w for readability; first char must be letter or underscore
    _TABLE_NAME_PATTERN = re.compile(r"^[A-Za-z0-9_.\-]{1,128}$")
    _DATABASE_NAME_PATTERN = re.compile(r"^[A-Za-z0-9_.\-]{1,128}$")
    _COLUMN_NAME_PATTERN = re.compile(r"^[A-Za-z0-9_.\-]+$")

    @staticmethod
    @lru_cache(maxsize=256)
    def validate_table_name(table_name: str) -> str:
        """
        Cached validation of table names for better performance
        """
        if not table_name:
            raise ValueError("Table name cannot be empty")

        if not DatabaseSecurity._TABLE_NAME_PATTERN.match(table_name):
            raise ValueError(f"Invalid table name: {table_name}")

        return table_name

    @staticmethod
    @lru_cache(maxsize=128)
    def validate_database_name(db_name: str) -> str:
        """Cached validation of database names"""
        if not db_name:
            raise ValueError("Database name cannot be empty")

        if not DatabaseSecurity._DATABASE_NAME_PATTERN.match(db_name):
            raise ValueError(f"Invalid database name: {db_name}")

        return db_name

    @staticmethod
    @lru_cache(maxsize=512)
    def validate_column_name(column_name: str) -> str:
        """Cached validation of column names"""
        if not column_name:
            raise ValueError("Column name cannot be empty")

        if not DatabaseSecurity._COLUMN_NAME_PATTERN.match(column_name):
            raise ValueError(f"Invalid column name: {column_name}")

        return column_name

    @staticmethod
    def analyze_sql_query(query: str) -> Dict:
        """Parse and validate exactly one read-only query."""
        if not query:
            raise ValueError("Query cannot be empty")

        analysis = {
            "is_safe": False,
            "warnings": [],
            "query_type": None,
            "tables_accessed": [],
        }
        try:
            import sqlglot
            from sqlglot import expressions as exp

            statements = [item for item in sqlglot.parse(query) if item is not None]
            if len(statements) != 1:
                analysis["warnings"].append("Exactly one SQL statement is required")
                return analysis

            statement = statements[0]
            allowed_roots = (exp.Select, exp.Union, exp.Intersect, exp.Except)
            if not isinstance(statement, allowed_roots):
                analysis["warnings"].append(
                    "Only read-only SELECT/WITH queries are allowed, not "
                    f"{type(statement).__name__}"
                )
                return analysis

            blocked_types = tuple(
                node_type
                for node_type in (
                    getattr(exp, name, None)
                    for name in (
                        "Insert", "Update", "Delete", "Drop", "Alter",
                        "Create", "TruncateTable", "Command", "Copy",
                        "Into", "Lock", "Merge", "Grant", "Revoke",
                    )
                )
                if node_type is not None
            )
            blocked_nodes = [
                type(node).__name__
                for node in statement.walk()
                if isinstance(node, blocked_types)
            ]
            if blocked_nodes:
                analysis["warnings"].append(
                    "Blocked operation detected: "
                    + ", ".join(sorted(set(blocked_nodes)))
                )
                return analysis

            analysis["query_type"] = (
                "WITH" if statement.args.get("with_") else "SELECT"
            )
            analysis["tables_accessed"] = [
                table.name for table in statement.find_all(exp.Table) if table.name
            ]
            analysis["is_safe"] = True
        except Exception as exc:
            analysis["warnings"].append(f"SQL could not be safely parsed: {exc}")

        return analysis

    @staticmethod
    @lru_cache(maxsize=64)
    def get_safe_query_template(query_type: str, table_name: str) -> str:
        """
        Generate cached safe query templates - READ-ONLY VERSION
        """
        validated_table = DatabaseSecurity.validate_table_name(table_name)

        # Only SELECT templates are provided
        templates = {
            "SELECT": f"SELECT {{columns}} FROM `{validated_table}` {{conditions}}",
            "COUNT": f"SELECT COUNT(*) FROM `{validated_table}` {{conditions}}",
        }

        return templates.get(query_type, "")

    @staticmethod
    def clear_cache():
        """Clear validation caches when needed"""
        DatabaseSecurity.validate_table_name.cache_clear()
        DatabaseSecurity.validate_database_name.cache_clear()
        DatabaseSecurity.validate_column_name.cache_clear()
        DatabaseSecurity.get_safe_query_template.cache_clear()
