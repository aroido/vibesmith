"""db.py 테스트 — SQLite 스키마 및 DatabaseManager 검증."""

import sqlite3
import threading
from pathlib import Path

import pytest

from vibesmith_core.infra.db import DatabaseManager

_INSERT_PROJECT = (
    "INSERT INTO projects (id, name, path, is_global, component_count, last_scanned_at) VALUES (?, ?, ?, ?, ?, ?)"
)
_INSERT_COMPONENT = (
    "INSERT INTO components (id, type, name, project_id, path, created_at, updated_at, platform)"
    " VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
)


@pytest.fixture
def db_path(tmp_path):
    return str(tmp_path / "test.db")


@pytest.fixture
def db(db_path):
    manager = DatabaseManager(db_path)
    manager.initialize_schema()
    yield manager
    manager.close()


class TestDatabaseManagerInit:
    def test_expanduser_tilde_path(self, tmp_path):
        """~ 로 시작하는 경로는 실제 홈 디렉토리로 expand된다. Issue #339"""
        import os

        # HOME을 tmp_path로 설정하여 ~가 제어 가능한 경로로 expand되게 함
        orig_home = os.environ.get("HOME")
        os.environ["HOME"] = str(tmp_path)
        try:
            orig_cwd = os.getcwd()
            try:
                other_dir = tmp_path / "other"
                other_dir.mkdir()
                os.chdir(other_dir)

                manager = DatabaseManager("~/.vibesmith/vibesmith.db")
                manager.initialize_schema()
                manager.close()

                expanded_db = tmp_path / ".vibesmith" / "vibesmith.db"
                literal_in_cwd = other_dir / "~" / ".vibesmith" / "vibesmith.db"
                assert expanded_db.exists(), "DB가 홈(~)으로 expand된 경로에 생성되어야 함"
                assert not literal_in_cwd.exists(), "DB가 cwd/~/ 아래에 생성되면 안 됨"
            finally:
                os.chdir(orig_cwd)
        finally:
            if orig_home is not None:
                os.environ["HOME"] = orig_home
            else:
                os.environ.pop("HOME", None)

    def test_creates_db_file(self, db_path):
        manager = DatabaseManager(db_path)
        manager.initialize_schema()
        assert Path(db_path).exists()
        manager.close()

    def test_creates_parent_directory(self, tmp_path):
        nested_path = str(tmp_path / "sub" / "dir" / "test.db")
        manager = DatabaseManager(nested_path)
        manager.initialize_schema()
        assert Path(nested_path).exists()
        manager.close()

    def test_get_connection_returns_connection(self, db):
        conn = db.get_connection()
        assert isinstance(conn, sqlite3.Connection)

    def test_get_connection_returns_thread_local_connections(self, db_path):
        """동일 매니저라도 스레드별로 독립 커넥션을 반환한다."""
        manager = DatabaseManager(db_path)
        manager.initialize_schema()

        main_conn = manager.get_connection()
        worker_conns: list[sqlite3.Connection] = []

        def _worker() -> None:
            conn = manager.get_connection()
            worker_conns.append(conn)
            conn.execute("SELECT 1").fetchone()

        thread = threading.Thread(target=_worker)
        thread.start()
        thread.join()

        assert worker_conns, "worker connection not captured"
        assert worker_conns[0] is not main_conn
        manager.close()


class TestSchema:
    def test_projects_table_exists(self, db):
        conn = db.get_connection()
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'")
        assert cursor.fetchone() is not None

    def test_components_table_exists(self, db):
        conn = db.get_connection()
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='components'")
        assert cursor.fetchone() is not None

    def test_tags_table_exists(self, db):
        conn = db.get_connection()
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='tags'")
        assert cursor.fetchone() is not None

    def test_dependencies_table_exists(self, db):
        conn = db.get_connection()
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='dependencies'")
        assert cursor.fetchone() is not None

    def test_versions_table_exists(self, db):
        conn = db.get_connection()
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='versions'")
        assert cursor.fetchone() is not None

    def test_activities_table_exists(self, db):
        """Issue #216: activities 테이블이 존재한다."""
        conn = db.get_connection()
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='activities'")
        assert cursor.fetchone() is not None

    def test_foreign_keys_enabled(self, db):
        conn = db.get_connection()
        cursor = conn.execute("PRAGMA foreign_keys")
        assert cursor.fetchone()[0] == 1


