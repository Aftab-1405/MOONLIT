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
    dependencies.Config.DEV_AUTH_USER_ID = "integration_hacks_user"
    
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
def test_integration_csrf_bypass_attempt(client):
    client.cookies.set("csrf_token", "csrf_token_value")
    response = client.post("/api/v1/user/settings", json={"theme": "dark"})
    assert response.status_code == 403
    assert "Invalid CSRF token" in response.text

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_csrf_success(client):
    client.cookies.set("csrf_token", "csrf_token_value")
    response = client.post(
        "/api/v1/user/settings", 
        json={"theme": "dark"},
        headers={"x-csrf-token": "csrf_token_value"}
    )
    assert response.status_code != 403

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_xss_payload_in_title(client):
    xss_payloads = [
        "<script>alert(1)</script>",
        "<img src=x onerror=alert(1)>",
        '\"><svg onload=alert(1)>'
    ]
    client.cookies.set("csrf_token", "csrf_token_value")
    for payload in xss_payloads:
        response = client.patch(
            "/api/v1/rename_conversation/123_missing", 
            json={"title": payload},
            headers={"x-csrf-token": "csrf_token_value"}
        )
        assert response.status_code in [404, 422]
        assert response.status_code != 500

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_xss_in_all_string_fields(client):
    payloads = [
        "<script>alert(1)</script>",
        "<img src=x onerror=alert(1)>",
        '\"><svg onload=alert(1)>'
    ]
    
    for payload in payloads:
        client.cookies.set("csrf_token", "csrf_token_value")
        
        settings_payload = {
            "nullDisplay": payload[:32],
            "llmProvider": payload[:50],
            "llmModel": payload[:150]
        }
        
        response = client.post(
            "/api/v1/user/settings",
            json=settings_payload,
            headers={"x-csrf-token": "csrf_token_value"}
        )
        assert response.status_code == 200
        
        get_response = client.get("/api/v1/user/settings")
        assert get_response.status_code == 200
        data = get_response.json()
        
        settings = data.get("settings", {})
        for field, val in settings_payload.items():
            assert settings.get(field) == val
            
        assert f"text/html" not in get_response.headers.get("content-type", "").lower()
        
        query_payload = {
            "sql_query": f"SELECT * FROM users WHERE username = '{payload}'"
        }
        response_query = client.post(
            "/api/v1/run_sql_query",
            json=query_payload,
            headers={"x-csrf-token": "csrf_token_value"}
        )
        assert response_query.status_code != 500

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_path_traversal_in_conversation_id(client):
    traversal_payloads = [
        "../../../../etc/passwd",
        "..%2F..%2F..%2Fetc%2Fshadow",
        "%2e%2e%2f%2e%2e%2fetc%2fpasswd"
    ]
    
    client.cookies.set("csrf_token", "csrf_token_value")
    
    for payload in traversal_payloads:
        res_get = client.get(f"/api/v1/get_conversation/{payload}")
        assert res_get.status_code in [400, 404, 422, 403]
        assert res_get.status_code != 500
        
        res_del = client.delete(
            f"/api/v1/delete_conversation/{payload}",
            headers={"x-csrf-token": "csrf_token_value"}
        )
        assert res_del.status_code in [400, 404, 422, 403]
        assert res_del.status_code != 500
        
        res_patch = client.patch(
            f"/api/v1/rename_conversation/{payload}",
            json={"title": "new title"},
            headers={"x-csrf-token": "csrf_token_value"}
        )
        assert res_patch.status_code in [400, 404, 422, 403]
        assert res_patch.status_code != 500
        
        res_schema_del = client.delete(
            f"/api/v1/user/context/schema/{payload}",
            headers={"x-csrf-token": "csrf_token_value"}
        )
        assert res_schema_del.status_code in [400, 404, 422, 403]
        assert res_schema_del.status_code != 500

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_massive_payload_denial_of_service(client):
    massive_string = "A" * 50005
    client.cookies.set("csrf_token", "csrf_token_value")
    response = client.post(
        "/api/v1/pass_user_prompt_to_llm", 
        json={"prompt": massive_string, "conversation_id": "123"},
        headers={"x-csrf-token": "csrf_token_value"}
    )
    assert response.status_code == 422
    assert "VALIDATION_ERROR" in response.text

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_massive_max_rows_buffer_overflow(client):
    client.cookies.set("csrf_token", "csrf_token_value")
    response = client.post(
        "/api/v1/run_sql_query", 
        json={"sql_query": "SELECT * FROM users", "max_rows": 1000000000},
        headers={"x-csrf-token": "csrf_token_value"}
    )
    assert response.status_code in [400, 422]
    assert response.status_code != 500

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_sql_injection_payload(client):
    sqli_payload = "SELECT * FROM users; DROP TABLE users; --"
    client.cookies.set("csrf_token", "csrf_token_value")
    response = client.post(
        "/api/v1/run_sql_query", 
        json={"sql_query": sqli_payload},
        headers={"x-csrf-token": "csrf_token_value"}
    )
    assert response.status_code in [400, 422]
    assert response.status_code != 500

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_invalid_type_injection(client):
    client.cookies.set("csrf_token", "csrf_token_value")
    response = client.post(
        "/api/v1/pass_user_prompt_to_llm", 
        json={"prompt": ["This", "is", "an", "array"], "conversation_id": "123"},
        headers={"x-csrf-token": "csrf_token_value"}
    )
    assert response.status_code == 422
