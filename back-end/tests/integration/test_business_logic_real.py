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
    dependencies.Config.DEV_AUTH_USER_ID = "integration_business_user"
    
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
def test_integration_sql_query_without_db_connection(client):
    """Must not execute query if no DB is connected — no step skipping."""
    r = client.post(
        "/api/v1/run_sql_query",
        json={"sql_query": "SELECT * FROM users"},
        headers=csrf_headers(client)
    )
    assert r.status_code == 400
    assert "No database configured" in r.text

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_schema_select_without_db_connection(client):
    """Must not select schema if no DB connected."""
    r = client.post(
        "/api/v1/select_schema",
        json={"schema_name": "public"},
        headers=csrf_headers(client)
    )
    assert r.status_code == 400

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_database_switch_without_db_connection(client):
    """Must not switch DB if not connected."""
    r = client.post(
        "/api/v1/switch_remote_database",
        json={"database": "target_db"},
        headers=csrf_headers(client)
    )
    assert r.status_code == 400

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_negative_max_rows(client):
    """Negative max_rows must be rejected."""
    r = client.post(
        "/api/v1/run_sql_query",
        json={"sql_query": "SELECT 1", "max_rows": -1},
        headers=csrf_headers(client)
    )
    assert r.status_code in [400, 422]

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_zero_max_rows(client):
    """Zero max_rows is nonsensical — must be rejected or treated as default."""
    r = client.post(
        "/api/v1/run_sql_query",
        json={"sql_query": "SELECT 1", "max_rows": 0},
        headers=csrf_headers(client)
    )
    assert r.status_code in [400, 422]

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_resume_agent_without_active_conversation(client):
    """resume_agent on nonexistent conversation must not crash, should return error."""
    r = client.post(
        "/api/v1/resume_agent",
        json={"conversation_id": "ghost_conv", "resume": {"choice": "1"}},
        headers=csrf_headers(client)
    )
    assert r.status_code in [200, 404, 400, 403]
    assert r.status_code != 500

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_rename_with_only_whitespace(client):
    """Whitespace-only title must be rejected."""
    r = client.patch(
        "/api/v1/rename_conversation/some_conv",
        json={"title": "     "},
        headers=csrf_headers(client)
    )
    assert r.status_code == 422

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_oversized_sql_query(client):
    """Extremely long SQL must be handled gracefully."""
    giant_query = "SELECT " + "1," * 10000 + "1"
    r = client.post(
        "/api/v1/run_sql_query",
        json={"sql_query": giant_query},
        headers=csrf_headers(client)
    )
    assert r.status_code in [400, 422]
    assert r.status_code != 500
