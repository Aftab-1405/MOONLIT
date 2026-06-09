import pytest
import httpx

BASE_URL = "http://localhost:5000"

@pytest.fixture
def unauth_client():
    return httpx.Client(base_url=BASE_URL)

# ── HTTP Method Switching ─────────────────────────────────────────────────────

@pytest.mark.integration
@pytest.mark.parametrize("method", ["POST", "PUT", "DELETE", "PATCH"])
def test_integration_method_switch_on_get_conversations(unauth_client, method):
    """Read-only endpoints must reject write methods. Without auth, expect 405 or 401."""
    r = unauth_client.request(method, "/api/v1/get_conversations")
    assert r.status_code in [401, 403, 405], (
        f"METHOD SWITCH: {method} /get_conversations returned {r.status_code}"
    )

@pytest.mark.integration
@pytest.mark.parametrize("method", ["POST", "PUT", "DELETE"])
def test_integration_method_switch_on_db_status(unauth_client, method):
    r = unauth_client.request(method, "/api/v1/db_status")
    assert r.status_code in [401, 403, 405]

@pytest.mark.integration
@pytest.mark.parametrize("method", ["GET", "PUT", "DELETE"])
def test_integration_method_switch_on_connect_db(unauth_client, method):
    """connect_db is POST-only."""
    r = unauth_client.request(method, "/api/v1/connect_db")
    assert r.status_code in [401, 403, 405]

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

@pytest.mark.integration
@pytest.mark.parametrize("method,path", PROTECTED_ENDPOINTS)
def test_integration_protected_endpoint_without_auth(unauth_client, method, path):
    """All protected endpoints must reject unauthenticated requests."""
    r = unauth_client.request(method, path)
    assert r.status_code in [401, 403], (
        f"AUTH BYPASS: {method} {path} returned {r.status_code} without auth"
    )
