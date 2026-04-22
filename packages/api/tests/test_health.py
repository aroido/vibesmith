"""GET /api/health readiness 엔드포인트 테스트."""


def test_health_returns_vibesmith_signature(client):
    """데스크톱 readiness 체크용 고유 식별 응답을 반환한다."""
    response = client.get("/api/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["service"] == "vibesmith-api"
    assert isinstance(payload["version"], str)
    assert payload["version"] != ""
