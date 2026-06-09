import os
import pytest
import importlib
from fastapi.testclient import TestClient

@pytest.fixture(scope="module")
def client():
    import dependencies
    import main
    
    orig_bypass = dependencies.Config.DEV_AUTH_BYPASS
    orig_debug = dependencies.Config.DEBUG
    orig_user = dependencies.Config.DEV_AUTH_USER_ID
    
    dependencies.Config.DEV_AUTH_BYPASS = True
    dependencies.Config.DEBUG = True
    dependencies.Config.DEV_AUTH_USER_ID = "integration_mass_user"
    
    app = main.create_app()
    with TestClient(app) as c:
        yield c
        
    dependencies.Config.DEV_AUTH_BYPASS = orig_bypass
    dependencies.Config.DEBUG = orig_debug
    dependencies.Config.DEV_AUTH_USER_ID = orig_user

def csrf_headers(client):
    client.cookies.set("csrf_token", "csrf_val")
    return {"x-csrf-token": "csrf_val"}

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_mass_assignment_is_admin(client):
    """Injecting is_admin=true must not escalate privileges."""
    payload = {
        "theme": "dark",
        "is_admin": True,
        "role": "admin",
        "verified": True,
        "permissions": ["read", "write", "delete", "admin"]
    }
    r = client.post("/api/v1/user/settings", json=payload, headers=csrf_headers(client))
    assert r.status_code != 500
    if r.status_code == 200:
        data = r.json().get("settings", {})
        assert data.get("is_admin") is not True
        assert data.get("role") != "admin"
        assert "admin" not in str(data.get("permissions", []))

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_mass_assignment_on_conversation_rename(client):
    """Rename endpoint must not accept ownership transfer fields."""
    payload = {
        "title": "legit title",
        "user_id": "attacker_owns_now",
        "owner": "attacker_123",
        "is_public": True
    }
    r = client.patch(
        "/api/v1/rename_conversation/test_conv",
        json=payload,
        headers=csrf_headers(client)
    )
    assert r.status_code not in [200]
    assert r.status_code != 500

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_mass_assignment_on_db_connect(client):
    """DB connect must not accept privilege escalation fields."""
    payload = {
        "db_type": "postgresql",
        "host": "localhost",
        "port": 5432,
        "database": "postgres",
        "username": "normal_user",
        "password": "pass",
        "is_admin": True,
        "role": "superuser",
        "bypass_auth": True
    }
    r = client.post("/api/v1/connect_db", json=payload, headers=csrf_headers(client))
    assert r.status_code != 500
    if r.status_code == 200:
        data = r.json()
        assert data.get("role") != "superuser"
        assert data.get("bypass_auth") is not True

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_mass_assignment_balance_injection(client):
    """Numeric privilege fields must be ignored."""
    payload = {
        "theme": "dark",
        "quota_limit": 999999,
        "balance": 999999,
        "plan": "enterprise",
        "max_requests": 999999
    }
    r = client.post("/api/v1/user/settings", json=payload, headers=csrf_headers(client))
    assert r.status_code != 500
    if r.status_code == 200:
        data = r.json().get("settings", {})
        assert data.get("quota_limit") != 999999
        assert data.get("plan") != "enterprise"
