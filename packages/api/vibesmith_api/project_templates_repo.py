"""Project template (preset) repository."""

from __future__ import annotations

import hashlib
import json
import sqlite3
import uuid
from datetime import UTC, datetime
from typing import Any, Literal

import yaml
from vibesmith_core.infra.db import DatabaseManager

from vibesmith_api.template_engine import render_component, validate_template_exists

ConflictPolicy = Literal["fail", "skip", "rename", "overwrite"]
PresetType = Literal["template", "snapshot"]

_ALLOWED_COMPONENT_TYPES = {"skill", "agent", "command", "hook", "rule"}
_ALLOWED_PLATFORMS = {"claude_code", "cursor"}
_ALLOWED_POLICIES = {"fail", "skip", "rename", "overwrite"}

_MAX_COMPONENTS_PER_PRESET = 200
_MAX_ITEM_CONTENT_BYTES = 256 * 1024
_MAX_PRESET_CONTENT_BYTES = 5 * 1024 * 1024


class ProjectTemplateError(Exception):
    """Base error for project template operations."""


class ProjectTemplateNotFoundError(ProjectTemplateError):
    """Raised when template is not found."""


class ProjectTemplateRevisionNotFoundError(ProjectTemplateError):
    """Raised when revision is not found."""


class ProjectTemplateSourceProjectNotFoundError(ProjectTemplateError):
    """Raised when source project is not found."""


class ProjectTemplateComponentSelectionError(ProjectTemplateError):
    """Raised when selected source components are invalid."""


class ProjectTemplateNameConflictError(ProjectTemplateError):
    """Raised when template name conflicts."""


class ProjectTemplateImmutableError(ProjectTemplateError):
    """Raised when attempting to modify a system template."""


class ProjectTemplateComponentsRequiredError(ProjectTemplateError):
    """Raised when components payload is empty."""


class ProjectTemplateValidationError(ProjectTemplateError):
    """Raised when payload values are invalid."""


class ProjectTemplatePayloadTooLargeError(ProjectTemplateError):
    """Raised when preset payload exceeds configured size limits."""


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _to_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def _from_json(value: str | None) -> Any:
    return json.loads(value) if value else None


