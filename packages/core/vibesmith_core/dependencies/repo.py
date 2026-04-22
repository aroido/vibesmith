"""Dependency repository — CRUD for the dependencies table."""

import sqlite3

from vibesmith_core.components.models import Dependency, DependencyType


def save_dependencies_for_sources(
    conn: sqlite3.Connection,
    source_ids: list[str],
    deps: list[Dependency],
) -> None:
    """Save dependencies for the specified sources.

    Args:
        conn: DB connection
        source_ids: List of source IDs to update
        deps: List of dependencies to save (only those with source_id in source_ids)

    Behavior:
        1. Delete existing dependencies for source_ids
        2. Insert only deps whose source_id is in source_ids
    """
    if not source_ids:
        return

    # 1. Delete existing dependencies
    placeholders = ",".join("?" * len(source_ids))
    conn.execute(
        f"DELETE FROM dependencies WHERE source_id IN ({placeholders})",
        source_ids,
    )

    # 2. Insert new dependencies
    filtered_deps = [dep for dep in deps if dep.source_id in source_ids]

    if filtered_deps:
        conn.executemany(
            "INSERT OR REPLACE INTO dependencies (source_id, target_id, dep_type) VALUES (?, ?, ?)",
            [(dep.source_id, dep.target_id, dep.dep_type.value) for dep in filtered_deps],
        )

    conn.commit()


def delete_dependencies_for_sources(
    conn: sqlite3.Connection,
    source_ids: list[str],
) -> None:
    """Delete dependencies for the specified sources.

    Args:
        conn: DB connection
        source_ids: List of source IDs to delete
    """
    if not source_ids:
        return

    placeholders = ",".join("?" * len(source_ids))
    conn.execute(
        f"DELETE FROM dependencies WHERE source_id IN ({placeholders})",
        source_ids,
    )
    conn.commit()


def get_all_dependencies(conn: sqlite3.Connection) -> list[Dependency]:
    """Retrieve all dependencies.

    Args:
        conn: DB connection

    Returns:
        List of dependencies
    """
    rows = conn.execute("SELECT source_id, target_id, dep_type FROM dependencies").fetchall()

    deps = []
    for row in rows:
        source_id, target_id, dep_type_str = row
        try:
            dep_type = DependencyType(dep_type_str)
        except ValueError:
            continue
        deps.append(
            Dependency(
                source_id=source_id,
                target_id=target_id,
                dep_type=dep_type,
            )
        )

    return deps
