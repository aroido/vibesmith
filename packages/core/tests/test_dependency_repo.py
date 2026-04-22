"""dependency_repo.py 테스트 — DB 저장 로직."""

import sqlite3

from vibesmith_core.components.models import Dependency, DependencyType
from vibesmith_core.dependencies.repo import (
    delete_dependencies_for_sources,
    get_all_dependencies,
    save_dependencies_for_sources,
)


def _setup_test_db():
    """테스트용 인메모리 DB 생성."""
    conn = sqlite3.connect(":memory:")
    conn.execute("PRAGMA foreign_keys = ON")

    # 테이블 생성
    conn.execute("""
        CREATE TABLE IF NOT EXISTS components (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            name TEXT NOT NULL,
            project_id TEXT NOT NULL,
            path TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            platform TEXT NOT NULL
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS dependencies (
            source_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
            target_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
            dep_type TEXT NOT NULL,
            PRIMARY KEY (source_id, target_id, dep_type)
        )
    """)

    # 테스트 컴포넌트 삽입
    conn.execute(
        "INSERT INTO components VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ("c1", "skill", "base", "proj1", "/path/base", "2026-01-01", "2026-01-01", "claude_code"),
    )
    conn.execute(
        "INSERT INTO components VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ("c2", "skill", "child", "proj1", "/path/child", "2026-01-01", "2026-01-01", "claude_code"),
    )
    conn.execute(
        "INSERT INTO components VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ("c3", "skill", "other", "proj1", "/path/other", "2026-01-01", "2026-01-01", "claude_code"),
    )

    conn.commit()
    return conn


class TestSaveDependencies:
    """save_dependencies_for_sources 테스트."""

    def test_insert_new_dependencies(self):
        """새로운 종속성 삽입."""
        conn = _setup_test_db()

        deps = [
            Dependency(source_id="c2", target_id="c1", dep_type=DependencyType.CONTEXT),
        ]

        save_dependencies_for_sources(conn, ["c2"], deps)

        # 확인
        rows = conn.execute("SELECT * FROM dependencies").fetchall()
        assert len(rows) == 1
        assert rows[0] == ("c2", "c1", "context")

        conn.close()

    def test_delete_old_dependencies_for_source(self):
        """기존 종속성 삭제 후 새로운 것 삽입."""
        conn = _setup_test_db()

        # 기존 종속성 삽입
        conn.execute(
            "INSERT INTO dependencies VALUES (?, ?, ?)",
            ("c2", "c1", "context"),
        )
        conn.commit()

        # 새로운 종속성 (다른 타겟)
        deps = [
            Dependency(source_id="c2", target_id="c3", dep_type=DependencyType.BODY_REFERENCE),
        ]

        save_dependencies_for_sources(conn, ["c2"], deps)

        # 확인: 기존 c2→c1 삭제, 새로운 c2→c3 삽입
        rows = conn.execute("SELECT * FROM dependencies ORDER BY target_id").fetchall()
        assert len(rows) == 1
        assert rows[0] == ("c2", "c3", "body_reference")

        conn.close()

    def test_multiple_sources(self):
        """여러 소스의 종속성 동시 저장."""
        conn = _setup_test_db()

        deps = [
            Dependency(source_id="c2", target_id="c1", dep_type=DependencyType.CONTEXT),
            Dependency(source_id="c3", target_id="c1", dep_type=DependencyType.BODY_REFERENCE),
        ]

        save_dependencies_for_sources(conn, ["c2", "c3"], deps)

        # 확인
        rows = conn.execute("SELECT * FROM dependencies ORDER BY source_id").fetchall()
        assert len(rows) == 2
        assert rows[0] == ("c2", "c1", "context")
        assert rows[1] == ("c3", "c1", "body_reference")

        conn.close()

    def test_empty_dependencies(self):
        """종속성이 없을 때 (기존 것만 삭제)."""
        conn = _setup_test_db()

        # 기존 종속성 삽입
        conn.execute(
            "INSERT INTO dependencies VALUES (?, ?, ?)",
            ("c2", "c1", "context"),
        )
        conn.commit()

        # 빈 종속성 저장
        save_dependencies_for_sources(conn, ["c2"], [])

        # 확인: 모두 삭제됨
        rows = conn.execute("SELECT * FROM dependencies").fetchall()
        assert len(rows) == 0

        conn.close()


class TestDeleteDependencies:
    """delete_dependencies_for_sources 테스트."""

    def test_delete_specific_sources(self):
        """특정 소스의 종속성만 삭제."""
        conn = _setup_test_db()

        # 종속성 삽입
        conn.execute("INSERT INTO dependencies VALUES (?, ?, ?)", ("c2", "c1", "context"))
        conn.execute("INSERT INTO dependencies VALUES (?, ?, ?)", ("c3", "c1", "body_reference"))
        conn.commit()

        # c2만 삭제
        delete_dependencies_for_sources(conn, ["c2"])

        # 확인: c3→c1만 남음
        rows = conn.execute("SELECT * FROM dependencies").fetchall()
        assert len(rows) == 1
        assert rows[0] == ("c3", "c1", "body_reference")

        conn.close()

    def test_delete_empty_list(self):
        """빈 리스트 전달 시 아무것도 삭제하지 않음."""
        conn = _setup_test_db()

        conn.execute("INSERT INTO dependencies VALUES (?, ?, ?)", ("c2", "c1", "CONTEXT"))
        conn.commit()

        delete_dependencies_for_sources(conn, [])

        # 확인: 그대로 유지
        rows = conn.execute("SELECT * FROM dependencies").fetchall()
        assert len(rows) == 1

        conn.close()


class TestGetAllDependencies:
    """get_all_dependencies 테스트."""

    def test_get_all(self):
        """모든 종속성 조회."""
        conn = _setup_test_db()

        conn.execute("INSERT INTO dependencies VALUES (?, ?, ?)", ("c2", "c1", "context"))
        conn.execute("INSERT INTO dependencies VALUES (?, ?, ?)", ("c3", "c1", "body_reference"))
        conn.commit()

        deps = get_all_dependencies(conn)

        assert len(deps) == 2
        assert deps[0].source_id == "c2"
        assert deps[0].target_id == "c1"
        assert deps[0].dep_type == DependencyType.CONTEXT

        assert deps[1].source_id == "c3"
        assert deps[1].target_id == "c1"
        assert deps[1].dep_type == DependencyType.BODY_REFERENCE

        conn.close()

    def test_get_empty(self):
        """종속성이 없을 때."""
        conn = _setup_test_db()

        deps = get_all_dependencies(conn)

        assert len(deps) == 0

        conn.close()

    def test_get_all_skips_unknown_dep_type(self):
        """알 수 없는 dep_type은 조용히 스킵."""
        conn = _setup_test_db()
        conn.execute(
            "INSERT INTO dependencies VALUES (?, ?, ?)",
            ("c2", "c1", "unknown_future_type"),
        )
        conn.execute(
            "INSERT INTO dependencies VALUES (?, ?, ?)",
            ("c3", "c1", "context"),
        )
        conn.commit()

        deps = get_all_dependencies(conn)
        # unknown_future_type 행은 스킵, context 행만 반환
        assert len(deps) == 1
        assert deps[0].dep_type == DependencyType.CONTEXT
        conn.close()
