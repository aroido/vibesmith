"""usage_repo.py 테스트 — 사용 통계 DB CRUD."""

import sqlite3
from datetime import UTC, datetime, timedelta

from vibesmith_core.usage.repo import (
    get_component_timeline,
    get_last_parsed_at,
    get_parse_state,
    get_total_sessions,
    get_unused_components,
    get_usage_ranking,
    reset_usage_data,
    save_parse_state,
    save_usage_stats,
)

_INSERT_PROJECT = (
    "INSERT INTO projects (id, name, path, is_global, component_count, last_scanned_at) VALUES (?, ?, ?, ?, ?, ?)"
)


class _RaceOnSessionInsertConn:
    """usage_sessions insert 시 1회 경쟁 상태를 시뮬레이션한다."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn
        self._triggered = False

    def execute(self, sql: str, params=()):
        normalized = " ".join(sql.split())
        if not self._triggered and normalized.startswith("INSERT INTO usage_sessions"):
            self._triggered = True
            self._conn.execute(
                "INSERT INTO usage_sessions (id, project_path, session_file, parsed_at) VALUES (?, ?, ?, ?)",
                ("race-session", params[1], params[2], params[3]),
            )
            self._conn.commit()
            raise sqlite3.IntegrityError(
                "UNIQUE constraint failed: usage_sessions.project_path, usage_sessions.session_file"
            )
        return self._conn.execute(sql, params)

    def commit(self) -> None:
        self._conn.commit()

    def __getattr__(self, name):
        return getattr(self._conn, name)


def _setup_test_db():
    """테스트용 인메모리 DB 생성 — usage 관련 테이블 포함."""
    conn = sqlite3.connect(":memory:")
    conn.execute("PRAGMA foreign_keys = ON")

    conn.executescript("""
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            path TEXT NOT NULL UNIQUE,
            is_global INTEGER NOT NULL DEFAULT 0,
            component_count INTEGER NOT NULL DEFAULT 0,
            last_scanned_at TEXT NOT NULL,
            hidden_at TEXT
        );

        CREATE TABLE IF NOT EXISTS components (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            path TEXT NOT NULL,
            content TEXT,
            frontmatter TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            platform TEXT NOT NULL,
            deleted_at TEXT,
            original_path TEXT,
            last_used TEXT
        );

        CREATE TABLE IF NOT EXISTS usage_parse_state (
            project_path TEXT NOT NULL,
            session_file TEXT NOT NULL,
            byte_offset INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (project_path, session_file)
        );

        CREATE TABLE IF NOT EXISTS usage_sessions (
            id TEXT PRIMARY KEY,
            project_path TEXT NOT NULL,
            session_file TEXT NOT NULL,
            parsed_at TEXT NOT NULL,
            UNIQUE(project_path, session_file)
        );

        CREATE TABLE IF NOT EXISTS usage_stats (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL REFERENCES usage_sessions(id) ON DELETE CASCADE,
            component_name TEXT NOT NULL,
            component_type TEXT NOT NULL,
            component_id TEXT REFERENCES components(id) ON DELETE SET NULL,
            use_count INTEGER NOT NULL DEFAULT 1,
            used_at TEXT NOT NULL,
            has_timestamp INTEGER NOT NULL DEFAULT 1,
            signal_quality TEXT NOT NULL DEFAULT 'strict'
        );
    """)

    # 테스트 프로젝트
    conn.execute(
        _INSERT_PROJECT,
        ("proj1", "test-project", "/path/to/project", 0, 3, "2026-02-19T00:00:00Z"),
    )

    # 테스트 컴포넌트
    ts = "2026-02-01T00:00:00Z"
    insert_sql = (
        "INSERT INTO components "
        "(id, type, name, project_id, path, created_at, updated_at, platform) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    conn.execute(insert_sql, ("c1", "skill", "commit-helper", "proj1", "/skills/commit-helper", ts, ts, "claude_code"))
    conn.execute(insert_sql, ("c2", "agent", "code-reviewer", "proj1", "/agents/code-reviewer", ts, ts, "claude_code"))
    conn.execute(insert_sql, ("c3", "skill", "unused-skill", "proj1", "/skills/unused-skill", ts, ts, "claude_code"))
    conn.commit()
    return conn


class TestParseState:
    """parse state CRUD 테스트."""

    def test_save_and_get_parse_state(self):
        """parse state 저장 후 조회."""
        conn = _setup_test_db()

        save_parse_state(conn, "/path/to/project", "session1.jsonl", 1024)
        state = get_parse_state(conn, "/path/to/project", "session1.jsonl")

        assert state is not None
        assert state["byte_offset"] == 1024
        conn.close()

    def test_get_parse_state_not_found(self):
        """존재하지 않는 parse state 조회 시 None 반환."""
        conn = _setup_test_db()

        state = get_parse_state(conn, "/nonexistent", "file.jsonl")
        assert state is None
        conn.close()

    def test_update_parse_state(self):
        """parse state 업데이트 (upsert)."""
        conn = _setup_test_db()

        save_parse_state(conn, "/path/to/project", "session1.jsonl", 512)
        save_parse_state(conn, "/path/to/project", "session1.jsonl", 2048)

        state = get_parse_state(conn, "/path/to/project", "session1.jsonl")
        assert state["byte_offset"] == 2048
        conn.close()


class TestUsageStats:
    """usage stats 저장/조회 테스트."""

    def test_save_usage_stats(self):
        """사용 통계 저장."""
        conn = _setup_test_db()

        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="session1.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 3,
                    "used_at": "2026-02-19T10:00:00Z",
                },
                {
                    "component_name": "code-reviewer",
                    "component_type": "agent",
                    "use_count": 1,
                    "used_at": "2026-02-19T10:05:00Z",
                },
            ],
        )

        # 세션이 생성되었는지 확인
        rows = conn.execute("SELECT * FROM usage_sessions").fetchall()
        assert len(rows) == 1

        # 통계가 저장되었는지 확인
        stats = conn.execute("SELECT * FROM usage_stats").fetchall()
        assert len(stats) == 2
        conn.close()

    def test_save_usage_stats_incremental_appends(self):
        """동일 세션 파일에 증분 데이터를 추가 저장한다 (Issue #856)."""
        conn = _setup_test_db()

        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="session1.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 1,
                    "used_at": "2026-02-19T10:00:00Z",
                },
            ],
        )
        # 같은 세션에 증분 데이터
        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="session1.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 5,
                    "used_at": "2026-02-19T11:00:00Z",
                },
            ],
        )

        # 세션은 여전히 1개
        rows = conn.execute("SELECT * FROM usage_sessions").fetchall()
        assert len(rows) == 1

        # stats는 누적 (1 + 1 = 2개 행)
        stats = conn.execute("SELECT * FROM usage_stats").fetchall()
        assert len(stats) == 2
        conn.close()

    def test_save_usage_stats_replace_existing_stats(self):
        """replace_existing_stats=True이면 동일 세션 통계를 덮어쓴다."""
        conn = _setup_test_db()

        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="cursor-session-1",
            stats=[
                {
                    "component_name": "auto-implement",
                    "component_type": "command",
                    "use_count": 1,
                    "used_at": "2026-02-19T10:00:00Z",
                },
            ],
            platform="cursor",
            replace_existing_stats=True,
        )
        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="cursor-session-1",
            stats=[
                {
                    "component_name": "work-session",
                    "component_type": "command",
                    "use_count": 2,
                    "used_at": "2026-02-19T11:00:00Z",
                },
            ],
            platform="cursor",
            replace_existing_stats=True,
        )

        rows = conn.execute("SELECT component_name, use_count FROM usage_stats ORDER BY used_at").fetchall()
        assert rows == [("work-session", 2)]
        conn.close()

    def test_save_usage_stats_replace_existing_preserves_used_at(self):
        """replace_existing_stats=True 재파싱 시 기존 used_at을 보존한다."""
        conn = _setup_test_db()

        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="cursor-session-1",
            stats=[
                {
                    "component_name": "work-session",
                    "component_type": "command",
                    "use_count": 1,
                    "used_at": "2026-02-19T10:00:00Z",
                },
            ],
            platform="cursor",
            replace_existing_stats=True,
        )
        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="cursor-session-1",
            stats=[
                {
                    "component_name": "work-session",
                    "component_type": "command",
                    "use_count": 2,
                    "used_at": "2026-02-19T11:00:00Z",
                },
            ],
            platform="cursor",
            replace_existing_stats=True,
        )

        row = conn.execute(
            "SELECT component_name, component_type, use_count, used_at "
            "FROM usage_stats WHERE component_name = 'work-session' "
            "ORDER BY used_at DESC LIMIT 1"
        ).fetchone()
        assert row is not None
        assert row[0] == "work-session"
        assert row[1] == "command"
        assert row[2] == 2
        assert row[3] == "2026-02-19T10:00:00Z"
        conn.close()

    def test_save_usage_stats_recovers_from_session_insert_race(self):
        """usage_sessions INSERT 경쟁 시 기존 row를 재사용해 저장한다."""
        conn = _setup_test_db()
        race_conn = _RaceOnSessionInsertConn(conn)

        save_usage_stats(
            race_conn,
            project_path="/path/to/project",
            session_file="session-race.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 1,
                    "used_at": "2026-02-19T10:00:00Z",
                },
            ],
        )

        sessions = conn.execute(
            "SELECT project_path, session_file FROM usage_sessions WHERE session_file = 'session-race.jsonl'"
        ).fetchall()
        assert len(sessions) == 1

        stats = conn.execute(
            "SELECT component_name, use_count FROM usage_stats "
            "JOIN usage_sessions ON usage_sessions.id = usage_stats.session_id "
            "WHERE usage_sessions.session_file = 'session-race.jsonl'"
        ).fetchall()
        assert stats == [("commit-helper", 1)]
        conn.close()


