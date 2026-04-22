"""CRUD + toggle + copy — component data operations."""

import json
import shutil
import sqlite3
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import structlog
import yaml

from vibesmith_core.components.models import (
    Command,
    ComponentBase,
    ComponentType,
    Hook,
    HookAction,
    HookMatcher,
    Rule,
    Skill,
    Subagent,
)
from vibesmith_core.infra.db import DatabaseManager

logger = structlog.get_logger(__name__)


class ComponentOperations:
    """Component CRUD, toggle, copy, and listing."""

    def __init__(self, db: DatabaseManager) -> None:
        self._db = db

    @staticmethod
    def _serialize_frontmatter(frontmatter: dict | None) -> str | None:
        """Serialize frontmatter to a JSON string.

        Uses default=str for safe serialization since YAML parsers may return date/datetime types.
        """
        if not frontmatter:
            return None
        return json.dumps(frontmatter, default=str, ensure_ascii=False)

    def create(self, component: ComponentBase) -> ComponentBase:
        """Save a component to the DB and create a file on the filesystem."""
        conn = self._db.get_connection()

        # Issue #33: Case-insensitive duplicate check
        existing = conn.execute(
            "SELECT id, name FROM components "
            "WHERE project_id = ? AND LOWER(name) = LOWER(?) AND type = ? AND platform = ? AND deleted_at IS NULL",
            (component.project_id, component.name, str(component.type), component.platform),
        ).fetchone()
        if existing:
            raise ValueError(
                f"Component already exists: {existing[1]} (type={component.type}, platform={component.platform})"
            )

        # Issue #307: Verify and create file path
        # Look up project path
        row = conn.execute("SELECT path FROM projects WHERE id = ?", (component.project_id,)).fetchone()
        if row is None:
            raise ValueError(f"Project {component.project_id} not found")
        project_path = row[0]

        comp_type = str(component.type)
        path_str = component.path
        # Issue #315: Distinguish API-style (/skills/name) vs scan/merge (absolute path)
        rel_parts = path_str.lstrip("/").split("/")
        is_api_style = rel_parts and rel_parts[0] in ("skills", "agents", "commands", "hooks", "rules")

        if not is_api_style:
            abs_path = path_str
        else:
            platform_dir = ".cursor" if component.platform == "cursor" else ".claude"
            rel_path = path_str.lstrip("/")
            file_path = Path(project_path) / platform_dir / rel_path

            if comp_type == "skill":
                file_path = file_path / "SKILL.md"
            elif comp_type == "agent":
                file_path = file_path.with_suffix(".md")
            elif comp_type == "command":
                file_path = file_path.with_suffix(".md")
            elif comp_type == "rule":
                ext = ".mdc" if component.platform == "cursor" else ".md"
                file_path = file_path.with_suffix(ext)

            if component.content:
                self._write_component_file(str(file_path), component.content, comp_type)
            abs_path = str(file_path.resolve())

        fm_json = self._serialize_frontmatter(component.frontmatter)
        conn.execute(
            "INSERT INTO components"
            " (id, type, name, description, enabled, project_id,"
            " path, content, frontmatter, created_at, updated_at, platform)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                component.id,
                str(component.type),
                component.name,
                component.description,
                1 if component.enabled else 0,
                component.project_id,
                abs_path,
                component.content,
                fm_json,
                component.created_at,
                component.updated_at,
                component.platform,
            ),
        )
        for tag in component.tags:
            conn.execute("INSERT INTO tags (component_id, tag) VALUES (?, ?)", (component.id, tag))
        conn.commit()
        return component.model_copy(update={"path": abs_path})

    def read(self, component_id: str, *, include_deleted: bool = False) -> ComponentBase | None:
        """Read a component by ID.

        include_deleted=False (default): Excludes deleted (trashed) items.
        include_deleted=True: For trash API, includes deleted items.
        """
        conn = self._db.get_connection()
        if include_deleted:
            cursor = conn.execute("SELECT * FROM components WHERE id = ?", (component_id,))
        else:
            cursor = conn.execute(
                "SELECT * FROM components WHERE id = ? AND deleted_at IS NULL",
                (component_id,),
            )
        row = cursor.fetchone()
        if row is None:
            return None
        return self._row_to_component(row, conn)

    def update(self, component_id: str, updates: dict) -> ComponentBase:
        """Update component fields."""
        existing = self.read(component_id, include_deleted=True)
        if existing is None:
            raise ValueError(f"Component {component_id} not found")
        conn = self._db.get_connection()
        allowed = {
            "name",
            "description",
            "enabled",
            "content",
            "frontmatter",
            "path",
            "updated_at",
            "deleted_at",
            "original_path",
        }
        set_clauses = []
        values = []
        for key, value in updates.items():
            if key in allowed:
                if key == "frontmatter" and isinstance(value, dict):
                    value = json.dumps(value)
                if key == "enabled" and isinstance(value, bool):
                    value = 1 if value else 0
                set_clauses.append(f"{key} = ?")
                values.append(value)
        if set_clauses:
            values.append(component_id)
            conn.execute(
                f"UPDATE components SET {', '.join(set_clauses)} WHERE id = ?",  # noqa: S608
                values,
            )
            conn.commit()
        return self.read(component_id, include_deleted=True)

    def delete(self, component_id: str) -> None:
        """Permanently delete a component. Removes from DB and filesystem."""
        existing = self.read(component_id, include_deleted=True)
        if existing is None:
            raise ValueError(f"Component {component_id} not found")
        # Delete file/directory (path is in _trash or original location)
        self._delete_component_files(existing)
        conn = self._db.get_connection()
        conn.execute("DELETE FROM components WHERE id = ?", (component_id,))
        conn.commit()

    def soft_delete(self, component_id: str) -> None:
        """Move a component to trash (Soft Delete).

        1. Move file/directory to {project}/.claude/_trash/{component_name} or .cursor/_trash/
        2. Record deleted_at and original_path in DB
        """
        existing = self.read(component_id)
        if existing is None:
            raise ValueError(f"Component {component_id} not found")
        conn = self._db.get_connection()
        row = conn.execute("SELECT path FROM projects WHERE id = ?", (existing.project_id,)).fetchone()
        if row is None:
            raise ValueError(f"Project {existing.project_id} not found")
        project_path = Path(row[0])
        comp_type = str(existing.type).lower()
        platform_dir = ".cursor" if existing.platform == "cursor" else ".claude"
        trash_base = project_path / platform_dir / "_trash"

        original_path = Path(existing.path)
        if comp_type == "skill":
            # skill: Move entire skills/name/ directory
            trash_dest = trash_base / existing.name
            if original_path.exists():
                trash_dest.parent.mkdir(parents=True, exist_ok=True)
                if trash_dest.exists():
                    shutil.rmtree(trash_dest)
                shutil.move(str(original_path.parent), str(trash_dest))  # skills/name -> _trash/name
            trash_path_str = str(trash_base / existing.name / "SKILL.md")
        elif comp_type in ("agent", "command", "rule"):
            # Move single file
            trash_dest = trash_base / original_path.name
            if original_path.exists():
                trash_dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(original_path), str(trash_dest))
            trash_path_str = str(trash_dest)
        else:
            # hook: No file movement since it's in settings.json. Only save original_path
            trash_path_str = existing.path

        now = datetime.now(UTC).isoformat()
        conn.execute(
            "UPDATE components SET deleted_at = ?, original_path = ?, path = ? WHERE id = ?",
            (now, existing.path, trash_path_str, component_id),
        )
        conn.commit()

    def restore(self, component_id: str) -> ComponentBase:
        """Restore a component from trash."""
        existing = self.read(component_id, include_deleted=True)
        if existing is None:
            raise ValueError(f"Component {component_id} not found")
        conn = self._db.get_connection()
        row = conn.execute(
            "SELECT original_path, deleted_at FROM components WHERE id = ?",
            (component_id,),
        ).fetchone()
        if not row or not row[0] or not row[1]:
            raise ValueError(f"Component {component_id} is not in trash")
        original_path = Path(row[0])
        comp_type = str(existing.type).lower()

        if comp_type == "skill":
            trash_path = Path(existing.path).parent  # _trash/name
            original_dir = original_path.parent  # skills/name
            if trash_path.exists():
                original_dir.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(trash_path), str(original_dir))
        elif comp_type in ("agent", "command", "rule"):
            trash_path = Path(existing.path)
            if trash_path.exists():
                original_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(trash_path), str(original_path))
        # hook and missing files: DB-only restore

        conn.execute(
            "UPDATE components SET deleted_at = NULL, original_path = NULL, path = ? WHERE id = ?",
            (str(original_path), component_id),
        )
        conn.commit()
        return self.read(component_id)

    def list_trash(self) -> list[ComponentBase]:
        """Return the list of components in trash."""
        conn = self._db.get_connection()
        cursor = conn.execute(
            "SELECT * FROM components WHERE deleted_at IS NOT NULL"
            " AND project_id NOT IN (SELECT id FROM projects WHERE hidden_at IS NOT NULL)"
            " ORDER BY deleted_at DESC"
        )
        result: list[ComponentBase] = []
        for row in cursor.fetchall():
            try:
                result.append(self._row_to_component(row, conn))
            except ValueError as error:
                logger.warning(
                    "skip_invalid_component_row",
                    operation="list_trash",
                    error=str(error),
                    row_len=len(row) if hasattr(row, "__len__") else None,
                )
        return result

    def list_trash_with_deleted_at(self) -> list[tuple[ComponentBase, str]]:
        """Return trash list along with deleted_at timestamps."""
        conn = self._db.get_connection()
        cursor = conn.execute(
            "SELECT * FROM components WHERE deleted_at IS NOT NULL"
            " AND project_id NOT IN (SELECT id FROM projects WHERE hidden_at IS NOT NULL)"
            " ORDER BY deleted_at DESC"
        )
        result: list[tuple[ComponentBase, str]] = []
        for row in cursor.fetchall():
            try:
                component = self._row_to_component(row, conn)
            except ValueError as error:
                logger.warning(
                    "skip_invalid_component_row",
                    operation="list_trash_with_deleted_at",
                    error=str(error),
                    row_len=len(row) if hasattr(row, "__len__") else None,
                )
                continue
            deleted_at = self._row_get(row, 12, "") or ""
            result.append((component, deleted_at))
        return result

    def cleanup_expired_trash(self, days: int = 30) -> int:
        """Delete trash items older than ``days`` and return the number removed."""
        threshold = (datetime.now(UTC) - timedelta(days=days)).isoformat()
        conn = self._db.get_connection()
        cursor = conn.execute(
            "SELECT id FROM components WHERE deleted_at IS NOT NULL AND deleted_at < ?",
            (threshold,),
        )
        ids = [row[0] for row in cursor.fetchall()]
        for cid in ids:
            self.delete(cid)
        return len(ids)

    def _delete_component_files(self, comp: ComponentBase) -> None:
        """Delete a component's file/directory from the filesystem."""
        comp_type = str(comp.type).lower()
        path = Path(comp.path)
        if comp_type == "skill":
            # skill: _trash/name/ or skills/name/ directory
            dir_to_remove = path.parent
            if dir_to_remove.exists() and "_trash" in str(dir_to_remove):
                shutil.rmtree(dir_to_remove, ignore_errors=True)
        elif comp_type in ("agent", "command", "rule") and path.exists():
            path.unlink(missing_ok=True)
        # hook: Don't delete settings.json as it's a shared file

    _SUFFIX_DISABLED = ".disabled"

    def toggle(self, component_id: str, enabled: bool | None = None) -> ComponentBase:
        """Toggle a component enabled/disabled.

        If enabled=None, inverts the current state.
        File-based types (skill, agent, command, rule) are actually disabled via file rename:
        - Disable: .md -> .md.disabled, .mdc -> .mdc.disabled
        - Enable: .md.disabled -> .md, .mdc.disabled -> .mdc
        Hooks are in settings.json so only the DB is updated.
        """
        existing = self.read(component_id)
        if existing is None:
            raise ValueError(f"Component {component_id} not found")
        if enabled is None:
            enabled = not existing.enabled

        updates: dict = {"enabled": enabled}

        # File-based types: rename file (.md <-> .md.disabled)
        comp_type = str(existing.type).lower()
        if comp_type in ("skill", "agent", "command", "rule") and existing.path:
            path_obj = Path(existing.path)
            if path_obj.exists():
                if enabled:
                    # Enable: .md.disabled -> .md (or .mdc.disabled -> .mdc)
                    if path_obj.name.endswith(self._SUFFIX_DISABLED):
                        base = path_obj.name[: -len(self._SUFFIX_DISABLED)]
                        new_path = path_obj.parent / base
                        path_obj.rename(new_path)
                        updates["path"] = str(new_path)
                else:
                    # Disable: .md -> .md.disabled (or .mdc -> .mdc.disabled)
                    if not path_obj.name.endswith(self._SUFFIX_DISABLED):
                        new_path = path_obj.parent / f"{path_obj.name}{self._SUFFIX_DISABLED}"
                        path_obj.rename(new_path)
                        updates["path"] = str(new_path)

        return self.update(component_id, updates)

    def _copy_single(
        self,
        component_id: str,
        target_project_id: str,
        target_project_path: str,
        conn: sqlite3.Connection,
    ) -> str | None:
        """Copy a single component. Returns None if duplicate, new ID on success.

        The caller is responsible for committing.
        """
        existing = self.read(component_id)
        if existing is None:
            raise ValueError(f"Component {component_id} not found")

        # Case-insensitive duplicate check — skip if already exists
        dup = conn.execute(
            "SELECT id FROM components "
            "WHERE project_id = ? AND LOWER(name) = LOWER(?) AND type = ? AND platform = ? AND deleted_at IS NULL",
            (target_project_id, existing.name, str(existing.type), existing.platform),
        ).fetchone()
        if dup:
            return None

        new_path, file_content = self._resolve_copy_path_and_content(existing, target_project_path)
        if new_path and file_content is not None:
            self._write_component_file(new_path, file_content, existing.type)

        new_id = str(uuid.uuid4())
        fm_json = self._serialize_frontmatter(existing.frontmatter)
        conn.execute(
            "INSERT INTO components"
            " (id, type, name, description, enabled, project_id,"
            " path, content, frontmatter, created_at, updated_at, platform)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                new_id,
                str(existing.type),
                existing.name,
                existing.description,
                1 if existing.enabled else 0,
                target_project_id,
                new_path or existing.path,
                existing.content,
                fm_json,
                existing.created_at,
                existing.updated_at,
                existing.platform,
            ),
        )
        for tag in existing.tags:
            conn.execute("INSERT INTO tags (component_id, tag) VALUES (?, ?)", (new_id, tag))
        return new_id

    def copy(self, component_id: str, target_project_id: str, include_deps: bool = False) -> list[str]:
        """Copy a component to another project.

        Creates files in the target project's .claude/ path and saves to DB. Returns list of new IDs.
        When include_deps=True, dependent components are also copied.
        """
        existing = self.read(component_id)
        if existing is None:
            raise ValueError(f"Component {component_id} not found")

        conn = self._db.get_connection()
        row = conn.execute("SELECT path FROM projects WHERE id = ?", (target_project_id,)).fetchone()
        if row is None:
            raise ValueError(f"Target project {target_project_id} not found")
        target_project_path = row[0]

        if not include_deps:
            # Existing logic: error on duplicate
            dup = conn.execute(
                "SELECT id, name FROM components "
                "WHERE project_id = ? AND LOWER(name) = LOWER(?) AND type = ? AND platform = ? AND deleted_at IS NULL",
                (target_project_id, existing.name, str(existing.type), existing.platform),
            ).fetchone()
            if dup:
                raise ValueError(
                    f"Component already exists: {dup[1]} (type={existing.type}, platform={existing.platform})"
                )

            new_path, file_content = self._resolve_copy_path_and_content(existing, target_project_path)
            wrote_file = False
            if new_path and file_content is not None:
                self._write_component_file(new_path, file_content, existing.type)
                wrote_file = True

            new_id = str(uuid.uuid4())
            fm_json = self._serialize_frontmatter(existing.frontmatter)
            try:
                conn.execute(
                    "INSERT INTO components"
                    " (id, type, name, description, enabled, project_id,"
                    " path, content, frontmatter, created_at, updated_at, platform)"
                    " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        new_id,
                        str(existing.type),
                        existing.name,
                        existing.description,
                        1 if existing.enabled else 0,
                        target_project_id,
                        new_path or existing.path,
                        existing.content,
                        fm_json,
                        existing.created_at,
                        existing.updated_at,
                        existing.platform,
                    ),
                )
                for tag in existing.tags:
                    conn.execute("INSERT INTO tags (component_id, tag) VALUES (?, ?)", (new_id, tag))
                conn.commit()
            except sqlite3.IntegrityError:
                if wrote_file and new_path:
                    try:
                        Path(new_path).unlink(missing_ok=True)
                    except OSError:
                        pass
                raise
            return [new_id]

        # include_deps=True: Also copy dependent components
        # Collect component IDs to copy (main + dependency targets)
        ids_to_copy = [component_id]
        dep_rows = conn.execute(
            "SELECT target_id FROM dependencies WHERE source_id = ?",
            (component_id,),
        ).fetchall()
        for (target_id,) in dep_rows:
            if target_id not in ids_to_copy:
                ids_to_copy.append(target_id)

        new_ids: list[str] = []
        try:
            for cid in ids_to_copy:
                new_id = self._copy_single(cid, target_project_id, target_project_path, conn)
                if new_id is not None:
                    new_ids.append(new_id)
            conn.commit()
        except Exception:
            conn.rollback()
            raise

        return new_ids

    def rename(self, component_id: str, new_name: str) -> ComponentBase:
        """Rename a component. Moves on filesystem and updates DB.

        Issue #164: Used for rename action during conflict resolution.
        """
        if ".." in new_name or "/" in new_name or "\\" in new_name:
            raise ValueError(f"Invalid component name: {new_name}")
        new_name = new_name.strip()
        if not new_name:
            raise ValueError("Component name cannot be empty")

        existing = self.read(component_id)
        if existing is None:
            raise ValueError(f"Component {component_id} not found")
        if existing.name == new_name:
            return existing

        conn = self._db.get_connection()
        row = conn.execute("SELECT path FROM projects WHERE id = ?", (existing.project_id,)).fetchone()
        if row is None:
            raise ValueError(f"Project {existing.project_id} not found")
        project_path = Path(row[0])
        platform_dir = ".cursor" if existing.platform == "cursor" else ".claude"
        base = project_path / platform_dir
        comp_type = str(existing.type).lower()

        def _path_for_name(name: str) -> Path:
            if comp_type == "skill":
                return base / "skills" / name / "SKILL.md"
            if comp_type == "agent":
                return base / "agents" / f"{name}.md"
            if comp_type == "command":
                return base / "commands" / f"{name}.md"
            if comp_type == "rule":
                ext = ".mdc" if existing.platform == "cursor" else ".md"
                return base / "rules" / f"{name}{ext}"
            raise ValueError(f"Cannot rename component type: {comp_type}")

        old_path = Path(existing.path)
        new_path = _path_for_name(new_name)
        if new_path.resolve() == old_path.resolve():
            return existing
        if new_path.exists():
            raise ValueError(f"Component with name '{new_name}' already exists")

        # Move file/directory
        if comp_type == "skill":
            old_dir = old_path.parent
            new_dir = new_path.parent
            new_dir.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(old_dir), str(new_dir))
        else:
            new_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(old_path), str(new_path))

        # Update frontmatter name and write to file
        fm = dict(existing.frontmatter or {})
        fm["name"] = new_name
        new_content = self._full_content(existing.model_copy(update={"frontmatter": fm, "name": new_name}))
        self._write_component_file(str(new_path), new_content, comp_type)

        self.update(
            component_id,
            {
                "name": new_name,
                "path": str(new_path.resolve()),
                "content": new_content,
                "frontmatter": fm,
            },
        )
        return self.read(component_id)

    def _resolve_copy_path_and_content(
        self, comp: ComponentBase, target_project_path: str
    ) -> tuple[str | None, str | None]:
        """Return the target project-relative path and file content to write.

        HOOK requires settings.json merging, so returns (path, None).
        """
        # Path traversal defense: reject if comp.name contains "..", "/", or "\\"
        if ".." in comp.name or "/" in comp.name or "\\" in comp.name:
            raise ValueError(f"Invalid component name: {comp.name}")

        # Issue #309: Select directory based on platform
        platform_dir = ".cursor" if comp.platform == "cursor" else ".claude"
        base = Path(target_project_path) / platform_dir
        comp_type = comp.type if isinstance(comp.type, str) else str(comp.type)

        if comp_type == "skill":
            out_path = base / "skills" / comp.name / "SKILL.md"
        elif comp_type == "agent":
            out_path = base / "agents" / f"{comp.name}.md"
        elif comp_type == "command":
            out_path = base / "commands" / f"{comp.name}.md"
        elif comp_type == "rule":
            # Issue #309: cursor uses .mdc, claude_code uses .md
            ext = ".mdc" if comp.platform == "cursor" else ".md"
            out_path = base / "rules" / f"{comp.name}{ext}"
        elif comp_type == "hook":
            # HOOK: settings.json merging not implemented. DB-only copy, path set relative to target
            out_path = base / "settings.json"
            return str(out_path), None  # Skip file writing
        else:
            return None, None

        # Verify final path is under base (secondary path traversal defense)
        resolved = out_path.resolve()
        base_resolved = base.resolve()
        if not str(resolved).startswith(str(base_resolved)):
            raise ValueError(f"Path traversal detected: {out_path}")

        # Return file content
        if comp_type == "command":
            return str(out_path), comp.content or ""
        else:
            return str(out_path), self._full_content(comp)

    def _full_content(self, comp: ComponentBase) -> str:
        """Combine frontmatter + body to return the full file content."""
        if comp.content and comp.content.strip().startswith("---"):
            return comp.content
        if comp.frontmatter:
            fm_str = yaml.dump(comp.frontmatter, allow_unicode=True, default_flow_style=False).strip()
            return f"---\n{fm_str}\n---\n\n{comp.content or ''}"
        return comp.content or ""

    def _write_component_file(self, out_path: str, content: str, comp_type: str) -> None:
        """Write a component file to the target path."""
        path = Path(out_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    def list_all(
        self,
        filters: dict | None = None,
        *,
        exclude_hidden_projects: bool = False,
    ) -> list[ComponentBase]:
        """Return the list of components. Deleted items are excluded.

        Args:
            filters: type, project_id, enabled, platform filters
            exclude_hidden_projects: If True, exclude components from hidden projects
        """
        conn = self._db.get_connection()
        query = "SELECT * FROM components WHERE deleted_at IS NULL"
        conditions = []
        values = []
        if exclude_hidden_projects:
            conditions.append("project_id NOT IN (SELECT id FROM projects WHERE hidden_at IS NOT NULL)")
        if filters:
            if "type" in filters:
                conditions.append("type = ?")
                values.append(filters["type"])
            if "project_id" in filters:
                conditions.append("project_id = ?")
                values.append(filters["project_id"])
            if "enabled" in filters:
                conditions.append("enabled = ?")
                values.append(1 if filters["enabled"] else 0)
            if "platform" in filters:
                conditions.append("platform = ?")
                values.append(filters["platform"])
        if conditions:
            query += " AND " + " AND ".join(conditions)
        query += " ORDER BY name"
        cursor = conn.execute(query, values)
        result: list[ComponentBase] = []
        for row in cursor.fetchall():
            try:
                result.append(self._row_to_component(row, conn))
            except ValueError as error:
                logger.warning(
                    "skip_invalid_component_row",
                    operation="list_all",
                    error=str(error),
                    row_len=len(row) if hasattr(row, "__len__") else None,
                )
        return result

    def list_all_with_project(
        self,
        filters: dict | None = None,
        *,
        exclude_hidden_projects: bool = False,
    ) -> list[tuple[ComponentBase, str]]:
        """Return the list of components with project names (N+1 query optimization, Issue #40).

        Args:
            filters: type, project_id, enabled, platform filters
            exclude_hidden_projects: If True, exclude components from hidden projects

        Returns:
            list[tuple[ComponentBase, str]]: List of (component, project_name) tuples
        """
        import time

        conn = self._db.get_connection()
        start = time.perf_counter()

        # Fetch project_name via JOIN query
        query = """
            SELECT c.*, COALESCE(p.name, '') AS project_name
            FROM components c
            LEFT JOIN projects p ON c.project_id = p.id
            WHERE c.deleted_at IS NULL
        """
        conditions = []
        values = []
        if exclude_hidden_projects:
            conditions.append("(p.hidden_at IS NULL OR p.id IS NULL)")
        if filters:
            if "type" in filters:
                conditions.append("c.type = ?")
                values.append(filters["type"])
            if "project_id" in filters:
                conditions.append("c.project_id = ?")
                values.append(filters["project_id"])
            if "enabled" in filters:
                conditions.append("c.enabled = ?")
                values.append(1 if filters["enabled"] else 0)
            if "platform" in filters:
                conditions.append("c.platform = ?")
                values.append(filters["platform"])
        if conditions:
            query += " AND " + " AND ".join(conditions)
        query += " ORDER BY c.name"

        cursor = conn.execute(query, values)
        rows = cursor.fetchall()

        # Each row contains components columns + project_name (last column)
        result = []
        for row in rows:
            component_row = row[:-1]  # All columns except project_name
            project_name = row[-1]  # Last column is project_name
            try:
                component = self._row_to_component(component_row, conn)
            except ValueError as error:
                logger.warning(
                    "skip_invalid_component_row",
                    operation="list_all_with_project",
                    error=str(error),
                    row_len=len(component_row) if hasattr(component_row, "__len__") else None,
                )
                continue
            result.append((component, project_name))

        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.info("db_query", operation="list_all_with_project", elapsed_ms=round(elapsed_ms, 2), count=len(result))

        return result

    @staticmethod
    def _row_get(row: tuple, index: int, default=None):
        """Safely access a row by index."""
        try:
            return row[index]
        except (IndexError, TypeError):
            return default

    def _row_to_component(self, row: tuple, conn) -> ComponentBase:
        """Convert a DB row to the appropriate subclass."""
        # row: id, type, name, desc, enabled, project_id, path, content, fm, created_at, updated_at, platform
        component_id = self._row_get(row, 0)
        comp_type_raw = self._row_get(row, 1)
        name = self._row_get(row, 2)
        project_id = self._row_get(row, 5)
        path = self._row_get(row, 6)

        if not component_id or not comp_type_raw or not name or not project_id or not path:
            raise ValueError("missing required component columns")

        try:
            comp_type = ComponentType(comp_type_raw)
        except ValueError as error:
            raise ValueError(f"invalid component type: {comp_type_raw}") from error

        fm_raw = self._row_get(row, 8)
        fm = None
        if fm_raw:
            try:
                fm = json.loads(fm_raw)
            except json.JSONDecodeError:
                logger.warning("invalid_frontmatter_json", component_id=component_id)

        tag_cursor = conn.execute(
            "SELECT tag FROM tags WHERE component_id = ? ORDER BY tag",
            (component_id,),
        )
        tags: list[str] = []
        for tag_row in tag_cursor.fetchall():
            # Ensure abnormal rows (empty tuples, etc.) don't cause the entire API to fail.
            if not tag_row:
                continue
            try:
                tag_value = tag_row[0]
            except (IndexError, TypeError):
                continue
            if isinstance(tag_value, str) and tag_value:
                tags.append(tag_value)
        created_at = self._row_get(row, 9) or datetime.now(UTC).isoformat()
        updated_at = self._row_get(row, 10) or created_at
        base = {
            "id": component_id,
            "type": comp_type,
            "name": name,
            "description": self._row_get(row, 3),
            "enabled": bool(self._row_get(row, 4, 1)),
            "project_id": project_id,
            "path": path,
            "content": self._row_get(row, 7),
            "frontmatter": fm,
            "tags": tags,
            "created_at": created_at,
            "updated_at": updated_at,
            "platform": self._row_get(row, 11) or "claude_code",
            "last_used": self._row_get(row, 14) or updated_at,
        }
        return self._build_typed_component(comp_type, base, fm)

    def _build_typed_component(self, comp_type: ComponentType, base: dict, fm: dict | None) -> ComponentBase:
        """Create the appropriate subclass for the given type."""
        fm = fm or {}
        if comp_type == ComponentType.SKILL:
            return Skill(
                **base,
                allowed_tools=self._csv_to_list(fm.get("allowed-tools")),
                context_files=self._csv_to_list(fm.get("context")),
                agent=fm.get("agent"),
            )
        if comp_type == ComponentType.AGENT:
            return Subagent(
                **base,
                tools=self._csv_to_list(fm.get("tools")),
                model=fm.get("model"),
                permission_mode=fm.get("permissionMode"),
                agents=self._csv_to_list(fm.get("agents")),
            )
        if comp_type == ComponentType.COMMAND:
            return Command(**base)
        if comp_type == ComponentType.HOOK:
            matchers = None
            if fm.get("matchers"):
                matchers = [
                    HookMatcher(
                        matcher=m["matcher"],
                        hooks=[HookAction(**h) for h in m["hooks"]],
                    )
                    for m in fm["matchers"]
                ]
            return Hook(**base, event_type=fm.get("event_type"), matchers=matchers)
        if comp_type == ComponentType.RULE:
            return Rule(**base, globs=self._csv_to_list(fm.get("globs")))
        return ComponentBase(**base)

    @staticmethod
    def _csv_to_list(value) -> list[str] | None:
        if value is None:
            return None
        if isinstance(value, list):
            return [str(v).strip() for v in value]
        return [v.strip() for v in str(value).split(",") if v.strip()]
