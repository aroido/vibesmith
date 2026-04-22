"""템플릿 API 테스트."""

from fastapi.testclient import TestClient


def test_list_templates_empty_filter(client: TestClient):
    """GET /api/templates — 필터 없이 전체 목록."""
    response = client.get("/api/templates")
    assert response.status_code == 200
    data = response.json()
    assert "templates" in data
    assert "total" in data
    assert data["total"] >= 3
    assert len(data["templates"]) == data["total"]


def test_list_templates_by_type_skill(client: TestClient):
    """GET /api/templates?component_type=skill — skill 타입만."""
    response = client.get("/api/templates", params={"component_type": "skill"})
    assert response.status_code == 200
    data = response.json()
    assert all(t["component_type"] == "skill" for t in data["templates"])
    assert data["total"] >= 2


def test_list_templates_by_type_agent(client: TestClient):
    """GET /api/templates?component_type=agent — agent 타입만."""
    response = client.get("/api/templates", params={"component_type": "agent"})
    assert response.status_code == 200
    data = response.json()
    assert all(t["component_type"] == "agent" for t in data["templates"])
    assert data["total"] >= 1


def test_get_template_detail(client: TestClient):
    """GET /api/templates/{id} — 상세 조회."""
    response = client.get("/api/templates/python-dev")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "python-dev"
    assert data["name"] == "Python Development Skill"
    assert data["component_type"] == "skill"
    assert "fields" in data
    assert len(data["fields"]) >= 2


def test_get_template_not_found(client: TestClient):
    """GET /api/templates/{id} — 존재하지 않는 템플릿 404."""
    response = client.get("/api/templates/nonexistent-template")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_template_has_required_fields(client: TestClient):
    """템플릿 응답에 필수 필드가 포함되는지."""
    response = client.get("/api/templates/python-dev")
    assert response.status_code == 200
    data = response.json()
    required = [
        "id",
        "name",
        "description",
        "component_type",
        "category",
        "icon",
        "difficulty",
        "estimated_time",
        "fields",
        "tags",
    ]
    for field in required:
        assert field in data, f"Missing field: {field}"