class TestIncrementalUsageStats:
    """Issue #856: 동일 세션의 증분 데이터를 올바르게 추가 저장한다."""

    def test_appends_stats_to_existing_session(self):
        """같은 세션 파일에 대해 두 번 호출하면 stats가 누적된다."""
        conn = _setup_test_db()

        # 1차 파싱 — 초기 데이터
        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="session1.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 1,
                    "used_at": "2026-02-19T10:00:00Z",
                },
            ],
        )

        # 2차 파싱 — 증분 데이터 (같은 세션, 새로운 도구 사용)
        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="session1.jsonl",
            stats=[
                {
                    "component_name": "code-reviewer",
                    "component_type": "agent",
                    "use_count": 2,
                    "used_at": "2026-02-19T11:00:00Z",
                },
            ],
        )

        # 세션은 여전히 1개 (중복 생성 안 됨)
        sessions = conn.execute("SELECT * FROM usage_sessions").fetchall()
        assert len(sessions) == 1

        # stats는 2개 (1차 + 2차 누적)
        stats = conn.execute("SELECT * FROM usage_stats ORDER BY used_at").fetchall()
        assert len(stats) == 2
        conn.close()

    def test_incremental_updates_parsed_at(self):
        """증분 저장 시 parsed_at 타임스탬프가 갱신된다."""
        conn = _setup_test_db()

        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="session1.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 1,
                    "used_at": "2026-02-19T10:00:00Z",
                },
            ],
        )

        first_parsed_at = get_last_parsed_at(conn)

        # 약간의 시간 차 확보
        import time

        time.sleep(0.01)

        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="session1.jsonl",
            stats=[
                {
                    "component_name": "code-reviewer",
                    "component_type": "agent",
                    "use_count": 1,
                    "used_at": "2026-02-19T11:00:00Z",
                },
            ],
        )

        second_parsed_at = get_last_parsed_at(conn)
        assert second_parsed_at > first_parsed_at
        conn.close()

    def test_incremental_updates_last_used(self):
        """증분 저장이 components.last_used를 갱신한다."""
        conn = _setup_test_db()

        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="session1.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 1,
                    "used_at": "2026-02-19T10:00:00Z",
                },
            ],
        )

        # 증분: 같은 컴포넌트를 더 최신 시각에 사용
        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="session1.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 2,
                    "used_at": "2026-02-20T12:00:00Z",
                },
            ],
        )

        row = conn.execute("SELECT last_used FROM components WHERE id = 'c1'").fetchone()
        assert row[0] == "2026-02-20T12:00:00Z"
        conn.close()

    def test_incremental_ranking_reflects_cumulative(self):
        """증분 저장 후 랭킹 조회 시 누적 횟수가 반영된다."""
        conn = _setup_test_db()

        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="session1.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 3,
                    "used_at": "2026-02-19T10:00:00Z",
                },
            ],
        )

        # 증분 데이터
        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="session1.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 2,
                    "used_at": "2026-02-19T11:00:00Z",
                },
            ],
        )

        ranking = get_usage_ranking(conn)
        assert ranking[0]["component_name"] == "commit-helper"
        assert ranking[0]["use_count"] == 5  # 3 + 2
        conn.close()

    def test_empty_incremental_stats_still_updates_parsed_at(self):
        """빈 stats 리스트로 호출해도 parsed_at만 갱신된다 (파서가 새 바이트는 읽었지만 도구 호출이 없는 경우)."""
        conn = _setup_test_db()

        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="session1.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 1,
                    "used_at": "2026-02-19T10:00:00Z",
                },
            ],
        )

        first_parsed_at = get_last_parsed_at(conn)

        import time

        time.sleep(0.01)

        # 빈 stats로 호출
        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="session1.jsonl",
            stats=[],
        )

        second_parsed_at = get_last_parsed_at(conn)
        assert second_parsed_at > first_parsed_at
        conn.close()


class TestUsageRanking:
    """사용 랭킹 조회 테스트."""

    def test_get_usage_ranking_empty(self):
        """통계가 없을 때 빈 리스트 반환."""
        conn = _setup_test_db()

        ranking = get_usage_ranking(conn)
        assert ranking == []
        conn.close()

    def test_get_usage_ranking_sorted_by_count(self):
        """사용 횟수 내림차순 정렬."""
        conn = _setup_test_db()

        # 세션 1: commit-helper 3회, code-reviewer 1회
        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="session1.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 3,
                    "used_at": "2026-02-19T10:00:00Z",
                },
                {
                    "component_name": "code-reviewer",
                    "component_type": "agent",
                    "use_count": 1,
                    "used_at": "2026-02-19T10:05:00Z",
                },
            ],
        )
        # 세션 2: commit-helper 2회 추가
        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="session2.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 2,
                    "used_at": "2026-02-19T11:00:00Z",
                },
            ],
        )

        ranking = get_usage_ranking(conn)

        assert len(ranking) == 2
        assert ranking[0]["component_name"] == "commit-helper"
        assert ranking[0]["use_count"] == 5  # 3 + 2
        assert ranking[1]["component_name"] == "code-reviewer"
        assert ranking[1]["use_count"] == 1
        conn.close()

    def test_get_usage_ranking_filter_by_component_type(self):
        """component_type 필터."""
        conn = _setup_test_db()

        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="session1.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 3,
                    "used_at": "2026-02-19T10:00:00Z",
                },
                {
                    "component_name": "code-reviewer",
                    "component_type": "agent",
                    "use_count": 1,
                    "used_at": "2026-02-19T10:05:00Z",
                },
            ],
        )

        ranking = get_usage_ranking(conn, component_type="skill")
        assert len(ranking) == 1
        assert ranking[0]["component_name"] == "commit-helper"
        conn.close()

    def test_get_usage_ranking_filter_by_days(self):
        """days 파라미터로 기간 필터."""
        conn = _setup_test_db()
        now = datetime.now(UTC)
        recent_used_at = now.isoformat().replace("+00:00", "Z")
        old_used_at = (now - timedelta(days=40)).isoformat().replace("+00:00", "Z")

        # 오늘 데이터
        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="session-today.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 3,
                    "used_at": recent_used_at,
                },
            ],
        )
        # 40일 전 데이터
        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="session-old.jsonl",
            stats=[
                {
                    "component_name": "old-skill",
                    "component_type": "skill",
                    "use_count": 10,
                    "used_at": old_used_at,
                },
            ],
        )

        # days=7 → 오늘 것만
        ranking = get_usage_ranking(conn, days=7)
        names = {r["component_name"] for r in ranking}
        assert "commit-helper" in names
        assert "old-skill" not in names

        # days=None → 전체
        ranking_all = get_usage_ranking(conn, days=None)
        names_all = {r["component_name"] for r in ranking_all}
        assert "commit-helper" in names_all
        assert "old-skill" in names_all
        conn.close()

    def test_get_usage_ranking_days_filters_missing_timestamp_by_used_at(self):
        """timestamp 없는 레코드도 used_at 기간 범위 내에서만 집계한다."""
        conn = _setup_test_db()
        now = datetime.now(UTC)
        old_used_at = (now - timedelta(days=120)).isoformat().replace("+00:00", "Z")
        recent_used_at = now.isoformat().replace("+00:00", "Z")

        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="recent.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 3,
                    "used_at": now.isoformat().replace("+00:00", "Z"),
                    "has_timestamp": True,
                },
            ],
        )
        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="unknown-ts-old.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 2,
                    "used_at": old_used_at,
                    "has_timestamp": False,
                },
            ],
        )
        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="unknown-ts-recent.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 1,
                    "used_at": recent_used_at,
                    "has_timestamp": False,
                },
            ],
        )

        ranking = get_usage_ranking(conn, days=7, dedupe_by_session=False)
        item = next((row for row in ranking if row["component_name"] == "commit-helper"), None)

        assert item is not None
        assert item["use_count"] == 4
        assert item["time_qualified_count"] == 3
        assert item["count_only_count"] == 1
        conn.close()

    def test_get_usage_ranking_filter_by_project_id(self):
        """project_id 필터로 특정 프로젝트 세션만 집계한다."""
        conn = _setup_test_db()
        conn.execute(
            _INSERT_PROJECT,
            ("proj2", "test-project-2", "/path/to/project-2", 0, 1, "2026-02-19T00:00:00Z"),
        )
        conn.commit()

        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="session-proj1.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 3,
                    "used_at": "2026-02-19T10:00:00Z",
                },
            ],
        )
        save_usage_stats(
            conn,
            project_path="/path/to/project-2",
            session_file="session-proj2.jsonl",
            stats=[
                {
                    "component_name": "other-skill",
                    "component_type": "skill",
                    "use_count": 7,
                    "used_at": "2026-02-19T10:01:00Z",
                },
            ],
        )

        ranking_proj1 = get_usage_ranking(conn, project_id="proj1")
        names_proj1 = {r["component_name"] for r in ranking_proj1}
        assert "commit-helper" in names_proj1
        assert "other-skill" not in names_proj1

        ranking_proj2 = get_usage_ranking(conn, project_id="proj2")
        names_proj2 = {r["component_name"] for r in ranking_proj2}
        assert "other-skill" in names_proj2
        assert "commit-helper" not in names_proj2

        assert get_usage_ranking(conn, project_id="missing-project") == []
        conn.close()

    def test_get_usage_ranking_no_last_used(self):
        """ranking 결과에 last_used가 없어야 한다."""
        conn = _setup_test_db()

        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="s1.jsonl",
            stats=[
                {
                    "component_name": "a",
                    "component_type": "skill",
                    "use_count": 1,
                    "used_at": "2026-02-19T10:00:00Z",
                },
            ],
        )

        ranking = get_usage_ranking(conn)
        assert "last_used" not in ranking[0]
        conn.close()

    def test_save_usage_stats_updates_components_last_used(self):
        """save_usage_stats가 components.last_used를 업데이트해야 한다."""
        conn = _setup_test_db()

        # _setup_test_db()에서 c1=commit-helper(skill) 이미 등록됨
        # last_used는 처음에 NULL
        row = conn.execute("SELECT last_used FROM components WHERE id = 'c1'").fetchone()
        assert row[0] is None

        # usage stats 저장 → last_used 업데이트
        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="s1.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 3,
                    "used_at": "2026-02-19T10:00:00Z",
                },
            ],
        )

        row = conn.execute("SELECT last_used FROM components WHERE id = 'c1'").fetchone()
        assert row[0] == "2026-02-19T10:00:00Z"

        # 더 최신 데이터 → last_used 갱신
        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="s2.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 1,
                    "used_at": "2026-02-20T12:00:00Z",
                },
            ],
        )

        row = conn.execute("SELECT last_used FROM components WHERE id = 'c1'").fetchone()
        assert row[0] == "2026-02-20T12:00:00Z"
        conn.close()


