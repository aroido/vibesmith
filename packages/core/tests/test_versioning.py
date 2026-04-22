"""versioning.py 테스트 — 버전 관리 검증."""

import pytest

from vibesmith_core.components.versioning import VersionManager
from vibesmith_core.infra.db import DatabaseManager

_INSERT_PROJECT = (
    "INSERT INTO projects (id, name, path, is_global, component_count, last_scanned_at) VALUES (?, ?, ?, ?, ?, ?)"
)
_INSERT_COMPONENT = (
    "INSERT INTO components (id, type, name, project_id, path, created_at, updated_at, platform)"
    " VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
)


@pytest.fixture
def db(tmp_path):
    manager = DatabaseManager(str(tmp_path / "test.db"))
    manager.initialize_schema()
    yield manager
    manager.close()


@pytest.fixture
def vm(db):
    return VersionManager(db)


@pytest.fixture
def setup_component(db):
    conn = db.get_connection()
    conn.execute(_INSERT_PROJECT, ("proj-1", "test", "/path", 0, 0, "2026-02-10"))
    conn.execute(
        _INSERT_COMPONENT,
        ("comp-1", "skill", "test-skill", "proj-1", "/path/skill", "2026-02-10", "2026-02-10", "claude_code"),
    )
    conn.commit()


class TestSaveVersion:
    def test_save_first_version(self, vm, setup_component):
        version_num = vm.save_version("comp-1", "# Version 1 content")
        assert version_num == 1

    def test_save_increments_version(self, vm, setup_component):
        vm.save_version("comp-1", "# V1")
        vm.save_version("comp-1", "# V2")
        version_num = vm.save_version("comp-1", "# V3")
        assert version_num == 3


class TestListVersions:
    def test_list_empty(self, vm, setup_component):
        versions = vm.list_versions("comp-1")
        assert versions == []

    def test_list_after_saves(self, vm, setup_component):
        vm.save_version("comp-1", "# V1")
        vm.save_version("comp-1", "# V2")
        versions = vm.list_versions("comp-1")
        assert len(versions) == 2
        assert versions[0].version == 1
        assert versions[1].version == 2

    def test_list_preserves_content(self, vm, setup_component):
        vm.save_version("comp-1", "# Original content")
        versions = vm.list_versions("comp-1")
        assert versions[0].content == "# Original content"


class TestGetVersionContent:
    def test_get_specific_version(self, vm, setup_component):
        vm.save_version("comp-1", "# V1")
        vm.save_version("comp-1", "# V2")
        content = vm.get_version_content("comp-1", 1)
        assert content == "# V1"

    def test_get_nonexistent_version(self, vm, setup_component):
        with pytest.raises(ValueError):
            vm.get_version_content("comp-1", 99)


class TestRollback:
    def test_rollback_updates_component_content(self, vm, db, setup_component):
        vm.save_version("comp-1", "# V1 original")
        # 컴포넌트 content를 업데이트 (실제 수정 시뮬레이션)
        conn = db.get_connection()
        conn.execute("UPDATE components SET content = ? WHERE id = ?", ("# V2 modified", "comp-1"))
        conn.commit()
        # 롤백
        vm.rollback("comp-1", 1)
        cursor = conn.execute("SELECT content FROM components WHERE id = ?", ("comp-1",))
        assert cursor.fetchone()[0] == "# V1 original"

    def test_rollback_nonexistent_version(self, vm, setup_component):
        with pytest.raises(ValueError):
            vm.rollback("comp-1", 99)