class TestNoAdapterType:
    """새 DB에서 projects 테이블에 adapter_type 컬럼이 없다."""

    def test_new_db_has_no_adapter_type_column(self, db):
        """새 DB의 projects 테이블에 adapter_type 컬럼이 없다."""
        conn = db.get_connection()
        cursor = conn.execute("PRAGMA table_info(projects)")
        columns = {row[1] for row in cursor.fetchall()}
        assert "adapter_type" not in columns

    def test_platform_column_has_no_default(self, db):
        """새 DB의 components.platform 컬럼에 DEFAULT가 없다."""
        conn = db.get_connection()
        cursor = conn.execute("PRAGMA table_info(components)")
        for row in cursor.fetchall():
            if row[1] == "platform":
                # row[4]는 default value
                assert row[4] is None, f"platform has DEFAULT: {row[4]}"
                return
        pytest.fail("platform column not found")


class TestProjectsCRUD:
    def test_insert_project(self, db):
        conn = db.get_connection()
        conn.execute(
            _INSERT_PROJECT,
            ("proj-1", "my-project", "/path/to/project", 0, 0, "2026-02-10T00:00:00"),
        )
        conn.commit()
        cursor = conn.execute("SELECT * FROM projects WHERE id = ?", ("proj-1",))
        assert cursor.fetchone() is not None

    def test_unique_path_constraint(self, db):
        conn = db.get_connection()
        conn.execute(
            _INSERT_PROJECT,
            ("proj-1", "project-1", "/same/path", 0, 0, "2026-02-10T00:00:00"),
        )
        conn.commit()
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(
                _INSERT_PROJECT,
                ("proj-2", "project-2", "/same/path", 0, 0, "2026-02-10T00:00:00"),
            )


class TestComponentsCRUD:
    def _insert_project(self, db):
        conn = db.get_connection()
        conn.execute(_INSERT_PROJECT, ("proj-1", "test", "/path", 0, 0, "2026-02-10"))
        conn.commit()

    def test_insert_component(self, db):
        self._insert_project(db)
        conn = db.get_connection()
        conn.execute(
            _INSERT_COMPONENT,
            ("comp-1", "skill", "test-skill", "proj-1", "/path/skill", "2026-02-10", "2026-02-10", "claude_code"),
        )
        conn.commit()
        cursor = conn.execute("SELECT * FROM components WHERE id = ?", ("comp-1",))
        assert cursor.fetchone() is not None

    def test_unique_project_name_type_constraint(self, db):
        self._insert_project(db)
        conn = db.get_connection()
        conn.execute(
            _INSERT_COMPONENT,
            ("comp-1", "skill", "same-name", "proj-1", "/path/1", "2026-02-10", "2026-02-10", "claude_code"),
        )
        conn.commit()
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(
                _INSERT_COMPONENT,
                ("comp-2", "skill", "same-name", "proj-1", "/path/2", "2026-02-10", "2026-02-10", "claude_code"),
            )

    def test_cascade_delete_on_project(self, db):
        self._insert_project(db)
        conn = db.get_connection()
        conn.execute(
            _INSERT_COMPONENT,
            ("comp-1", "skill", "test-skill", "proj-1", "/path/skill", "2026-02-10", "2026-02-10", "claude_code"),
        )
        conn.commit()
        conn.execute("DELETE FROM projects WHERE id = ?", ("proj-1",))
        conn.commit()
        cursor = conn.execute("SELECT * FROM components WHERE id = ?", ("comp-1",))
        assert cursor.fetchone() is None


