"""CORS 미들웨어 테스트."""

from fastapi.testclient import TestClient


def test_options_preflight_returns_200(client: TestClient):
    """OPTIONS preflight 요청이 200을 반환한다."""
    response = client.options(
        "/api/projects",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_cors_headers_on_get(client: TestClient):
    """일반 GET 요청에 CORS 헤더가 포함된다."""
    response = client.get(
        "/api/projects",
        headers={"Origin": "http://localhost:5173"},
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_disallowed_origin_has_no_cors_header(client: TestClient):
    """허용되지 않은 Origin에는 CORS 헤더가 없다."""
    response = client.get(
        "/api/projects",
        headers={"Origin": "http://evil.com"},
    )
    assert "access-control-allow-origin" not in response.headers
