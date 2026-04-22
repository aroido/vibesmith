"""UsageScanner 테스트 — 주기적 JSONL 파싱 + 수동 트리거."""

import json
import os
import sqlite3
from pathlib import Path

from vibesmith_core.usage.scanner import UsageScanner

_INSERT_PROJECT = (
    "INSERT INTO projects (id, name, path, is_global, component_count, last_scanned_at) VALUES (?, ?, ?, ?, ?, ?)"
)


def _make_test_db():
    """테스트용 인메모리 DB."""
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
    conn.commit()
    return conn


def _write_jsonl(path: Path, events: list[dict]) -> None:
    with open(path, "w") as f:
        for event in events:
            f.write(json.dumps(event) + "\n")


def _assistant_skill(skill_name: str) -> dict:
    """실제 Claude Code 형식의 Skill 사용 이벤트."""
    return {
        "type": "assistant",
        "message": {
            "role": "assistant",
            "content": [
                {"type": "tool_use", "name": "Skill", "input": {"skill": skill_name}},
            ],
        },
    }


def _setup_claude_session_dir(tmp_path: Path, project_path: str) -> Path:
    """Claude Code 세션 디렉토리를 모방하여 생성한다."""
    # /Users/foo/bar → -Users-foo-bar
    encoded = project_path.replace("/", "-")
    session_dir = tmp_path / "claude_projects" / encoded
    session_dir.mkdir(parents=True)
    return session_dir


class TestUsageScannerScanOnce:
    """scan_once() — 등록된 프로젝트의 JSONL 파일을 1회 스캔."""

    def test_scan_parses_new_sessions(self, tmp_path: Path):
        """새 세션 파일을 파싱하여 DB에 저장."""
        conn = _make_test_db()
        project_path = str(tmp_path / "my-project")

        # 프로젝트 등록
        conn.execute(
            _INSERT_PROJECT,
            ("p1", "my-project", project_path, 0, 0, "2026-02-19"),
        )
        conn.commit()

        # Claude 세션 디렉토리에 JSONL 작성
        claude_base = tmp_path / "claude_home"
        session_dir = _setup_claude_session_dir(
            claude_base,
            project_path,
        )
        _write_jsonl(
            session_dir / "session1.jsonl",
            [
                _assistant_skill("commit-helper"),
                _assistant_skill("commit-helper"),
            ],
        )

        scanner = UsageScanner(conn, claude_base_dir=str(claude_base / "claude_projects"))
        result = scanner.scan_once()

        assert result["sessions_parsed"] >= 1
        assert result["stats_saved"] >= 1

        # DB에 저장되었는지 확인
        stats = conn.execute("SELECT * FROM usage_stats").fetchall()
        assert len(stats) >= 1

    def test_scan_incremental_skips_parsed(self, tmp_path: Path):
        """이미 파싱된 세션은 건너뛴다."""
        conn = _make_test_db()
        project_path = str(tmp_path / "my-project")
        conn.execute(
            _INSERT_PROJECT,
            ("p1", "my-project", project_path, 0, 0, "2026-02-19"),
        )
        conn.commit()

        claude_base = tmp_path / "claude_home"
        session_dir = _setup_claude_session_dir(claude_base, project_path)
        _write_jsonl(
            session_dir / "session1.jsonl",
            [_assistant_skill("a")],
        )

        scanner = UsageScanner(conn, claude_base_dir=str(claude_base / "claude_projects"))

        # 1회 스캔
        r1 = scanner.scan_once()
        assert r1["sessions_parsed"] == 1

        # 2회 스캔 — 동일 파일, 새 내용 없음
        r2 = scanner.scan_once()
        assert r2["sessions_parsed"] == 0

    def test_scan_no_projects(self, tmp_path: Path):
        """프로젝트가 없으면 0건."""
        conn = _make_test_db()
        scanner = UsageScanner(conn, claude_base_dir=str(tmp_path))
        result = scanner.scan_once()
        assert result["sessions_parsed"] == 0
        assert result["stats_saved"] == 0

    def test_scan_skips_when_another_scan_is_running(self, tmp_path: Path):
        """동시에 scan_once가 호출되면 중복 스캔을 건너뛴다."""
        conn = _make_test_db()
        scanner = UsageScanner(conn, claude_base_dir=str(tmp_path))

        assert scanner._scan_lock.acquire(blocking=False)  # 내부 스캔 실행 중 상태 시뮬레이션
        try:
            result = scanner.scan_once()
        finally:
            scanner._scan_lock.release()

        assert result == {"sessions_parsed": 0, "stats_saved": 0}

    def test_scan_nonexistent_session_dir(self, tmp_path: Path):
        """세션 디렉토리가 없으면 건너뛴다."""
        conn = _make_test_db()
        conn.execute(
            _INSERT_PROJECT,
            ("p1", "proj", "/nonexistent/path", 0, 0, "2026-02-19"),
        )
        conn.commit()

        scanner = UsageScanner(conn, claude_base_dir=str(tmp_path))
        result = scanner.scan_once()
        assert result["sessions_parsed"] == 0

    def test_scan_supports_underscore_normalized_session_dir(self, tmp_path: Path):
        """Issue #586: '_'도 '-'로 치환된 실제 Claude 경로를 인식한다."""
        conn = _make_test_db()
        project_path = str(tmp_path / "my_project")
        conn.execute(
            _INSERT_PROJECT,
            ("p1", "my_project", project_path, 0, 0, "2026-02-21"),
        )
        conn.commit()

        claude_base = tmp_path / "claude_home"
        encoded = project_path.replace("/", "-").replace("_", "-")
        session_dir = claude_base / "claude_projects" / encoded
        session_dir.mkdir(parents=True)
        _write_jsonl(session_dir / "session1.jsonl", [_assistant_skill("my-skill")])

        scanner = UsageScanner(conn, claude_base_dir=str(claude_base / "claude_projects"))
        result = scanner.scan_once()

        assert result["sessions_parsed"] == 1
        assert result["stats_saved"] >= 1

    def test_scan_supports_legacy_slash_only_session_dir(self, tmp_path: Path):
        """'/'만 '-' 치환한 레거시 경로도 계속 인식한다."""
        conn = _make_test_db()
        project_path = str(tmp_path / "my_project")
        conn.execute(
            _INSERT_PROJECT,
            ("p1", "my_project", project_path, 0, 0, "2026-02-21"),
        )
        conn.commit()

        claude_base = tmp_path / "claude_home"
        legacy_encoded = project_path.replace("/", "-")
        session_dir = claude_base / "claude_projects" / legacy_encoded
        session_dir.mkdir(parents=True)
        _write_jsonl(session_dir / "session1.jsonl", [_assistant_skill("my-skill")])

        scanner = UsageScanner(conn, claude_base_dir=str(claude_base / "claude_projects"))
        result = scanner.scan_once()

        assert result["sessions_parsed"] == 1
        assert result["stats_saved"] >= 1