class TestTagsCRUD:
    def _setup(self, db):
        conn = db.get_connection()
        conn.execute(_INSERT_PROJECT, ("proj-1", "test", "/path", 0, 0, "2026-02-10"))
        conn.execute(
            _INSERT_COMPONENT,
            ("comp-1", "skill", "test", "proj-1", "/path", "2026-02-10", "2026-02-10", "claude_code"),
        )
        conn.commit()

    def test_insert_tag(self, db):
        self._setup(db)
        conn = db.get_connection()
        conn.execute("INSERT INTO tags (component_id, tag) VALUES (?, ?)", ("comp-1", "python"))
        conn.commit()
        cursor = conn.execute("SELECT tag FROM tags WHERE component_id = ?", ("comp-1",))
        assert cursor.fetchone()[0] == "python"

    def test_cascade_delete_tags(self, db):
        self._setup(db)
        conn = db.get_connection()
        conn.execute("INSERT INTO tags (component_id, tag) VALUES (?, ?)", ("comp-1", "python"))
        conn.commit()
        conn.execute("DELETE FROM components WHERE id = ?", ("comp-1",))
        conn.commit()
        cursor = conn.execute("SELECT * FROM tags WHERE component_id = ?", ("comp-1",))
        assert cursor.fetchone() is None


class TestPlatformColumn:
    """components 테이블의 platform 컬럼 검증."""

    def test_components_table_has_platform_column(self, db):
        """새 DB의 components 테이블에 platform 컬럼이 존재한다."""
        conn = db.get_connection()
        cursor = conn.execute("PRAGMA table_info(components)")
        columns = {row[1] for row in cursor.fetchall()}
        assert "platform" in columns

    def test_platform_stored_correctly(self, db):
        """platform 값이 DB에 올바르게 저장된다."""
        conn = db.get_connection()
        conn.execute(_INSERT_PROJECT, ("proj-1", "test", "/path", 0, 0, "2026-02-10T00:00:00"))
        conn.execute(
            _INSERT_COMPONENT,
            ("comp-1", "skill", "test-skill", "proj-1", "/path/skill", "2026-02-10", "2026-02-10", "claude_code"),
        )
        conn.commit()
        cursor = conn.execute("SELECT platform FROM components WHERE id = ?", ("comp-1",))
        assert cursor.fetchone()[0] == "claude_code"

    def test_unique_constraint_includes_platform(self, db):
        """같은 (project_id, name, type)이어도 platform이 다르면 중복 허용."""
        conn = db.get_connection()
        conn.execute(_INSERT_PROJECT, ("proj-1", "test", "/path", 0, 0, "2026-02-10T00:00:00"))
        conn.execute(
            "INSERT INTO components (id, type, name, project_id, path, created_at, updated_at, platform)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("comp-1", "rule", "api-style", "proj-1", "/p1", "2026-02-10", "2026-02-10", "claude_code"),
        )
        conn.execute(
            "INSERT INTO components (id, type, name, project_id, path, created_at, updated_at, platform)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("comp-2", "rule", "api-style", "proj-1", "/p2", "2026-02-10", "2026-02-10", "cursor"),
        )
        conn.commit()
        cursor = conn.execute("SELECT count(*) FROM components WHERE project_id = 'proj-1'")
        assert cursor.fetchone()[0] == 2

    def test_unique_constraint_same_platform_fails(self, db):
        """같은 (project_id, name, type, platform)은 중복 불가."""
        conn = db.get_connection()
        conn.execute(_INSERT_PROJECT, ("proj-1", "test", "/path", 0, 0, "2026-02-10T00:00:00"))
        conn.execute(
            "INSERT INTO components (id, type, name, project_id, path, created_at, updated_at, platform)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("comp-1", "rule", "api-style", "proj-1", "/p1", "2026-02-10", "2026-02-10", "claude_code"),
        )
        conn.commit()
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(
                "INSERT INTO components (id, type, name, project_id, path, created_at, updated_at, platform)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                ("comp-2", "rule", "api-style", "proj-1", "/p2", "2026-02-10", "2026-02-10", "claude_code"),
            )


class TestInitializeIdempotent:
    def test_double_initialize(self, db_path):
        manager = DatabaseManager(db_path)
        manager.initialize_schema()
        manager.initialize_schema()
        conn = manager.get_connection()
        cursor = conn.execute("SELECT count(*) FROM sqlite_master WHERE type='table'")
        assert cursor.fetchone()[0] >= 5
        manager.close()


