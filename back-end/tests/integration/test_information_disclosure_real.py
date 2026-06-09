import os
import pytest
import importlib
from fastapi.testclient import TestClient

@pytest.fixture(scope="module")
def app_prod():
    import main
    
    orig_debug = main.AppConfig.DEBUG
    main.AppConfig.DEBUG = False
    
    app = main.create_app()
    yield app
    
    main.AppConfig.DEBUG = orig_debug

@pytest.fixture(scope="module")
def client(app_prod):
    import dependencies
    
    orig_bypass = dependencies.Config.DEV_AUTH_BYPASS
    orig_debug = dependencies.Config.DEBUG
    orig_user = dependencies.Config.DEV_AUTH_USER_ID
    
    dependencies.Config.DEV_AUTH_BYPASS = True
    dependencies.Config.DEBUG = True
    dependencies.Config.DEV_AUTH_USER_ID = "integration_info_user"
    
    with TestClient(app_prod) as c:
        yield c
        
    dependencies.Config.DEV_AUTH_BYPASS = orig_bypass
    dependencies.Config.DEBUG = orig_debug
    dependencies.Config.DEV_AUTH_USER_ID = orig_user

@pytest.fixture(scope="module")
def unauth_client(app_prod):
    import dependencies
    orig_bypass = dependencies.Config.DEV_AUTH_BYPASS
    dependencies.Config.DEV_AUTH_BYPASS = False
    with TestClient(app_prod) as c:
        yield c
    dependencies.Config.DEV_AUTH_BYPASS = orig_bypass

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

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_404_does_not_leak(unauth_client):
    r = unauth_client.get("/api/v1/this_does_not_exist_xyz")
    assert_no_leak(r.text, "404 response")

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_422_does_not_leak(client):
    client.cookies.set("csrf_token", "csrf_val")
    r = client.post(
        "/api/v1/connect_db",
        json={"completely": "wrong", "payload": True},
        headers={"x-csrf-token": "csrf_val"}
    )
    assert r.status_code == 422
    assert_no_leak(r.text, "422 validation error")

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_db_error_does_not_leak(client):
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
    assert "pass" not in r.text

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_auth_error_does_not_leak(client):
    import dependencies
    orig_bypass = dependencies.Config.DEV_AUTH_BYPASS
    dependencies.Config.DEV_AUTH_BYPASS = False
    
    r = client.get("/api/v1/user/context")
    dependencies.Config.DEV_AUTH_BYPASS = orig_bypass
    
    assert r.status_code in [401, 403], f"Expected 401 or 403, got {r.status_code}"
    assert_no_leak(r.text, "auth error")
    assert "firebase" not in r.text.lower() or \
           r.text.lower().count("firebase") <= 1

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_openapi_not_exposed_in_production(client):
    """In production mode, /docs and /openapi.json should be inaccessible."""
    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404
    assert client.get("/redoc").status_code == 404
