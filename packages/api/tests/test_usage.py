"""Usage API 엔드포인트 테스트 (Issue #67)."""

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from vibesmith_core import VibeSmithCore
from vibesmith_core.usage.scanner import UsageScanner

from vibesmith_api.main import _resolve_cursor_base_dir

_INSERT_PROJECT = (
    "INSERT INTO projects (id, name, path, is_global, component_count, last_scanned_at) VALUES (?, ?, ?, ?, ?, ?)"
)


def test_resolve_cursor_base_dir_uses_configured_path():
    """config에 cursor_base_dir가 있으면 해당 경로를 사용한다."""
    assert _resolve_cursor_base_dir({"cursor_base_dir": "/custom/cursor-base"}) == "/custom/cursor-base"


def test_resolve_cursor_base_dir_falls_back_to_default():
    """config에 cursor_base_dir가 없으면 기본 경로를 사용한다."""
    resolved = _resolve_cursor_base_dir({})
    assert isinstance(resolved, str)
    assert len(resolved) > 0


def test_get_usage_empty(client: TestClient):
    """사용 데이터가 없을 때 빈 응답."""
    response = client.get("/api/usage")
    assert response.status_code == 200
    data = response.json()

    assert data["ranking"] == []
    assert data["unused"] == []
    assert data["total_sessions_parsed"] == 0
    assert data["last_parsed_at"] is None
    assert data["aggregation_mode"] == "strict"
    assert data["dedupe_by_session"] == "auto"
    assert data["matched_only"] is True


def test_get_usage_with_data(client: TestClient, core: VibeSmithCore, sample_project):
    """사용 데이터가 있을 때 ranking과 unused 반환."""
    from vibesmith_core.usage.repo import save_usage_stats

    conn = core.db.get_connection()

    # 프로젝트 스캔 (구성요소 등록)
    client.post("/api/scan", json={"project_id": sample_project["id"]})

    # 사용 통계 저장
    save_usage_stats(
        conn,
        project_path=sample_project["path"],
        session_file="test-session.jsonl",
        stats=[
            {
                "component_name": "sample-skill",
                "component_type": "skill",
                "use_count": 5,
                "used_at": "2026-02-19T10:00:00Z",
            },
        ],
    )

    response = client.get("/api/usage")
    assert response.status_code == 200
    data = response.json()

    assert len(data["ranking"]) >= 1
    assert data["ranking"][0]["component_name"] == "sample-skill"
    assert data["ranking"][0]["use_count"] == 5  # auto: Claude Code skill → SUM
    assert data["total_sessions_parsed"] >= 1


def test_get_usage_filter_by_component_type(client: TestClient, core: VibeSmithCore):
    """component_type 쿼리 파라미터로 필터."""
    from vibesmith_core.usage.repo import save_usage_stats

    conn = core.db.get_connection()

    save_usage_stats(
        conn,
        project_path="/some/path",
        session_file="session1.jsonl",
        stats=[
            {
                "component_name": "my-skill",
                "component_type": "skill",
                "use_count": 3,
                "used_at": "2026-02-19T10:00:00Z",
            },
            {"component_name": "my-hook", "component_type": "hook", "use_count": 1, "used_at": "2026-02-19T10:00:00Z"},
        ],
    )

    response = client.get("/api/usage", params={"component_type": "skill"})
    assert response.status_code == 200
    data = response.json()

    # ranking에서 skill만 반환
    for item in data["ranking"]:
        assert item["component_type"] == "skill"


def test_get_usage_response_schema(client: TestClient):
    """응답 스키마 필드 확인."""
    response = client.get("/api/usage")
    assert response.status_code == 200
    data = response.json()

    assert "ranking" in data
    assert "unused" in data
    assert "total_sessions_parsed" in data
    assert "last_parsed_at" in data
    assert "aggregation_mode" in data
    assert "dedupe_by_session" in data
    assert "matched_only" in data


