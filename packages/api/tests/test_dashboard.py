"""Dashboard 엔드포인트 테스트."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

from fastapi.testclient import TestClient


def test_get_stats_empty(client: TestClient):
    """프로젝트가 없을 때 통계 조회."""
    response = client.get("/api/stats")
    assert response.status_code == 200
    data = response.json()

    assert data["total_skills"] == 0
    assert data["total_agents"] == 0
    assert data["total_commands"] == 0
    assert data["total_hooks"] == 0
    assert data["total_rules"] == 0
    assert data["active_count"] == 0
    assert data["inactive_count"] == 0
    assert data["total_count"] == 0
    assert "trends" in data


def test_get_stats_with_components(client: TestClient, sample_project):
    """구성요소가 있을 때 통계 조회."""
    # 프로젝트 스캔
    client.post("/api/scan", json={"project_id": sample_project["id"]})

    response = client.get("/api/stats")
    assert response.status_code == 200
    data = response.json()

    # 샘플 프로젝트에는 skill 1개가 있음
    assert data["total_skills"] >= 1
    assert data["total_count"] >= 1
    assert data["active_count"] + data["inactive_count"] == data["total_count"]

    # 트렌드 구조 확인
    assert "trends" in data
    assert "skills" in data["trends"]
    assert "value" in data["trends"]["skills"]
    assert "percentage" in data["trends"]["skills"]
    assert "direction" in data["trends"]["skills"]


def test_dashboard_endpoints_stable_under_concurrent_requests(client: TestClient, sample_project):
    """동시 요청 시 dashboard/components 핵심 엔드포인트가 500 없이 응답한다."""
    client.post("/api/scan", json={"project_id": sample_project["id"]})
    paths = ["/api/system/status", "/api/stats", "/api/components"]

    def _request(path: str) -> tuple[str, int]:
        response = client.get(path)
        return path, response.status_code

    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = [executor.submit(_request, paths[i % len(paths)]) for i in range(30)]
        results = [future.result() for future in futures]

    failed = [(path, status) for path, status in results if status != 200]
    assert not failed, f"concurrent request failures: {failed}"


def test_get_system_status_default(client: TestClient):
    """글로벌 프로젝트만 있을 때 시스템 상태 조회."""
    response = client.get("/api/system/status")
    assert response.status_code == 200
    data = response.json()

    # core fixture가 글로벌 프로젝트를 생성하므로 is_live=True (방금 스캔됨)
    assert data["is_live"] is True
    assert data["health_score"] == 100
    assert "last_scan_at" in data
    assert "active_workers" in data
    assert isinstance(data["active_workers"]["watcher"], bool)
    assert isinstance(data["active_workers"]["usage_scanner"], bool)


def test_get_system_status_with_projects(client: TestClient, sample_project):
    """프로젝트가 있을 때 시스템 상태 조회."""
    # 프로젝트 스캔
    client.post("/api/scan", json={"project_id": sample_project["id"]})

    response = client.get("/api/system/status")
    assert response.status_code == 200
    data = response.json()

    assert isinstance(data["is_live"], bool)
    assert 0 <= data["health_score"] <= 100
    assert "last_scan_at" in data
    assert "active_workers" in data

    # ISO 8601 형식 확인
    datetime.fromisoformat(data["last_scan_at"].replace("Z", "+00:00"))


def test_get_system_status_unscanned_projects(client: TestClient, sample_project, core):
    """Issue #336, #810: 미스캔 프로젝트만 있어도 is_live=True (API 응답 = 서버 alive)."""
    conn = core.db.get_connection()
    conn.execute("UPDATE projects SET last_scanned_at = ''")
    conn.commit()

    response = client.get("/api/system/status")
    assert response.status_code == 200
    data = response.json()

    assert data["is_live"] is True, "API가 응답하면 is_live는 항상 True (#810)"
    assert data["health_score"] == 0, "미스캔 프로젝트만 있으면 health_score는 0"
    assert "last_scan_at" in data
    assert "active_workers" in data


def test_stats_type_counts(client: TestClient, sample_project, core):
    """타입별 개수가 정확한지 확인."""
    # 여러 타입의 구성요소 생성
    project_id = sample_project["id"]

    # Skill 생성
    client.post(
        "/api/components",
        json={
            "type": "skill",
            "name": "test-skill",
            "project_id": project_id,
            "content": "---\nname: test-skill\n---\nTest skill",
            "platform": "claude_code",
        },
    )

    # Agent 생성
    client.post(
        "/api/components",
        json={
            "type": "agent",
            "name": "test-agent",
            "project_id": project_id,
            "content": "---\nname: test-agent\n---\nTest agent",
            "platform": "claude_code",
        },
    )

    # Command 생성
    client.post(
        "/api/components",
        json={
            "type": "command",
            "name": "test-command",
            "project_id": project_id,
            "content": "---\nname: test-command\n---\nTest command",
            "platform": "claude_code",
        },
    )

    response = client.get("/api/stats")
    assert response.status_code == 200
    data = response.json()

    assert data["total_skills"] >= 1
    assert data["total_agents"] >= 1
    assert data["total_commands"] >= 1
    assert data["total_count"] >= 3