class TestUsageScannerRegistry:
    """scan_once()에서 ScanProgressRegistry 연동을 검증한다."""

    def test_scan_once_calls_registry_start_and_finish(self, tmp_path: Path):
        """registry가 주입되면 start_scan과 finish_scan이 호출된다."""
        conn = _make_test_db()
        conn.execute(
            _INSERT_PROJECT,
            ("p1", "my-project", str(tmp_path / "proj"), 0, 0, "2026-02-19"),
        )
        conn.commit()

        from unittest.mock import MagicMock

        from vibesmith_core.infra.scan_progress import ScanProgressRegistry

        registry = MagicMock(spec=ScanProgressRegistry)
        scanner = UsageScanner(conn, claude_base_dir=str(tmp_path), registry=registry)
        scanner.scan_once()

        registry.start_scan.assert_called_once()
        registry.finish_scan.assert_called_once()

    def test_scan_once_calls_mark_per_project(self, tmp_path: Path):
        """각 프로젝트에 대해 mark_scanning과 mark_done이 호출된다."""
        conn = _make_test_db()
        for i in range(2):
            conn.execute(
                _INSERT_PROJECT,
                (f"p{i}", f"proj-{i}", str(tmp_path / f"proj-{i}"), 0, 0, "2026-02-19"),
            )
        conn.commit()

        from unittest.mock import MagicMock

        from vibesmith_core.infra.scan_progress import ScanProgressRegistry

        registry = MagicMock(spec=ScanProgressRegistry)
        scanner = UsageScanner(conn, claude_base_dir=str(tmp_path), registry=registry)
        scanner.scan_once()

        # mark_scanning이 프로젝트 수만큼 호출됨
        assert registry.mark_scanning.call_count == 2
        assert registry.mark_done.call_count == 2

    def test_scan_once_without_registry_works(self, tmp_path: Path):
        """registry=None이면 기존 동작 그대로."""
        conn = _make_test_db()
        scanner = UsageScanner(conn, claude_base_dir=str(tmp_path))
        result = scanner.scan_once()
        assert "sessions_parsed" in result


class TestUsageScannerLifecycle:
    """start/stop — 주기적 스캔 스레드."""

    def test_start_and_stop(self, tmp_path: Path):
        """시작 후 중지가 정상 동작."""
        conn = _make_test_db()
        scanner = UsageScanner(conn, claude_base_dir=str(tmp_path), interval_seconds=60)

        scanner.start()
        assert scanner.is_running

        scanner.stop()
        assert not scanner.is_running

    def test_stop_without_start(self, tmp_path: Path):
        """시작 안 했는데 stop 호출해도 에러 없음."""
        conn = _make_test_db()
        scanner = UsageScanner(conn, claude_base_dir=str(tmp_path))
        scanner.stop()  # 에러 없이 무시

    def test_double_start_ignored(self, tmp_path: Path):
        """이미 실행 중이면 start 무시."""
        conn = _make_test_db()
        scanner = UsageScanner(conn, claude_base_dir=str(tmp_path), interval_seconds=60)

        scanner.start()
        scanner.start()  # 두 번째 호출은 무시
        assert scanner.is_running

        scanner.stop()