class TestUsageRankingAggregationMode:
    """strict/expanded 집계 모드 + 세션 dedupe 동작."""

    def test_strict_mode_excludes_fallback_rows(self):
        conn = _setup_test_db()

        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="strict.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 2,
                    "used_at": "2026-02-19T10:00:00Z",
                },
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 9,
                    "used_at": "2026-02-19T10:00:00Z",
                    "signal_quality": "fallback",
                },
            ],
        )

        strict_ranking = get_usage_ranking(conn, aggregation_mode="strict")
        expanded_ranking = get_usage_ranking(conn, aggregation_mode="expanded")

        assert strict_ranking[0]["component_name"] == "commit-helper"
        assert strict_ranking[0]["use_count"] == 2
        assert expanded_ranking[0]["use_count"] == 11
        conn.close()

    def test_dedupe_by_session_counts_each_session_once(self):
        conn = _setup_test_db()

        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="session1.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 3,
                    "used_at": "2026-02-19T10:00:00Z",
                },
            ],
        )
        # 같은 세션 파일에 증분 append
        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="session1.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 5,
                    "used_at": "2026-02-19T10:10:00Z",
                },
            ],
        )

        raw_ranking = get_usage_ranking(conn, dedupe_by_session=False)
        deduped_ranking = get_usage_ranking(conn, dedupe_by_session=True)

        assert raw_ranking[0]["use_count"] == 8
        assert deduped_ranking[0]["use_count"] == 1
        conn.close()

    def test_dedupe_auto_cursor_always_dedupes(self):
        """auto 모드에서 Cursor 세션은 항상 세션 dedupe (모든 타입)."""
        conn = _setup_test_db()

        # Cursor 세션 — skill 타입, 같은 세션에서 use_count=3
        save_usage_stats(
            conn,
            project_path="cursor:global",
            session_file="cursor-session1.jsonl",
            stats=[
                {
                    "component_name": "my-rule",
                    "component_type": "rule",
                    "use_count": 5,
                    "used_at": "2026-02-19T10:00:00Z",
                },
            ],
            platform="cursor",
        )

        ranking = get_usage_ranking(conn, dedupe_by_session="auto")
        match = [r for r in ranking if r["component_name"] == "my-rule"]
        # Cursor → session dedupe → 1 session = 1회
        assert match[0]["use_count"] == 1
        conn.close()

    def test_dedupe_auto_claude_code_hook_dedupes(self):
        """auto 모드에서 Claude Code hook은 세션 dedupe."""
        conn = _setup_test_db()

        # Claude Code 세션 — hook 타입, 같은 세션에서 다회 호출
        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="cc-session1.jsonl",
            stats=[
                {
                    "component_name": "PostToolUse",
                    "component_type": "hook",
                    "use_count": 50,
                    "used_at": "2026-02-19T10:00:00Z",
                },
            ],
        )

        ranking = get_usage_ranking(conn, dedupe_by_session="auto")
        match = [r for r in ranking if r["component_name"] == "PostToolUse"]
        # Claude Code hook → session dedupe → 1 session = 1회
        assert match[0]["use_count"] == 1
        conn.close()

    def test_dedupe_auto_claude_code_non_hook_sums(self):
        """auto 모드에서 Claude Code skill/command는 SUM(use_count)."""
        conn = _setup_test_db()

        # Claude Code 세션 — skill 타입, 같은 세션에서 다회 호출
        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="cc-session1.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 3,
                    "used_at": "2026-02-19T10:00:00Z",
                },
            ],
        )
        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="cc-session2.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 2,
                    "used_at": "2026-02-19T11:00:00Z",
                },
            ],
        )

        ranking = get_usage_ranking(conn, dedupe_by_session="auto")
        match = [r for r in ranking if r["component_name"] == "commit-helper"]
        # Claude Code non-hook → SUM(use_count) → 3 + 2 = 5
        assert match[0]["use_count"] == 5
        conn.close()

    def test_dedupe_auto_mixed_platforms(self):
        """auto 모드에서 같은 컴포넌트가 양 플랫폼에 있을 때 혼합 집계."""
        conn = _setup_test_db()

        # Cursor 세션 — skill, use_count=10
        save_usage_stats(
            conn,
            project_path="cursor:global",
            session_file="cursor-s1.jsonl",
            stats=[
                {
                    "component_name": "shared-skill",
                    "component_type": "skill",
                    "use_count": 10,
                    "used_at": "2026-02-19T10:00:00Z",
                },
            ],
            platform="cursor",
        )

        # Claude Code 세션 — skill, use_count=3
        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="cc-s1.jsonl",
            stats=[
                {
                    "component_name": "shared-skill",
                    "component_type": "skill",
                    "use_count": 3,
                    "used_at": "2026-02-19T11:00:00Z",
                },
            ],
        )

        ranking = get_usage_ranking(conn, dedupe_by_session="auto")
        match = [r for r in ranking if r["component_name"] == "shared-skill"]
        # Cursor: 1 (session dedupe) + Claude Code skill: 3 (SUM) = 4
        assert match[0]["use_count"] == 4
        conn.close()

    def test_dedupe_bool_backward_compat(self):
        """bool 값도 하위 호환으로 작동한다."""
        conn = _setup_test_db()

        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="session1.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 3,
                    "used_at": "2026-02-19T10:00:00Z",
                },
            ],
        )

        # bool True → "true" 동작 (전체 dedupe)
        deduped = get_usage_ranking(conn, dedupe_by_session=True)
        assert deduped[0]["use_count"] == 1

        # bool False → "false" 동작 (전체 SUM)
        raw = get_usage_ranking(conn, dedupe_by_session=False)
        assert raw[0]["use_count"] == 3

        # 문자열도 동작
        deduped_str = get_usage_ranking(conn, dedupe_by_session="true")
        assert deduped_str[0]["use_count"] == 1

        raw_str = get_usage_ranking(conn, dedupe_by_session="false")
        assert raw_str[0]["use_count"] == 3
        conn.close()


