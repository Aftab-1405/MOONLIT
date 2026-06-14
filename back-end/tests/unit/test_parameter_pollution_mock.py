# test_parameter_pollution.py
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
        "uid": "normal_user_123",
        "email": "normal@example.com",
        "name": "Normal User",
        "verified": True
    }
    
    from app.features.conversations.infrastructure.conversation_repository import ConversationRepository
    original_get = ConversationRepository.get
    original_get_for_user = ConversationRepository.get_for_user
    original_delete = ConversationRepository.delete
    original_rename = ConversationRepository.rename
    
    ConversationRepository.get = staticmethod(lambda cid: None)
    ConversationRepository.get_for_user = staticmethod(lambda cid, uid: None)
    ConversationRepository.delete = staticmethod(lambda cid, uid: None)
    ConversationRepository.rename = staticmethod(lambda cid, uid, title: None)
    
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()
        ConversationRepository.get = original_get
        ConversationRepository.get_for_user = original_get_for_user
        ConversationRepository.delete = original_delete
        ConversationRepository.rename = original_rename


def csrf_headers(client):
    client.cookies.set("csrf_token", "csrf_val")
    return {"x-csrf-token": "csrf_val"}

def test_uid_override_via_query_param(client):
    """Injecting uid as query param must not override authenticated user."""
    r = client.get("/api/v1/user/context?uid=admin_user&user_id=admin_user")
    assert r.status_code in [200, 400, 404]
    if r.status_code == 200:
        data = r.json()
        # Must reflect normal_user_123, not the injected uid
        uid = data.get("uid") or data.get("data", {}).get("uid")
        if uid:
            assert uid == "normal_user_123", (
                f"PARAM POLLUTION: uid was overridden to {uid}"
            )

def test_duplicate_param_pollution(client):
    """Duplicate query params must not confuse auth or routing."""
    r = client.get(
        "/api/v1/get_conversation/real_conv_id",
        params=[("id", "real_conv_id"), ("id", "victim_conv_id")]
    )
    assert r.status_code in [404, 400, 422]
    assert r.status_code != 500

def test_role_via_query_param(client):
    """Role escalation via query param must not work."""
    r = client.get("/api/v1/user/context?role=admin&is_admin=true")
    assert r.status_code in [200, 400]
    if r.status_code == 200:
        data = r.json()
        role = str(data).lower()
        assert "superuser" not in role
        assert '"is_admin": true' not in role.replace(" ", "")

def test_json_param_pollution_in_body(client):
    """Duplicate keys in JSON body — last value must not bypass validation."""
    import json
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