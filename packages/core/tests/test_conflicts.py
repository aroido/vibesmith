"""Tests for conflicts.py (Issue #164)."""

from datetime import UTC, datetime

import pytest

from vibesmith_core.components.conflicts import CONFLICT_ID_SEP, list_conflicts, resolve_conflict
from vibesmith_core.components.operations import ComponentOperations
from vibesmith_core.infra.db import DatabaseManager


@pytest.fixture
def db(tmp_path):
    manager = DatabaseManager(str(tmp_path / "test.db"))
    manager.initialize_schema()
    yield manager
    manager.close()


@pytest.fixture
def ops(db):
    return ComponentOperations(db)


@pytest.fixture
def conflict_db(db, ops):
    """DB state with same-name skill in both global and project."""
    conn = db.get_connection()
    conn.execute(
        "INSERT INTO projects (id, name, path, is_global, component_count, last_scanned_at)"
        " VALUES ('proj-global', 'global', '/home', 1, 0, '2026-02-18')"
    )
    conn.execute(
        "INSERT INTO projects (id, name, path, is_global, component_count, last_scanned_at)"
        " VALUES ('proj-a', 'myproj', '/proj', 0, 0, '2026-02-18')"
    )
    conn.commit()
    now = datetime.now(UTC).isoformat()
    conn.execute(
        "INSERT INTO components ("
        "id, type, name, description, enabled, project_id, path, content, "
        "frontmatter, created_at, updated_at, platform"
        ") VALUES ("
        "'comp-global', 'skill', 'dup-skill', 'g', 1, 'proj-global', "
        "'/g/skills/dup-skill/SKILL.md', 'body', '{}', ?, ?, 'claude_code'"
        ")",
        (now, now),
    )
    conn.execute(
        "INSERT INTO components ("
        "id, type, name, description, enabled, project_id, path, content, "
        "frontmatter, created_at, updated_at, platform"
        ") VALUES ("
        "'comp-proj', 'skill', 'dup-skill', 'p', 1, 'proj-a', "
        "'/p/skills/dup-skill/SKILL.md', 'body', '{}', ?, ?, 'claude_code'"
        ")",
        (now, now),
    )
    conn.commit()
    return db


def test_list_conflicts_empty(db):
    """Empty list when no conflicts exist."""
    conn = db.get_connection()
    conn.execute(
        "INSERT INTO projects (id, name, path, is_global, component_count, last_scanned_at)"
        " VALUES ('p1', 'g', '/g', 1, 0, '2026-02-18')"
    )
    conn.commit()
    assert list_conflicts(db) == []


def test_list_conflicts_detects_same_name_type_platform(conflict_db):
    """Detects global-project pair with same name+type+platform."""
    conflicts = list_conflicts(conflict_db)
    assert len(conflicts) == 1
    c = conflicts[0]
    assert c["name"] == "dup-skill"
    assert c["type"] == "skill"
    assert c["global_component_id"] == "comp-global"
    assert c["project_component_id"] == "comp-proj"
    assert c["project_name"] == "myproj"
    assert c["priority"] == "project"
    assert c["is_intentional"] is False
    assert "comp-global" in c["id"] and "comp-proj" in c["id"]


def test_list_conflicts_filter_by_project_id(conflict_db):
    """Filter by project_id returns only matching project."""
    conflicts = list_conflicts(conflict_db, project_id="proj-a")
    assert len(conflicts) == 1
    conflicts = list_conflicts(conflict_db, project_id="nonexistent")
    assert len(conflicts) == 0


def test_resolve_conflict_ignore(conflict_db, ops):
    """ignore action — saves to conflict_ignores."""
    conflict_id = f"comp-global{CONFLICT_ID_SEP}comp-proj"
    success, updated = resolve_conflict(conflict_db, ops, conflict_id, action="ignore")
    assert success is True
    assert updated == []

    conflicts = list_conflicts(conflict_db)
    assert len(conflicts) == 1
    assert conflicts[0]["is_intentional"] is True


def test_resolve_conflict_disable_global(conflict_db, ops):
    """disable_global — disables global component."""
    conflict_id = f"comp-global{CONFLICT_ID_SEP}comp-proj"
    success, updated = resolve_conflict(conflict_db, ops, conflict_id, action="disable_global")
    assert success is True
    assert "comp-global" in updated
    comp = ops.read("comp-global")
    assert comp.enabled is False


def test_resolve_conflict_invalid_id_raises(conflict_db, ops):
    """Invalid conflict_id — raises ValueError."""
    with pytest.raises(ValueError, match="Invalid conflict_id"):
        resolve_conflict(conflict_db, ops, "bad-id", action="ignore")
