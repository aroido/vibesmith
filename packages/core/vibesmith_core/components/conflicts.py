"""Component conflict detection — global vs project same name/type (Issue #164)."""

from __future__ import annotations

from typing import TypedDict

from vibesmith_core.components.operations import ComponentOperations
from vibesmith_core.infra.db import DatabaseManager


class ConflictRecord(TypedDict):
    """Conflict record — for API responses."""

    id: str
    name: str
    type: str
    global_component_id: str
    project_component_id: str
    project_name: str
    priority: str
    is_intentional: bool


CONFLICT_ID_SEP = "::"  # URL-safe (| can cause issues in query strings)


def _make_conflict_id(global_component_id: str, project_component_id: str) -> str:
    """Generate a fixed ID from a conflict pair. Used for parsing during resolve."""
    return f"{global_component_id}{CONFLICT_ID_SEP}{project_component_id}"


def _parse_conflict_id(conflict_id: str) -> tuple[str, str]:
    """Parse conflict_id into (global_component_id, project_component_id)."""
    if CONFLICT_ID_SEP not in conflict_id:
        raise ValueError(f"Invalid conflict_id: {conflict_id}")
    parts = conflict_id.split(CONFLICT_ID_SEP, 1)
    return (parts[0], parts[1])


def list_conflicts(
    db: DatabaseManager,
    *,
    project_id: str | None = None,
) -> list[ConflictRecord]:
    """Return the list of name+type+platform conflicts between global and project components.

    Detection logic:
    - Conflict exists when components with the same name, type, platform exist in both global (is_global=1) and project
    - Ignored conflicts are in the conflict_ignores table with is_intentional=True

    Args:
        db: Database manager
        project_id: If specified, only this project; None for all
    """
    conn = db.get_connection()

    # Components by (name, type, platform) in the global project
    cursor = conn.execute(
        """
        SELECT c.id, c.name, c.type, c.platform, p.name as project_name
        FROM components c
        JOIN projects p ON c.project_id = p.id
        WHERE p.is_global = 1 AND c.deleted_at IS NULL
        """
    )
    global_components = {
        (row[1], row[2], row[3]): {
            "id": row[0],
            "name": row[1],
            "type": row[2],
            "platform": row[3],
            "project_name": row[4],
        }
        for row in cursor.fetchall()
    }

    # Per-project (name, type, platform) components
    project_sql = """
        SELECT c.id, c.name, c.type, c.platform, p.id as proj_id, p.name as proj_name
        FROM components c
        JOIN projects p ON c.project_id = p.id
        WHERE p.is_global = 0 AND c.deleted_at IS NULL AND p.hidden_at IS NULL
    """
    params: tuple = ()
    if project_id:
        project_sql += " AND p.id = ?"
        params = (project_id,)
    cursor = conn.execute(project_sql, params)
    project_components = cursor.fetchall()

    # Ignore list: (global_id, project_id) pairs
    cursor = conn.execute("SELECT global_component_id, project_component_id FROM conflict_ignores")
    ignored_pairs = {(row[0], row[1]) for row in cursor.fetchall()}

    conflicts: list[ConflictRecord] = []
    for row in project_components:
        comp_id, name, comp_type, platform, proj_id, proj_name = row
        key = (name, comp_type, platform)
        if key not in global_components:
            continue
        global_comp = global_components[key]
        global_id = global_comp["id"]
        if (global_id, comp_id) in ignored_pairs:
            is_intentional = True
        else:
            is_intentional = False

        conflicts.append(
            ConflictRecord(
                id=_make_conflict_id(global_id, comp_id),
                name=name,
                type=comp_type,
                global_component_id=global_id,
                project_component_id=comp_id,
                project_name=proj_name,
                priority="project",  # project > global
                is_intentional=is_intentional,
            )
        )
    return conflicts


def resolve_conflict(
    db: DatabaseManager,
    operations: ComponentOperations,
    conflict_id: str,
    *,
    action: str,
    new_name: str | None = None,
    target: str | None = None,
) -> tuple[bool, list[str]]:
    """Execute a conflict resolution action.

    Args:
        db: Database manager
        operations: Component operations (toggle, delete, etc.)
        conflict_id: Conflict ID (global_id|project_id)
        action: disable_global | delete_project | rename | ignore
        new_name: New name for rename action
        target: 'global' | 'project' for rename action

    Returns:
        (success, updated_component_ids)
    """
    global_id, project_id = _parse_conflict_id(conflict_id)
    updated: list[str] = []

    if action == "ignore":
        conn = db.get_connection()
        conn.execute(
            "INSERT OR IGNORE INTO conflict_ignores (global_component_id, project_component_id) VALUES (?, ?)",
            (global_id, project_id),
        )
        conn.commit()
        return (True, [])

    if action == "disable_global":
        operations.toggle(global_id, enabled=False)
        updated.append(global_id)
        return (True, updated)

    if action == "delete_project":
        operations.soft_delete(project_id)
        updated.append(project_id)
        return (True, updated)

    if action == "rename":
        if not new_name or not new_name.strip():
            raise ValueError("rename action requires new_name")
        if target not in ("global", "project"):
            raise ValueError("rename action requires target: 'global' or 'project'")
        comp_id = global_id if target == "global" else project_id
        operations.rename(comp_id, new_name.strip())
        updated.append(comp_id)
        return (True, updated)

    raise ValueError(f"Unknown action: {action}")