class TestProjectsHiddenAtMigration:
    """projects 테이블에 hidden_at 컬럼과 인덱스가 존재한다."""

    def test_hidden_at_column_exists_after_initialize(self, db):
        """새 DB에 hidden_at 컬럼이 존재한다."""
        conn = db.get_connection()
        cursor = conn.execute("PRAGMA table_info(projects)")
        columns = {row[1] for row in cursor.fetchall()}
        assert "hidden_at" in columns

    def test_idx_projects_hidden_at_exists(self, db):
        """idx_projects_hidden_at 인덱스가 존재한다."""
        conn = db.get_connection()
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_projects_hidden_at'")
        assert cursor.fetchone() is not None

    def test_migration_adds_hidden_at_to_existing_db(self, tmp_path):
        """hidden_at 컬럼이 없는 기존 DB에서 initialize_schema() 호출 시 컬럼이 추가된다."""
        db_path = str(tmp_path / "legacy.db")
        conn = sqlite3.connect(db_path)
        # hidden_at 없는 구 스키마로 projects 테이블 생성
        conn.execute(
            "CREATE TABLE projects ("
            "id TEXT PRIMARY KEY, name TEXT NOT NULL, path TEXT NOT NULL UNIQUE,"
            "is_global INTEGER NOT NULL DEFAULT 0, component_count INTEGER NOT NULL DEFAULT 0,"
            "last_scanned_at TEXT NOT NULL)"
        )
        conn.execute(
            "INSERT INTO projects (id, name, path, is_global, component_count, last_scanned_at)"
            " VALUES ('p1', 'test', '/tmp/test', 0, 0, '2026-01-01')"
        )
        conn.commit()
        conn.close()

        # DatabaseManager로 마이그레이션 실행
        manager = DatabaseManager(db_path)
        manager.initialize_schema()
        migrated_conn = manager.get_connection()
        cursor = migrated_conn.execute("PRAGMA table_info(projects)")
        columns = {row[1] for row in cursor.fetchall()}
        assert "hidden_at" in columns

        # 기존 데이터 보존 확인
        row = migrated_conn.execute("SELECT id, hidden_at FROM projects WHERE id = 'p1'").fetchone()
        assert row is not None
        assert row[1] is None  # 기존 프로젝트는 hidden_at = NULL
        manager.close()


class TestClearRescannableData:
    """clear_rescannable_data() — factory-reset용 DB 초기화."""

    def test_clears_projects_and_components(self, db):
        """프로젝트와 컴포넌트가 삭제된다."""
        conn = db.get_connection()
        conn.execute(_INSERT_PROJECT, ("p1", "proj", "/tmp/p", 0, 0, "2026-01-01"))
        conn.execute(
            _INSERT_COMPONENT,
            ("c1", "skill", "test-skill", "p1", "/tmp/p/skill.md", "2026-01-01", "2026-01-01", "claude_code"),
        )
        conn.commit()

        result = db.clear_rescannable_data()

        assert conn.execute("SELECT COUNT(*) FROM projects").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM components").fetchone()[0] == 0
        assert result["tables_cleared"] >= 2

    def test_clears_usage_data(self, db):
        """usage_sessions, usage_parse_state가 삭제된다."""
        conn = db.get_connection()
        conn.execute(
            "INSERT INTO usage_parse_state (project_path, session_file, byte_offset, updated_at) VALUES (?, ?, ?, ?)",
            ("/tmp/p", "test.jsonl", 100, "2026-01-01"),
        )
        conn.commit()

        db.clear_rescannable_data()

        assert conn.execute("SELECT COUNT(*) FROM usage_parse_state").fetchone()[0] == 0

    def test_preserves_presets(self, db):
        """프리셋/컬렉션은 보존된다."""
        conn = db.get_connection()
        conn.execute(
            "INSERT INTO presets (id, name, component_type, platform, description, scope, created_at, updated_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("preset1", "my-preset", "skill", "claude_code", "test", "user", "2026-01-01", "2026-01-01"),
        )
        conn.commit()

        db.clear_rescannable_data()

        assert conn.execute("SELECT COUNT(*) FROM presets").fetchone()[0] == 1