def _to_frontmatter(content: str) -> dict[str, Any]:
    if not content.startswith("---"):
        return {}
    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}
    try:
        parsed = yaml.safe_load(parts[1].strip())
    except yaml.YAMLError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _hash_content(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _validate_component_name(name: str) -> str:
    stripped = name.strip()
    if not stripped:
        raise ProjectTemplateValidationError("component name is required")
    if ".." in stripped or "/" in stripped or "\\" in stripped:
        raise ProjectTemplateValidationError("component name must not contain path traversal or separators")
    if len(stripped) > 200:
        raise ProjectTemplateValidationError("component name must be <= 200 chars")
    return stripped


class ProjectTemplateRepository:
    """SQLite-backed repository for project templates."""

    def __init__(self, db: DatabaseManager):
        self._db = db

    @staticmethod
    def _template_row_to_response(row: tuple[Any, ...]) -> dict[str, Any]:
        tags = _from_json(row[5]) or []
        legacy_components = _from_json(row[6]) or []
        latest_component_count = int(row[12] or 0)
        component_count = latest_component_count if latest_component_count > 0 else len(legacy_components)

        return {
            "id": row[0],
            "name": row[1],
            "description": row[2],
            "scope": row[3],
            "preset_type": row[4],
            "tags": tags,
            "components": legacy_components,
            "version": row[7],
            "created_at": row[8],
            "updated_at": row[9],
            "latest_revision": int(row[10] or 1),
            "revisions_count": int(row[11] or 0),
            "component_count": component_count,
        }

    def _fetch_template_row(self, template_id: str) -> tuple[Any, ...] | None:
        conn = self._db.get_connection()
        return conn.execute(
            """
            SELECT
              t.id,
              t.name,
              t.description,
              t.scope,
              COALESCE(t.preset_type, 'template') AS preset_type,
              t.tags,
              t.components,
              t.version,
              t.created_at,
              t.updated_at,
              COALESCE((
                SELECT MAX(r.revision)
                FROM project_template_revisions r
                WHERE r.template_id = t.id
              ), 1) AS latest_revision,
              COALESCE((
                SELECT COUNT(*)
                FROM project_template_revisions r
                WHERE r.template_id = t.id
              ), 0) AS revisions_count,
              COALESCE((
                SELECT COUNT(*)
                FROM project_template_revision_items i
                JOIN project_template_revisions r ON i.revision_id = r.id
                WHERE r.template_id = t.id
                  AND r.revision = (
                    SELECT MAX(rr.revision) FROM project_template_revisions rr WHERE rr.template_id = t.id
                  )
              ), 0) AS latest_component_count
            FROM project_templates t
            WHERE t.id = ? AND t.deleted_at IS NULL
            """,
            (template_id,),
        ).fetchone()

    def list_templates(
        self,
        *,
        q: str | None = None,
        scope: str = "all",
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[dict[str, Any]], int]:
        conn = self._db.get_connection()

        where = ["t.deleted_at IS NULL"]
        params: list[Any] = []

        if scope in {"system", "user"}:
            where.append("t.scope = ?")
            params.append(scope)

        if q:
            where.append("(LOWER(t.name) LIKE ? OR LOWER(t.description) LIKE ?)")
            q_like = f"%{q.lower()}%"
            params.extend([q_like, q_like])

        where_sql = " AND ".join(where)
        total = conn.execute(f"SELECT COUNT(*) FROM project_templates t WHERE {where_sql}", params).fetchone()[0]

        rows = conn.execute(
            f"""
            SELECT
              t.id,
              t.name,
              t.description,
              t.scope,
              COALESCE(t.preset_type, 'template') AS preset_type,
              t.tags,
              t.components,
              t.version,
              t.created_at,
              t.updated_at,
              COALESCE((
                SELECT MAX(r.revision)
                FROM project_template_revisions r
                WHERE r.template_id = t.id
              ), 1) AS latest_revision,
              COALESCE((
                SELECT COUNT(*)
                FROM project_template_revisions r
                WHERE r.template_id = t.id
              ), 0) AS revisions_count,
              COALESCE((
                SELECT COUNT(*)
                FROM project_template_revision_items i
                JOIN project_template_revisions r ON i.revision_id = r.id
                WHERE r.template_id = t.id
                  AND r.revision = (
                    SELECT MAX(rr.revision) FROM project_template_revisions rr WHERE rr.template_id = t.id
                  )
              ), 0) AS latest_component_count
            FROM project_templates t
            WHERE {where_sql}
            ORDER BY CASE t.scope WHEN 'user' THEN 0 ELSE 1 END, t.updated_at DESC
            LIMIT ? OFFSET ?
            """,
            [*params, limit, offset],
        ).fetchall()

        return [self._template_row_to_response(row) for row in rows], total

    def get_template(self, template_id: str) -> dict[str, Any]:
        row = self._fetch_template_row(template_id)
        if row is None:
            raise ProjectTemplateNotFoundError(template_id)
        return self._template_row_to_response(row)

    def _normalize_components_for_revision(self, components: list[dict[str, Any]]) -> list[dict[str, Any]]:
        normalized: list[dict[str, Any]] = []
        if not components:
            raise ProjectTemplateComponentsRequiredError

        for index, item in enumerate(components):
            if not isinstance(item, dict):
                raise ProjectTemplateValidationError(f"component at index {index} must be object")

            component_type = str(item.get("component_type") or "").strip().lower()
            if component_type not in _ALLOWED_COMPONENT_TYPES:
                raise ProjectTemplateValidationError("invalid component_type")

            platform = str(item.get("platform") or "").strip().lower()
            if platform not in _ALLOWED_PLATFORMS:
                raise ProjectTemplateValidationError("invalid platform")

            name = _validate_component_name(str(item.get("name") or ""))
            description = str(item.get("description") or "")
            template_id = item.get("template_id")
            config = item.get("config") if isinstance(item.get("config"), dict) else {}

            content = item.get("content")
            if content is None and template_id:
                validate_template_exists(str(template_id))
                rendered_content, rendered_type, _ = render_component(
                    template_id=str(template_id),
                    name=name,
                    description=description,
                    config=config,
                )
                if rendered_type != component_type:
                    raise ProjectTemplateValidationError("template/component_type mismatch")
                content = rendered_content

            if content is None:
                content = ""
            content = str(content)

            frontmatter = item.get("frontmatter")
            if isinstance(frontmatter, str):
                try:
                    frontmatter = json.loads(frontmatter)
                except json.JSONDecodeError:
                    frontmatter = {}
            if not isinstance(frontmatter, dict):
                frontmatter = _to_frontmatter(content)

            raw_tags = item.get("tags")
            if isinstance(raw_tags, list):
                tags = list(dict.fromkeys([str(tag).strip() for tag in raw_tags if str(tag).strip()]))
            else:
                tags = []

            normalized.append(
                {
                    "order_index": int(item.get("order_index", index)),
                    "component_type": component_type,
                    "name": name,
                    "platform": platform,
                    "description": description,
                    "content": content,
                    "frontmatter": frontmatter,
                    "tags": tags,
                    "source_component_id": item.get("source_component_id"),
                    "template_id": str(template_id) if template_id else None,
                    "config": config,
                    "content_hash": _hash_content(content),
                }
            )

        seen = set()
        for item in normalized:
            key = (item["name"].lower(), item["component_type"], item["platform"])
            if key in seen:
                raise ProjectTemplateValidationError("duplicate component identity in preset")
            seen.add(key)

        return normalized

    @staticmethod
    def _to_legacy_components(components: list[dict[str, Any]]) -> list[dict[str, Any]]:
        result: list[dict[str, Any]] = []
        for component in components:
            result.append(
                {
                    "component_type": component["component_type"],
                    "name": component["name"],
                    "platform": component["platform"],
                    "description": component.get("description") or "",
                    "template_id": component.get("template_id"),
                    "config": component.get("config") or {},
                    "content": component.get("content") or "",
                    "frontmatter": component.get("frontmatter") or {},
                    "tags": component.get("tags") or [],
                    "source_component_id": component.get("source_component_id"),
                }
            )
        return result

    @staticmethod
    def _validate_size_constraints(components: list[dict[str, Any]]) -> None:
        if len(components) > _MAX_COMPONENTS_PER_PRESET:
            raise ProjectTemplatePayloadTooLargeError("too many components in preset")

        total_size = 0
        for component in components:
            content = str(component.get("content") or "")
            content_size = len(content.encode("utf-8"))
            if content_size > _MAX_ITEM_CONTENT_BYTES:
                raise ProjectTemplatePayloadTooLargeError("component content exceeds item size limit")
            total_size += content_size

        if total_size > _MAX_PRESET_CONTENT_BYTES:
            raise ProjectTemplatePayloadTooLargeError("preset total content exceeds size limit")

    def _append_revision(
        self,
        conn: sqlite3.Connection,
        *,
        template_id: str,
        preset_type: PresetType,
        components: list[dict[str, Any]],
        change_note: str | None,
        created_by: str | None,
        force_revision: int | None = None,
        created_at: str | None = None,
    ) -> int:
        if force_revision is None:
            row = conn.execute(
                "SELECT COALESCE(MAX(revision), 0) FROM project_template_revisions WHERE template_id = ?",
                (template_id,),
            ).fetchone()
            revision = int(row[0] or 0) + 1
        else:
            revision = force_revision

        revision_id = str(uuid.uuid4())
        now = created_at or _now_iso()
        conn.execute(
            """
            INSERT INTO project_template_revisions
            (id, template_id, revision, preset_type, created_at, created_by, change_note)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (revision_id, template_id, revision, preset_type, now, created_by, change_note),
        )

        ordered_components = sorted(components, key=lambda item: int(item.get("order_index", 0)))
        for index, component in enumerate(ordered_components):
            conn.execute(
                """
                INSERT INTO project_template_revision_items
                (id, revision_id, order_index, component_type, name, platform, description,
                 content, frontmatter_json, tags_json, source_component_id, template_id, config_json, content_hash)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    revision_id,
                    index,
                    component["component_type"],
                    component["name"],
                    component["platform"],
                    component.get("description") or "",
                    component.get("content") or "",
                    _to_json(component.get("frontmatter") or {}),
                    _to_json(component.get("tags") or []),
                    component.get("source_component_id"),
                    component.get("template_id"),
                    _to_json(component.get("config") or {}),
                    component.get("content_hash") or _hash_content(component.get("content") or ""),
                ),
            )

        return revision

    def create_template(
        self,
        *,
        name: str,
        description: str,
        tags: list[str] | None,
        components: list[dict[str, Any]],
        preset_type: PresetType = "template",
        change_note: str | None = None,
        created_by: str | None = None,
    ) -> dict[str, Any]:
        normalized = self._normalize_components_for_revision(components)
        self._validate_size_constraints(normalized)
        conn = self._db.get_connection()

        duplicate = conn.execute(
            "SELECT id FROM project_templates WHERE LOWER(name) = LOWER(?) AND deleted_at IS NULL",
            (name,),
        ).fetchone()
        if duplicate:
            raise ProjectTemplateNameConflictError(name)

        template_id = f"preset-{uuid.uuid4().hex[:10]}"
        now = _now_iso()
        conn.execute(
            """
            INSERT INTO project_templates
            (id, name, description, scope, preset_type, tags, components, version, created_at, updated_at, deleted_at)
            VALUES (?, ?, ?, 'user', ?, ?, ?, 1, ?, ?, NULL)
            """,
            (
                template_id,
                name.strip(),
                description.strip(),
                preset_type,
                _to_json(tags or []),
                _to_json(self._to_legacy_components(normalized)),
                now,
                now,
            ),
        )
        self._append_revision(
            conn,
            template_id=template_id,
            preset_type=preset_type,
            components=normalized,
            change_note=change_note or "initial revision",
            created_by=created_by,
            force_revision=1,
            created_at=now,
        )
        conn.commit()
        return self.get_template(template_id)

    def _next_available_name(self, conn: sqlite3.Connection, base_name: str) -> str:
        candidate = base_name.strip()
        suffix = 1
        while True:
            exists = conn.execute(
                "SELECT 1 FROM project_templates WHERE LOWER(name) = LOWER(?) AND deleted_at IS NULL",
                (candidate,),
            ).fetchone()
            if not exists:
                return candidate
            candidate = f"{base_name.strip()}-{suffix}"
            suffix += 1

    def create_template_from_project(
        self,
        *,
        source_project_id: str,
        name: str,
        description: str,
        tags: list[str] | None,
        component_ids: list[str],
        include_disabled: bool = False,
        conflict_if_name_exists: bool = True,
        created_by: str | None = None,
    ) -> dict[str, Any]:
        selected_ids = list(
            dict.fromkeys([component_id.strip() for component_id in component_ids if component_id.strip()])
        )
        if not selected_ids:
            raise ProjectTemplateComponentsRequiredError
        if len(selected_ids) > _MAX_COMPONENTS_PER_PRESET:
            raise ProjectTemplatePayloadTooLargeError("too many components in preset")

        conn = self._db.get_connection()
        project_row = conn.execute("SELECT id FROM projects WHERE id = ?", (source_project_id,)).fetchone()
        if project_row is None:
            raise ProjectTemplateSourceProjectNotFoundError(source_project_id)

        duplicate_name = conn.execute(
            "SELECT id FROM project_templates WHERE LOWER(name) = LOWER(?) AND deleted_at IS NULL",
            (name,),
        ).fetchone()
        if duplicate_name and conflict_if_name_exists:
            raise ProjectTemplateNameConflictError(name)
        resolved_name = self._next_available_name(conn, name) if duplicate_name else name

        placeholders = ",".join(["?"] * len(selected_ids))
        enabled_clause = "" if include_disabled else " AND c.enabled = 1"
        rows = conn.execute(
            f"""
            SELECT c.id, c.type, c.name, c.description, c.platform, c.content, c.frontmatter
            FROM components c
            WHERE c.project_id = ?
              AND c.deleted_at IS NULL
              {enabled_clause}
              AND c.id IN ({placeholders})
            """,
            [source_project_id, *selected_ids],
        ).fetchall()

        fetched_ids = {row[0] for row in rows}
        missing_ids = [component_id for component_id in selected_ids if component_id not in fetched_ids]
        if missing_ids:
            raise ProjectTemplateComponentSelectionError(f"invalid component_ids: {', '.join(missing_ids)}")

        tag_rows = conn.execute(
            f"SELECT component_id, tag FROM tags WHERE component_id IN ({placeholders})",
            selected_ids,
        ).fetchall()
        tags_by_component: dict[str, list[str]] = {}
        for component_id, tag in tag_rows:
            tags_by_component.setdefault(component_id, []).append(tag)

        component_map = {row[0]: row for row in rows}
        snapshot_components: list[dict[str, Any]] = []
        for index, component_id in enumerate(selected_ids):
            row = component_map[component_id]
            frontmatter = _from_json(row[6]) if row[6] else {}
            if not isinstance(frontmatter, dict):
                frontmatter = {}
            snapshot_components.append(
                {
                    "order_index": index,
                    "component_type": row[1],
                    "name": row[2],
                    "description": row[3] or "",
                    "platform": row[4],
                    "content": row[5] or "",
                    "frontmatter": frontmatter,
                    "tags": tags_by_component.get(component_id, []),
                    "source_component_id": component_id,
                    "template_id": None,
                    "config": {},
                }
            )

        return self.create_template(
            name=resolved_name,
            description=description,
            tags=tags,
            components=snapshot_components,
            preset_type="snapshot",
            change_note="created from project components",
            created_by=created_by,
        )

    def update_template(
        self,
        template_id: str,
        *,
        name: str,
        description: str,
        tags: list[str] | None,
        components: list[dict[str, Any]],
        change_note: str | None = None,
        created_by: str | None = None,
    ) -> dict[str, Any]:
        current = self.get_template(template_id)
        if current["scope"] == "system":
            raise ProjectTemplateImmutableError(template_id)

        normalized = self._normalize_components_for_revision(components)
        self._validate_size_constraints(normalized)

        conn = self._db.get_connection()
        duplicate = conn.execute(
            "SELECT id FROM project_templates WHERE LOWER(name) = LOWER(?) AND id <> ? AND deleted_at IS NULL",
            (name, template_id),
        ).fetchone()
        if duplicate:
            raise ProjectTemplateNameConflictError(name)

        now = _now_iso()
        conn.execute(
            """
            UPDATE project_templates
            SET name = ?, description = ?, tags = ?, components = ?, version = version + 1, updated_at = ?
            WHERE id = ? AND deleted_at IS NULL
            """,
            (
                name.strip(),
                description.strip(),
                _to_json(tags or []),
                _to_json(self._to_legacy_components(normalized)),
                now,
                template_id,
            ),
        )
        self._append_revision(
            conn,
            template_id=template_id,
            preset_type=current["preset_type"],
            components=normalized,
            change_note=change_note or "template updated",
            created_by=created_by,
            created_at=now,
        )
        conn.commit()
        return self.get_template(template_id)

    def delete_template(self, template_id: str) -> None:
        current = self.get_template(template_id)
        if current["scope"] == "system":
            raise ProjectTemplateImmutableError(template_id)

        conn = self._db.get_connection()
        conn.execute(
            "UPDATE project_templates SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
            (_now_iso(), _now_iso(), template_id),
        )
        conn.commit()

    def list_revisions(self, template_id: str, *, limit: int = 50, offset: int = 0) -> tuple[list[dict[str, Any]], int]:
        self.get_template(template_id)
        conn = self._db.get_connection()
        total = conn.execute(
            "SELECT COUNT(*) FROM project_template_revisions WHERE template_id = ?",
            (template_id,),
        ).fetchone()[0]

        rows = conn.execute(
            """
            SELECT
              r.revision,
              r.preset_type,
              r.created_at,
              r.created_by,
              r.change_note,
              COALESCE((
                SELECT COUNT(*)
                FROM project_template_revision_items i
                WHERE i.revision_id = r.id
              ), 0) AS item_count
            FROM project_template_revisions r
            WHERE r.template_id = ?
            ORDER BY r.revision DESC
            LIMIT ? OFFSET ?
            """,
            (template_id, limit, offset),
        ).fetchall()

        items = [
            {
                "revision": int(row[0]),
                "preset_type": row[1],
                "created_at": row[2],
                "created_by": row[3],
                "change_note": row[4] or "",
                "item_count": int(row[5] or 0),
            }
            for row in rows
        ]
        return items, total

    def get_revision(self, template_id: str, revision: int | None = None) -> dict[str, Any]:
        self.get_template(template_id)
        conn = self._db.get_connection()

        if revision is None:
            revision_row = conn.execute(
                """
                SELECT id, revision, preset_type, created_at, created_by, change_note
                FROM project_template_revisions
                WHERE template_id = ?
                ORDER BY revision DESC
                LIMIT 1
                """,
                (template_id,),
            ).fetchone()
        else:
            revision_row = conn.execute(
                """
                SELECT id, revision, preset_type, created_at, created_by, change_note
                FROM project_template_revisions
                WHERE template_id = ? AND revision = ?
                """,
                (template_id, revision),
            ).fetchone()

        if revision_row is None:
            raise ProjectTemplateRevisionNotFoundError(f"{template_id}:{revision}")

        revision_id = revision_row[0]
        item_rows = conn.execute(
            """
            SELECT order_index, component_type, name, platform, description, content,
                   frontmatter_json, tags_json, source_component_id, template_id, config_json, content_hash
            FROM project_template_revision_items
            WHERE revision_id = ?
            ORDER BY order_index ASC
            """,
            (revision_id,),
        ).fetchall()

        items = [
            {
                "order_index": int(row[0]),
                "component_type": row[1],
                "name": row[2],
                "platform": row[3],
                "description": row[4] or "",
                "content": row[5] or "",
                "frontmatter": _from_json(row[6]) or {},
                "tags": _from_json(row[7]) or [],
                "source_component_id": row[8],
                "template_id": row[9],
                "config": _from_json(row[10]) or {},
                "content_hash": row[11],
            }
            for row in item_rows
        ]

        return {
            "template_id": template_id,
            "revision": int(revision_row[1]),
            "preset_type": revision_row[2],
            "created_at": revision_row[3],
            "created_by": revision_row[4],
            "change_note": revision_row[5] or "",
            "items": items,
            "item_count": len(items),
        }

    def restore_revision(
        self,
        template_id: str,
        *,
        revision: int,
        change_note: str | None = None,
        created_by: str | None = None,
    ) -> dict[str, Any]:
        current = self.get_template(template_id)
        if current["scope"] == "system":
            raise ProjectTemplateImmutableError(template_id)

        source_revision = self.get_revision(template_id, revision)
        normalized = self._normalize_components_for_revision(source_revision["items"])
        self._validate_size_constraints(normalized)

        conn = self._db.get_connection()
        now = _now_iso()
        conn.execute(
            """
            UPDATE project_templates
            SET components = ?, version = version + 1, updated_at = ?
            WHERE id = ? AND deleted_at IS NULL
            """,
            (_to_json(self._to_legacy_components(normalized)), now, template_id),
        )
        new_revision = self._append_revision(
            conn,
            template_id=template_id,
            preset_type=current["preset_type"],
            components=normalized,
            change_note=change_note or f"restore revision {revision}",
            created_by=created_by,
            created_at=now,
        )
        conn.commit()
        return self.get_revision(template_id, new_revision)

    def log_apply_result(
        self,
        *,
        project_id: str,
        preset_id: str,
        revision: int,
        policy: ConflictPolicy,
        status: Literal["preview", "applied", "failed"],
        summary: dict[str, Any],
        created_by: str | None = None,
    ) -> None:
        if policy not in _ALLOWED_POLICIES:
            raise ProjectTemplateValidationError("invalid conflict_policy")

        conn = self._db.get_connection()
        conn.execute(
            """
            INSERT INTO preset_apply_logs
            (id, project_id, preset_id, revision, policy, status, summary_json, created_at, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                project_id,
                preset_id,
                revision,
                policy,
                status,
                _to_json(summary),
                _now_iso(),
                created_by,
            ),
        )
        conn.commit()

    def get_last_policy_for_project(self, project_id: str) -> ConflictPolicy | None:
        conn = self._db.get_connection()
        row = conn.execute(
            """
            SELECT policy
            FROM preset_apply_logs
            WHERE project_id = ? AND status IN ('applied', 'failed')
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (project_id,),
        ).fetchone()
        if row is None:
            return None
        policy = str(row[0])
        if policy not in _ALLOWED_POLICIES:
            return None
        return policy  # type: ignore[return-value]
