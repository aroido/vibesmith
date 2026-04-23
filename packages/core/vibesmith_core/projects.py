"""Project management — project CRUD and rescan."""

import json
import sqlite3
import uuid
from datetime import UTC, datetime
from pathlib import Path

from vibesmith_core.components.conflicts import list_conflicts
from vibesmith_core.components.models import Project
from vibesmith_core.components.operations import ComponentOperations
from vibesmith_core.dependencies.analyzer import DependencyAnalyzer
from vibesmith_core.dependencies.repo import save_dependencies_for_sources
from vibesmith_core.infra.db import DatabaseManager
from vibesmith_core.scanning.scanner import FileSystemScanner


class ProjectManager:
    """Manages projects and performs component scanning."""

    def __init__(
        self,
        db: DatabaseManager,
        scanner: FileSystemScanner | None = None,
        operations: ComponentOperations | None = None,
    ) -> None:
        self._db = db
        self._scanner = scanner or FileSystemScanner()
        self._operations = operations or ComponentOperations(db)

    def ensure_global_project(self, home_path: str | None = None) -> Project:
        """Register and scan the global project. Returns the existing project if already present."""
        home = home_path or str(Path.home())
        conn = self._db.get_connection()
        existing = conn.execute("SELECT id FROM projects WHERE path = ?", (home,)).fetchone()
        if existing:
            return self.get(existing[0])
        project_id = str(uuid.uuid4())
        now = datetime.now(UTC).isoformat()
        conn.execute(
            "INSERT INTO projects (id, name, path, is_global, component_count, last_scanned_at)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (project_id, "global", home, 1, 0, now),
        )
        conn.commit()
        # Scan with all adapters
        components = self._scanner.scan_project_all_adapters(home, project_id)
        for comp in components:
            try:
                self._operations.create(comp)
            except sqlite3.IntegrityError:
                pass
        count = len(components)
        conn.execute(
            "UPDATE projects SET component_count = ?, last_scanned_at = ? WHERE id = ?",
            (count, datetime.now(UTC).isoformat(), project_id),
        )
        conn.commit()
        return self.get(project_id)

    def add_project(self, path: str) -> Project:
        """Register a project. Does not perform a scan; last_scanned_at is stored as an empty string (unscanned)."""
        conn = self._db.get_connection()
        existing = conn.execute("SELECT id FROM projects WHERE path = ?", (path,)).fetchone()
        if existing:
            raise ValueError(f"Project already registered at {path}")
        project_id = str(uuid.uuid4())
        name = Path(path).name
        conn.execute(
            "INSERT INTO projects (id, name, path, is_global, component_count, last_scanned_at)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (project_id, name, path, 0, 0, ""),
        )
        conn.commit()
        return Project(
            id=project_id,
            name=name,
            path=path,
            is_global=False,
            component_count=0,
            last_scanned_at="",
        )

    def discover_projects(self, root_path: str, max_depth: int = 1) -> list[str]:
        """Discover project paths with config directories under root_path."""
        return self._scanner.discover_projects(root_path, max_depth)

    def list_all(self, include_hidden: bool = False) -> list[Project]:
        """Return registered projects. Hidden projects are excluded by default."""
        conn = self._db.get_connection()
        cols = "id, name, path, is_global, component_count, last_scanned_at, hidden_at"
        if include_hidden:
            cursor = conn.execute(f"SELECT {cols} FROM projects ORDER BY name")
        else:
            cursor = conn.execute(f"SELECT {cols} FROM projects WHERE hidden_at IS NULL ORDER BY name")
        return [
            Project(
                id=row[0],
                name=row[1],
                path=row[2],
                is_global=bool(row[3]),
                component_count=row[4],
                last_scanned_at=row[5],
                hidden_at=row[6],
            )
            for row in cursor.fetchall()
        ]

    def get(self, project_id: str) -> Project | None:
        """Look up a project by ID (including hidden projects)."""
        conn = self._db.get_connection()
        cursor = conn.execute(
            "SELECT id, name, path, is_global, component_count, last_scanned_at, hidden_at FROM projects WHERE id = ?",
            (project_id,),
        )
        row = cursor.fetchone()
        if row is None:
            return None
        return Project(
            id=row[0],
            name=row[1],
            path=row[2],
            is_global=bool(row[3]),
            component_count=row[4],
            last_scanned_at=row[5],
            hidden_at=row[6],
        )

    def hide_project(self, project_id: str) -> Project:
        """Hide a project. Global projects cannot be hidden."""
        existing = self.get(project_id)
        if existing is None:
            raise ValueError(f"Project {project_id} not found")
        if existing.is_global:
            raise ValueError(f"Cannot hide global project {project_id}")
        now = datetime.now(UTC).isoformat()
        conn = self._db.get_connection()
        conn.execute("UPDATE projects SET hidden_at = ? WHERE id = ?", (now, project_id))
        conn.commit()
        return self.get(project_id)

    def unhide_project(self, project_id: str) -> Project:
        """Unhide a hidden project."""
        existing = self.get(project_id)
        if existing is None:
            raise ValueError(f"Project {project_id} not found")
        conn = self._db.get_connection()
        conn.execute("UPDATE projects SET hidden_at = NULL WHERE id = ?", (project_id,))
        conn.commit()
        return self.get(project_id)

    def remove_project(self, project_id: str) -> None:
        """Delete a project. Related components are also deleted via CASCADE."""
        existing = self.get(project_id)
        if existing is None:
            raise ValueError(f"Project {project_id} not found")
        conn = self._db.get_connection()
        conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        conn.commit()

    def rescan(self, project_id: str) -> dict:
        """Rescan a project to update components. Uses a merge approach that preserves existing components."""
        project = self.get(project_id)
        if project is None:
            raise ValueError(f"Project {project_id} not found")
        if project.hidden_at is not None:
            raise ValueError(f"Project {project_id} is hidden, cannot rescan")
        conn = self._db.get_connection()

        # 1. Index existing components by (name, type, platform) key (including deleted_at — preserve trashed items)
        existing_rows = conn.execute(
            "SELECT id, name, type, platform, enabled, content, description, frontmatter, deleted_at,"
            " path, updated_at"
            " FROM components WHERE project_id = ?",
            (project_id,),
        ).fetchall()
        existing_map: dict[tuple[str, str, str], dict] = {}
        existing_by_path: dict[tuple[str, str, str], dict] = {}
        for row in existing_rows:
            entry = {
                "id": row[0],
                "name": row[1],
                "enabled": row[4],
                "content": row[5],
                "description": row[6],
                "frontmatter": row[7],
                "deleted_at": row[8],
                "path": row[9],
                "updated_at": row[10],
            }
            key = (row[1], row[2], row[3])  # (name, type, platform)
            existing_map[key] = entry
            # Index non-trashed items by (path, type, platform) for rename detection
            if row[8] is None and row[9]:
                existing_by_path[(row[9], row[2], row[3])] = entry

        # 2. Filesystem scan
        scanned = self._scanner.scan_project_all_adapters(project.path, project_id)

        # 3. Classify as INSERT/UPDATE by comparing with scan results
        scanned_keys: set[tuple[str, str, str]] = set()
        # Track existing IDs consumed by path-based rename so step 4 won't soft_delete them
        renamed_ids: set[str] = set()
        for comp in scanned:
            key = (comp.name, str(comp.type), comp.platform)
            scanned_keys.add(key)

            if key in existing_map:
                existing = existing_map[key]
                if existing.get("deleted_at"):
                    # File is on disk despite DB marked trashed — user re-created
                    # the component (e.g. after accidental delete or after #8
                    # atomic-save-race recovery). Auto-restore: clear deleted_at
                    # and original_path, point path at the current disk location,
                    # and refresh metadata.
                    self._operations.update(
                        existing["id"],
                        {
                            "content": comp.content,
                            "description": comp.description,
                            "frontmatter": comp.frontmatter,
                            "updated_at": comp.updated_at,
                            "path": comp.path,
                            "deleted_at": None,
                            "original_path": None,
                        },
                    )
                    continue
                # UPDATE: Only update when actual changes exist
                existing_fm = existing["frontmatter"]
                scanned_fm = json.dumps(comp.frontmatter, default=str, ensure_ascii=False) if comp.frontmatter else None
                changed = (
                    existing["content"] != comp.content
                    or existing["description"] != comp.description
                    or existing_fm != scanned_fm
                )
                if changed:
                    self._operations.update(
                        existing["id"],
                        {
                            "content": comp.content,
                            "description": comp.description,
                            "path": comp.path,
                            "frontmatter": comp.frontmatter,
                            "updated_at": comp.updated_at,
                        },
                    )
                else:
                    # Issue #494: Update if path or mtime differs even when content is unchanged
                    updates: dict = {}
                    if existing["path"] != comp.path:
                        updates["path"] = comp.path
                    if existing["updated_at"] != comp.updated_at:
                        updates["updated_at"] = comp.updated_at
                    if updates:
                        self._operations.update(existing["id"], updates)
            else:
                # Path-based rename: same file on disk, but frontmatter `name` field changed.
                # Without this branch, step 4 would soft_delete the existing record (moving the
                # actual file to _trash) while step 3 inserts a new record with the new name —
                # user sees their file vanish. Match by path and UPDATE instead.
                path_key = (comp.path, str(comp.type), comp.platform)
                renamed = existing_by_path.get(path_key)
                if renamed is not None and renamed["id"] not in renamed_ids:
                    renamed_ids.add(renamed["id"])
                    # Re-add the existing record's key to scanned_keys so step 4 skips it
                    scanned_keys.add((renamed["name"], str(comp.type), comp.platform))
                    self._operations.update(
                        renamed["id"],
                        {
                            "name": comp.name,
                            "content": comp.content,
                            "description": comp.description,
                            "frontmatter": comp.frontmatter,
                            "updated_at": comp.updated_at,
                        },
                    )
                    continue
                # INSERT: New component
                try:
                    self._operations.create(comp)
                except sqlite3.IntegrityError:
                    pass

        # 4. Handle components that disappeared from the filesystem
        for key, existing in existing_map.items():
            if key not in scanned_keys:
                if existing.get("deleted_at"):
                    # Keep trashed items as-is to avoid watchdog rescans after soft_delete.
                    pass
                else:
                    # Re-check the file system before soft_delete: IntelliJ/vi atomic
                    # save briefly unlinks then recreates the target, and scanner may
                    # run during that window. The scan result is a hint, not truth;
                    # the current file system state decides. If the file is still on
                    # disk, skip — the next rescan will reconcile any real change.
                    existing_path = existing.get("path")
                    if existing_path and Path(existing_path).is_file():
                        continue
                    # File missing + active/disabled -> soft delete (move to trash)
                    self._operations.soft_delete(existing["id"])

        # 5. Update project metadata (count excluding deleted items)
        now = datetime.now(UTC).isoformat()
        count = conn.execute(
            "SELECT COUNT(*) FROM components WHERE project_id = ? AND deleted_at IS NULL",
            (project_id,),
        ).fetchone()[0]
        conn.execute(
            "UPDATE projects SET component_count = ?, last_scanned_at = ? WHERE id = ?",
            (count, now, project_id),
        )
        conn.commit()

        # 6. Issue #31: Analyze and save dependencies
        self._analyze_and_save_dependencies(project_id)

        # 7. Issue #164: Post-scan processing — conflict detection (global vs project same name+type)
        # Queried on-demand via GET /api/conflicts, so only reference logging is possible here
        conflict_count = len(list_conflicts(self._db, project_id=project_id))
        if conflict_count > 0:
            # Can be utilized when injecting a logger such as structlog
            pass

        return {"project_id": project_id, "component_count": count, "last_scanned_at": now}

    def _analyze_and_save_dependencies(self, project_id: str) -> None:
        """Analyze dependencies and save them to the DB.

        Args:
            project_id: Project ID to analyze
        """
        conn = self._db.get_connection()

        # 1. Get component IDs for this project (deleted_at IS NULL)
        project_component_ids = [
            row[0]
            for row in conn.execute(
                "SELECT id FROM components WHERE project_id = ? AND deleted_at IS NULL",
                (project_id,),
            ).fetchall()
        ]

        if not project_component_ids:
            # No components means no dependencies
            return

        # 2. Load project + global components (for known_names)
        all_components = self._operations.list_all()

        # 3. Analyze dependencies
        analyzer = DependencyAnalyzer(all_components)
        deps = analyzer.analyze_all()

        # 4. Save only this project's dependencies to DB
        save_dependencies_for_sources(conn, project_component_ids, deps)
