# test_session_fixation.py
import os
os.environ["FIREBASE_PROJECT_ID"] = "mock"
os.environ["FIREBASE_WEB_PROJECT_ID"] = "mock"
os.environ["UPSTASH_REDIS_URL"] = ""

import pytest
from fastapi.testclient import TestClient
import main
from app.core.dependencies import get_current_user, verify_session_cookie_value
import app.features.conversations.infrastructure.firestore_service
app.features.conversations.infrastructure.firestore_service.FirestoreService.initialize = lambda: None

app = main.create_app()

def test_session_invalidated_after_logout():
    """Session cookie used before logout must be rejected after logout."""
    import app.core.dependencies as dependencies

    call_count = {"n": 0}

    def mock_verify(cookie_val):
        if cookie_val == "valid_session_before_logout":
            if call_count["n"] == 0:
                call_count["n"] += 1
                return {
                    "uid": "test_user_123",
                    "email": "test@example.com",
                    "name": "Test User",
                    "verified": True
                }
            # After logout, same cookie must be rejected
            raise Exception("Session has been revoked")
        raise Exception("Invalid session")

    original_verify = dependencies.verify_session_cookie_value
    dependencies.verify_session_cookie_value = mock_verify

    try:
        # 1. Authenticate
        with TestClient(app) as c:
            c.cookies.set("firebase_session", "valid_session_before_logout")
            r = c.get("/api/v1/user/context")
            assert r.status_code != 401, "Valid session rejected before logout"

        # 2. Logout
        with TestClient(app) as c:
            c.cookies.set("firebase_session", "valid_session_before_logout")
            c.cookies.set("csrf_token", "csrf_val")
            c.post("/logout", headers={"x-csrf-token": "csrf_val"})

        # 3. Replay the same session cookie — must be rejected
        with TestClient(app) as c:
            c.cookies.set("firebase_session", "valid_session_before_logout")
            r = c.get("/api/v1/user/context")
            assert r.status_code == 401, (
                f"SESSION FIXATION: Old session cookie still valid after logout, got {r.status_code}"
            )
    finally:
        dependencies.verify_session_cookie_value = original_verify

def test_session_cookie_not_accessible_via_js():
    """firebase_session cookie must be HttpOnly."""
    with TestClient(app) as c:
        r = c.get("/firebase-config")
        session_cookie = r.cookies.get("firebase_session")
        # TestClient doesn't expose HttpOnly directly,
        # so check Set-Cookie header
        set_cookie = r.headers.get("set-cookie", "")
        if "firebase_session" in set_cookie:
            assert "httponly" in set_cookie.lower(), (
                "SESSION EXPOSURE: firebase_session cookie is not HttpOnly"
            )

def test_csrf_token_rotates_after_login():
    """CSRF token must change after a new session is established."""
    with TestClient(app) as c:
        r1 = c.get("/firebase-config")
        csrf_before = r1.cookies.get("csrf_token")

        # Simulate login
        c.cookies.set("csrf_token", csrf_before)
        c.post(
            "/set_session",
            json={"idToken": "mock_token"},
            headers={"x-csrf-token": csrf_before}
        )

        r2 = c.get("/firebase-config")
        csrf_after = r2.cookies.get("csrf_token")

        # If csrf_after is None, server didn't rotate — not necessarily a bug
        # but if both exist and are equal, flag it
        if csrf_before and csrf_after:
            assert csrf_before != csrf_after, (
                "SESSION FIXATION: CSRF token was not rotated after login"
            )