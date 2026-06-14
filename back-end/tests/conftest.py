# conftest.py
import pytest
import os
import importlib
import firebase_admin
from dotenv import load_dotenv

@pytest.fixture(scope="function")
def restore_real_env():
    # 1. Force reload environment variables from .env
    load_dotenv(override=True)
    
    # 2. Delete any existing initialized Firebase Admin SDK app to force re-initialization with correct credentials
    try:
        firebase_admin.delete_app(firebase_admin.get_app())
    except ValueError:
        pass
        
    # 3. Clear the firestore db cache in firestore_service
    from app.features.conversations.infrastructure.firestore_service import get_firestore_db
    get_firestore_db.cache_clear()
    
    # 4. Restore actual FirestoreService methods
    from app.features.conversations.infrastructure.firestore_service import FirestoreService, _initialize_firebase
    FirestoreService.initialize = classmethod(lambda cls: _initialize_firebase())
    FirestoreService.get_db = classmethod(lambda cls: get_firestore_db())
    
    yield


def pytest_configure(config):
    config.addinivalue_line(
        "markers", "integration: mark test as integration test using real backend"
    )
