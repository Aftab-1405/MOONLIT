import pytest
import httpx

REQUIRED_HEADERS = {
    "x-content-type-options": "nosniff",
    "x-frame-options": ["DENY", "SAMEORIGIN"],
    "x-xss-protection": "1; mode=block",
    "strict-transport-security": None,   # just presence check
    "referrer-policy": None,
    "permissions-policy": None,
}

FORBIDDEN_HEADERS = [
    "x-powered-by",
    "server",
    "x-aspnet-version",
    "x-runtime",
]

from fastapi.testclient import TestClient

@pytest.fixture
def client():
    import main
    app = main.create_app()
    with TestClient(app) as c:
        yield c

@pytest.mark.integration
def test_integration_required_security_headers_present(client):
    r = client.get("/api/v1/")
    for header, expected in REQUIRED_HEADERS.items():
        value = r.headers.get(header)
        assert value is not None, f"MISSING SECURITY HEADER: {header}"
        if isinstance(expected, list):
            assert value.upper() in [e.upper() for e in expected], (
                f"WRONG VALUE: {header} = {value}"
            )
        elif expected is not None:
            assert value.lower() == expected.lower(), (
                f"WRONG VALUE: {header} = {value}, expected {expected}"
            )

@pytest.mark.integration
def test_integration_information_disclosure_headers_absent(client):
    r = client.get("/api/v1/")
    for header in FORBIDDEN_HEADERS:
        val = r.headers.get(header)
        if header == "server" and val == "Moonlit":
            continue # We mask it explicitly
        assert val is None, (
            f"INFO DISCLOSURE: Response contains {header}: {val}"
        )

@pytest.mark.integration
def test_integration_content_type_on_json_responses(client):
    r = client.get("/api/v1/")
    ct = r.headers.get("content-type", "")
    assert "application/json" in ct

@pytest.mark.integration
def test_integration_no_stack_trace_in_error_response(client):
    """Trigger a 404 — must not leak internal paths or stack traces."""
    r = client.get("/api/v1/nonexistent_endpoint_xyz")
    body = r.text.lower()
    assert "traceback" not in body
    assert "file \"/" not in body
    assert "line " not in body or "site-packages" not in body

@pytest.mark.integration
def test_integration_no_stack_trace_on_invalid_input(client):
    """Malformed input must return clean error, not stack trace."""
    r = client.post("/api/v1/connect_db", json={"invalid": "payload"})
    body = r.text.lower()
    assert "traceback" not in body
    assert "file \"/" not in body
