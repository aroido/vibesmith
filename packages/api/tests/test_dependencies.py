"""Dependencies API 테스트."""

import uuid
from datetime import UTC, datetime

from fastapi.testclient import TestClient
from vibesmith_core.components.models import Command, Skill


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _make_skill(core, project_id: str, name: str) -> Skill:
    skill = Skill(
        id=str(uuid.uuid4()),
        name=name,
        description=f"{name} description",
        enabled=True,
        tags=[],
        project_id=project_id,
        path=f"/fake/skills/{name}/SKILL.md",
        content=f"---\nname: {name}\n---\n\nBody of {name}",
        frontmatter={"name": name},
        created_at=_now(),
        updated_at=_now(),
        platform="claude_code",
    )
    core.operations.create(skill)
    return skill


def _make_command(core, project_id: str, name: str) -> Command:
    command = Command(
        id=str(uuid.uuid4()),
        name=name,
        description=f"{name} description",
        enabled=True,
        tags=[],
        project_id=project_id,
        path=f"/fake/commands/{name}.md",
        content=f"# {name}\n\nCommand body",
        frontmatter=None,
        created_at=_now(),
        updated_at=_now(),
        platform="claude_code",
    )
    core.operations.create(command)
    return command


def test_get_dependency_graph_empty(client: TestClient):
    """GET /api/dependencies — stub으로 빈 그래프 반환."""
    response = client.get("/api/dependencies")
    assert response.status_code == 200
    data = response.json()

    assert "nodes" in data
    assert "edges" in data
    assert "cycles" in data
    assert data["nodes"] == []
    assert data["edges"] == []
    assert data["cycles"] == []


def test_get_dependency_graph_with_query_params(client: TestClient):
    """GET /api/dependencies — project_id, type 쿼리 파라미터 지원."""
    response = client.get(
        "/api/dependencies",
        params={"project_id": "proj_123", "type": "skill"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["nodes"] == []
    assert data["edges"] == []
    assert data["cycles"] == []


def test_get_dependency_graph_with_multi_type_query(client: TestClient, core):
    """GET /api/dependencies — type 쿼리를 여러 번 전달하면 OR 필터로 처리한다."""
    project = core.projects.list_all()[0]
    _make_skill(core, project.id, "dep-skill")
    _make_command(core, project.id, "dep-command")

    response = client.get(
        "/api/dependencies",
        params=[("type", "skill"), ("type", "command")],
    )

    assert response.status_code == 200
    data = response.json()
    node_types = {node["type"] for node in data["nodes"]}
    assert node_types == {"skill", "command"}


def test_get_component_dependencies_success(client: TestClient, sample_project):
    """GET /api/dependencies/{component_id} — 존재하는 구성요소 시 빈 배열 반환."""
    # 프로젝트 스캔 후 구성요소 ID 획득
    client.post("/api/scan", json={"project_id": sample_project["id"]})
    proj_components = client.get(f"/api/projects/{sample_project['id']}/components").json()
    assert proj_components["total"] >= 1
    comp_id = proj_components["items"][0]["id"]

    response = client.get(f"/api/dependencies/{comp_id}")
    assert response.status_code == 200
    data = response.json()

    assert data["component_id"] == comp_id
    assert data["depends_on"] == []
    assert data["depended_by"] == []


def test_get_component_dependencies_not_found(client: TestClient):
    """GET /api/dependencies/{component_id} — 존재하지 않는 구성요소 시 404."""
    response = client.get("/api/dependencies/nonexistent_component_id")
    assert response.status_code == 404
    assert response.json()["detail"] == "Component not found"
