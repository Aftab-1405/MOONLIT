from __future__ import annotations

import sys
import unittest
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from core.admin_authorization import get_admin_authorization_decision


class AdminAuthorizationDecisionTests(unittest.TestCase):
    def test_unauthenticated_user_is_rejected_with_401(self) -> None:
        decision = get_admin_authorization_decision(None, "admin-uid")
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.status_code, 401)

    def test_non_admin_user_is_rejected_with_403(self) -> None:
        decision = get_admin_authorization_decision({"uid": "user-uid"}, "admin-uid")
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.status_code, 403)

    def test_missing_admin_configuration_fails_closed_with_403(self) -> None:
        decision = get_admin_authorization_decision({"uid": "admin-uid"}, "")
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.status_code, 403)
        self.assertEqual(decision.reason, "missing_configuration")

    def test_whitespace_admin_configuration_fails_closed(self) -> None:
        decision = get_admin_authorization_decision({"uid": "admin-uid"}, "   ")
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.reason, "missing_configuration")

    def test_configured_admin_is_allowed(self) -> None:
        decision = get_admin_authorization_decision({"uid": "admin-uid"}, "admin-uid")
        self.assertTrue(decision.allowed)
        self.assertIsNone(decision.status_code)
        self.assertEqual(decision.reason, "allowed")

    def test_unicode_uid_is_compared_without_raising(self) -> None:
        decision = get_admin_authorization_decision({"uid": "administrateur-é"}, "administrateur-é")
        self.assertTrue(decision.allowed)


if __name__ == "__main__":
    unittest.main()
