import asyncio
import pytest
from fastapi.testclient import TestClient
import os
import importlib

@pytest.fixture(scope="module")
def client():
    # Save original env
    orig_env = dict(os.environ)
    
    # Override the environment to test our CORS split logic
    os.environ["APP_ENV"] = "production"
    os.environ["SECRET_KEY"] = "this_is_a_super_secret_key_that_is_at_least_32_chars_long!"
    os.environ["CORS_ORIGINS"] = "http://localhost:3000 ,   http://localhost:5173  , https://app.moonlit.ai "
    os.environ["FIREBASE_TYPE"] = "mock"
    os.environ["FIREBASE_PROJECT_ID"] = "mock"
    os.environ["FIREBASE_WEB_PROJECT_ID"] = "mock"
    os.environ["FIREBASE_PRIVATE_KEY_ID"] = "mock"
    os.environ["FIREBASE_PRIVATE_KEY"] = "mock"
    os.environ["FIREBASE_CLIENT_EMAIL"] = "mock"
    os.environ["FIREBASE_CLIENT_ID"] = "mock"
    os.environ["FIREBASE_AUTH_URI"] = "mock"
    os.environ["FIREBASE_TOKEN_URI"] = "mock"
    os.environ["UPSTASH_REDIS_URL"] = "redis://localhost:6379"
    
    import config
    importlib.reload(config)
    
    import main
    importlib.reload(main)
    
    app = main.create_app()
    with TestClient(app) as c:
        yield c
        
    # Restore original env
    os.environ.clear()
    os.environ.update(orig_env)
    importlib.reload(config)
    importlib.reload(main)


def test_cors(client):
    print("Testing CORS headers...")
    
    # 1. Test allowed origin with spaces in .env
    response = client.options("/pass_user_prompt_to_llm", headers={
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "POST"
    })
    
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173", "CORS origin with space failed to strip properly!"
    print("✅ CORS origin with space correctly stripped and matched!")
    
    # 2. Test another allowed origin
    response = client.options("/pass_user_prompt_to_llm", headers={
        "Origin": "https://app.moonlit.ai",
        "Access-Control-Request-Method": "POST"
    })
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "https://app.moonlit.ai", "CORS origin failed!"
    print("✅ CORS origin https://app.moonlit.ai correctly matched!")
    
    # 3. Test disallowed origin
    response = client.options("/pass_user_prompt_to_llm", headers={
        "Origin": "http://evil.com",
        "Access-Control-Request-Method": "POST"
    })
    assert response.headers.get("access-control-allow-origin") is None, "Disallowed origin got CORS header!"
    print("✅ Disallowed origin correctly rejected!")

    # 4. Test Origin: null -> assert access-control-allow-origin is NOT "null"
    response = client.options("/pass_user_prompt_to_llm", headers={
        "Origin": "null",
        "Access-Control-Request-Method": "POST"
    })
    assert response.headers.get("access-control-allow-origin") != "null", "CORS Origin: null bypass detected!"
    print("✅ Origin 'null' correctly blocked!")

    # 5. Test Origin: https://evil.moonlit.ai (subdomain of allowed domain) -> assert header is not reflected
    response = client.options("/pass_user_prompt_to_llm", headers={
        "Origin": "https://evil.moonlit.ai",
        "Access-Control-Request-Method": "POST"
    })
    assert response.headers.get("access-control-allow-origin") != "https://evil.moonlit.ai", "Wildcard subdomain bypass detected!"
    print("✅ Subdomain bypass attempt correctly blocked!")

    # 6. Test OPTIONS with Origin + Access-Control-Request-Headers: Cookie -> assert access-control-allow-credentials is not "true" unless explicitly intended
    response = client.options("/pass_user_prompt_to_llm", headers={
        "Origin": "http://evil.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Cookie"
    })
    allow_origin = response.headers.get("access-control-allow-origin")
    allow_credentials = response.headers.get("access-control-allow-credentials")
    if allow_origin is not None:
        if allow_credentials == "true":
            assert allow_origin != "*", "CORS credentials must not be allowed with wildcard origin!"
            assert allow_origin != "http://evil.com", "CORS credentials must not be allowed for disallowed origin!"
    print("✅ Credentialed request on disallowed origin correctly verified!")

if __name__ == "__main__":
    # Mock firestore initialize so it doesn't crash during TestClient init
    import app.features.conversations.infrastructure.firestore_service
    app.features.conversations.infrastructure.firestore_service.FirestoreService.initialize = lambda: None
    
    test_cors()