def test_get_usage_ranking_has_component_id(client: TestClient, core: VibeSmithCore, sample_project):
    """ranking 항목에 component_id가 포함되고, 매칭된 경우 값이 존재."""
    from vibesmith_core.usage.repo import save_usage_stats

    conn = core.db.get_connection()
    client.post("/api/scan", json={"project_id": sample_project["id"]})

    save_usage_stats(
        conn,
        project_path=sample_project["path"],
        session_file="test-cid.jsonl",
        stats=[
            {
                "component_name": "sample-skill",
                "component_type": "skill",
                "use_count": 3,
                "used_at": "2026-02-20T10:00:00Z",
            },
        ],
    )

    response = client.get("/api/usage")
    assert response.status_code == 200
    data = response.json()

    matched = [r for r in data["ranking"] if r["component_name"] == "sample-skill"]
    assert len(matched) == 1
    assert "component_id" in matched[0]
    assert matched[0]["component_id"] is not None


def test_get_usage_ranking_excludes_unmatched_components(client: TestClient, core: VibeSmithCore):
    """Issue #627: 매칭되지 않은 구성요소(시스템 내장)는 랭킹에서 제외된다."""
    from vibesmith_core.usage.repo import save_usage_stats

    conn = core.db.get_connection()

    save_usage_stats(
        conn,
        project_path="/nonexistent/path",
        session_file="unmatched.jsonl",
        stats=[
            {
                "component_name": "unknown-skill",
                "component_type": "skill",
                "use_count": 1,
                "used_at": "2026-02-20T10:00:00Z",
            },
        ],
    )

    response = client.get("/api/usage")
    assert response.status_code == 200
    data = response.json()

    # component_id가 NULL인 항목은 랭킹에서 제외됨
    names = {r["component_name"] for r in data["ranking"]}
    assert "unknown-skill" not in names


def test_get_usage_with_days_filter(client: TestClient, core: VibeSmithCore, sample_project):
    """days 쿼리 파라미터로 기간 필터."""
    from vibesmith_core.usage.repo import save_usage_stats

    conn = core.db.get_connection()
    client.post("/api/scan", json={"project_id": sample_project["id"]})
    now = datetime.now(UTC)
    recent_used_at = now.isoformat().replace("+00:00", "Z")
    old_used_at = (now - timedelta(days=60)).isoformat().replace("+00:00", "Z")

    # 오늘 데이터 (매칭되는 프로젝트 경로 사용)
    save_usage_stats(
        conn,
        project_path=sample_project["path"],
        session_file="today.jsonl",
        stats=[
            {
                "component_name": "sample-skill",
                "component_type": "skill",
                "use_count": 3,
                "used_at": recent_used_at,
            },
        ],
    )
    # 60일 전 데이터
    save_usage_stats(
        conn,
        project_path=sample_project["path"],
        session_file="old.jsonl",
        stats=[
            {
                "component_name": "sample-skill",
                "component_type": "skill",
                "use_count": 10,
                "used_at": old_used_at,
            },
        ],
    )

    # days=7 → 최근 것만
    resp = client.get("/api/usage", params={"days": 7})
    assert resp.status_code == 200
    ranking = resp.json()["ranking"]
    # sample-skill이 최근 데이터로만 집계됨
    matched = [r for r in ranking if r["component_name"] == "sample-skill"]
    assert len(matched) == 1
    assert matched[0]["use_count"] == 3  # auto: Claude Code skill → SUM(use_count)

    # days 없음 → 전체 합산
    resp_all = client.get("/api/usage")
    ranking_all = resp_all.json()["ranking"]
    matched_all = [r for r in ranking_all if r["component_name"] == "sample-skill"]
    assert len(matched_all) == 1
    assert matched_all[0]["use_count"] == 13  # auto: Claude Code skill → SUM(3 + 10)


