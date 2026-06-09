# test_integration_advanced_hacks.py
import os
import pytest
import importlib
import uuid
from fastapi.testclient import TestClient
from repositories.conversation_repository import ConversationRepository

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_get_current_user():
    import dependencies
    import main
    
    orig_bypass = dependencies.Config.DEV_AUTH_BYPASS
    orig_debug = dependencies.Config.DEBUG
    orig_user_id = dependencies.Config.DEV_AUTH_USER_ID
    
    dependencies.Config.DEV_AUTH_BYPASS = True
    dependencies.Config.DEBUG = True
    dependencies.Config.DEV_AUTH_USER_ID = "integration-user-123"
    
    app = main.create_app()
    
    with TestClient(app) as client:
        # GET /api/v1/user/context
        response = client.get("/api/v1/user/context")
        
        # Verify status code is 200 (authenticated)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "success"
        
    dependencies.Config.DEV_AUTH_BYPASS = orig_bypass
    dependencies.Config.DEBUG = orig_debug
    dependencies.Config.DEV_AUTH_USER_ID = orig_user_id


@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_conversation_repository_flow():
    # We use a unique ID for this integration test run
    test_conv_id = f"integration_test_{uuid.uuid4()}"
    test_user_id = "integration_test_user_123"
    
    try:
        # Store a test message (which initializes/creates the conversation doc)
        ConversationRepository.store_message(
            conversation_id=test_conv_id,
            sender="user",
            message="Hello, this is an integration test query.",
            user_id=test_user_id
        )
        
        # Call get to retrieve it
        conv = ConversationRepository.get(test_conv_id)
        
        # Verify the structure matches our assumptions in mocks
        assert conv is not None
        assert conv["user_id"] == test_user_id
        assert isinstance(conv["messages"], list)
        assert len(conv["messages"]) == 1
        assert conv["messages"][0]["sender"] == "user"
        assert conv["messages"][0]["content"] == "Hello, this is an integration test query."
        
        # Verify get_for_user works
        conv_for_user = ConversationRepository.get_for_user(test_conv_id, test_user_id)
        assert conv_for_user is not None
        assert conv_for_user["user_id"] == test_user_id
        
        # Verify get_for_user permission check (raises PermissionError for other users)
        with pytest.raises(PermissionError):
            ConversationRepository.get_for_user(test_conv_id, "different_user_456")
            
    finally:
        # Clean up by deleting the conversation document
        ConversationRepository.delete(test_conv_id, test_user_id)
        
        # Verify it is deleted
        deleted_conv = ConversationRepository.get(test_conv_id)
        assert deleted_conv is None
