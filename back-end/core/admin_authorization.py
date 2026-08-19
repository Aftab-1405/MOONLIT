"""Pure, fail-closed authorization decisions for administrative routes."""

from __future__ import annotations

from dataclasses import dataclass
from hmac import compare_digest
from typing import Mapping


@dataclass(frozen=True)
class AdminAuthorizationDecision:
    allowed: bool
    status_code: int | None
    reason: str


def get_admin_authorization_decision(
    user: Mapping[str, object] | None,
    admin_uid: str | None,
) -> AdminAuthorizationDecision:
    """Return the server authorization decision for an administrative user."""
    if not user or not user.get("uid"):
        return AdminAuthorizationDecision(False, 401, "unauthenticated")

    configured_admin_uid = admin_uid.strip() if isinstance(admin_uid, str) else ""
    if not configured_admin_uid:
        return AdminAuthorizationDecision(False, 403, "missing_configuration")

    user_uid = str(user["uid"])
    if not compare_digest(user_uid.encode("utf-8"), configured_admin_uid.encode("utf-8")):
        return AdminAuthorizationDecision(False, 403, "forbidden")

    return AdminAuthorizationDecision(True, None, "allowed")