class TestUnusedComponents:
    """미사용 구성요소 조회 테스트."""

    def test_get_unused_components_all_unused(self):
        """모든 구성요소가 미사용일 때."""
        conn = _setup_test_db()

        unused = get_unused_components(conn)
        assert len(unused) == 3  # c1, c2, c3
        conn.close()

    def test_get_unused_components_excludes_used(self):
        """사용된 구성요소는 미사용 목록에서 제외."""
        conn = _setup_test_db()

        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="session1.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 1,
                    "used_at": "2026-02-19T10:00:00Z",
                },
            ],
        )

        unused = get_unused_components(conn)
        names = [u["component_name"] for u in unused]
        assert "commit-helper" not in names
        assert "unused-skill" in names
        conn.close()

    def test_get_unused_components_filter_by_type(self):
        """component_type 필터."""
        conn = _setup_test_db()

        unused = get_unused_components(conn, component_type="skill")
        assert all(u["component_type"] == "skill" for u in unused)
        conn.close()

    def test_get_unused_components_filter_by_project_id(self):
        """project_id 필터 시 해당 프로젝트 구성요소만 반환."""
        conn = _setup_test_db()
        ts = "2026-02-01T00:00:00Z"
        conn.execute(
            _INSERT_PROJECT,
            ("proj2", "test-project-2", "/path/to/project-2", 0, 1, "2026-02-19T00:00:00Z"),
        )
        conn.execute(
            "INSERT INTO components (id, type, name, project_id, path, created_at, updated_at, platform) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("c4", "skill", "proj2-only-unused", "proj2", "/skills/proj2-only-unused", ts, ts, "claude_code"),
        )
        conn.commit()

        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="session-proj1.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 1,
                    "used_at": "2026-02-19T10:00:00Z",
                },
            ],
        )

        unused_proj1 = get_unused_components(conn, project_id="proj1")
        names_proj1 = {u["component_name"] for u in unused_proj1}
        assert "unused-skill" in names_proj1
        assert "proj2-only-unused" not in names_proj1

        unused_proj2 = get_unused_components(conn, project_id="proj2")
        names_proj2 = {u["component_name"] for u in unused_proj2}
        assert "proj2-only-unused" in names_proj2
        assert "unused-skill" not in names_proj2
        conn.close()


class TestSessionCounts:
    """세션 카운트 및 마지막 파싱 시각 테스트."""

    def test_get_total_sessions_empty(self):
        """세션이 없을 때 0 반환."""
        conn = _setup_test_db()
        assert get_total_sessions(conn) == 0
        conn.close()

    def test_get_total_sessions(self):
        """세션 수 정확히 반환."""
        conn = _setup_test_db()

        save_usage_stats(
            conn,
            "/path",
            "s1.jsonl",
            [{"component_name": "a", "component_type": "skill", "use_count": 1, "used_at": "2026-02-19T10:00:00Z"}],
        )
        save_usage_stats(
            conn,
            "/path",
            "s2.jsonl",
            [{"component_name": "a", "component_type": "skill", "use_count": 1, "used_at": "2026-02-19T11:00:00Z"}],
        )

        assert get_total_sessions(conn) == 2
        conn.close()

    def test_get_total_sessions_filter_by_project_id(self):
        """project_id 필터 시 해당 프로젝트 세션만 카운트한다."""
        conn = _setup_test_db()
        conn.execute(
            _INSERT_PROJECT,
            ("proj2", "test-project-2", "/path/to/project-2", 0, 1, "2026-02-19T00:00:00Z"),
        )
        conn.commit()

        save_usage_stats(
            conn,
            "/path/to/project",
            "proj1-session.jsonl",
            [{"component_name": "a", "component_type": "skill", "use_count": 1, "used_at": "2026-02-19T10:00:00Z"}],
        )
        save_usage_stats(
            conn,
            "/path/to/project-2",
            "proj2-session.jsonl",
            [{"component_name": "b", "component_type": "skill", "use_count": 1, "used_at": "2026-02-19T11:00:00Z"}],
        )

        assert get_total_sessions(conn) == 2
        assert get_total_sessions(conn, project_id="proj1") == 1
        assert get_total_sessions(conn, project_id="proj2") == 1
        assert get_total_sessions(conn, project_id="missing-project") == 0
        conn.close()

    def test_get_last_parsed_at_empty(self):
        """세션이 없을 때 None 반환."""
        conn = _setup_test_db()
        assert get_last_parsed_at(conn) is None
        conn.close()

    def test_get_last_parsed_at(self):
        """가장 최근 파싱 시각 반환."""
        conn = _setup_test_db()

        save_usage_stats(
            conn,
            "/path",
            "s1.jsonl",
            [{"component_name": "a", "component_type": "skill", "use_count": 1, "used_at": "2026-02-19T10:00:00Z"}],
        )

        result = get_last_parsed_at(conn)
        assert result is not None
        conn.close()


class TestResetUsageData:
    """usage 데이터 전체 초기화 테스트."""

    def test_reset_clears_all_tables(self):
        """3개 테이블 (parse_state, sessions, stats) 모두 초기화."""
        conn = _setup_test_db()

        # 데이터 삽입
        save_parse_state(conn, "/path", "s1.jsonl", 1024)
        save_usage_stats(
            conn,
            "/path",
            "s1.jsonl",
            [{"component_name": "a", "component_type": "skill", "use_count": 1, "used_at": "2026-02-19T10:00:00Z"}],
        )

        # 데이터가 있는지 확인
        assert get_total_sessions(conn) == 1
        assert get_parse_state(conn, "/path", "s1.jsonl") is not None

        # 리셋
        result = reset_usage_data(conn)

        # 전부 비었는지 확인
        assert get_total_sessions(conn) == 0
        assert get_last_parsed_at(conn) is None
        assert get_parse_state(conn, "/path", "s1.jsonl") is None
        assert get_usage_ranking(conn) == []
        assert result["deleted_sessions"] == 1
        assert result["deleted_parse_states"] == 1
        conn.close()

    def test_reset_on_empty_db(self):
        """빈 DB에서 리셋해도 에러 없음."""
        conn = _setup_test_db()

        result = reset_usage_data(conn)

        assert result["deleted_sessions"] == 0
        assert result["deleted_parse_states"] == 0
        conn.close()


class TestResolveComponentId:
    """_resolve_component 매칭 테스트."""

    def test_resolve_finds_matching_component(self):
        """프로젝트 내 이름 매칭 시 (component_id, actual_type) 반환."""
        from vibesmith_core.usage.repo import _resolve_component

        conn = _setup_test_db()
        comp_id, actual_type = _resolve_component(conn, "/path/to/project", "commit-helper", "skill")
        assert comp_id == "c1"
        assert actual_type == "skill"
        conn.close()

    def test_resolve_returns_none_for_unknown_project(self):
        """등록되지 않은 프로젝트 경로면 (None, 원래 type) 반환."""
        from vibesmith_core.usage.repo import _resolve_component

        conn = _setup_test_db()
        comp_id, actual_type = _resolve_component(conn, "/unknown/project", "commit-helper", "skill")
        assert comp_id is None
        assert actual_type == "skill"
        conn.close()

    def test_resolve_returns_none_for_unmatched_name(self):
        """프로젝트에 해당 이름의 컴포넌트가 없으면 (None, 원래 type) 반환."""
        from vibesmith_core.usage.repo import _resolve_component

        conn = _setup_test_db()
        comp_id, actual_type = _resolve_component(conn, "/path/to/project", "nonexistent-skill", "skill")
        assert comp_id is None
        assert actual_type == "skill"
        conn.close()

    def test_resolve_excludes_deleted_components(self):
        """deleted_at이 설정된 컴포넌트는 매칭하지 않는다."""
        from vibesmith_core.usage.repo import _resolve_component

        conn = _setup_test_db()
        conn.execute("UPDATE components SET deleted_at = '2026-02-20T00:00:00Z' WHERE id = 'c1'")
        conn.commit()

        comp_id, _ = _resolve_component(conn, "/path/to/project", "commit-helper", "skill")
        assert comp_id is None
        conn.close()

    def test_resolve_matches_by_name_regardless_of_type(self):
        """Skill 도구는 skill/command 구분 없이 호출하므로 type 무관 매칭 (#639)."""
        from vibesmith_core.usage.repo import _resolve_component

        conn = _setup_test_db()
        # commit-helper는 DB에 type="skill"로 등록, type="agent"로 조회해도 매칭
        comp_id, actual_type = _resolve_component(conn, "/path/to/project", "commit-helper", "agent")
        assert comp_id == "c1"
        assert actual_type == "skill"  # DB의 실제 타입 반환
        conn.close()

    def test_resolve_cross_type_skill_to_command(self):
        """파서가 'skill'로 기록한 command 타입 컴포넌트도 매칭 + 실제 타입 반환 (#639)."""
        from vibesmith_core.usage.repo import _resolve_component

        conn = _setup_test_db()
        ts = "2026-02-01T00:00:00Z"
        conn.execute(
            "INSERT INTO components (id, type, name, project_id, path, created_at, updated_at, platform) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("c_cmd", "command", "ralph", "proj1", "/commands/ralph.md", ts, ts, "claude_code"),
        )
        conn.commit()

        comp_id, actual_type = _resolve_component(conn, "/path/to/project", "ralph", "skill")
        assert comp_id == "c_cmd"
        assert actual_type == "command"  # 파서는 "skill"이지만 실제는 "command"
        conn.close()


