"""Sanitized exception formatting for API responses and LLM tool output.

Two concerns are interleaved in this module:

1. **User-facing / LLM-facing error sanitization** — DB driver errors and
   internal tracebacks routinely leak schema names, column names,
   connection strings, and hostnames. When these are surfaced to the LLM
   in tool output, the LLM may quote them back to the user. When they
   are surfaced in HTTP error responses, attackers gain reconnaissance.

2. **Classified error categories** — the AI tool executor needs a
   stable category string ("table_not_found", "permission_denied",
   "timeout", "syntax_error", "unknown") so it can write a helpful
   retry message instead of dumping the raw exception.

All helpers are pure functions.
"""

from __future__ import annotations

import re
from typing import Literal

#: Maximum length of any sanitized error string. Long errors are
#: truncated with an ellipsis; the tail is never kept because driver
#: errors often put the offending SQL fragment at the end.
_MAX_SANITIZED_LEN: int = 280

#: Token bucket of regex patterns matched against the *lower-cased* error
#: message. First match wins. Order matters — more specific patterns first.
_ERROR_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\b(table|view|relation).*does not exist\b"), "table_not_found"),
    (re.compile(r"\bunknown (table|view|column)\b"), "table_not_found"),
    (re.compile(r"\binvalid column name\b"), "column_not_found"),
    (re.compile(r"\bcolumn .* does not exist\b"), "column_not_found"),
    (re.compile(r"\bunrecognized column\b"), "column_not_found"),
    (re.compile(r"\bpermission denied\b"), "permission_denied"),
    (re.compile(r"\baccess denied\b"), "permission_denied"),
    (re.compile(r"\binsufficient privilege\b"), "permission_denied"),
    (re.compile(r"\bORA-\d{5}: insufficient privileges\b"), "permission_denied"),
    (re.compile(r"\btimeout expired\b"), "timeout"),
    (re.compile(r"\bmax_execution_time exceeded\b"), "timeout"),
    (re.compile(r"\bstatement timeout\b"), "timeout"),
    (re.compile(r"\bcanceling statement due to timeout\b"), "timeout"),
    (re.compile(r"\bdeadlock\b"), "deadlock"),
    (
        re.compile(r"\bviolates (?:foreign key|unique|primary key|not-null|check) constraint\b"),
        "constraint_violation",
    ),
    (re.compile(r"\bduplicate key\b"), "constraint_violation"),
    (re.compile(r"\bsyntax error\b"), "syntax_error"),
    (re.compile(r"\bORA-01756\b"), "syntax_error"),
    (re.compile(r"\bconnection refused\b"), "connection_error"),
    (re.compile(r"\bconnection reset\b"), "connection_error"),
    (re.compile(r"\bserver closed the connection\b"), "connection_error"),
    (re.compile(r"\blost connection\b"), "connection_error"),
    (re.compile(r"\btoo many connections\b"), "connection_error"),
)

#: Stable outcome type returned to callers.
ErrorCategory = Literal[
    "table_not_found",
    "column_not_found",
    "permission_denied",
    "timeout",
    "deadlock",
    "constraint_violation",
    "syntax_error",
    "connection_error",
    "unknown",
]


def classify_db_error(message: str) -> ErrorCategory:
    """Classify a DB driver error message into a stable category.

    Args:
        message: Raw error message from the DB driver.

    Returns:
        One of the :data:`ErrorCategory` literals. ``"unknown"`` if no
        pattern matched.
    """
    if not message:
        return "unknown"
    lowered = message.lower()
    for pattern, category in _ERROR_PATTERNS:
        if pattern.search(lowered):
            return category  # type: ignore[return-value]
    return "unknown"


#: Substrings removed from sanitized error messages because they reveal
#: infrastructure details (schema names, hosts, paths) that the LLM and
#: end users do not need.
_LEAKAGE_PATTERNS: tuple[re.Pattern[str], str, ...] = (
    # Connection-string fragments: `user:pass@host:port/db`
    (
        re.compile(r"\b[A-Za-z0-9_.-]+:[^@\s]+@[A-Za-z0-9_.-]+(?::\d+)?(?:/\S*)?"),
        "[connection-string]",
    ),
    # `host=...` `password=...` `user=...` key/value fragments
    (
        re.compile(
            r"\b(host|user|username|password|passwd|dsn|port|database|dbname)\s*=\s*[^\s;]+",
            re.IGNORECASE,
        ),
        "[redacted]",
    ),
    # Filesystem paths from tracebacks
    (re.compile(r"/(?:[A-Za-z0-9_.-]+/)+[A-Za-z0-9_.-]+"), "[path]"),
    # SQL Server / Oracle bracketed identifiers leaked in errors
    (re.compile(r"'[^']*\.dbo\.[^']*'"), "[schema]"),
)


def sanitize_error_message(message: str, *, max_length: int = _MAX_SANITIZED_LEN) -> str:
    """Return a PII-safe, length-capped version of ``message``.

    Args:
        message: Raw error string (typically ``str(exception)``).
        max_length: Maximum returned length.

    Returns:
        Sanitized message with connection strings, credentials, and
        filesystem paths replaced by ``[redacted]`` / ``[path]``.
        Truncated to ``max_length`` with a trailing ellipsis if needed.
    """
    if not message:
        return ""
    sanitized = message
    for pattern, replacement in _LEAKAGE_PATTERNS:
        sanitized = pattern.sub(replacement, sanitized)
    if len(sanitized) > max_length:
        sanitized = sanitized[: max_length - 1] + "…"
    return sanitized


def sanitize_exception(exc: BaseException) -> str:
    """Sanitize an exception for safe inclusion in API / LLM responses.

    Args:
        exc: Any exception.

    Returns:
        A sanitized, length-capped string. Never includes the exception
        traceback.
    """
    return sanitize_error_message(str(exc))


__all__ = [
    "ErrorCategory",
    "classify_db_error",
    "sanitize_error_message",
    "sanitize_exception",
]
