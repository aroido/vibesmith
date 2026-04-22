"""tagging.py 테스트 — 태그 관리 검증."""

import pytest

from vibesmith_core.components.tagging import TagManager
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
def tm(db):
    return TagManager(db)


@pytest.fixture
def setup_components(db):
    conn = db.get_connection()
    conn.execute(_INSERT_PROJECT, ("proj-1", "test", "/path", 0, 0, "2026-02-10"))
    conn.execute(
        _INSERT_COMPONENT,
        ("comp-1", "skill", "skill-a", "proj-1", "/p/a", "2026-02-10", "2026-02-10", "claude_code"),
    )
    conn.execute(
        _INSERT_COMPONENT,
        ("comp-2", "skill", "skill-b", "proj-1", "/p/b", "2026-02-10", "2026-02-10", "claude_code"),
    )
    conn.commit()


class TestAddTag:
    def test_add_tag(self, tm, setup_components):
        tm.add_tag("comp-1", "python")
        tags = tm.get_tags("comp-1")
        assert tags == ["python"]

    def test_add_multiple_tags(self, tm, setup_components):
        tm.add_tag("comp-1", "python")
        tm.add_tag("comp-1", "review")
        tags = tm.get_tags("comp-1")
        assert set(tags) == {"python", "review"}

    def test_add_duplicate_tag_is_idempotent(self, tm, setup_components):
        tm.add_tag("comp-1", "python")
        tm.add_tag("comp-1", "python")
        tags = tm.get_tags("comp-1")
        assert tags == ["python"]


class TestRemoveTag:
    def test_remove_tag(self, tm, setup_components):
        tm.add_tag("comp-1", "python")
        tm.add_tag("comp-1", "review")
        tm.remove_tag("comp-1", "python")
        tags = tm.get_tags("comp-1")
        assert tags == ["review"]

    def test_remove_nonexistent_tag(self, tm, setup_components):
        tm.remove_tag("comp-1", "nonexistent")


class TestGetTags:
    def test_get_tags_empty(self, tm, setup_components):
        tags = tm.get_tags("comp-1")
        assert tags == []


class TestSearchByTags:
    def test_search_single_tag(self, tm, setup_components):
        tm.add_tag("comp-1", "python")
        tm.add_tag("comp-2", "python")
        result = tm.search_by_tags(["python"])
        assert set(result) == {"comp-1", "comp-2"}

    def test_search_multiple_tags_intersection(self, tm, setup_components):
        tm.add_tag("comp-1", "python")
        tm.add_tag("comp-1", "review")
        tm.add_tag("comp-2", "python")
        result = tm.search_by_tags(["python", "review"])
        assert result == ["comp-1"]

    def test_search_no_match(self, tm, setup_components):
        result = tm.search_by_tags(["nonexistent"])
        assert result == []


class TestListAllTags:
    def test_list_all_tags(self, tm, setup_components):
        tm.add_tag("comp-1", "python")
        tm.add_tag("comp-1", "review")
        tm.add_tag("comp-2", "python")
        tm.add_tag("comp-2", "security")
        all_tags = tm.list_all_tags()
        assert set(all_tags) == {"python", "review", "security"}

    def test_list_all_tags_empty(self, tm, setup_components):
        all_tags = tm.list_all_tags()
        assert all_tags == []