def test_get_usage_with_days_filter_filters_missing_timestamp_by_used_at(
    client: TestClient,
    core: VibeSmithCore,
    sample_project,
):
    """timestamp 없는 레코드도 days 범위(used_at) 안에서만 카운트한다."""
    from vibesmith_core.usage.repo import save_usage_stats

    conn = core.db.get_connection()
    client.post("/api/scan", json={"project_id": sample_project["id"]})
    now = datetime.now(UTC)
    old_used_at = (now - timedelta(days=120)).isoformat().replace("+00:00", "Z")
    recent_used_at = now.isoformat().replace("+00:00", "Z")

    save_usage_stats(
        conn,
        project_path=sample_project["path"],
        session_file="recent-known-ts.jsonl",
        stats=[
            {
                "component_name": "sample-skill",
                "component_type": "skill",
                "use_count": 3,
                "used_at": now.isoformat().replace("+00:00", "Z"),
                "has_timestamp": True,
            },
        ],
    )
    save_usage_stats(
        conn,
        project_path=sample_project["path"],
        session_file="missing-ts-old.jsonl",
        stats=[
            {
                "component_name": "sample-skill",
                "component_type": "skill",
                "use_count": 2,
                "used_at": old_used_at,
                "has_timestamp": False,
            },
        ],
    )
    save_usage_stats(
        conn,
        project_path=sample_project["path"],
        session_file="missing-ts-recent.jsonl",
        stats=[
            {
                "component_name": "sample-skill",
                "component_type": "skill",
                "use_count": 1,
                "used_at": recent_used_at,
                "has_timestamp": False,
            },
        ],
    )

    resp = client.get("/api/usage", params={"days": 7, "dedupe_by_session": "false"})
    assert resp.status_code == 200
    ranking = resp.json()["ranking"]
    matched = [r for r in ranking if r["component_name"] == "sample-skill"]
    assert len(matched) == 1
    assert matched[0]["use_count"] == 4
    assert matched[0]["time_qualified_count"] == 3
    assert matched[0]["count_only_count"] == 1


def test_get_usage_aggregation_mode_expanded_includes_fallback(client: TestClient, core: VibeSmithCore, sample_project):
    """expanded 모드는 fallback 신호까지 포함한다."""
    from vibesmith_core.usage.repo import save_usage_stats

    conn = core.db.get_connection()
    client.post("/api/scan", json={"project_id": sample_project["id"]})

    save_usage_stats(
        conn,
        project_path=sample_project["path"],
        session_file="strict-session.jsonl",
        stats=[
            {
                "component_name": "sample-skill",
                "component_type": "skill",
                "use_count": 2,
                "used_at": "2026-02-21T10:00:00Z",
            },
        ],
    )
    save_usage_stats(
        conn,
        project_path=sample_project["path"],
        session_file="fallback-session.jsonl",
        stats=[
            {
                "component_name": "sample-skill",
                "component_type": "skill",
                "use_count": 5,
                "used_at": "2026-02-21T10:01:00Z",
                "signal_quality": "fallback",
            },
        ],
    )

    strict_resp = client.get("/api/usage", params={"dedupe_by_session": "false"})
    expanded_resp = client.get("/api/usage", params={"aggregation_mode": "expanded", "dedupe_by_session": "false"})

    strict_match = [r for r in strict_resp.json()["ranking"] if r["component_name"] == "sample-skill"]
    expanded_match = [r for r in expanded_resp.json()["ranking"] if r["component_name"] == "sample-skill"]

    assert strict_resp.status_code == 200
    assert expanded_resp.status_code == 200
    assert strict_match[0]["use_count"] == 2
    assert expanded_match[0]["use_count"] == 7
    assert strict_resp.json()["aggregation_mode"] == "strict"
    assert expanded_resp.json()["aggregation_mode"] == "expanded"


