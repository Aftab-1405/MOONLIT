import os
os.environ["FIREBASE_PROJECT_ID"] = "mock"
os.environ["FIREBASE_WEB_PROJECT_ID"] = "mock"

import pytest
from fastapi.testclient import TestClient
import main
from dependencies import get_current_user

# Mock Firebase initialization during import
import services.firestore_service
services.firestore_service.FirestoreService.initialize = lambda: None

app = main.create_app()

@pytest.fixture
def client():
    """Provides a TestClient with overridden auth dependency by default."""
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "test_user_123",
        "email": "test@example.com",
        "name": "Test User",
        "verified": True
    }
    
    from repositories.conversation_repository import ConversationRepository
    original_get = ConversationRepository.get
    original_get_for_user = ConversationRepository.get_for_user
    original_delete = ConversationRepository.delete
    original_rename = ConversationRepository.rename
    
    def mock_rename(cid, uid, title):
        raise ValueError("Conversation not found")
        
    ConversationRepository.get = staticmethod(lambda cid: None)
    ConversationRepository.get_for_user = staticmethod(lambda cid, uid: None)
    ConversationRepository.delete = staticmethod(lambda cid, uid: None)
    ConversationRepository.rename = staticmethod(mock_rename)
    
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()
        ConversationRepository.get = original_get
        ConversationRepository.get_for_user = original_get_for_user
        ConversationRepository.delete = original_delete
        ConversationRepository.rename = original_rename

def test_csrf_bypass_attempt(client):
    # Attempt to execute a POST without the CSRF header
    # Double-submit CSRF checks if header x-csrf-token equals cookie csrf_token.
    # If header is missing, it should fail with 403 Forbidden.
    client.cookies.set("csrf_token", "csrf_token_value")
    response = client.post("/api/v1/user/settings", json={"theme": "dark"})
    assert response.status_code == 403
    assert "Invalid CSRF token" in response.text

def test_csrf_success(client):
    # If CSRF header and cookie match, the request should proceed (e.g. 404/422 but not 403)
    client.cookies.set("csrf_token", "csrf_token_value")
    response = client.post(
        "/api/v1/user/settings", 
        json={"theme": "dark"},
        headers={"x-csrf-token": "csrf_token_value"}
    )
    # The route /api/v1/user/settings might return 404 or success depending on DB, but NOT 403 CSRF error
    assert response.status_code != 403

def test_xss_payload_in_title(client):
    # Attempt to inject a script tag into a conversation title
    xss_payloads = [
        "<script>alert(1)</script>",
        "<img src=x onerror=alert(1)>",
        '\"><svg onload=alert(1)>'
    ]
    client.cookies.set("csrf_token", "csrf_token_value")
    for payload in xss_payloads:
        response = client.patch(
            "/api/v1/rename_conversation/123", 
            json={"title": payload},
            headers={"x-csrf-token": "csrf_token_value"}
        )
        # Should safely return 404 Not Found (since conversation 123 doesn't exist), not crash (500)
        assert response.status_code in [404, 422]
        assert response.status_code != 500

def test_xss_in_all_string_fields(client):
    from services.user_settings_service import UserSettingsService
    
    payloads = [
        "<script>alert(1)</script>",
        "<img src=x onerror=alert(1)>",
        '\"><svg onload=alert(1)>'
    ]
    
    # Mock UserSettingsService to save and retrieve payloads
    stored_prefs = {}
    
    def mock_save(uid, patch):
        stored_prefs.update(patch)
        return stored_prefs
        
    def mock_get_merged(uid):
        return stored_prefs
        
    original_save = UserSettingsService.save
    original_get_merged = UserSettingsService.get_merged
    
    UserSettingsService.save = mock_save
    UserSettingsService.get_merged = mock_get_merged
    
    try:
        for payload in payloads:
            client.cookies.set("csrf_token", "csrf_token_value")
            
            settings_payload = {
                "nullDisplay": payload[:32],
                "llmProvider": payload[:50],
                "llmModel": payload[:150]
            }
            
            # Send payload to POST /api/v1/user/settings
            response = client.post(
                "/api/v1/user/settings",
                json=settings_payload,
                headers={"x-csrf-token": "csrf_token_value"}
            )
            assert response.status_code == 200
            
            # GET settings to verify reflection
            get_response = client.get("/api/v1/user/settings")
            assert get_response.status_code == 200
            data = get_response.json()
            
            settings = data.get("settings", {})
            for field, val in settings_payload.items():
                assert settings.get(field) == val
                
            # HTML Response Check: check that raw script/payload is not printed unescaped as HTML
            assert f"text/html" not in get_response.headers.get("content-type", "").lower()
            
            # Test SQL editor query field
            query_payload = {
                "sql_query": f"SELECT * FROM users WHERE username = '{payload}'"
            }
            response_query = client.post(
                "/api/v1/run_sql_query",
                json=query_payload,
                headers={"x-csrf-token": "csrf_token_value"}
            )
            # Should be blocked or rejected as bad/unconnected query, but NOT cause 500 server error
            assert response_query.status_code != 500
    finally:
        UserSettingsService.save = original_save
        UserSettingsService.get_merged = original_get_merged