class TestUsageStatsComponentMatching:
    """save_usage_stats가 component_id를 매칭하여 저장하는지 테스트."""

    def test_save_sets_component_id_on_match(self):
        """매칭되면 usage_stats.component_id가 설정된다."""
        conn = _setup_test_db()

        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="s1.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 3,
                    "used_at": "2026-02-19T10:00:00Z",
                }
            ],
        )

        row = conn.execute("SELECT component_id FROM usage_stats WHERE component_name = 'commit-helper'").fetchone()
        assert row[0] == "c1"
        conn.close()

    def test_save_corrects_component_type_on_cross_type_match(self):
        """command를 skill로 호출해도 저장 시 실제 타입(command)으로 교정된다 (#639)."""
        conn = _setup_test_db()
        ts = "2026-02-01T00:00:00Z"
        conn.execute(
            "INSERT INTO components (id, type, name, project_id, path, created_at, updated_at, platform) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("c_cmd", "command", "ralph", "proj1", "/commands/ralph.md", ts, ts, "claude_code"),
        )
        conn.commit()

        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="s1.jsonl",
            stats=[
                {
                    "component_name": "ralph",
                    "component_type": "skill",  # 파서가 부여한 잘못된 타입
                    "use_count": 8,
                    "used_at": "2026-02-19T10:00:00Z",
                }
            ],
        )

        row = conn.execute(
            "SELECT component_id, component_type FROM usage_stats WHERE component_name = 'ralph'"
        ).fetchone()
        assert row[0] == "c_cmd"
        assert row[1] == "command"  # "skill"이 아닌 실제 타입 "command"
        conn.close()

    def test_save_sets_null_component_id_on_no_match(self):
        """매칭 실패 시 component_id는 NULL."""
        conn = _setup_test_db()

        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="s1.jsonl",
            stats=[
                {
                    "component_name": "unknown-skill",
                    "component_type": "skill",
                    "use_count": 1,
                    "used_at": "2026-02-19T10:00:00Z",
                }
            ],
        )

        row = conn.execute("SELECT component_id FROM usage_stats WHERE component_name = 'unknown-skill'").fetchone()
        assert row[0] is None
        conn.close()

    def test_last_used_updates_only_matched_component(self):
        """last_used는 매칭된 component_id 기반으로만 업데이트된다."""
        conn = _setup_test_db()

        # 다른 프로젝트에 같은 이름 컴포넌트 추가
        conn.execute(
            _INSERT_PROJECT,
            ("proj2", "other-project", "/other/project", 0, 1, "2026-02-19T00:00:00Z"),
        )
        ts = "2026-02-01T00:00:00Z"
        conn.execute(
            "INSERT INTO components (id, type, name, project_id, path, created_at, updated_at, platform) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("c4", "skill", "commit-helper", "proj2", "/skills/commit-helper", ts, ts, "claude_code"),
        )
        conn.commit()

        # proj1 세션에서 commit-helper 사용
        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="s1.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 1,
                    "used_at": "2026-02-19T10:00:00Z",
                }
            ],
        )

        # proj1의 c1만 last_used 업데이트
        row1 = conn.execute("SELECT last_used FROM components WHERE id = 'c1'").fetchone()
        assert row1[0] == "2026-02-19T10:00:00Z"

        # proj2의 c4는 last_used가 NULL 유지
        row2 = conn.execute("SELECT last_used FROM components WHERE id = 'c4'").fetchone()
        assert row2[0] is None
        conn.close()