def test_get_usage_dedupe_by_session_false_returns_sum(client: TestClient, core: VibeSmithCore, sample_project):
    """dedupe_by_session=false이면 원시 use_count 합계를 반환한다."""
    from vibesmith_core.usage.repo import save_usage_stats

    conn = core.db.get_connection()
    client.post("/api/scan", json={"project_id": sample_project["id"]})

    save_usage_stats(
        conn,
        project_path=sample_project["path"],
        session_file="dedupe-target.jsonl",
        stats=[
            {
                "component_name": "sample-skill",
                "component_type": "skill",
                "use_count": 2,
                "used_at": "2026-02-22T10:00:00Z",
            },
        ],
    )
    save_usage_stats(
        conn,
        project_path=sample_project["path"],
        session_file="dedupe-target.jsonl",
        stats=[
            {
                "component_name": "sample-skill",
                "component_type": "skill",
                "use_count": 3,
                "used_at": "2026-02-22T10:05:00Z",
            },
        ],
    )

    # 기본값은 "auto" — Claude Code skill이므로 SUM(use_count)
    auto_resp = client.get("/api/usage")
    deduped_resp = client.get("/api/usage", params={"dedupe_by_session": "true"})
    raw_resp = client.get("/api/usage", params={"dedupe_by_session": "false"})

    auto_match = [r for r in auto_resp.json()["ranking"] if r["component_name"] == "sample-skill"]
    deduped_match = [r for r in deduped_resp.json()["ranking"] if r["component_name"] == "sample-skill"]
    raw_match = [r for r in raw_resp.json()["ranking"] if r["component_name"] == "sample-skill"]

    assert auto_resp.status_code == 200
    assert deduped_resp.status_code == 200
    assert raw_resp.status_code == 200
    assert auto_match[0]["use_count"] == 5  # auto: Claude Code skill → SUM
    assert deduped_match[0]["use_count"] == 1  # true: 전체 dedupe
    assert raw_match[0]["use_count"] == 5  # false: 전체 SUM
    assert auto_resp.json()["dedupe_by_session"] == "auto"
    assert deduped_resp.json()["dedupe_by_session"] == "true"
    assert raw_resp.json()["dedupe_by_session"] == "false"


def test_get_usage_filters_by_project_id(client: TestClient, core: VibeSmithCore, tmp_path):
    """project_id 쿼리 파라미터가 ranking/unused/sessions 집계에 반영된다."""
    from vibesmith_core.usage.repo import save_usage_stats

    def create_project_with_skills(project_dir: str, used_name: str, unused_name: str) -> dict:
        proj_dir = tmp_path / project_dir
        used_dir = proj_dir / ".claude" / "skills" / used_name
        unused_dir = proj_dir / ".claude" / "skills" / unused_name
        used_dir.mkdir(parents=True)
        unused_dir.mkdir(parents=True)
        (used_dir / "SKILL.md").write_text(f"---\nname: {used_name}\n---\n\nUsed skill")
        (unused_dir / "SKILL.md").write_text(f"---\nname: {unused_name}\n---\n\nUnused skill")

        project = core.projects.add_project(str(proj_dir))
        resp = client.post("/api/scan", json={"project_id": project.id})
        assert resp.status_code == 200
        return {"id": project.id, "path": str(proj_dir), "used": used_name, "unused": unused_name}

    p1 = create_project_with_skills("proj-one", "skill-one-used", "skill-one-unused")
    p2 = create_project_with_skills("proj-two", "skill-two-used", "skill-two-unused")

    save_usage_stats(
        core.db.get_connection(),
        project_path=p1["path"],
        session_file="p1-session.jsonl",
        stats=[
            {
                "component_name": p1["used"],
                "component_type": "skill",
                "use_count": 2,
                "used_at": "2026-02-21T10:00:00Z",
            }
        ],
    )
    save_usage_stats(
        core.db.get_connection(),
        project_path=p2["path"],
        session_file="p2-session.jsonl",
        stats=[
            {
                "component_name": p2["used"],
                "component_type": "skill",
                "use_count": 5,
                "used_at": "2026-02-21T10:01:00Z",
            }
        ],
    )

    resp1 = client.get("/api/usage", params={"project_id": p1["id"]})
    assert resp1.status_code == 200
    data1 = resp1.json()
    ranking_names_1 = {r["component_name"] for r in data1["ranking"]}
    unused_names_1 = {u["component_name"] for u in data1["unused"]}

    assert p1["used"] in ranking_names_1
    assert p2["used"] not in ranking_names_1
    assert p1["unused"] in unused_names_1
    assert p2["unused"] not in unused_names_1
    assert data1["total_sessions_parsed"] == 1

    resp2 = client.get("/api/usage", params={"project_id": p2["id"]})
    assert resp2.status_code == 200
    data2 = resp2.json()
    ranking_names_2 = {r["component_name"] for r in data2["ranking"]}
    unused_names_2 = {u["component_name"] for u in data2["unused"]}

    assert p2["used"] in ranking_names_2
    assert p1["used"] not in ranking_names_2
    assert p2["unused"] in unused_names_2
    assert p1["unused"] not in unused_names_2
    assert data2["total_sessions_parsed"] == 1


