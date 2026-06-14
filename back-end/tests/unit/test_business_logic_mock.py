# test_business_logic.py
import os
os.environ["FIREBASE_PROJECT_ID"] = "mock"
os.environ["FIREBASE_WEB_PROJECT_ID"] = "mock"

import pytest
from fastapi.testclient import TestClient
import main
from app.core.dependencies import get_current_user
from app.features.conversations.infrastructure.conversation_repository import ConversationRepository
import app.features.conversations.infrastructure.firestore_service
app.features.conversations.infrastructure.firestore_service.FirestoreService.initialize = lambda: None

app = main.create_app()

@pytest.fixture
def client():
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "test_user_123",
        "email": "test@example.com",
        "name": "Test User",
        "verified": True
    }
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

def csrf_headers(client):
    client.cookies.set("csrf_token", "csrf_val")
    return {"x-csrf-token": "csrf_val"}

def test_sql_query_without_db_connection(client):
    """Must not execute query if no DB is connected — no step skipping."""
    r = client.post(
        "/api/v1/run_sql_query",
        json={"sql_query": "SELECT * FROM users"},
        headers=csrf_headers(client)
    )
    assert r.status_code == 400
    assert "No database configured" in r.text

def test_schema_select_without_db_connection(client):
    """Must not select schema if no DB connected."""
    r = client.post(
        "/api/v1/select_schema",
        json={"schema_name": "public"},
        headers=csrf_headers(client)
    )
    assert r.status_code == 400

def test_database_switch_without_db_connection(client):
    """Must not switch DB if not connected."""
    r = client.post(
        "/api/v1/switch_remote_database",
        json={"database": "target_db"},
        headers=csrf_headers(client)
    )
    assert r.status_code == 400

def test_negative_max_rows(client):
    """Negative max_rows must be rejected."""
    r = client.post(
        "/api/v1/run_sql_query",
        json={"sql_query": "SELECT 1", "max_rows": -1},
        headers=csrf_headers(client)
    )
    assert r.status_code in [400, 422]

def test_zero_max_rows(client):
    """Zero max_rows is nonsensical — must be rejected or treated as default."""
    r = client.post(
        "/api/v1/run_sql_query",
        json={"sql_query": "SELECT 1", "max_rows": 0},
        headers=csrf_headers(client)
    )
    assert r.status_code in [400, 422]

def test_resume_agent_without_active_conversation(client):
    """resume_agent on nonexistent conversation must not crash."""
    original_get = ConversationRepository.get
    ConversationRepository.get = staticmethod(lambda cid: None)
    try:
        r = client.post(
            "/api/v1/resume_agent",
            json={"conversation_id": "ghost_conv", "resume": {"choice": "1"}},
            headers=csrf_headers(client)
        )
        assert r.status_code in [200, 404, 400]
        assert r.status_code != 500
    finally:
        ConversationRepository.get = original_get

def test_rename_with_only_whitespace(client):
    """Whitespace-only title must be rejected."""
    r = client.patch(
        "/api/v1/rename_conversation/some_conv",
        json={"title": "     "},
        headers=csrf_headers(client)
    )
    assert r.status_code == 422

def test_oversized_sql_query(client):
    """Extremely long SQL must be handled gracefully."""
    giant_query = "SELECT " + "1," * 10000 + "1"
    r = client.post(
        "/api/v1/run_sql_query",
        json={"sql_query": giant_query},
        headers=csrf_headers(client)
    )
    assert r.status_code in [400, 422]
    assert r.status_code != 500