class TestUsageScannerReset:
    """reset() — 파일 존재 여부를 확인하여 선별적 초기화."""

    def test_reset_preserves_data_for_deleted_files(self, tmp_path: Path):
        """삭제된 세션 파일의 데이터는 보존한다."""
        conn = _make_test_db()
        project_path = str(tmp_path / "my-project")
        conn.execute(
            _INSERT_PROJECT,
            ("p1", "my-project", project_path, 0, 0, "2026-02-19"),
        )
        conn.commit()

        # 세션 파일 생성 → 스캔
        claude_base = tmp_path / "claude_home"
        session_dir = _setup_claude_session_dir(claude_base, project_path)
        session_file = session_dir / "session1.jsonl"
        _write_jsonl(session_file, [_assistant_skill("my-skill")])

        scanner = UsageScanner(conn, claude_base_dir=str(claude_base / "claude_projects"))
        scanner.scan_once()

        # 파일 삭제 (Claude의 30일 자동 삭제 시뮬레이션)
        session_file.unlink()

        # 리셋 → 삭제된 파일의 데이터는 보존되어야 함
        result = scanner.reset()

        # 데이터가 여전히 존재
        stats = conn.execute("SELECT * FROM usage_stats").fetchall()
        assert len(stats) >= 1

        sessions = conn.execute("SELECT * FROM usage_sessions").fetchall()
        assert len(sessions) == 1

        # 삭제된 건 0
        assert result["deleted_sessions"] == 0
        assert result["preserved_sessions"] == 1

    def test_reset_clears_data_for_existing_files(self, tmp_path: Path):
        """존재하는 세션 파일의 데이터는 초기화한다."""
        conn = _make_test_db()
        project_path = str(tmp_path / "my-project")
        conn.execute(
            _INSERT_PROJECT,
            ("p1", "my-project", project_path, 0, 0, "2026-02-19"),
        )
        conn.commit()

        claude_base = tmp_path / "claude_home"
        session_dir = _setup_claude_session_dir(claude_base, project_path)
        _write_jsonl(session_dir / "session1.jsonl", [_assistant_skill("my-skill")])

        scanner = UsageScanner(conn, claude_base_dir=str(claude_base / "claude_projects"))
        scanner.scan_once()

        # 파일이 존재하는 상태에서 리셋
        result = scanner.reset()

        # 데이터가 삭제됨
        stats = conn.execute("SELECT * FROM usage_stats").fetchall()
        assert len(stats) == 0

        sessions = conn.execute("SELECT * FROM usage_sessions").fetchall()
        assert len(sessions) == 0

        parse_states = conn.execute("SELECT * FROM usage_parse_state").fetchall()
        assert len(parse_states) == 0

        assert result["deleted_sessions"] == 1
        assert result["preserved_sessions"] == 0

    def test_reset_mixed_existing_and_deleted(self, tmp_path: Path):
        """존재하는 파일은 초기화, 삭제된 파일은 보존."""
        conn = _make_test_db()
        project_path = str(tmp_path / "my-project")
        conn.execute(
            _INSERT_PROJECT,
            ("p1", "my-project", project_path, 0, 0, "2026-02-19"),
        )
        conn.commit()

        claude_base = tmp_path / "claude_home"
        session_dir = _setup_claude_session_dir(claude_base, project_path)

        # 파일 2개 생성
        _write_jsonl(session_dir / "existing.jsonl", [_assistant_skill("skill-a")])
        _write_jsonl(session_dir / "will-delete.jsonl", [_assistant_skill("skill-b")])

        scanner = UsageScanner(conn, claude_base_dir=str(claude_base / "claude_projects"))
        scanner.scan_once()

        # 하나만 삭제
        (session_dir / "will-delete.jsonl").unlink()

        result = scanner.reset()

        # existing.jsonl 데이터만 삭제됨
        assert result["deleted_sessions"] == 1
        assert result["preserved_sessions"] == 1

        # will-delete.jsonl의 데이터는 남아있음
        sessions = conn.execute("SELECT session_file FROM usage_sessions").fetchall()
        assert len(sessions) == 1
        assert sessions[0][0] == "will-delete.jsonl"

        # parse_state도 마찬가지
        ps = conn.execute("SELECT session_file FROM usage_parse_state").fetchall()
        assert len(ps) == 1
        assert ps[0][0] == "will-delete.jsonl"

    def test_reset_empty_db(self, tmp_path: Path):
        """빈 DB에서 리셋해도 에러 없음."""
        conn = _make_test_db()
        scanner = UsageScanner(conn, claude_base_dir=str(tmp_path))
        result = scanner.reset()

        assert result["deleted_sessions"] == 0
        assert result["preserved_sessions"] == 0


# ---- Issue #630: Cursor reset 지원 ----


