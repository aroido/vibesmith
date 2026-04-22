"""Component Wizard API 통합 테스트 — generate, save."""

from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# POST /api/components/generate
# ---------------------------------------------------------------------------


def test_generate_component_success(client: TestClient):
    """POST /api/components/generate — 정상 생성 (미리보기)."""
    response = client.post(
        "/api/components/generate",
        json={
            "component_type": "skill",
            "template_id": "python-dev",
            "name": "my-pytest-helper",
            "description": "Python 테스트 자동화 스킬",
            "config": {
                "skill_name": "my-pytest-helper",
                "description": "Python 테스트 자동화 스킬",
                "tools": ["read", "write"],
            },
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "content" in data
    assert "preview_id" in data
    assert data["preview_id"].startswith("preview-")
    assert "expires_at" in data
    assert data["component_type"] == "skill"
    assert data["file_name"] == "SKILL.md"
    assert "name:" in data["content"] or "my-pytest-helper" in data["content"]


def test_generate_component_template_not_found(client: TestClient):
    """POST /api/components/generate — 존재하지 않는 템플릿 404."""
    response = client.post(
        "/api/components/generate",
        json={
            "component_type": "skill",
            "template_id": "nonexistent-template",
            "name": "test-skill",
            "config": {},
        },
    )
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_generate_component_agent_template(client: TestClient):
    """POST /api/components/generate — agent 템플릿."""
    response = client.post(
        "/api/components/generate",
        json={
            "component_type": "agent",
            "template_id": "code-reviewer",
            "name": "my-code-reviewer",
            "description": "코드 리뷰 에이전트",
            "config": {
                "agent_name": "my-code-reviewer",
                "description": "코드 리뷰 에이전트",
                "review_focus": "all",
            },
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["component_type"] == "agent"
    assert data["file_name"] == "AGENT.md"


# ---------------------------------------------------------------------------
# POST /api/components/save
# ---------------------------------------------------------------------------


def test_save_component_success(client: TestClient, sample_project: dict):
    """POST /api/components/save — 정상 저장."""
    project_id = sample_project["id"]
    content = "---\nname: wizard-skill\ndescription: Wizard로 생성한 스킬\n---\n\n본문 내용"
    response = client.post(
        "/api/components/save",
        json={
            "type": "skill",
            "name": "wizard-skill",
            "project_id": project_id,
            "content": content,
            "tags": ["wizard", "test"],
            "platform": "claude_code",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "wizard-skill"
    assert data["type"] == "skill"
    assert data["project_id"] == project_id
    assert data["enabled"] is True
    assert "id" in data
    assert "path" in data


def test_save_component_project_not_found(client: TestClient):
    """POST /api/components/save — 존재하지 않는 프로젝트 404."""
    response = client.post(
        "/api/components/save",
        json={
            "type": "skill",
            "name": "test-skill",
            "project_id": "00000000-0000-0000-0000-000000000000",
            "content": "---\nname: test-skill\n---\n\ncontent",
            "platform": "claude_code",
        },
    )
    assert response.status_code == 404


def test_save_component_duplicate_name(client: TestClient, sample_project: dict):
    """POST /api/components/save — 동일 이름 중복 409 Conflict."""
    project_id = sample_project["id"]
    content = "---\nname: duplicate-skill\ndescription: 중복 테스트\n---\n\n본문"
    r1 = client.post(
        "/api/components/save",
        json={
            "type": "skill",
            "name": "duplicate-skill",
            "project_id": project_id,
            "content": content,
            "platform": "claude_code",
        },
    )
    assert r1.status_code == 201
    r2 = client.post(
        "/api/components/save",
        json={
            "type": "skill",
            "name": "duplicate-skill",
            "project_id": project_id,
            "content": content,
            "platform": "claude_code",
        },
    )
    assert r2.status_code == 409
