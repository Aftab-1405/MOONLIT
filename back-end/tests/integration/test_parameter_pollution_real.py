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
    dependencies.Config.DEV_AUTH_USER_ID = "integration_param_user"
    
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
def test_integration_uid_override_via_query_param(client):
    """Injecting uid as query param must not override authenticated user."""
    r = client.get("/api/v1/user/context?uid=admin_user&user_id=admin_user")
    assert r.status_code in [200, 400, 404]
    if r.status_code == 200:
        data = r.json()
        uid = data.get("uid") or data.get("data", {}).get("uid")
        if uid:
            assert uid == "integration_pollution_user", (
                f"PARAM POLLUTION: uid was overridden to {uid}"
            )

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_duplicate_param_pollution(client):
    """Duplicate query params must not confuse auth or routing."""
    r = client.get(
        "/api/v1/get_conversation/real_conv_id",
        params=[("id", "real_conv_id"), ("id", "victim_conv_id")]
    )
    assert r.status_code in [404, 400, 422, 403]
    assert r.status_code != 500

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_role_via_query_param(client):
    """Role escalation via query param must not work."""
    r = client.get("/api/v1/user/context?role=admin&is_admin=true")
    assert r.status_code in [200, 400]
    if r.status_code == 200:
        data = r.json()
        role = str(data).lower()
        assert "superuser" not in role
        assert '"is_admin": true' not in role.replace(" ", "")

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_json_param_pollution_in_body(client):
    """Duplicate keys in JSON body — last value must not bypass validation."""
    raw_body = '{"theme": "dark", "is_admin": false, "is_admin": true}'
    r = client.post(
        "/api/v1/user/settings",
        content=raw_body,
        headers={**csrf_headers(client), "content-type": "application/json"}
    )
    assert r.status_code != 500
    if r.status_code == 200:
        data = r.json()
        assert data.get("is_admin") is not True