def test_post_usage_scan_manual_trigger(client: TestClient, core: VibeSmithCore):
    """POST /api/usage/scan — 수동 파싱 트리거."""
    # UsageScanner를 app.state에 등록 (테스트용)
    conn = core.db.get_connection()
    scanner = UsageScanner(conn, claude_base_dir="/nonexistent")
    from vibesmith_api.main import app

    app.state.usage_scanner = scanner

    response = client.post("/api/usage/scan")
    assert response.status_code == 200
    data = response.json()

    assert "sessions_parsed" in data
    assert "stats_saved" in data


def test_post_usage_scan_returns_correct_counts(
    client: TestClient,
    core: VibeSmithCore,
    tmp_path,
):
    """POST /api/usage/scan — 파싱 결과 카운트가 정확."""
    import json

    conn = core.db.get_connection()

    # 프로젝트 등록
    project_path = str(tmp_path / "test-proj")
    conn.execute(
        _INSERT_PROJECT,
        ("p1", "test-proj", project_path, 0, 0, "2026-02-19"),
    )
    conn.commit()

    # Claude 세션 디렉토리 구조 생성
    encoded = project_path.replace("/", "-")
    session_dir = tmp_path / "claude_sessions" / encoded
    session_dir.mkdir(parents=True)
    event = {
        "type": "assistant",
        "message": {
            "role": "assistant",
            "content": [{"type": "tool_use", "name": "Skill", "input": {"skill": "my-skill"}}],
        },
    }
    (session_dir / "s1.jsonl").write_text(json.dumps(event) + "\n")

    scanner = UsageScanner(
        conn,
        claude_base_dir=str(tmp_path / "claude_sessions"),
    )
    from vibesmith_api.main import app

    app.state.usage_scanner = scanner

    response = client.post("/api/usage/scan")
    assert response.status_code == 200
    data = response.json()

    assert data["sessions_parsed"] >= 1
    assert data["stats_saved"] >= 1


def test_post_usage_reset_preserves_deleted_files(
    client: TestClient,
    core: VibeSmithCore,
    tmp_path,
):
    """POST /api/usage/reset — 삭제된 파일의 데이터는 보존."""
    import json

    conn = core.db.get_connection()

    # 프로젝트 등록
    project_path = str(tmp_path / "test-proj")
    conn.execute(
        _INSERT_PROJECT,
        ("p1", "test-proj", project_path, 0, 0, "2026-02-19"),
    )
    conn.commit()

    # 세션 파일 생성 + 스캔
    encoded = project_path.replace("/", "-")
    session_dir = tmp_path / "claude_sessions" / encoded
    session_dir.mkdir(parents=True)
    event = {
        "type": "assistant",
        "message": {
            "role": "assistant",
            "content": [{"type": "tool_use", "name": "Skill", "input": {"skill": "my-skill"}}],
        },
    }
    (session_dir / "s1.jsonl").write_text(json.dumps(event) + "\n")

    scanner = UsageScanner(conn, claude_base_dir=str(tmp_path / "claude_sessions"))
    from vibesmith_api.main import app

    app.state.usage_scanner = scanner
    scanner.scan_once()

    # 파일 삭제 (30일 경과 시뮬레이션)
    (session_dir / "s1.jsonl").unlink()

    # 리셋 → 삭제된 파일의 데이터는 보존
    response = client.post("/api/usage/reset")
    assert response.status_code == 200
    data = response.json()

    assert data["deleted_sessions"] == 0
    assert data["preserved_sessions"] == 1

    # 데이터가 여전히 남아있음
    usage = client.get("/api/usage").json()
    assert usage["total_sessions_parsed"] == 1


