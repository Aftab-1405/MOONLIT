# test_broken_access_control.py
import os
os.environ["FIREBASE_PROJECT_ID"] = "mock"
os.environ["FIREBASE_WEB_PROJECT_ID"] = "mock"

import pytest
from fastapi.testclient import TestClient
import main
from dependencies import get_current_user
import services.firestore_service
services.firestore_service.FirestoreService.initialize = lambda: None

app = main.create_app()

NORMAL_USER = {
    "uid": "normal_user_123",
    "email": "normal@example.com",
    "name": "Normal User",
    "verified": True
}

@pytest.fixture
def client():
    app.dependency_overrides[get_current_user] = lambda: NORMAL_USER
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture
def unauth_client():
    """No auth override — raw unauthenticated client."""
    app.dependency_overrides.clear()
    with TestClient(app) as c:
        yield c

def csrf_headers(client):
    client.cookies.set("csrf_token", "csrf_val")
    return {"x-csrf-token": "csrf_val"}

# ── HTTP Method Switching ─────────────────────────────────────────────────────

@pytest.mark.parametrize("method", ["POST", "PUT", "DELETE", "PATCH"])
def test_method_switch_on_get_conversations(client, method):
    """Read-only endpoints must reject write methods."""
    r = client.request(method, "/api/v1/get_conversations", headers=csrf_headers(client))
    assert r.status_code in [405, 403, 404], (
        f"METHOD SWITCH: {method} /get_conversations returned {r.status_code}"
    )

@pytest.mark.parametrize("method", ["POST", "PUT", "DELETE"])
def test_method_switch_on_db_status(client, method):
    r = client.request(method, "/api/v1/db_status", headers=csrf_headers(client))
    assert r.status_code in [405, 403, 404]

@pytest.mark.parametrize("method", ["GET", "PUT", "DELETE"])
def test_method_switch_on_connect_db(client, method):
    """connect_db is POST-only."""
    r = client.request(method, "/api/v1/connect_db", headers=csrf_headers(client))
    assert r.status_code in [405, 403, 404]

# ── Unauthenticated Access ────────────────────────────────────────────────────

PROTECTED_ENDPOINTS = [
    ("GET",  "/api/v1/get_conversations"),
    ("GET",  "/api/v1/quota/status"),
    ("GET",  "/api/v1/user/context"),
    ("GET",  "/api/v1/user/settings"),
    ("POST", "/api/v1/connect_db"),
    ("POST", "/api/v1/run_sql_query"),
    ("GET",  "/api/v1/llm/options"),
]

@pytest.mark.parametrize("method,path", PROTECTED_ENDPOINTS)
def test_protected_endpoint_without_auth(unauth_client, method, path):
    """All protected endpoints must reject unauthenticated requests."""
    r = unauth_client.request(method, path)
    assert r.status_code in [401, 403], (
        f"AUTH BYPASS: {method} {path} returned {r.status_code} without auth"
    )