def test_path_traversal_in_conversation_id(client):
    traversal_payloads = [
        "../../../../etc/passwd",
        "..%2F..%2F..%2Fetc%2Fshadow",
        "%2e%2e%2f%2e%2e%2fetc%2fpasswd"
    ]
    
    # Endpoints to test
    # 1. /api/v1/get_conversation/{id}
    # 2. /api/v1/delete_conversation/{id} (DELETE)
    # 3. /api/v1/rename_conversation/{id} (PATCH)
    # 4. /api/v1/user/context/schema/{database} (DELETE)
    
    client.cookies.set("csrf_token", "csrf_token_value")
    
    for payload in traversal_payloads:
        # GET /api/v1/get_conversation/{id}
        res_get = client.get(f"/api/v1/get_conversation/{payload}")
        assert res_get.status_code in [400, 404, 422]
        assert res_get.status_code != 500
        
        # DELETE /api/v1/delete_conversation/{id}
        res_del = client.delete(
            f"/api/v1/delete_conversation/{payload}",
            headers={"x-csrf-token": "csrf_token_value"}
        )
        assert res_del.status_code in [400, 404, 422]
        assert res_del.status_code != 500
        
        # PATCH /api/v1/rename_conversation/{id}
        res_patch = client.patch(
            f"/api/v1/rename_conversation/{payload}",
            json={"title": "new title"},
            headers={"x-csrf-token": "csrf_token_value"}
        )
        assert res_patch.status_code in [400, 404, 422]
        assert res_patch.status_code != 500
        
        # DELETE /api/v1/user/context/schema/{database}
        res_schema_del = client.delete(
            f"/api/v1/user/context/schema/{payload}",
            headers={"x-csrf-token": "csrf_token_value"}
        )
        assert res_schema_del.status_code in [400, 404, 422]
        assert res_schema_del.status_code != 500

def test_massive_payload_denial_of_service(client):
    # Send a prompt larger than the allowed limit (50,000 chars)
    massive_string = "A" * 50005
    client.cookies.set("csrf_token", "csrf_token_value")
    response = client.post(
        "/api/v1/pass_user_prompt_to_llm", 
        json={"prompt": massive_string, "conversation_id": "123"},
        headers={"x-csrf-token": "csrf_token_value"}
    )
    # The Pydantic max_length should intercept this and return 422
    assert response.status_code == 422
    assert "VALIDATION_ERROR" in response.text

def test_massive_max_rows_buffer_overflow(client):
    # Send max_rows = 1,000,000,000 to see if we can trigger memory allocation crash
    client.cookies.set("csrf_token", "csrf_token_value")
    response = client.post(
        "/api/v1/run_sql_query", 
        json={"sql_query": "SELECT * FROM users", "max_rows": 1000000000},
        headers={"x-csrf-token": "csrf_token_value"}
    )
    # Should be caught by schema validation (le=100000) returning 422, or 400 (no DB configured)
    assert response.status_code in [400, 422]
    assert response.status_code != 500

def test_sql_injection_payload(client):
    # Pass an explicit SQLi statement to test if the query handles it
    sqli_payload = "SELECT * FROM users; DROP TABLE users; --"
    client.cookies.set("csrf_token", "csrf_token_value")
    response = client.post(
        "/api/v1/run_sql_query", 
        json={"sql_query": sqli_payload},
        headers={"x-csrf-token": "csrf_token_value"}
    )
    # Should be caught by SQL analysis (detects multiple statements or dangerous keywords) and return 422 or 400
    assert response.status_code in [400, 422]
    assert response.status_code != 500

def test_invalid_type_injection(client):
    # Inject an array where a string is expected
    client.cookies.set("csrf_token", "csrf_token_value")
    response = client.post(
        "/api/v1/pass_user_prompt_to_llm", 
        json={"prompt": ["This", "is", "an", "array"], "conversation_id": "123"},
        headers={"x-csrf-token": "csrf_token_value"}
    )
    # Should cleanly validate and reject with 422
    assert response.status_code == 422