class TestComponentTimeline:
    """컴포넌트별 시간대 사용 추이 테스트."""

    def test_get_component_timeline_daily(self):
        """days=1, limit=5 일별 집계."""
        from datetime import date

        conn = _setup_test_db()
        ref = date(2026, 2, 19)

        save_usage_stats(
            conn,
            "/path",
            "s1.jsonl",
            [
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 3,
                    "used_at": "2026-02-19T10:00:00Z",
                },
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 2,
                    "used_at": "2026-02-17T14:00:00Z",
                },
            ],
        )

        result = get_component_timeline(conn, "commit-helper", days=1, limit=5, reference_date=ref)

        assert len(result) == 5
        assert result[0]["date"] == "2026-02-19"
        assert result[0]["count"] == 3
        assert result[1]["date"] == "2026-02-18"
        assert result[1]["count"] == 0
        assert result[2]["date"] == "2026-02-17"
        assert result[2]["count"] == 2
        conn.close()

    def test_get_component_timeline_fills_empty_days(self):
        """데이터 없는 날짜도 0으로 채움 — limit=5면 항상 5개 반환."""
        from datetime import date

        conn = _setup_test_db()
        ref = date(2026, 2, 19)

        # 데이터가 1일치만 있어도 limit=5면 5개 반환
        save_usage_stats(
            conn,
            "/path",
            "s1.jsonl",
            [
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 1,
                    "used_at": "2026-02-19T10:00:00Z",
                }
            ],
        )

        result = get_component_timeline(conn, "commit-helper", days=1, limit=5, reference_date=ref)

        assert len(result) == 5
        # 데이터 없는 날짜는 count=0, intensity=0.0
        for entry in result[1:]:
            assert entry["count"] == 0
            assert entry["intensity"] == 0.0
        conn.close()

    def test_get_component_timeline_session_mode(self):
        """days=0 세션별 반환 — ISO 8601 타임스탬프."""
        conn = _setup_test_db()

        save_usage_stats(
            conn,
            "/path",
            "s1.jsonl",
            [
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 5,
                    "used_at": "2026-02-19T10:00:00Z",
                },
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 3,
                    "used_at": "2026-02-18T09:00:00Z",
                },
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 1,
                    "used_at": "2026-02-17T08:00:00Z",
                },
            ],
        )

        result = get_component_timeline(conn, "commit-helper", days=0, limit=2)

        assert len(result) == 2
        # 최신순
        assert result[0]["date"] == "2026-02-19T10:00:00Z"
        assert result[0]["count"] == 5
        assert result[1]["date"] == "2026-02-18T09:00:00Z"
        assert result[1]["count"] == 3
        conn.close()

    def test_get_component_timeline_empty(self):
        """해당 컴포넌트 데이터 없을 때."""
        from datetime import date

        conn = _setup_test_db()
        ref = date(2026, 2, 19)

        # days=0: 빈 리스트
        result_session = get_component_timeline(conn, "nonexistent", days=0, limit=5)
        assert result_session == []

        # days=1: limit개 항목, 모두 count=0
        result_daily = get_component_timeline(conn, "nonexistent", days=1, limit=3, reference_date=ref)
        assert len(result_daily) == 3
        assert all(e["count"] == 0 for e in result_daily)
        assert all(e["intensity"] == 0.0 for e in result_daily)
        conn.close()

    def test_get_component_timeline_intensity(self):
        """intensity 정규화 — max=1.0, 나머지 비례."""
        from datetime import date

        conn = _setup_test_db()
        ref = date(2026, 2, 19)

        save_usage_stats(
            conn,
            "/path",
            "s1.jsonl",
            [
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 10,
                    "used_at": "2026-02-19T10:00:00Z",
                },
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 5,
                    "used_at": "2026-02-18T10:00:00Z",
                },
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 2,
                    "used_at": "2026-02-17T10:00:00Z",
                },
            ],
        )

        result = get_component_timeline(conn, "commit-helper", days=1, limit=3, reference_date=ref)

        assert result[0]["intensity"] == 1.0  # max=10 → 1.0
        assert result[1]["intensity"] == 0.5  # 5/10 = 0.5
        assert result[2]["intensity"] == 0.2  # 2/10 = 0.2
        conn.close()

    def test_get_component_timeline_prefers_component_id_when_present(self):
        """component_id 데이터가 있으면 name fallback 대신 ID 기준으로 집계한다."""
        from datetime import date

        conn = _setup_test_db()
        ref = date(2026, 2, 19)

        # ID 매칭 데이터
        save_usage_stats(
            conn,
            "/path/to/project",
            "s-id.jsonl",
            [
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 2,
                    "used_at": "2026-02-19T10:00:00Z",
                }
            ],
        )

        # legacy name-only 데이터 (component_id=NULL)
        conn.execute(
            "INSERT INTO usage_sessions VALUES (?, ?, ?, ?)",
            ("legacy-sess", "/path/to/project", "legacy.jsonl", "2026-02-19T00:00:00Z"),
        )
        conn.execute(
            "INSERT INTO usage_stats (id, session_id, component_name, component_type, use_count, used_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            ("legacy-stat", "legacy-sess", "commit-helper", "skill", 9, "2026-02-19T11:00:00Z"),
        )
        conn.commit()

        result = get_component_timeline(
            conn,
            component_name="commit-helper",
            component_id="c1",
            days=1,
            limit=1,
            reference_date=ref,
        )

        assert len(result) == 1
        assert result[0]["count"] == 2
        conn.close()

    def test_get_component_timeline_returns_empty_counts_when_no_component_id_data(self):
        """component_id 데이터가 없으면 name fallback 없이 0 카운트 타임라인을 반환한다."""
        from datetime import date

        conn = _setup_test_db()
        ref = date(2026, 2, 19)

        conn.execute(
            "INSERT INTO usage_sessions VALUES (?, ?, ?, ?)",
            ("legacy-sess", "/path/to/project", "legacy.jsonl", "2026-02-19T00:00:00Z"),
        )
        conn.execute(
            "INSERT INTO usage_stats (id, session_id, component_name, component_type, use_count, used_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            ("legacy-stat", "legacy-sess", "commit-helper", "skill", 7, "2026-02-19T11:00:00Z"),
        )
        conn.commit()

        result = get_component_timeline(
            conn,
            component_name="commit-helper",
            component_id="c1",
            days=1,
            limit=1,
            reference_date=ref,
        )

        assert len(result) == 1
        assert result[0]["count"] == 0
        conn.close()

    def test_get_component_timeline_strict_excludes_fallback_signal(self):
        """strict 모드에서는 fallback 품질 신호를 타임라인에서 제외한다."""
        from datetime import date

        conn = _setup_test_db()
        ref = date(2026, 2, 19)

        # strict usage (기본값)
        save_usage_stats(
            conn,
            "/path/to/project",
            "strict.jsonl",
            [
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 2,
                    "used_at": "2026-02-19T10:00:00Z",
                }
            ],
        )

        # fallback usage (동일 컴포넌트)
        conn.execute(
            "INSERT INTO usage_sessions VALUES (?, ?, ?, ?)",
            ("fallback-sess", "/path/to/project", "fallback.jsonl", "2026-02-19T00:00:00Z"),
        )
        conn.execute(
            "INSERT INTO usage_stats "
            "(id, session_id, component_name, component_type, component_id, use_count, used_at, signal_quality) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                "fallback-stat",
                "fallback-sess",
                "commit-helper",
                "skill",
                "c1",
                9,
                "2026-02-19T11:00:00Z",
                "fallback",
            ),
        )
        conn.commit()

        strict_timeline = get_component_timeline(
            conn,
            component_name="commit-helper",
            component_id="c1",
            days=1,
            limit=1,
            aggregation_mode="strict",
            reference_date=ref,
        )
        expanded_timeline = get_component_timeline(
            conn,
            component_name="commit-helper",
            component_id="c1",
            days=1,
            limit=1,
            aggregation_mode="expanded",
            reference_date=ref,
        )

        assert strict_timeline[0]["count"] == 2
        assert expanded_timeline[0]["count"] == 11
        conn.close()

    def test_get_component_timeline_excludes_missing_timestamp(self):
        """타임라인 집계는 has_timestamp=False 레코드를 제외한다."""
        from datetime import date

        conn = _setup_test_db()
        ref = date(2026, 2, 19)

        save_usage_stats(
            conn,
            "/path/to/project",
            "known-ts.jsonl",
            [
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 2,
                    "used_at": "2026-02-19T10:00:00Z",
                    "has_timestamp": True,
                }
            ],
        )
        save_usage_stats(
            conn,
            "/path/to/project",
            "missing-ts.jsonl",
            [
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 9,
                    "used_at": "2026-02-19T11:00:00Z",
                    "has_timestamp": False,
                }
            ],
        )

        timeline = get_component_timeline(
            conn,
            component_name="commit-helper",
            component_id="c1",
            days=1,
            limit=1,
            aggregation_mode="strict",
            reference_date=ref,
        )

        assert len(timeline) == 1
        assert timeline[0]["count"] == 2
        conn.close()


class TestBackfillComponentIds:
    """기존 usage_stats 레코드의 component_id 후속 매칭 테스트."""

    def test_backfill_matches_existing_records(self):
        """component_id가 NULL인 레코드를 매칭하여 채운다."""
        from vibesmith_core.usage.repo import backfill_component_ids

        conn = _setup_test_db()

        # component_id 없이 직접 삽입 (마이그레이션 시나리오)
        conn.execute(
            "INSERT INTO usage_sessions VALUES (?, ?, ?, ?)",
            ("sess1", "/path/to/project", "old.jsonl", "2026-02-19T00:00:00Z"),
        )
        conn.execute(
            "INSERT INTO usage_stats (id, session_id, component_name, component_type, use_count, used_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            ("stat1", "sess1", "commit-helper", "skill", 3, "2026-02-19T10:00:00Z"),
        )
        conn.commit()

        # 매칭 전 — NULL
        row = conn.execute("SELECT component_id FROM usage_stats WHERE id = 'stat1'").fetchone()
        assert row[0] is None

        result = backfill_component_ids(conn)

        # 매칭 후 — c1
        row = conn.execute("SELECT component_id FROM usage_stats WHERE id = 'stat1'").fetchone()
        assert row[0] == "c1"
        assert result["matched"] == 1
        assert result["unmatched"] == 0
        conn.close()

    def test_backfill_skips_already_matched(self):
        """이미 component_id가 있는 레코드는 건너뛴다."""
        from vibesmith_core.usage.repo import backfill_component_ids

        conn = _setup_test_db()

        conn.execute(
            "INSERT INTO usage_sessions VALUES (?, ?, ?, ?)",
            ("sess1", "/path/to/project", "old.jsonl", "2026-02-19T00:00:00Z"),
        )
        conn.execute(
            "INSERT INTO usage_stats "
            "(id, session_id, component_name, component_type, component_id, use_count, used_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            ("stat1", "sess1", "commit-helper", "skill", "c1", 3, "2026-02-19T10:00:00Z"),
        )
        conn.commit()

        result = backfill_component_ids(conn)
        assert result["matched"] == 0
        assert result["unmatched"] == 0
        conn.close()

    def test_backfill_matches_cross_type_skill_to_command(self):
        """파서가 'skill'로 기록한 command 컴포넌트도 backfill로 매칭된다 (#639)."""
        from vibesmith_core.usage.repo import backfill_component_ids

        conn = _setup_test_db()
        ts = "2026-02-01T00:00:00Z"
        conn.execute(
            "INSERT INTO components (id, type, name, project_id, path, created_at, updated_at, platform) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("c_cmd", "command", "ralph", "proj1", "/commands/ralph.md", ts, ts, "claude_code"),
        )

        conn.execute(
            "INSERT INTO usage_sessions VALUES (?, ?, ?, ?)",
            ("sess1", "/path/to/project", "s1.jsonl", "2026-02-19T00:00:00Z"),
        )
        # 파서가 "skill"로 기록한 ralph
        conn.execute(
            "INSERT INTO usage_stats (id, session_id, component_name, component_type, use_count, used_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            ("stat1", "sess1", "ralph", "skill", 8, "2026-02-19T10:00:00Z"),
        )
        conn.commit()

        result = backfill_component_ids(conn)

        row = conn.execute("SELECT component_id, component_type FROM usage_stats WHERE id = 'stat1'").fetchone()
        assert row[0] == "c_cmd"
        assert row[1] == "command"  # "skill" → "command"로 교정됨
        assert result["matched"] == 1
        conn.close()

    def test_backfill_counts_unmatched(self):
        """매칭 불가능한 레코드는 unmatched로 카운트된다."""
        from vibesmith_core.usage.repo import backfill_component_ids

        conn = _setup_test_db()

        conn.execute(
            "INSERT INTO usage_sessions VALUES (?, ?, ?, ?)",
            ("sess1", "/unknown/project", "old.jsonl", "2026-02-19T00:00:00Z"),
        )
        conn.execute(
            "INSERT INTO usage_stats "
            "(id, session_id, component_name, component_type, use_count, used_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            ("stat1", "sess1", "nonexistent", "skill", 1, "2026-02-19T10:00:00Z"),
        )
        conn.commit()

        result = backfill_component_ids(conn)
        assert result["matched"] == 0
        assert result["unmatched"] == 1
        conn.close()

    def test_backfill_skips_invalid_types_without_crash(self):
        """비정상 타입 레코드가 있어도 예외 없이 unmatched로 처리한다."""
        from vibesmith_core.usage.repo import backfill_component_ids

        conn = _setup_test_db()
        conn.execute(
            "INSERT INTO usage_sessions VALUES (?, ?, ?, ?)",
            ("sess1", "/path/to/project", "broken.jsonl", "2026-02-19T00:00:00Z"),
        )
        conn.execute(
            "INSERT INTO usage_stats (id, session_id, component_name, component_type, use_count, used_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            ("stat1", "sess1", "", "skill", 1, "2026-02-19T10:00:00Z"),
        )
        conn.execute(
            "INSERT INTO usage_stats (id, session_id, component_name, component_type, use_count, used_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            ("stat2", "sess1", "valid-name", "", 1, "2026-02-19T10:05:00Z"),
        )
        conn.commit()

        result = backfill_component_ids(conn)
        assert result["matched"] == 0
        assert result["unmatched"] == 2
        conn.close()

    def test_backfill_cursor_canonical_name_from_skill_path(self):
        """cursor:global의 create-skill/SKILL.md 로그도 canonical name으로 후속 매칭된다."""
        from vibesmith_core.usage.repo import backfill_component_ids

        conn = _setup_test_db_with_cursor()
        ts = "2026-02-01T00:00:00Z"
        conn.execute(
            "INSERT INTO components (id, type, name, project_id, path, created_at, updated_at, platform) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("cc3", "rule", "create-skill", "proj1", "/rules/create-skill.mdc", ts, ts, "cursor"),
        )
        conn.execute(
            "INSERT INTO usage_sessions VALUES (?, ?, ?, ?)",
            ("cursor-sess-1", "cursor:global", "composerData:abc", "2026-02-19T00:00:00Z"),
        )
        conn.execute(
            "INSERT INTO usage_stats (id, session_id, component_name, component_type, use_count, used_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            ("cursor-stat-1", "cursor-sess-1", "create-skill/SKILL.md", "rule", 1, "2026-02-19T10:00:00Z"),
        )
        conn.commit()

        result = backfill_component_ids(conn)
        row = conn.execute("SELECT component_id, component_type FROM usage_stats WHERE id = 'cursor-stat-1'").fetchone()
        assert row is not None
        assert row[0] == "cc3"
        assert row[1] == "rule"
        assert result["matched"] == 1
        conn.close()


