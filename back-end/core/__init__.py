"""Cross-cutting infrastructure shared by every backend layer.

This package hosts utilities that are intentionally *not* business logic:
PII redaction, secret-free error sanitization, structured audit logging,
and constant-time comparisons.  Putting them in their own package keeps
the import graph clean — every layer may depend on ``core`` but ``core``
depends on nothing inside the application.

Modules
-------
- :mod:`core.security`  — PII redaction, secret scanning, identifier rules.
- :mod:`core.audit`     — structured audit-event emitter (SOX/PCI-friendly).
- :mod:`core.errors`    — sanitized exception formatting for API/LLM paths.
- :mod:`core.logging`   — request-id / correlation-id logging context.
"""

from __future__ import annotations

__all__: list[str] = []