def test_post_usage_reset_clears_existing_files(
    client: TestClient,
    core: VibeSmithCore,
    tmp_path,
):
    """POST /api/usage/reset — 존재하는 파일의 데이터는 초기화."""
    import json

    conn = core.db.get_connection()

    project_path = str(tmp_path / "test-proj")
    conn.execute(
        _INSERT_PROJECT,
        ("p1", "test-proj", project_path, 0, 0, "2026-02-19"),
    )
    conn.commit()

    encoded = project_path.replace("/", "-")
    session_dir = tmp_path / "claude_sessions" / encoded
    session_dir.mkdir(parents=True)
    event = {
        "type": "assistant",
        "message": {
            "role": "assistant",
            "content": [{"type": "tool_use", "name": "Skill", "input": {"skill": "my-skill"}}],
        },
    }
    (session_dir / "s1.jsonl").write_text(json.dumps(event) + "\n")

    scanner = UsageScanner(conn, claude_base_dir=str(tmp_path / "claude_sessions"))
    from vibesmith_api.main import app

    app.state.usage_scanner = scanner
    scanner.scan_once()

    # 파일이 존재하는 상태에서 리셋
    response = client.post("/api/usage/reset")
    assert response.status_code == 200
    data = response.json()

    assert data["deleted_sessions"] == 1
    assert data["preserved_sessions"] == 0

    # 데이터가 비었는지 확인
    usage = client.get("/api/usage").json()
    assert usage["ranking"] == []
    assert usage["total_sessions_parsed"] == 0


def test_get_usage_component_timeline(client: TestClient, core: VibeSmithCore, sample_project):
    """GET /api/usage/component — 컴포넌트별 타임라인 조회."""
    from vibesmith_core.usage.repo import save_usage_stats

    conn = core.db.get_connection()

    # sample_project 스캔 → 컴포넌트 등록
    client.post("/api/scan", json={"project_id": sample_project["id"]})

    # 등록된 컴포넌트 ID 조회
    row = conn.execute("SELECT id, name FROM components WHERE name = 'sample-skill'").fetchone()
    assert row is not None
    comp_id, comp_name = row[0], row[1]

    save_usage_stats(
        conn,
        project_path=sample_project["path"],
        session_file="s1.jsonl",
        stats=[
            {"component_name": comp_name, "component_type": "skill", "use_count": 5, "used_at": "2026-02-19T10:00:00Z"},
            {"component_name": comp_name, "component_type": "skill", "use_count": 3, "used_at": "2026-02-18T10:00:00Z"},
        ],
    )

    resp = client.get("/api/usage/component", params={"component_id": comp_id, "days": 1, "limit": 3})
    assert resp.status_code == 200
    data = resp.json()

    assert data["component_id"] == comp_id
    assert data["component_name"] == comp_name
    assert len(data["timeline"]) == 3
    for entry in data["timeline"]:
        assert "date" in entry
        assert "count" in entry
        assert "intensity" in entry