# ---- Issue #566: platform 파라미터 지원 ----


def _setup_test_db_with_cursor():
    """Cursor 컴포넌트도 포함한 테스트 DB."""
    conn = _setup_test_db()
    ts = "2026-02-01T00:00:00Z"
    insert_sql = (
        "INSERT INTO components "
        "(id, type, name, project_id, path, created_at, updated_at, platform) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    conn.execute(insert_sql, ("cc1", "rule", "my-rule", "proj1", "/rules/my-rule", ts, ts, "cursor"))
    conn.execute(insert_sql, ("cc2", "rule", "other-rule", "proj1", "/rules/other-rule", ts, ts, "cursor"))
    conn.commit()
    return conn


class TestResolveComponentIdPlatform:
    """Issue #566: _resolve_component platform 파라미터 테스트."""

    def test_resolve_default_platform_is_claude_code(self):
        """platform 미지정 시 claude_code로 매칭 (하위 호환)."""
        from vibesmith_core.usage.repo import _resolve_component

        conn = _setup_test_db_with_cursor()
        comp_id, _ = _resolve_component(conn, "/path/to/project", "commit-helper", "skill")
        assert comp_id == "c1"
        conn.close()

    def test_resolve_cursor_platform_finds_cursor_component(self):
        """platform='cursor' 시 cursor 컴포넌트를 매칭한다."""
        from vibesmith_core.usage.repo import _resolve_component

        conn = _setup_test_db_with_cursor()
        comp_id, _ = _resolve_component(conn, "/path/to/project", "my-rule", "rule", platform="cursor")
        assert comp_id == "cc1"
        conn.close()

    def test_resolve_cursor_platform_ignores_claude_code_component(self):
        """platform='cursor'이면 claude_code 컴포넌트를 매칭하지 않는다."""
        from vibesmith_core.usage.repo import _resolve_component

        conn = _setup_test_db_with_cursor()
        comp_id, _ = _resolve_component(conn, "/path/to/project", "commit-helper", "skill", platform="cursor")
        assert comp_id is None
        conn.close()

    def test_resolve_claude_code_platform_ignores_cursor_component(self):
        """platform='claude_code'이면 cursor 컴포넌트를 매칭하지 않는다."""
        from vibesmith_core.usage.repo import _resolve_component

        conn = _setup_test_db_with_cursor()
        comp_id, _ = _resolve_component(conn, "/path/to/project", "my-rule", "rule", platform="claude_code")
        assert comp_id is None
        conn.close()

    def test_resolve_cursor_global_path_with_unique_name(self):
        """cursor:global 경로에서도 유일한 cursor 컴포넌트면 매칭한다."""
        from vibesmith_core.usage.repo import _resolve_component

        conn = _setup_test_db_with_cursor()
        comp_id, _ = _resolve_component(conn, "cursor:global", "my-rule", "rule", platform="cursor")
        assert comp_id == "cc1"
        conn.close()

    def test_resolve_cursor_global_path_ambiguous_name_returns_none(self):
        """cursor:global 경로에서 이름이 중복되면 오매칭을 피하기 위해 매칭하지 않는다."""
        from vibesmith_core.usage.repo import _resolve_component

        conn = _setup_test_db_with_cursor()
        conn.execute(
            _INSERT_PROJECT,
            ("proj2", "dup-project", "/path/to/project-2", 0, 0, "2026-02-19T00:00:00Z"),
        )
        conn.execute(
            "INSERT INTO components (id, type, name, project_id, path, created_at, updated_at, platform) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                "cc-dup",
                "rule",
                "my-rule",
                "proj2",
                "/rules/my-rule",
                "2026-02-01T00:00:00Z",
                "2026-02-01T00:00:00Z",
                "cursor",
            ),
        )
        conn.commit()

        comp_id, _ = _resolve_component(conn, "cursor:global", "my-rule", "rule", platform="cursor")
        assert comp_id is None
        conn.close()

    def test_resolve_cursor_normalized_skill_path_matches_rule_name(self):
        """create-skill/SKILL.md 형식도 canonical name(create-skill)으로 매칭한다."""
        from vibesmith_core.usage.repo import _resolve_component

        conn = _setup_test_db_with_cursor()
        ts = "2026-02-01T00:00:00Z"
        conn.execute(
            "INSERT INTO components (id, type, name, project_id, path, created_at, updated_at, platform) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("cc3", "rule", "create-skill", "proj1", "/rules/create-skill.mdc", ts, ts, "cursor"),
        )
        conn.commit()

        comp_id, actual_type = _resolve_component(
            conn,
            "cursor:global",
            "create-skill/SKILL.md",
            "rule",
            platform="cursor",
        )
        assert comp_id == "cc3"
        assert actual_type == "rule"
        conn.close()

    def test_resolve_cursor_name_platform_unique_fallback_with_type_mismatch(self):
        """type이 달라도 name+platform 유일 매칭이면 fallback으로 연결한다."""
        from vibesmith_core.usage.repo import _resolve_component

        conn = _setup_test_db_with_cursor()
        ts = "2026-02-01T00:00:00Z"
        conn.execute(
            "INSERT INTO components (id, type, name, project_id, path, created_at, updated_at, platform) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("cc4", "skill", "create-skill", "proj1", "/skills/create-skill/SKILL.md", ts, ts, "cursor"),
        )
        conn.commit()

        comp_id, actual_type = _resolve_component(
            conn,
            "cursor:global",
            "create-skill",
            "rule",
            platform="cursor",
        )
        assert comp_id == "cc4"
        assert actual_type == "skill"
        conn.close()