class TestUsageScannerCursorReset:
    """Issue #630: reset()이 Cursor 세션 데이터도 올바르게 처리하는지 검증."""

    def test_reset_clears_cursor_data_when_db_exists(self, tmp_path: Path):
        """cursor_base_dir 주입 + state.vscdb 존재 시 cursor:global 데이터 삭제."""
        conn = _make_test_db()

        # Cursor DB 생성
        cursor_base = tmp_path / "cursor_home"
        cursor_storage = cursor_base / "Cursor" / "User" / "globalStorage"
        cursor_storage.mkdir(parents=True)

        import sqlite3 as _sqlite3

        c = _sqlite3.connect(str(cursor_storage / "state.vscdb"))
        c.execute("CREATE TABLE cursorDiskKV (key TEXT PRIMARY KEY, value TEXT)")
        c.execute(
            "INSERT INTO cursorDiskKV VALUES (?, ?)",
            (
                "composerData:sess1",
                json.dumps(
                    {
                        "createdAt": 1708300000000,
                        "context": {"cursorRules": [{"name": "rule.mdc", "path": "/p/.cursor/rules/rule.mdc"}]},
                    }
                ),
            ),
        )
        c.commit()
        c.close()

        # 스캔으로 cursor:global 세션 생성
        scanner = UsageScanner(
            conn,
            claude_base_dir=str(tmp_path / "nonexistent"),
            cursor_base_dir=str(cursor_base),
        )
        scan_result = scanner.scan_once()
        assert scan_result["sessions_parsed"] >= 1

        # cursor:global 세션이 DB에 존재하는지 확인
        sessions_before = conn.execute("SELECT * FROM usage_sessions WHERE project_path = 'cursor:global'").fetchall()
        assert len(sessions_before) >= 1

        # reset — DB 파일이 존재하므로 삭제 대상
        result = scanner.reset()
        assert result["deleted_sessions"] >= 1

        # cursor:global 세션이 삭제되었는지 확인
        sessions_after = conn.execute("SELECT * FROM usage_sessions WHERE project_path = 'cursor:global'").fetchall()
        assert len(sessions_after) == 0

    def test_reset_preserves_cursor_data_when_db_missing(self, tmp_path: Path):
        """cursor_base_dir=None 시 cursor:global 데이터 보존."""
        import uuid

        conn = _make_test_db()

        # cursor:global 세션을 수동으로 DB에 삽입 (파일 없이)
        session_id = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO usage_sessions (id, project_path, session_file, parsed_at) VALUES (?, ?, ?, ?)",
            (session_id, "cursor:global", "state.vscdb", "2026-02-21T00:00:00"),
        )
        conn.execute(
            "INSERT INTO usage_parse_state (project_path, session_file, byte_offset, updated_at) VALUES (?, ?, ?, ?)",
            ("cursor:global", "state.vscdb", 100, "2026-02-21T00:00:00"),
        )
        conn.commit()

        # cursor_base_dir=None → CursorUsageAdapter 비활성
        scanner = UsageScanner(conn, claude_base_dir=str(tmp_path / "nonexistent"))
        result = scanner.reset()

        # cursor:global 데이터가 보존되었는지 확인
        assert result["preserved_sessions"] >= 1
        sessions = conn.execute("SELECT * FROM usage_sessions WHERE project_path = 'cursor:global'").fetchall()
        assert len(sessions) == 1


# ---- Issue #566: Cursor 스캔 지원 ----


def _create_mock_cursor_db(db_path: str, entries: dict[str, str | bytes]) -> None:
    """테스트용 Cursor state.vscdb 생성."""
    import sqlite3 as _sqlite3

    c = _sqlite3.connect(db_path)
    c.execute("CREATE TABLE IF NOT EXISTS cursorDiskKV (key TEXT PRIMARY KEY, value BLOB)")
    for key, value in entries.items():
        c.execute("INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)", (key, value))
    c.commit()
    c.close()


def _composer_entry(rules: list[dict], created_at: int = 1708300000000) -> str:
    return json.dumps(
        {
            "createdAt": created_at,
            "context": {"cursorRules": rules},
        }
    )


def _agentkv_blob_entry(payload: dict) -> str:
    return json.dumps(payload, ensure_ascii=False).encode("utf-8").hex()


def _agentkv_blob_json_entry(payload: dict) -> bytes:
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