def test_get_usage_component_timeline_uses_component_id_priority(client: TestClient, core: VibeSmithCore, tmp_path):
    """동일 이름 컴포넌트가 여러 개여도 component_id 기준으로 해당 컴포넌트만 집계한다."""
    from vibesmith_core.usage.repo import save_usage_stats

    conn = core.db.get_connection()
    ts = "2026-02-19T00:00:00Z"

    # 프로젝트 2개 + 동일 이름 컴포넌트 2개 생성
    p1_path = str(tmp_path / "proj-1")
    p2_path = str(tmp_path / "proj-2")
    conn.execute(
        _INSERT_PROJECT,
        ("p1", "proj-1", p1_path, 0, 1, ts),
    )
    conn.execute(
        _INSERT_PROJECT,
        ("p2", "proj-2", p2_path, 0, 1, ts),
    )
    conn.execute(
        "INSERT INTO components (id, type, name, project_id, path, created_at, updated_at, platform) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ("comp-p1", "skill", "shared-name", "p1", "/p1/.claude/skills/shared-name/SKILL.md", ts, ts, "claude_code"),
    )
    conn.execute(
        "INSERT INTO components (id, type, name, project_id, path, created_at, updated_at, platform) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ("comp-p2", "skill", "shared-name", "p2", "/p2/.claude/skills/shared-name/SKILL.md", ts, ts, "claude_code"),
    )
    conn.commit()

    save_usage_stats(
        conn,
        project_path=p1_path,
        session_file="p1-s1.jsonl",
        stats=[
            {
                "component_name": "shared-name",
                "component_type": "skill",
                "use_count": 2,
                "used_at": "2026-02-19T10:00:00Z",
            }
        ],
    )
    save_usage_stats(
        conn,
        project_path=p2_path,
        session_file="p2-s1.jsonl",
        stats=[
            {
                "component_name": "shared-name",
                "component_type": "skill",
                "use_count": 9,
                "used_at": "2026-02-19T11:00:00Z",
            }
        ],
    )

    resp = client.get("/api/usage/component", params={"component_id": "comp-p1", "days": 0, "limit": 10})
    assert resp.status_code == 200
    data = resp.json()
    assert data["component_id"] == "comp-p1"
    assert data["component_name"] == "shared-name"
    assert len(data["timeline"]) == 1
    assert data["timeline"][0]["count"] == 2


def test_get_usage_component_timeline_does_not_fallback_to_name_without_component_id_match(
    client: TestClient,
    core: VibeSmithCore,
    sample_project,
):
    """usage/component은 component_id 기준으로만 집계하고 name fallback을 사용하지 않는다."""
    conn = core.db.get_connection()

    # sample_project 스캔 → sample-skill 컴포넌트 등록
    client.post("/api/scan", json={"project_id": sample_project["id"]})
    row = conn.execute("SELECT id FROM components WHERE name = 'sample-skill'").fetchone()
    assert row is not None
    comp_id = row[0]

    # component_id 없는 legacy usage 데이터 삽입
    conn.execute(
        "INSERT INTO usage_sessions VALUES (?, ?, ?, ?)",
        ("legacy-sess", sample_project["path"], "legacy.jsonl", "2026-02-19T00:00:00Z"),
    )
    conn.execute(
        "INSERT INTO usage_stats (id, session_id, component_name, component_type, use_count, used_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        ("legacy-stat", "legacy-sess", "sample-skill", "skill", 4, "2026-02-19T10:00:00Z"),
    )
    conn.commit()

    # backfill 전에는 component_id NULL
    before = conn.execute("SELECT component_id FROM usage_stats WHERE id = 'legacy-stat'").fetchone()
    assert before is not None and before[0] is None

    resp = client.get("/api/usage/component", params={"component_id": comp_id, "days": 0, "limit": 10})
    assert resp.status_code == 200
    data = resp.json()
    assert data["timeline"] == []

    # API 요청 중 동기 backfill을 수행하지 않는다.
    after = conn.execute("SELECT component_id FROM usage_stats WHERE id = 'legacy-stat'").fetchone()
    assert after is not None and after[0] is None


