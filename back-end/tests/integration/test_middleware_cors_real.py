import pytest
import httpx

BASE_URL = "http://localhost:5000"

@pytest.fixture
def client():
    return httpx.Client(base_url=BASE_URL)

@pytest.mark.integration
def test_integration_cors_allowed_origin(client):
    print("Testing CORS headers against live server...")
    
    # 1. Test allowed origin
    response = client.options("/api/v1/user/context", headers={
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "GET"
    })
    
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000", "CORS origin failed!"

@pytest.mark.integration
def test_integration_cors_disallowed_origin(client):
    # 2. Test disallowed origin
    response = client.options("/api/v1/user/context", headers={
        "Origin": "http://evil.com",
        "Access-Control-Request-Method": "GET"
    })
    assert response.headers.get("access-control-allow-origin") is None, "Disallowed origin got CORS header!"

@pytest.mark.integration
def test_integration_cors_null_origin(client):
    # 3. Test Origin: null -> assert access-control-allow-origin is NOT "null"
    response = client.options("/api/v1/user/context", headers={
        "Origin": "null",
        "Access-Control-Request-Method": "GET"
    })
    assert response.headers.get("access-control-allow-origin") != "null", "CORS Origin: null bypass detected!"

@pytest.mark.integration
def test_integration_cors_subdomain_bypass(client):
    # 4. Test Origin: http://localhost.evil.com (prefix bypass attempt)
    response = client.options("/api/v1/user/context", headers={
        "Origin": "http://localhost.evil.com",
        "Access-Control-Request-Method": "GET"
    })
    assert response.headers.get("access-control-allow-origin") != "http://localhost.evil.com", "Prefix/Suffix subdomain bypass detected!"

@pytest.mark.integration
def test_integration_cors_credentials_on_disallowed(client):
    # 5. Test OPTIONS with Origin + Access-Control-Request-Headers: Cookie
    response = client.options("/api/v1/user/context", headers={
        "Origin": "http://evil.com",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Cookie"
    })
    allow_origin = response.headers.get("access-control-allow-origin")
    allow_credentials = response.headers.get("access-control-allow-credentials")
    if allow_origin is not None:
        if allow_credentials == "true":
            assert allow_origin != "*", "CORS credentials must not be allowed with wildcard origin!"
            assert allow_origin != "http://evil.com", "CORS credentials must not be allowed for disallowed origin!"
