# test_security_headers.py
import os
os.environ["FIREBASE_PROJECT_ID"] = "mock"
os.environ["FIREBASE_WEB_PROJECT_ID"] = "mock"

import pytest
from fastapi.testclient import TestClient
import main
import app.features.conversations.infrastructure.firestore_service
app.features.conversations.infrastructure.firestore_service.FirestoreService.initialize = lambda: None

app = main.create_app()
client = TestClient(app)

REQUIRED_HEADERS = {
    "x-content-type-options": "nosniff",
    "x-frame-options": ["DENY", "SAMEORIGIN"],
    "x-xss-protection": "1; mode=block",
    "strict-transport-security": None,   # just presence check
    "referrer-policy": None,
    "permissions-policy": None,
}

FORBIDDEN_HEADERS = [
    "x-powered-by",
    "server",
    "x-aspnet-version",
    "x-runtime",
]

def test_required_security_headers_present():
    r = client.get("/api/v1/")
    for header, expected in REQUIRED_HEADERS.items():
        value = r.headers.get(header)
        assert value is not None, f"MISSING SECURITY HEADER: {header}"
        if isinstance(expected, list):
            assert value.upper() in [e.upper() for e in expected], (
                f"WRONG VALUE: {header} = {value}"
            )
        elif expected is not None:
            assert value.lower() == expected.lower(), (
                f"WRONG VALUE: {header} = {value}, expected {expected}"
            )

def test_information_disclosure_headers_absent():
    r = client.get("/api/v1/")
    for header in FORBIDDEN_HEADERS:
        val = r.headers.get(header)
        if header == "server" and val == "Moonlit":
            continue
        assert val is None, (
            f"INFO DISCLOSURE: Response contains {header}: {val}"
        )

def test_content_type_on_json_responses():
    r = client.get("/api/v1/")
    ct = r.headers.get("content-type", "")
    assert "application/json" in ct

def test_no_stack_trace_in_error_response():
    """Trigger a 404 — must not leak internal paths or stack traces."""
    r = client.get("/api/v1/nonexistent_endpoint_xyz")
    body = r.text.lower()
    assert "traceback" not in body
    assert "file \"/" not in body
    assert "line " not in body or "site-packages" not in body

def test_no_stack_trace_on_invalid_input():
    """Malformed input must return clean error, not stack trace."""
    r = client.post("/api/v1/connect_db", json={"invalid": "payload"})
    body = r.text.lower()
    assert "traceback" not in body
    assert "file \"/" not in body