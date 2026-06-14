# test_information_disclosure.py
import os
os.environ["FIREBASE_PROJECT_ID"] = "mock"
os.environ["FIREBASE_WEB_PROJECT_ID"] = "mock"

import pytest
from fastapi.testclient import TestClient
import main
from app.core.dependencies import get_current_user
import app.features.conversations.infrastructure.firestore_service
app.features.conversations.infrastructure.firestore_service.FirestoreService.initialize = lambda: None

app = main.create_app()

@pytest.fixture
def client():
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "test_user_123",
        "email": "test@example.com",
        "name": "Test User",
        "verified": True
    }
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture
def unauth_client():
    app.dependency_overrides.clear()
    with TestClient(app) as c:
        yield c

LEAK_PATTERNS = [
    "traceback",
    "file \"/",
    "site-packages",
    "sqlalchemy",
    "psycopg2",
    "internal server error at",
    "exception in",
    "/home/",
    "/var/",
    "/usr/",
    "secret_key",
    "password",
    "aws_access_key",
    "firebase_private_key",
]

def assert_no_leak(response_text: str, context: str):
    body = response_text.lower()
    for pattern in LEAK_PATTERNS:
        assert pattern not in body, (
            f"INFO DISCLOSURE [{context}]: Response contains '{pattern}'"
        )

def test_404_does_not_leak(unauth_client):
    r = unauth_client.get("/api/v1/this_does_not_exist_xyz")
    assert_no_leak(r.text, "404 response")

def test_422_does_not_leak(client):
    client.cookies.set("csrf_token", "csrf_val")
    r = client.post(
        "/api/v1/connect_db",
        json={"completely": "wrong", "payload": True},
        headers={"x-csrf-token": "csrf_val"}
    )
    assert r.status_code == 422
    assert_no_leak(r.text, "422 validation error")

def test_db_error_does_not_leak(client):
    """Bad DB connection must return clean error, not connection string or stack."""
    client.cookies.set("csrf_token", "csrf_val")
    payload = {
        "db_type": "postgresql",
        "host": "nonexistent.internal.host",
        "port": 5432,
        "database": "postgres",
        "username": "user",
        "password": "pass"
    }
    r = client.post(
        "/api/v1/connect_db",
        json=payload,
        headers={"x-csrf-token": "csrf_val"}
    )
    assert r.status_code in [400, 500]
    assert_no_leak(r.text, "DB connection error")
    # Specifically: password must never appear in error response
    assert "pass" not in r.text

def test_auth_error_does_not_leak(unauth_client):
    r = unauth_client.get("/api/v1/user/context")
    assert r.status_code in [401, 403]
    assert_no_leak(r.text, "auth error")
    # Must not reveal Firebase internals
    assert "firebase" not in r.text.lower() or \
           r.text.lower().count("firebase") <= 1  # one mention in error msg is okay

def test_openapi_not_exposed_in_production():
    """In production mode, /docs and /openapi.json should be inaccessible."""
    prod_env = os.getenv("APP_ENV", "development")
    if prod_env != "production":
        pytest.skip("Only relevant in production mode")
    with TestClient(app) as c:
        assert c.get("/docs").status_code == 404
        assert c.get("/openapi.json").status_code == 404
        assert c.get("/redoc").status_code == 404