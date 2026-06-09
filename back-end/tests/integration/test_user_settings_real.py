# test_integration_user_settings.py
import pytest
import uuid
import firebase_admin
from firebase_admin import credentials
from dotenv import load_dotenv
from config import Config
from services.user_settings_service import UserSettingsService, DEFAULT_PREFERENCES
from repositories.context_repository import ContextRepository

load_dotenv()

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_user_settings_service():
    # 1. Initialize Firebase if not already initialized
    firebase_credentials = Config.get_firebase_credentials()
    cred = credentials.Certificate(firebase_credentials)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
        
    test_user_id = f"integration_user_settings_{uuid.uuid4().hex}"
    
    try:
        # Get initial preferences (should return DEFAULT_PREFERENCES)
        initial = UserSettingsService.get_merged(test_user_id)
        for k, v in DEFAULT_PREFERENCES.items():
            assert initial[k] == v
            
        # Save a patch
        patch = {
            "theme": "light",
            "confirmBeforeRun": True,
            "queryTimeout": 45,
            "nullDisplay": "NIL"
        }
        updated = UserSettingsService.save(test_user_id, patch)
        
        # Verify returned preferences are merged
        assert updated["theme"] == "light"
        assert updated["confirmBeforeRun"] is True
        assert updated["queryTimeout"] == 45
        assert updated["nullDisplay"] == "NIL"
        # Other default preferences should remain unchanged
        assert updated["maxRows"] == DEFAULT_PREFERENCES["maxRows"]
        
        # Get merged preferences again to verify DB persistence
        fetched = UserSettingsService.get_merged(test_user_id)
        assert fetched["theme"] == "light"
        assert fetched["confirmBeforeRun"] is True
        assert fetched["queryTimeout"] == 45
        assert fetched["nullDisplay"] == "NIL"
        
    finally:
        # Clean up Firestore document
        ContextRepository.delete(test_user_id)
