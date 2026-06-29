# File: database/security.py
"""Optimized Database security utilities - READ-ONLY VERSION"""

import re
import logging
from typing import List, Optional, Dict
from functools import lru_cache

logger = logging.getLogger(__name__)


class DatabaseSecurity:
    """Optimized database security utilities - READ-ONLY VERSION"""

    # Pre-compiled regex patterns for better performance
    # Use concise character class \w for readability; first char must be letter or underscore
    _TABLE_NAME_PATTERN = re.compile(r"^[A-Za-z0-9_.\-]{1,128}$")
    _DATABASE_NAME_PATTERN = re.compile(r"^[A-Za-z0-9_.\-]{1,128}$")
    _COLUMN_NAME_PATTERN = re.compile(r"^[A-Za-z0-9_.\-]+$")

    # Optimized keyword sets - READ-ONLY FOCUSED
    ALLOWED_KEYWORDS = frozenset(
        {
            "SELECT",
            "FROM",
            "WHERE",
            "ORDER",
            "BY",
            "GROUP",
            "HAVING",
            "LIMIT",
            "OFFSET",
            "JOIN",
            "LEFT",
            "RIGHT",
            "INNER",
            "OUTER",
            "ON",
            "AS",
            "AND",
            "OR",
            "NOT",
            "IN",
            "LIKE",
            "BETWEEN",
            "IS",
            "NULL",
            "COUNT",
            "SUM",
            "AVG",
            "MAX",
            "MIN",
            "DISTINCT",
            "ASC",
            "DESC",
            "CASE",
            "WHEN",
            "THEN",
            "ELSE",
            "END",
            "WITH",
            "RECURSIVE",  # CTEs (Common Table Expressions)
        }
    )

    # Expanded dangerous keywords to include all DML operations
    DANGEROUS_KEYWORDS = frozenset(
        {
            "DROP",
            "CREATE",
            "ALTER",
            "TRUNCATE",
            "GRANT",
            "REVOKE",
            "EXEC",
            "EXECUTE",
            "UNION",
            "SCRIPT",
            "DECLARE",
            "CALL",
            "PROCEDURE",
            "FUNCTION",
            "INSERT",
            "UPDATE",
            "DELETE",
            "INTO",
            "VALUES",
            "SET",
        }
    )

    # Query type detection patterns - Only SELECT and WITH(CTE) are allowed
    _QUERY_TYPE_PATTERNS = {
        "SELECT": re.compile(r"^\s*SELECT\b", re.IGNORECASE),
        "WITH": re.compile(r"^\s*WITH\b", re.IGNORECASE),  # CTE - also a SELECT query
        "INSERT": re.compile(r"^\s*INSERT\b", re.IGNORECASE),
        "UPDATE": re.compile(r"^\s*UPDATE\b", re.IGNORECASE),
        "DELETE": re.compile(r"^\s*DELETE\b", re.IGNORECASE),
    }

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
    def _detect_query_type(query_stripped: str) -> Optional[str]:
        """Return detected query type or None."""
        for query_type, pattern in DatabaseSecurity._QUERY_TYPE_PATTERNS.items():
            if pattern.match(query_stripped):
                return query_type
        return None

    @staticmethod
    def _is_query_type_allowed(query_type: Optional[str]) -> bool:
        """Only SELECT and WITH (CTE) are allowed."""
        return query_type in ("SELECT", "WITH")

    @staticmethod
    def _detect_dangerous_keywords(query_upper: str):
        """Return set of dangerous keywords found in the query."""
        # Use regex to extract purely alphabetical words, bypassing any
        # punctuation or comment evasion tactics like `DELETE/**/FROM`
        query_words = set(re.findall(r'\b[A-Z]+\b', query_upper))
        return query_words & DatabaseSecurity.DANGEROUS_KEYWORDS

    @staticmethod
    def _has_multiple_statements(query: str) -> bool:
        semicolon_count = query.count(";")
        return semicolon_count > 1 or (
            semicolon_count == 1 and not query.rstrip().endswith(";")
        )

    @staticmethod
    def _detect_comments_and_file_ops(
        query: str, query_upper: str
    ) -> tuple[List[str], bool]:
        warnings = []
        should_block = False
        if "--" in query or "/*" in query:
            warnings.append("SQL comments detected")
        if "OUTFILE" in query_upper or "DUMPFILE" in query_upper:
            warnings.append("File operations are not allowed")
            should_block = True
        if "LOAD_FILE" in query_upper or "LOAD DATA" in query_upper:
            warnings.append("File loading operations are not allowed")
            should_block = True
        return warnings, should_block

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
