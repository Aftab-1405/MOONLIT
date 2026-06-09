import pytest
import httpx

BASE_URL = "http://localhost:5000"

@pytest.fixture
def unauth_client():
    return httpx.Client(base_url=BASE_URL)

@pytest.mark.integration
def test_integration_session_cookie_not_accessible_via_js(unauth_client):
    """firebase_session cookie must be HttpOnly."""
    r = unauth_client.get("/firebase-config")
    # Check set-cookie header
    set_cookie = r.headers.get("set-cookie", "")
    if "firebase_session" in set_cookie:
        assert "httponly" in set_cookie.lower(), (
            "SESSION EXPOSURE: firebase_session cookie is not HttpOnly"
        )

@pytest.mark.integration
def test_integration_csrf_token_present(unauth_client):
    """CSRF token must be issued on /firebase-config."""
    r = unauth_client.get("/firebase-config")
    assert "csrf_token" in r.cookies, "CSRF token not issued"