class TestUsageScannerCursor:
    """Issue #566: Cursor DB 스캔 지원."""

    def test_scan_once_parses_cursor_db(self, tmp_path: Path):
        """scan_once()가 Cursor state.vscdb도 파싱한다."""
        conn = _make_test_db()
        project_path = str(tmp_path / "my-project")
        conn.execute(
            _INSERT_PROJECT,
            ("p1", "my-project", project_path, 0, 0, "2026-02-19"),
        )
        conn.commit()

        # Cursor DB 생성
        cursor_base = tmp_path / "cursor_home"
        cursor_storage = cursor_base / "Cursor" / "User" / "globalStorage"
        cursor_storage.mkdir(parents=True)
        _create_mock_cursor_db(
            str(cursor_storage / "state.vscdb"),
            {
                "composerData:sess1": _composer_entry(
                    [{"name": "my-rule.mdc", "path": "/project/.cursor/rules/my-rule.mdc"}]
                ),
            },
        )

        scanner = UsageScanner(
            conn,
            claude_base_dir=str(tmp_path / "nonexistent"),
            cursor_base_dir=str(cursor_base),
        )
        result = scanner.scan_once()

        assert result["stats_saved"] >= 1

        # DB에 cursor 세션이 저장되었는지 확인
        sessions = conn.execute("SELECT * FROM usage_sessions").fetchall()
        assert len(sessions) >= 1

    def test_scan_once_parses_cursor_filename_fallback(self, tmp_path: Path):
        """cursorRules.name이 없어도 filename으로 통계를 저장한다."""
        conn = _make_test_db()
        project_path = str(tmp_path / "my-project")
        conn.execute(
            _INSERT_PROJECT,
            ("p1", "my-project", project_path, 0, 0, "2026-02-19"),
        )
        conn.execute(
            "INSERT INTO components (id, type, name, project_id, path, created_at, updated_at, platform) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                "cursor-rule-1",
                "rule",
                "my-rule",
                "p1",
                "/rules/my-rule.mdc",
                "2026-02-19T00:00:00Z",
                "2026-02-19T00:00:00Z",
                "cursor",
            ),
        )
        conn.commit()

        cursor_base = tmp_path / "cursor_home"
        cursor_storage = cursor_base / "Cursor" / "User" / "globalStorage"
        cursor_storage.mkdir(parents=True)
        _create_mock_cursor_db(
            str(cursor_storage / "state.vscdb"),
            {
                "composerData:sess1": _composer_entry([{"filename": "/project/.cursor/rules/my-rule.mdc"}]),
            },
        )

        scanner = UsageScanner(
            conn,
            claude_base_dir=str(tmp_path / "nonexistent"),
            cursor_base_dir=str(cursor_base),
        )
        result = scanner.scan_once()

        assert result["stats_saved"] >= 1
        row = conn.execute(
            "SELECT component_name, component_id FROM usage_stats ORDER BY used_at DESC LIMIT 1"
        ).fetchone()
        assert row is not None
        assert row[0] == "my-rule"
        assert row[1] == "cursor-rule-1"

    def test_scan_once_normalizes_skill_md_path_and_matches_component(self, tmp_path: Path):
        """create-skill/SKILL.md 형식을 create-skill로 정규화하고 component_id를 매칭한다."""
        conn = _make_test_db()
        project_path = str(tmp_path / "my-project")
        conn.execute(
            _INSERT_PROJECT,
            ("p1", "my-project", project_path, 0, 0, "2026-02-19"),
        )
        conn.execute(
            "INSERT INTO components (id, type, name, project_id, path, created_at, updated_at, platform) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                "cursor-rule-2",
                "rule",
                "create-skill",
                "p1",
                "/rules/create-skill.mdc",
                "2026-02-19T00:00:00Z",
                "2026-02-19T00:00:00Z",
                "cursor",
            ),
        )
        conn.commit()

        cursor_base = tmp_path / "cursor_home"
        cursor_storage = cursor_base / "Cursor" / "User" / "globalStorage"
        cursor_storage.mkdir(parents=True)
        _create_mock_cursor_db(
            str(cursor_storage / "state.vscdb"),
            {
                "composerData:sess1": _composer_entry([{"filename": "create-skill/SKILL.md"}]),
            },
        )

        scanner = UsageScanner(
            conn,
            claude_base_dir=str(tmp_path / "nonexistent"),
            cursor_base_dir=str(cursor_base),
        )
        result = scanner.scan_once()

        assert result["stats_saved"] >= 1
        row = conn.execute(
            "SELECT component_name, component_type, component_id FROM usage_stats ORDER BY used_at DESC LIMIT 1"
        ).fetchone()
        assert row is not None
        assert row[0] == "create-skill"
        # 저장 시 실제 매칭 컴포넌트 type(rule)로 보정되어야 함
        assert row[1] == "rule"
        assert row[2] == "cursor-rule-2"

    def test_scan_once_parses_agentkv_tool_call_component_usage(self, tmp_path: Path):
        """agentKv:blob tool-call의 컴포넌트 파일 접근을 usage로 저장한다."""
        conn = _make_test_db()
        project_path = str(tmp_path / "my-project")
        conn.execute(
            _INSERT_PROJECT,
            ("p1", "my-project", project_path, 0, 0, "2026-02-19"),
        )
        conn.execute(
            "INSERT INTO components (id, type, name, project_id, path, created_at, updated_at, platform) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                "cursor-command-1",
                "command",
                "work-session",
                "p1",
                "/commands/work-session.md",
                "2026-02-19T00:00:00Z",
                "2026-02-19T00:00:00Z",
                "cursor",
            ),
        )
        conn.commit()

        cursor_base = tmp_path / "cursor_home"
        cursor_storage = cursor_base / "Cursor" / "User" / "globalStorage"
        cursor_storage.mkdir(parents=True)
        _create_mock_cursor_db(
            str(cursor_storage / "state.vscdb"),
            {
                "agentKv:blob:a": _agentkv_blob_entry(
                    {
                        "id": "1",
                        "role": "assistant",
                        "content": [
                            {
                                "type": "tool-call",
                                "toolName": "Read",
                                "args": {"path": "/repo/.cursor/commands/work-session.md"},
                            }
                        ],
                    }
                ),
            },
        )

        scanner = UsageScanner(
            conn,
            claude_base_dir=str(tmp_path / "nonexistent"),
            cursor_base_dir=str(cursor_base),
        )
        result = scanner.scan_once()

        assert result["stats_saved"] >= 1
        row = conn.execute(
            "SELECT us.component_name, us.component_type, us.component_id "
            "FROM usage_stats us JOIN usage_sessions sess ON us.session_id = sess.id "
            "WHERE sess.project_path = 'cursor:global' AND sess.session_file LIKE 'agentKv:blob:%' "
            "ORDER BY us.used_at DESC LIMIT 1"
        ).fetchone()
        assert row is not None
        assert row[0] == "work-session"
        assert row[1] == "command"
        assert row[2] == "cursor-command-1"

    def test_scan_once_parses_agentkv_utf8_blob_tool_call_component_usage(self, tmp_path: Path):
        """agentKv:blob UTF-8 JSON BLOB payload에서도 컴포넌트 사용량을 저장한다."""
        conn = _make_test_db()
        project_path = str(tmp_path / "my-project")
        conn.execute(
            _INSERT_PROJECT,
            ("p1", "my-project", project_path, 0, 0, "2026-02-19"),
        )
        conn.execute(
            "INSERT INTO components (id, type, name, project_id, path, created_at, updated_at, platform) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                "cursor-command-blob-1",
                "command",
                "work-session",
                "p1",
                "/commands/work-session.md",
                "2026-02-19T00:00:00Z",
                "2026-02-19T00:00:00Z",
                "cursor",
            ),
        )
        conn.commit()

        cursor_base = tmp_path / "cursor_home"
        cursor_storage = cursor_base / "Cursor" / "User" / "globalStorage"
        cursor_storage.mkdir(parents=True)
        _create_mock_cursor_db(
            str(cursor_storage / "state.vscdb"),
            {
                "agentKv:blob:a": _agentkv_blob_json_entry(
                    {
                        "id": "1",
                        "role": "assistant",
                        "content": [
                            {
                                "type": "tool-call",
                                "toolName": "Read",
                                "args": {"path": "/repo/.cursor/commands/work-session.md"},
                            }
                        ],
                    }
                ),
            },
        )

        scanner = UsageScanner(
            conn,
            claude_base_dir=str(tmp_path / "nonexistent"),
            cursor_base_dir=str(cursor_base),
        )
        result = scanner.scan_once()

        assert result["stats_saved"] >= 1
        row = conn.execute(
            "SELECT us.component_name, us.component_type, us.component_id "
            "FROM usage_stats us JOIN usage_sessions sess ON us.session_id = sess.id "
            "WHERE sess.project_path = 'cursor:global' AND sess.session_file LIKE 'agentKv:blob:%' "
            "ORDER BY us.used_at DESC LIMIT 1"
        ).fetchone()
        assert row is not None
        assert row[0] == "work-session"
        assert row[1] == "command"
        assert row[2] == "cursor-command-blob-1"

    def test_scan_cursor_keeps_agentkv_rowid_when_payload_unreadable(self, tmp_path: Path):
        """unreadable BLOB만 존재하면 agentKv rowid parse_state를 전진시키지 않는다."""
        conn = _make_test_db()

        cursor_base = tmp_path / "cursor_home"
        cursor_storage = cursor_base / "Cursor" / "User" / "globalStorage"
        cursor_storage.mkdir(parents=True)
        _create_mock_cursor_db(
            str(cursor_storage / "state.vscdb"),
            {
                "agentKv:blob:a": b"\x00\x81\x82\xff",
            },
        )

        scanner = UsageScanner(
            conn,
            claude_base_dir=str(tmp_path / "nonexistent"),
            cursor_base_dir=str(cursor_base),
        )
        result = scanner.scan_once()

        assert result["sessions_parsed"] == 0
        assert result["stats_saved"] == 0

        row = conn.execute(
            "SELECT byte_offset FROM usage_parse_state "
            "WHERE project_path = 'cursor:global' AND session_file = 'agentKv:blob:rowid:v2'"
        ).fetchone()
        assert row is not None
        assert row[0] == 0

    def test_scan_cursor_incremental_by_mtime(self, tmp_path: Path):
        """Cursor DB mtime이 변경되지 않으면 재파싱하지 않는다."""
        conn = _make_test_db()

        cursor_base = tmp_path / "cursor_home"
        cursor_storage = cursor_base / "Cursor" / "User" / "globalStorage"
        cursor_storage.mkdir(parents=True)
        _create_mock_cursor_db(
            str(cursor_storage / "state.vscdb"),
            {
                "composerData:sess1": _composer_entry([{"name": "rule.mdc", "path": "/p/.cursor/rules/rule.mdc"}]),
            },
        )

        scanner = UsageScanner(
            conn,
            claude_base_dir=str(tmp_path / "nonexistent"),
            cursor_base_dir=str(cursor_base),
        )

        # 1회 스캔
        r1 = scanner.scan_once()
        assert r1["stats_saved"] >= 1

        # 2회 스캔 — mtime 미변경이면 건너뜀
        r2 = scanner.scan_once()
        assert r2["stats_saved"] == 0

    def test_scan_cursor_agentkv_incremental_even_when_db_mtime_unchanged(self, tmp_path: Path):
        """DB mtime이 동일해도 agentKv rowid 증분은 주기 스캔에서 반영한다."""
        conn = _make_test_db()
        project_path = str(tmp_path / "my-project")
        conn.execute(
            _INSERT_PROJECT,
            ("p1", "my-project", project_path, 0, 0, "2026-02-19"),
        )
        conn.execute(
            "INSERT INTO components (id, type, name, project_id, path, created_at, updated_at, platform) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                "cursor-command-2",
                "command",
                "work-session",
                "p1",
                "/commands/work-session.md",
                "2026-02-19T00:00:00Z",
                "2026-02-19T00:00:00Z",
                "cursor",
            ),
        )
        conn.commit()

        cursor_base = tmp_path / "cursor_home"
        cursor_storage = cursor_base / "Cursor" / "User" / "globalStorage"
        cursor_storage.mkdir(parents=True)
        db_path = cursor_storage / "state.vscdb"
        _create_mock_cursor_db(
            str(db_path),
            {
                "composerData:sess1": _composer_entry([{"name": "rule.mdc", "path": "/p/.cursor/rules/rule.mdc"}]),
            },
        )

        scanner = UsageScanner(
            conn,
            claude_base_dir=str(tmp_path / "nonexistent"),
            cursor_base_dir=str(cursor_base),
        )

        r1 = scanner.scan_once()
        assert r1["stats_saved"] >= 1

        stable_mtime = int(os.path.getmtime(db_path))
        c = sqlite3.connect(str(db_path))
        c.execute(
            "INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)",
            (
                "agentKv:blob:b",
                _agentkv_blob_entry(
                    {
                        "id": "2",
                        "role": "assistant",
                        "content": [
                            {
                                "type": "tool-call",
                                "toolName": "Read",
                                "args": {"path": "/repo/.cursor/commands/work-session.md"},
                            }
                        ],
                    }
                ),
            ),
        )
        c.commit()
        c.close()

        # composer mtime 게이트를 유지한 상태에서 agentKv 증분만 반영되는지 검증
        st = os.stat(db_path)
        os.utime(db_path, (st.st_atime, stable_mtime))

        r2 = scanner.scan_once()
        assert r2["stats_saved"] >= 1

        row = conn.execute(
            "SELECT us.component_name, us.component_type "
            "FROM usage_stats us JOIN usage_sessions sess ON us.session_id = sess.id "
            "WHERE sess.project_path = 'cursor:global' AND sess.session_file = 'agentKv:blob:b' "
            "ORDER BY us.used_at DESC LIMIT 1"
        ).fetchone()
        assert row == ("work-session", "command")

    def test_cursor_change_mtime_includes_wal_and_shm(self, tmp_path: Path):
        """Cursor change mtime은 state.vscdb-wal/-shm도 포함해 계산한다."""
        conn = _make_test_db()
        scanner = UsageScanner(conn, claude_base_dir=str(tmp_path))

        db_path = tmp_path / "state.vscdb"
        wal_path = tmp_path / "state.vscdb-wal"
        shm_path = tmp_path / "state.vscdb-shm"
        db_path.write_text("db")
        wal_path.write_text("wal")
        shm_path.write_text("shm")

        os.utime(db_path, (1_700_000_000, 1_700_000_000))
        os.utime(shm_path, (1_700_000_020, 1_700_000_020))
        os.utime(wal_path, (1_700_000_040, 1_700_000_040))

        assert scanner._get_cursor_change_mtime(str(db_path)) == 1_700_000_040

    def test_scan_cursor_reparse_replaces_existing_session_stats(self, tmp_path: Path):
        """Cursor 재파싱 시 동일 session의 기존 stats를 덮어쓴다."""
        conn = _make_test_db()

        cursor_base = tmp_path / "cursor_home"
        cursor_storage = cursor_base / "Cursor" / "User" / "globalStorage"
        cursor_storage.mkdir(parents=True)
        db_path = cursor_storage / "state.vscdb"
        _create_mock_cursor_db(
            str(db_path),
            {
                "composerData:sess1": _composer_entry([{"name": "rule-a.mdc", "path": "/p/.cursor/rules/rule-a.mdc"}]),
            },
        )

        scanner = UsageScanner(
            conn,
            claude_base_dir=str(tmp_path / "nonexistent"),
            cursor_base_dir=str(cursor_base),
        )

        r1 = scanner.scan_once()
        assert r1["stats_saved"] >= 1

        # 동일 session 데이터를 변경하고 mtime을 증가시켜 재스캔 유도
        c = sqlite3.connect(str(db_path))
        c.execute(
            "UPDATE cursorDiskKV SET value = ? WHERE key = ?",
            (
                _composer_entry(
                    [
                        {"name": "rule-a.mdc", "path": "/p/.cursor/rules/rule-a.mdc"},
                        {"name": "rule-b.mdc", "path": "/p/.cursor/rules/rule-b.mdc"},
                    ]
                ),
                "composerData:sess1",
            ),
        )
        c.commit()
        c.close()
        st = os.stat(db_path)
        os.utime(db_path, (st.st_atime, st.st_mtime + 2))

        r2 = scanner.scan_once()
        assert r2["stats_saved"] >= 2

        rows = conn.execute(
            "SELECT component_name FROM usage_stats us "
            "JOIN usage_sessions sess ON us.session_id = sess.id "
            "WHERE sess.project_path = 'cursor:global' AND sess.session_file = 'composerData:sess1' "
            "ORDER BY component_name"
        ).fetchall()
        assert [r[0] for r in rows] == ["rule-a", "rule-b"]

    def test_scan_cursor_ignores_legacy_parse_state_key(self, tmp_path: Path):
        """레거시 parse_state(state.vscdb)가 있어도 v2 키 기준으로 1회 재파싱한다."""
        conn = _make_test_db()

        cursor_base = tmp_path / "cursor_home"
        cursor_storage = cursor_base / "Cursor" / "User" / "globalStorage"
        cursor_storage.mkdir(parents=True)
        db_path = cursor_storage / "state.vscdb"
        _create_mock_cursor_db(
            str(db_path),
            {
                "composerData:sess1": _composer_entry([{"name": "rule.mdc", "path": "/p/.cursor/rules/rule.mdc"}]),
            },
        )

        # 구버전 키(state.vscdb)에 최신 mtime이 저장돼 있어도, v2 키는 없으므로 재파싱되어야 한다.
        current_mtime = int(os.path.getmtime(db_path))
        conn.execute(
            "INSERT INTO usage_parse_state (project_path, session_file, byte_offset, updated_at) VALUES (?, ?, ?, ?)",
            ("cursor:global", "state.vscdb", current_mtime + 9999, "2026-02-26T00:00:00Z"),
        )
        conn.commit()

        scanner = UsageScanner(
            conn,
            claude_base_dir=str(tmp_path / "nonexistent"),
            cursor_base_dir=str(cursor_base),
        )

        result = scanner.scan_once()
        assert result["sessions_parsed"] == 1
        assert result["stats_saved"] >= 1

    def test_cursor_scan_failure_does_not_break_claude_scan(self, tmp_path: Path):
        """Cursor 스캔 실패 시 Claude Code 스캔은 정상 진행."""
        conn = _make_test_db()
        project_path = str(tmp_path / "my-project")
        conn.execute(
            _INSERT_PROJECT,
            ("p1", "my-project", project_path, 0, 0, "2026-02-19"),
        )
        conn.commit()

        # Claude Code 세션 준비
        claude_base = tmp_path / "claude_home"
        session_dir = _setup_claude_session_dir(claude_base, project_path)
        _write_jsonl(session_dir / "session1.jsonl", [_assistant_skill("my-skill")])

        # Cursor DB는 손상된 파일
        cursor_base = tmp_path / "cursor_home"
        cursor_storage = cursor_base / "Cursor" / "User" / "globalStorage"
        cursor_storage.mkdir(parents=True)
        (cursor_storage / "state.vscdb").write_bytes(b"corrupt")

        scanner = UsageScanner(
            conn,
            claude_base_dir=str(claude_base / "claude_projects"),
            cursor_base_dir=str(cursor_base),
        )
        result = scanner.scan_once()

        # Claude Code 스캔은 성공해야 함
        assert result["sessions_parsed"] >= 1

    def test_scan_once_without_cursor_base_dir(self, tmp_path: Path):
        """cursor_base_dir 미지정 시 Cursor 스캔은 건너뛴다."""
        conn = _make_test_db()
        scanner = UsageScanner(conn, claude_base_dir=str(tmp_path))
        result = scanner.scan_once()

        assert result["sessions_parsed"] == 0
        assert result["stats_saved"] == 0