def test_stats_active_inactive_counts(client: TestClient, sample_project):
    """활성/비활성 개수가 정확한지 확인."""
    project_id = sample_project["id"]

    # 활성 구성요소 생성
    client.post(
        "/api/components",
        json={
            "type": "skill",
            "name": "active-skill",
            "project_id": project_id,
            "content": "---\nname: active-skill\n---\nActive",
            "platform": "claude_code",
        },
    )

    # 비활성 구성요소 생성 후 비활성화
    resp2 = client.post(
        "/api/components",
        json={
            "type": "skill",
            "name": "inactive-skill",
            "project_id": project_id,
            "content": "---\nname: inactive-skill\n---\nInactive",
            "platform": "claude_code",
        },
    )
    comp2_id = resp2.json()["id"]
    client.post(f"/api/components/{comp2_id}/toggle", json={"enabled": False})

    response = client.get("/api/stats")
    assert response.status_code == 200
    data = response.json()

    assert data["active_count"] >= 1
    assert data["inactive_count"] >= 1
    assert data["active_count"] + data["inactive_count"] == data["total_count"]


# ---- GET /api/components/recent (Issue #575) ----


def test_recent_components_empty(client: TestClient):
    """구성요소가 없을 때 빈 리스트를 반환한다."""
    response = client.get("/api/components/recent")
    assert response.status_code == 200
    assert response.json() == []


def test_recent_components_sorted_by_updated_at(client: TestClient, sample_project):
    """updated_at 내림차순으로 정렬되어 반환된다."""
    project_id = sample_project["id"]

    # 구성요소 3개 생성 (생성 순서: a → b → c)
    for name in ["comp-a", "comp-b", "comp-c"]:
        client.post(
            "/api/components",
            json={
                "type": "skill",
                "name": name,
                "project_id": project_id,
                "content": f"---\nname: {name}\n---\n{name} body",
                "platform": "claude_code",
            },
        )

    response = client.get("/api/components/recent")
    assert response.status_code == 200
    data = response.json()

    # 최소 3개 이상 (sample_project fixture에서 1개 + 3개)
    assert len(data) >= 3

    # updated_at 내림차순 확인
    updated_ats = [item["updated_at"] for item in data]
    assert updated_ats == sorted(updated_ats, reverse=True)


def test_recent_components_default_limit(client: TestClient, sample_project):
    """기본 limit은 10이다."""
    project_id = sample_project["id"]

    # 15개 구성요소 생성
    for i in range(15):
        client.post(
            "/api/components",
            json={
                "type": "command",
                "name": f"cmd-{i:02d}",
                "project_id": project_id,
                "content": f"Command {i}",
                "platform": "claude_code",
            },
        )

    response = client.get("/api/components/recent")
    assert response.status_code == 200
    data = response.json()

    # 기본 limit=10이므로 최대 10개
    assert len(data) == 10


def test_recent_components_custom_limit(client: TestClient, sample_project):
    """limit 파라미터로 반환 개수를 조절한다."""
    project_id = sample_project["id"]

    for i in range(5):
        client.post(
            "/api/components",
            json={
                "type": "command",
                "name": f"lim-cmd-{i}",
                "project_id": project_id,
                "content": f"Command {i}",
                "platform": "claude_code",
            },
        )

    response = client.get("/api/components/recent?limit=3")
    assert response.status_code == 200
    data = response.json()

    assert len(data) == 3


def test_recent_components_limit_clamped_to_100(client: TestClient):
    """limit이 100을 초과하면 100으로 클램프된다."""
    response = client.get("/api/components/recent?limit=999")
    assert response.status_code == 200
    # 데이터가 100개 미만이라도 에러 없이 정상 응답
    data = response.json()
    assert isinstance(data, list)


def test_recent_components_response_schema(client: TestClient, sample_project):
    """응답이 ComponentResponse 스키마를 따른다."""
    project_id = sample_project["id"]

    client.post(
        "/api/components",
        json={
            "type": "skill",
            "name": "schema-test",
            "project_id": project_id,
            "content": "---\nname: schema-test\n---\nBody",
            "platform": "claude_code",
        },
    )

    response = client.get("/api/components/recent?limit=1")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1

    item = data[0]
    # ComponentResponse 필수 필드 확인
    assert "id" in item
    assert "type" in item
    assert "name" in item
    assert "enabled" in item
    assert "project_id" in item
    assert "updated_at" in item
    assert "created_at" in item
    assert "platform" in item