def test_get_usage_component_timeline_strict_mode_excludes_fallback_signal(
    client: TestClient,
    core: VibeSmithCore,
    sample_project,
):
    """usage/component strict 모드는 fallback 신호를 제외한다."""
    from vibesmith_core.usage.repo import save_usage_stats

    conn = core.db.get_connection()
    now = datetime.now(UTC).replace(microsecond=0)
    strict_used_at = now.isoformat().replace("+00:00", "Z")
    fallback_used_at = (now + timedelta(minutes=1)).isoformat().replace("+00:00", "Z")
    session_created_at = now.date().isoformat() + "T00:00:00Z"

    client.post("/api/scan", json={"project_id": sample_project["id"]})
    row = conn.execute("SELECT id, name FROM components WHERE name = 'sample-skill'").fetchone()
    assert row is not None
    comp_id, comp_name = row[0], row[1]

    save_usage_stats(
        conn,
        project_path=sample_project["path"],
        session_file="strict.jsonl",
        stats=[
            {
                "component_name": comp_name,
                "component_type": "skill",
                "use_count": 2,
                "used_at": strict_used_at,
            }
        ],
    )

    conn.execute(
        "INSERT INTO usage_sessions VALUES (?, ?, ?, ?)",
        ("fallback-sess", sample_project["path"], "fallback.jsonl", session_created_at),
    )
    conn.execute(
        "INSERT INTO usage_stats "
        "(id, session_id, component_name, component_type, component_id, use_count, used_at, signal_quality) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (
            "fallback-stat",
            "fallback-sess",
            comp_name,
            "skill",
            comp_id,
            9,
            fallback_used_at,
            "fallback",
        ),
    )
    conn.commit()

    strict_resp = client.get(
        "/api/usage/component",
        params={"component_id": comp_id, "days": 1, "limit": 1, "aggregation_mode": "strict"},
    )
    expanded_resp = client.get(
        "/api/usage/component",
        params={"component_id": comp_id, "days": 1, "limit": 1, "aggregation_mode": "expanded"},
    )

    assert strict_resp.status_code == 200
    assert expanded_resp.status_code == 200
    assert strict_resp.json()["timeline"][0]["count"] == 2
    assert expanded_resp.json()["timeline"][0]["count"] == 11


def test_get_usage_component_timeline_excludes_missing_timestamp(
    client: TestClient,
    core: VibeSmithCore,
    sample_project,
):
    """usage/component 타임라인은 has_timestamp=False 레코드를 제외한다."""
    from vibesmith_core.usage.repo import save_usage_stats

    conn = core.db.get_connection()
    now = datetime.now(UTC).replace(microsecond=0)
    known_used_at = now.isoformat().replace("+00:00", "Z")
    unknown_used_at = (now + timedelta(minutes=1)).isoformat().replace("+00:00", "Z")

    client.post("/api/scan", json={"project_id": sample_project["id"]})
    row = conn.execute("SELECT id, name FROM components WHERE name = 'sample-skill'").fetchone()
    assert row is not None
    comp_id, comp_name = row[0], row[1]

    save_usage_stats(
        conn,
        project_path=sample_project["path"],
        session_file="known-ts.jsonl",
        stats=[
            {
                "component_name": comp_name,
                "component_type": "skill",
                "use_count": 2,
                "used_at": known_used_at,
                "has_timestamp": True,
            }
        ],
    )
    save_usage_stats(
        conn,
        project_path=sample_project["path"],
        session_file="unknown-ts.jsonl",
        stats=[
            {
                "component_name": comp_name,
                "component_type": "skill",
                "use_count": 9,
                "used_at": unknown_used_at,
                "has_timestamp": False,
            }
        ],
    )

    resp = client.get(
        "/api/usage/component",
        params={"component_id": comp_id, "days": 1, "limit": 1, "aggregation_mode": "strict"},
    )

    assert resp.status_code == 200
    assert resp.json()["timeline"][0]["count"] == 2


def test_get_usage_component_missing_id(client: TestClient):
    """GET /api/usage/component — component_id 누락 시 422."""
    resp = client.get("/api/usage/component")
    assert resp.status_code == 422


def test_get_usage_component_not_found(client: TestClient):
    """GET /api/usage/component — 존재하지 않는 ID → 404."""
    resp = client.get("/api/usage/component", params={"component_id": "nonexistent-id"})
    assert resp.status_code == 404
