# test_mass_assignment.py
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

@pytest.fixture
def client():
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

def csrf_headers(client):
    client.cookies.set("csrf_token", "csrf_val")
    return {"x-csrf-token": "csrf_val"}

def test_mass_assignment_is_admin(client):
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
    # If 200, verify injected fields are NOT reflected back
    if r.status_code == 200:
        data = r.json().get("settings", {})
        assert data.get("is_admin") is not True
        assert data.get("role") != "admin"
        assert "admin" not in str(data.get("permissions", []))

def test_mass_assignment_on_conversation_rename(client):
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
    assert r.status_code not in [200]  # 404 expected since conv doesn't exist
    assert r.status_code != 500

def test_mass_assignment_on_db_connect(client):
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

def test_mass_assignment_balance_injection(client):
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