class TestWaitForIdle:
    """wait_for_idle() — 스캔 완료를 대기한다."""

    def test_wait_for_idle_returns_immediately_when_not_scanning(self, tmp_path: Path):
        """스캔 중이 아니면 즉시 반환한다."""
        conn = _make_test_db()
        scanner = UsageScanner(conn, claude_base_dir=str(tmp_path))
        # scan_lock이 free인 상태 — 즉시 반환
        result = scanner.wait_for_idle(timeout=1.0)
        assert result is True

    def test_wait_for_idle_blocks_during_scan(self, tmp_path: Path):
        """스캔 중이면 완료될 때까지 대기한다."""
        import threading
        import time

        conn = _make_test_db()
        scanner = UsageScanner(conn, claude_base_dir=str(tmp_path))

        # 수동으로 scan_lock 획득하여 스캔 중 시뮬레이션
        scanner._scan_lock.acquire()

        result_holder = [None]

        def wait_thread():
            result_holder[0] = scanner.wait_for_idle(timeout=2.0)

        t = threading.Thread(target=wait_thread)
        t.start()

        # 0.1초 후 lock 해제
        time.sleep(0.1)
        scanner._scan_lock.release()

        t.join(timeout=3.0)
        assert result_holder[0] is True

    def test_wait_for_idle_timeout(self, tmp_path: Path):
        """타임아웃 시 False를 반환한다."""
        conn = _make_test_db()
        scanner = UsageScanner(conn, claude_base_dir=str(tmp_path))

        # scan_lock 잠금 유지
        scanner._scan_lock.acquire()
        try:
            result = scanner.wait_for_idle(timeout=0.1)
            assert result is False
        finally:
            scanner._scan_lock.release()
