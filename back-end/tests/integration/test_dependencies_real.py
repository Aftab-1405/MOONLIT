# test_integration_dependencies.py
import os
import pytest
import httpx
import firebase_admin
from firebase_admin import auth, credentials
from dotenv import load_dotenv
from config import Config
from dependencies import verify_session_cookie_value

load_dotenv()

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_verify_session_cookie():
    # We do NOT use mocks. We test the real verification flow with a real Firebase session cookie.
    
    # 1. Initialize Firebase if not already initialized
    firebase_credentials = Config.get_firebase_credentials()
    cred = credentials.Certificate(firebase_credentials)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
        
    uid = "integration-test-user-verify"
    
    try:
        # 2. Create a custom token for the test user
        custom_token = auth.create_custom_token(uid).decode("utf-8")
        
        # 3. Exchange custom token for ID token using client Auth REST API
        web_api_key = os.getenv("FIREBASE_WEB_API_KEY")
        url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key={web_api_key}"
        response = httpx.post(url, json={"token": custom_token, "returnSecureToken": True})
        response.raise_for_status()
        id_token = response.json()["idToken"]
        
        # 4. Exchange ID token for a Firebase session cookie
        expires_in = 600  # 10 minutes
        session_cookie = auth.create_session_cookie(id_token, expires_in=expires_in)
        
        # 5. Call the real verify_session_cookie_value method
        user = verify_session_cookie_value(session_cookie)
        
        # 6. Assert return structure and values
        assert user["uid"] == uid
        assert "verified" in user
        assert user["verified"] is True
        
    except Exception as e:
        pytest.fail(f"Real session cookie creation and verification failed: {e}")