class TestSaveUsageStatsPlatform:
    """Issue #566: save_usage_stats platform 파라미터 테스트."""

    def test_save_with_cursor_platform_matches_cursor_component(self):
        """platform='cursor' 시 cursor 컴포넌트에 component_id를 매칭한다."""
        conn = _setup_test_db_with_cursor()

        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="cursor-session-1",
            stats=[
                {
                    "component_name": "my-rule",
                    "component_type": "rule",
                    "use_count": 1,
                    "used_at": "2026-02-19T10:00:00Z",
                }
            ],
            platform="cursor",
        )

        row = conn.execute("SELECT component_id FROM usage_stats WHERE component_name = 'my-rule'").fetchone()
        assert row[0] == "cc1"
        conn.close()

    def test_save_default_platform_backward_compat(self):
        """platform 미지정 시 기존처럼 claude_code로 동작."""
        conn = _setup_test_db_with_cursor()

        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="s1.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 1,
                    "used_at": "2026-02-19T10:00:00Z",
                }
            ],
        )

        row = conn.execute("SELECT component_id FROM usage_stats WHERE component_name = 'commit-helper'").fetchone()
        assert row[0] == "c1"
        conn.close()


class TestUsageRankingPlatformFilter:
    """Issue #566: platform 필터로 랭킹 조회."""

    def test_ranking_filter_cursor_only(self):
        """platform='cursor' 필터 시 cursor 세션의 통계만 반환."""
        conn = _setup_test_db_with_cursor()

        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="cc-s1.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 3,
                    "used_at": "2026-02-19T10:00:00Z",
                }
            ],
        )
        save_usage_stats(
            conn,
            project_path="cursor:global",
            session_file="composerData:abc",
            stats=[
                {
                    "component_name": "my-rule",
                    "component_type": "rule",
                    "use_count": 1,
                    "used_at": "2026-02-19T11:00:00Z",
                }
            ],
            platform="cursor",
        )

        ranking = get_usage_ranking(conn, platform="cursor")
        names = {r["component_name"] for r in ranking}
        assert "my-rule" in names
        assert "commit-helper" not in names
        conn.close()

    def test_ranking_filter_claude_code_only(self):
        """platform='claude_code' 필터 시 Claude Code 세션의 통계만 반환."""
        conn = _setup_test_db_with_cursor()

        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="cc-s1.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 3,
                    "used_at": "2026-02-19T10:00:00Z",
                }
            ],
        )
        save_usage_stats(
            conn,
            project_path="cursor:global",
            session_file="composerData:abc",
            stats=[
                {
                    "component_name": "my-rule",
                    "component_type": "rule",
                    "use_count": 1,
                    "used_at": "2026-02-19T11:00:00Z",
                }
            ],
            platform="cursor",
        )

        ranking = get_usage_ranking(conn, platform="claude_code")
        names = {r["component_name"] for r in ranking}
        assert "commit-helper" in names
        assert "my-rule" not in names
        conn.close()

    def test_ranking_no_platform_filter_returns_all(self):
        """platform 미지정 시 전체 반환 (하위 호환)."""
        conn = _setup_test_db_with_cursor()

        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="cc-s1.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 3,
                    "used_at": "2026-02-19T10:00:00Z",
                }
            ],
        )
        save_usage_stats(
            conn,
            project_path="cursor:global",
            session_file="composerData:abc",
            stats=[
                {
                    "component_name": "my-rule",
                    "component_type": "rule",
                    "use_count": 1,
                    "used_at": "2026-02-19T11:00:00Z",
                }
            ],
            platform="cursor",
        )

        ranking = get_usage_ranking(conn)
        names = {r["component_name"] for r in ranking}
        assert "commit-helper" in names
        assert "my-rule" in names
        conn.close()


# ---- Issue #627: 시스템 내장 컴포넌트 필터링 ----


class TestUsageRankingMatchedOnly:
    """Issue #627: matched_only=True 시 component_id IS NOT NULL만 반환."""

    def test_matched_only_excludes_null_component_id(self):
        """component_id가 NULL인 시스템 내장 컴포넌트는 제외된다."""
        conn = _setup_test_db()

        # 매칭된 컴포넌트 (component_id = c1)
        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="s1.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 5,
                    "used_at": "2026-02-19T10:00:00Z",
                }
            ],
        )
        # 매칭 안 되는 시스템 내장 (component_id = NULL)
        conn.execute(
            "INSERT INTO usage_sessions VALUES (?, ?, ?, ?)",
            ("sys-sess", "/path/to/project", "s2.jsonl", "2026-02-19T00:00:00Z"),
        )
        conn.execute(
            "INSERT INTO usage_stats "
            "(id, session_id, component_name, component_type, use_count, used_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            ("sys-stat1", "sys-sess", "SessionStart", "hook", 34, "2026-02-19T10:00:00Z"),
        )
        conn.execute(
            "INSERT INTO usage_stats "
            "(id, session_id, component_name, component_type, use_count, used_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            ("sys-stat2", "sys-sess", "Explore", "agent", 10, "2026-02-19T10:00:00Z"),
        )
        conn.commit()

        ranking = get_usage_ranking(conn, matched_only=True)
        names = {r["component_name"] for r in ranking}
        assert "commit-helper" in names
        assert "SessionStart" not in names
        assert "Explore" not in names
        conn.close()

    def test_matched_only_false_returns_all(self):
        """matched_only=False(기본값)이면 NULL 포함 전체 반환 — 하위 호환."""
        conn = _setup_test_db()

        save_usage_stats(
            conn,
            project_path="/path/to/project",
            session_file="s1.jsonl",
            stats=[
                {
                    "component_name": "commit-helper",
                    "component_type": "skill",
                    "use_count": 5,
                    "used_at": "2026-02-19T10:00:00Z",
                }
            ],
        )
        conn.execute(
            "INSERT INTO usage_sessions VALUES (?, ?, ?, ?)",
            ("sys-sess", "/path/to/project", "s2.jsonl", "2026-02-19T00:00:00Z"),
        )
        conn.execute(
            "INSERT INTO usage_stats "
            "(id, session_id, component_name, component_type, use_count, used_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            ("sys-stat1", "sys-sess", "SessionStart", "hook", 34, "2026-02-19T10:00:00Z"),
        )
        conn.commit()

        ranking = get_usage_ranking(conn, matched_only=False)
        names = {r["component_name"] for r in ranking}
        assert "commit-helper" in names
        assert "SessionStart" in names
        conn.close()

    def test_backfill_then_matched_only_recovers_late_registered(self):
        """backfill로 매칭 복구된 컴포넌트는 matched_only에서도 반환된다."""
        from vibesmith_core.usage.repo import backfill_component_ids

        conn = _setup_test_db()

        # component_id 없이 직접 삽입 (스캔 타이밍 이슈 시뮬레이션)
        conn.execute(
            "INSERT INTO usage_sessions VALUES (?, ?, ?, ?)",
            ("sess1", "/path/to/project", "s1.jsonl", "2026-02-19T00:00:00Z"),
        )
        conn.execute(
            "INSERT INTO usage_stats "
            "(id, session_id, component_name, component_type, use_count, used_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            ("stat1", "sess1", "commit-helper", "skill", 3, "2026-02-19T10:00:00Z"),
        )
        # 시스템 내장도 같이 삽입
        conn.execute(
            "INSERT INTO usage_stats "
            "(id, session_id, component_name, component_type, use_count, used_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            ("stat2", "sess1", "SessionStart", "hook", 10, "2026-02-19T10:00:00Z"),
        )
        conn.commit()

        # backfill 전: 둘 다 NULL
        ranking_before = get_usage_ranking(conn, matched_only=True)
        assert len(ranking_before) == 0

        # backfill 실행 → commit-helper는 c1으로 매칭됨
        backfill_component_ids(conn)

        # backfill 후: commit-helper만 반환, SessionStart는 여전히 제외
        ranking_after = get_usage_ranking(conn, matched_only=True)
        names = {r["component_name"] for r in ranking_after}
        assert "commit-helper" in names
        assert "SessionStart" not in names
        conn.close()

    def test_matched_only_includes_cursor_global_when_unique_component_exists(self):
        """cursor:global 세션도 cursor 컴포넌트에 매칭되면 matched_only 결과에 포함된다."""
        conn = _setup_test_db_with_cursor()

        save_usage_stats(
            conn,
            project_path="cursor:global",
            session_file="composerData:cursor-1",
            stats=[
                {
                    "component_name": "my-rule",
                    "component_type": "rule",
                    "use_count": 4,
                    "used_at": "2026-02-19T12:00:00Z",
                }
            ],
            platform="cursor",
        )

        ranking = get_usage_ranking(conn, matched_only=True)
        names = {r["component_name"] for r in ranking}
        assert "my-rule" in names
        conn.close()
