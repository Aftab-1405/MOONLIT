"""Structured audit-event emitter for SOX / PCI / internal-bank compliance.

The backend runs inside a bank — every privileged action (SQL execution,
conversation deletion, auth event, memory mutation, connection lifecycle)
must emit a structured audit record that an external SIEM can ingest.

Design
------
- **Single emitter**: :func:`audit_log` is the only public entry point.
- **JSON line format**: every record is a single-line JSON object so it
  can be streamed to a file, Redis Stream, or Kinesis Firehose without
  parsing.
- **PII-safe**: the ``core.security.redact`` helper is applied to every
  ``details`` payload before serialization.
- **Idempotent**: callers may pass an ``idempotency_key`` so duplicate
  audit records (e.g. on retry) can be de-duplicated downstream.
- **Async-safe**: a :class:`logging.Logger` is used under the hood; no
  global mutable state.

Usage
-----
>>> audit_log(
...     actor="user:u-123",
...     action="sql.execute",
...     resource="db:customers/query",
...     outcome="success",
...     details={"row_count": 42, "execution_time_ms": 18},
... )

Notes
-----
This module never raises — audit logging is best-effort. A failure to
emit an audit record must not break the request path.
"""

from __future__ import annotations

import json
import logging
import os
import secrets
import time
from typing import Any, Mapping

from core.security import redact

#: Dedicated logger — operators can route audit events to a separate
#: sink (file, syslog, Kinesis) without affecting application logs.
_AUDIT_LOGGER_NAME: str = "audit"

_audit_logger: logging.Logger = logging.getLogger(_AUDIT_LOGGER_NAME)
_audit_logger.setLevel(logging.INFO)

# Attach a NullHandler so that "no audit handler configured" never breaks
# the request path. Operators add a real handler (FileHandler, syslog,
# CloudWatch agent) via deployment configuration.
if not _audit_logger.handlers:
    _audit_logger.addHandler(logging.NullHandler())


def _new_event_id() -> str:
    """Return a fresh, sortable audit-event ID."""
    return f"evt_{secrets.token_urlsafe(12)}"


def audit_log(
    *,
    actor: str,
    action: str,
    resource: str,
    outcome: str,
    details: Mapping[str, Any] | None = None,
    idempotency_key: str | None = None,
    request_id: str | None = None,
    actor_ip: str | None = None,
) -> None:
    """Emit a structured audit event.

    Args:
        actor: Identifier of the actor (e.g. ``"user:u-123"``,
            ``"system:vamp-maintenance"``, ``"agent:langgraph"``).
        action: Dotted action path (e.g. ``"sql.execute"``,
            ``"conversation.delete"``, ``"auth.login"``).
        resource: Identifier of the affected resource (e.g.
            ``"db:customers/query"``, ``"conversation:c-456"``).
        outcome: ``"success"``, ``"failure"``, or ``"denied"``.
        details: Optional mapping with action-specific metadata. PII and
            secrets are redacted automatically.
        idempotency_key: Optional de-duplication key (e.g. request ID).
        request_id: Optional correlation ID for cross-service tracing.
        actor_ip: Optional IP of the originating client.

    Notes:
        - Never raises; logging failures are swallowed.
        - Emits a single JSON line at INFO level on the ``audit`` logger.
    """
    safe_details = redact(dict(details)) if details else {}
    payload = {
        "event_id": _new_event_id(),
        "ts": time.time(),
        "actor": actor,
        "action": action,
        "resource": resource,
        "outcome": outcome,
        "details": safe_details,
    }
    if idempotency_key:
        payload["idempotency_key"] = idempotency_key
    if request_id:
        payload["request_id"] = request_id
    if actor_ip:
        payload["actor_ip"] = actor_ip
    pid = os.getpid()
    payload["pid"] = pid
    try:
        _audit_logger.info(json.dumps(payload, separators=(",", ":"), default=str))
    except Exception:  # pragma: no cover - audit must never break request
        pass


__all__ = ["audit_log"]
