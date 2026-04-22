"""Preset/Collection V1 repository."""

from __future__ import annotations

import hashlib
import json
import sqlite3
import uuid
from datetime import UTC, datetime
from typing import Any, Literal

import yaml
from vibesmith_core.infra.db import DatabaseManager

ConflictPolicy = Literal["fail", "skip", "rename", "overwrite"]
PinMode = Literal["pin", "latest"]

_ALLOWED_COMPONENT_TYPES = {"skill", "agent", "command", "hook", "rule"}
_ALLOWED_PLATFORMS = {"claude_code", "cursor"}
_ALLOWED_SCOPES = {"system", "user"}
_ALLOWED_PIN_MODES = {"pin", "latest"}
_ALLOWED_POLICIES = {"fail", "skip", "rename", "overwrite"}
_ALLOWED_LOG_STATUS = {"preview", "applied", "failed"}

_MAX_CONTENT_BYTES = 256 * 1024


class PresetCollectionError(Exception):
    """Base error for preset/collection operations."""


class PresetNotFoundError(PresetCollectionError):
    """Raised when preset is not found."""


class PresetRevisionNotFoundError(PresetCollectionError):
    """Raised when preset revision is not found."""


class PresetNameConflictError(PresetCollectionError):
    """Raised when preset name conflicts."""


class PresetImmutableError(PresetCollectionError):
    """Raised when attempting to modify an immutable preset."""


class PresetSourceProjectNotFoundError(PresetCollectionError):
    """Raised when source project is not found."""


class PresetSourceComponentNotFoundError(PresetCollectionError):
    """Raised when source component is not found."""


class CollectionNotFoundError(PresetCollectionError):
    """Raised when collection is not found."""


class CollectionRevisionNotFoundError(PresetCollectionError):
    """Raised when collection revision is not found."""


class CollectionNameConflictError(PresetCollectionError):
    """Raised when collection name conflicts."""


class CollectionImmutableError(PresetCollectionError):
    """Raised when attempting to modify an immutable collection."""


class PresetCollectionValidationError(PresetCollectionError):
    """Raised when payload validation fails."""


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


def _validate_name(name: str) -> str:
    stripped = name.strip()
    if not stripped:
        raise PresetCollectionValidationError("name is required")
    if ".." in stripped or "/" in stripped or "\\" in stripped:
        raise PresetCollectionValidationError("name must not contain path traversal or separators")
    if len(stripped) > 200:
        raise PresetCollectionValidationError("name must be <= 200 chars")
    return stripped


def _normalize_tags(raw_tags: list[str] | None) -> list[str]:
    if not raw_tags:
        return []
    return list(dict.fromkeys([str(tag).strip() for tag in raw_tags if str(tag).strip()]))


class PresetCollectionRepository:
    """SQLite-backed repository for Preset/Collection V1."""

    def __init__(self, db: DatabaseManager):
        self._db = db

    @staticmethod
    def _preset_row_to_summary(row: tuple[Any, ...]) -> dict[str, Any]:
        return {
            "id": row[0],
            "name": row[1],
            "component_type": row[2],
            "platform": row[3],
            "description": row[4],
            "scope": row[5],
            "tags": _from_json(row[6]) or [],
            "latest_revision": int(row[7] or 0),
            "created_at": row[8],
            "updated_at": row[9],
            "revisions_count": int(row[10] or 0),
        }

    @staticmethod
    def _collection_row_to_summary(row: tuple[Any, ...]) -> dict[str, Any]:
        return {
            "id": row[0],
            "name": row[1],
            "description": row[2],
            "scope": row[3],
            "tags": _from_json(row[4]) or [],
            "latest_revision": int(row[5] or 0),
            "created_at": row[6],
            "updated_at": row[7],
            "revisions_count": int(row[8] or 0),
            "items_count": int(row[9] or 0),
        }

    def _fetch_preset_row(self, preset_id: str) -> tuple[Any, ...] | None:
        conn = self._db.get_connection()
        return conn.execute(
            """
            SELECT
              p.id,
              p.name,
              p.component_type,
              p.platform,
              p.description,
              p.scope,
              p.tags,
              p.latest_revision,
              p.created_at,
              p.updated_at,
              COALESCE((SELECT COUNT(*) FROM preset_revisions r WHERE r.preset_id = p.id), 0) AS revisions_count
            FROM presets p
            WHERE p.id = ? AND p.deleted_at IS NULL
            """,
            (preset_id,),
        ).fetchone()

    def _fetch_collection_row(self, collection_id: str) -> tuple[Any, ...] | None:
        conn = self._db.get_connection()
        return conn.execute(
            """
            SELECT
              c.id,
              c.name,
              c.description,
              c.scope,
              c.tags,
              c.latest_revision,
              c.created_at,
              c.updated_at,
              COALESCE(
                (SELECT COUNT(*) FROM collection_revisions r WHERE r.collection_id = c.id),
                0
              ) AS revisions_count,
              COALESCE((SELECT COUNT(*) FROM collection_items i WHERE i.collection_id = c.id), 0) AS items_count
            FROM collections c
            WHERE c.id = ? AND c.deleted_at IS NULL
            """,
            (collection_id,),
        ).fetchone()

    def get_preset(self, preset_id: str) -> dict[str, Any]:
        row = self._fetch_preset_row(preset_id)
        if row is None:
            raise PresetNotFoundError(preset_id)
        return self._preset_row_to_summary(row)

    def list_presets(
        self,
        *,
        q: str | None = None,
        scope: str = "all",
        component_type: str | None = None,
        platform: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[dict[str, Any]], int]:
        conn = self._db.get_connection()

        where = ["p.deleted_at IS NULL"]
        params: list[Any] = []

        if scope in _ALLOWED_SCOPES:
            where.append("p.scope = ?")
            params.append(scope)

        if component_type:
            normalized_type = str(component_type).strip().lower()
            if normalized_type not in _ALLOWED_COMPONENT_TYPES:
                raise PresetCollectionValidationError("invalid component_type")
            where.append("p.component_type = ?")
            params.append(normalized_type)

        if platform:
            normalized_platform = str(platform).strip().lower()
            if normalized_platform not in _ALLOWED_PLATFORMS:
                raise PresetCollectionValidationError("invalid platform")
            where.append("p.platform = ?")
            params.append(normalized_platform)

        if q:
            where.append("(LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ?)")
            q_like = f"%{q.lower()}%"
            params.extend([q_like, q_like])

        where_sql = " AND ".join(where)
        total = conn.execute(f"SELECT COUNT(*) FROM presets p WHERE {where_sql}", params).fetchone()[0]

        rows = conn.execute(
            f"""
            SELECT
              p.id,
              p.name,
              p.component_type,
              p.platform,
              p.description,
              p.scope,
              p.tags,
              p.latest_revision,
              p.created_at,
              p.updated_at,
              COALESCE((SELECT COUNT(*) FROM preset_revisions r WHERE r.preset_id = p.id), 0) AS revisions_count
            FROM presets p
            WHERE {where_sql}
            ORDER BY CASE p.scope WHEN 'user' THEN 0 ELSE 1 END, p.updated_at DESC
            LIMIT ? OFFSET ?
            """,
            [*params, limit, offset],
        ).fetchall()

        return [self._preset_row_to_summary(row) for row in rows], total

    def _append_preset_revision(
        self,
        conn: sqlite3.Connection,
        *,
        preset_id: str,
        content: str,
        frontmatter: dict[str, Any],
        tags: list[str],
        change_note: str | None,
        created_by: str | None,
        force_revision: int | None = None,
        created_at: str | None = None,
    ) -> int:
        if force_revision is None:
            row = conn.execute(
                "SELECT COALESCE(MAX(revision), 0) FROM preset_revisions WHERE preset_id = ?",
                (preset_id,),
            ).fetchone()
            revision = int(row[0] or 0) + 1
        else:
            revision = force_revision

        now = created_at or _now_iso()
        conn.execute(
            """
            INSERT INTO preset_revisions
            (
              id,
              preset_id,
              revision,
              content,
              frontmatter_json,
              tags_json,
              content_hash,
              change_note,
              created_at,
              created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                preset_id,
                revision,
                content,
                _to_json(frontmatter),
                _to_json(tags),
                _hash_content(content),
                change_note,
                now,
                created_by,
            ),
        )
        return revision

    def _assert_preset_unique_identity(
        self,
        conn: sqlite3.Connection,
        *,
        name: str,
        component_type: str,
        platform: str,
        scope: str,
        exclude_id: str | None = None,
    ) -> None:
        if exclude_id:
            row = conn.execute(
                """
                SELECT id
                FROM presets
                WHERE LOWER(name) = LOWER(?)
                  AND component_type = ?
                  AND platform = ?
                  AND scope = ?
                  AND id <> ?
                  AND deleted_at IS NULL
                """,
                (name, component_type, platform, scope, exclude_id),
            ).fetchone()
        else:
            row = conn.execute(
                """
                SELECT id
                FROM presets
                WHERE LOWER(name) = LOWER(?)
                  AND component_type = ?
                  AND platform = ?
                  AND scope = ?
                  AND deleted_at IS NULL
                """,
                (name, component_type, platform, scope),
            ).fetchone()

        if row:
            raise PresetNameConflictError(name)

    def create_preset(
        self,
        *,
        name: str,
        component_type: str,
        platform: str,
        description: str,
        scope: str = "user",
        tags: list[str] | None,
        content: str,
        frontmatter: dict[str, Any] | None,
        change_note: str | None = None,
        created_by: str | None = None,
    ) -> dict[str, Any]:
        normalized_name = _validate_name(name)
        normalized_component_type = str(component_type).strip().lower()
        normalized_platform = str(platform).strip().lower()
        normalized_scope = str(scope).strip().lower()
        normalized_content = str(content)

        if normalized_component_type not in _ALLOWED_COMPONENT_TYPES:
            raise PresetCollectionValidationError("invalid component_type")
        if normalized_platform not in _ALLOWED_PLATFORMS:
            raise PresetCollectionValidationError("invalid platform")
        if normalized_scope not in _ALLOWED_SCOPES:
            raise PresetCollectionValidationError("invalid scope")
        if len(normalized_content.encode("utf-8")) > _MAX_CONTENT_BYTES:
            raise PresetCollectionValidationError("content exceeds size limit")

        normalized_tags = _normalize_tags(tags)
        normalized_frontmatter = frontmatter if isinstance(frontmatter, dict) else _to_frontmatter(normalized_content)

        conn = self._db.get_connection()
        self._assert_preset_unique_identity(
            conn,
            name=normalized_name,
            component_type=normalized_component_type,
            platform=normalized_platform,
            scope=normalized_scope,
            exclude_id=None,
        )

        preset_id = f"preset-{uuid.uuid4().hex[:10]}"
        now = _now_iso()

        conn.execute(
            """
            INSERT INTO presets
            (
              id,
              name,
              component_type,
              platform,
              description,
              scope,
              tags,
              latest_revision,
              created_at,
              updated_at,
              deleted_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL)
            """,
            (
                preset_id,
                normalized_name,
                normalized_component_type,
                normalized_platform,
                description.strip(),
                normalized_scope,
                _to_json(normalized_tags),
                now,
                now,
            ),
        )

        latest_revision = self._append_preset_revision(
            conn,
            preset_id=preset_id,
            content=normalized_content,
            frontmatter=normalized_frontmatter,
            tags=normalized_tags,
            change_note=change_note or "initial revision",
            created_by=created_by,
            force_revision=1,
            created_at=now,
        )

        conn.execute(
            "UPDATE presets SET latest_revision = ?, updated_at = ? WHERE id = ?",
            (latest_revision, now, preset_id),
        )
        conn.commit()

        return self.get_preset(preset_id)

    def update_preset(
        self,
        preset_id: str,
        *,
        name: str,
        component_type: str,
        platform: str,
        description: str,
        scope: str,
        tags: list[str] | None,
        content: str,
        frontmatter: dict[str, Any] | None,
        change_note: str | None = None,
        created_by: str | None = None,
    ) -> dict[str, Any]:
        current = self.get_preset(preset_id)
        if current["scope"] == "system":
            raise PresetImmutableError(preset_id)

        normalized_name = _validate_name(name)
        normalized_component_type = str(component_type).strip().lower()
        normalized_platform = str(platform).strip().lower()
        normalized_scope = str(scope).strip().lower()
        normalized_content = str(content)

        if normalized_component_type not in _ALLOWED_COMPONENT_TYPES:
            raise PresetCollectionValidationError("invalid component_type")
        if normalized_platform not in _ALLOWED_PLATFORMS:
            raise PresetCollectionValidationError("invalid platform")
        if normalized_scope not in _ALLOWED_SCOPES:
            raise PresetCollectionValidationError("invalid scope")
        if len(normalized_content.encode("utf-8")) > _MAX_CONTENT_BYTES:
            raise PresetCollectionValidationError("content exceeds size limit")

        normalized_tags = _normalize_tags(tags)
        normalized_frontmatter = frontmatter if isinstance(frontmatter, dict) else _to_frontmatter(normalized_content)

        conn = self._db.get_connection()
        self._assert_preset_unique_identity(
            conn,
            name=normalized_name,
            component_type=normalized_component_type,
            platform=normalized_platform,
            scope=normalized_scope,
            exclude_id=preset_id,
        )

        now = _now_iso()
        latest_revision = self._append_preset_revision(
            conn,
            preset_id=preset_id,
            content=normalized_content,
            frontmatter=normalized_frontmatter,
            tags=normalized_tags,
            change_note=change_note or "preset updated",
            created_by=created_by,
            created_at=now,
        )

        conn.execute(
            """
            UPDATE presets
            SET name = ?,
                component_type = ?,
                platform = ?,
                description = ?,
                scope = ?,
                tags = ?,
                latest_revision = ?,
                updated_at = ?
            WHERE id = ? AND deleted_at IS NULL
            """,
            (
                normalized_name,
                normalized_component_type,
                normalized_platform,
                description.strip(),
                normalized_scope,
                _to_json(normalized_tags),
                latest_revision,
                now,
                preset_id,
            ),
        )
        conn.commit()

        return self.get_preset(preset_id)

    def delete_preset(self, preset_id: str) -> None:
        current = self.get_preset(preset_id)
        if current["scope"] == "system":
            raise PresetImmutableError(preset_id)

        now = _now_iso()
        conn = self._db.get_connection()
        conn.execute(
            "UPDATE presets SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
            (now, now, preset_id),
        )
        conn.commit()

    def list_preset_revisions(
        self,
        preset_id: str,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict[str, Any]], int]:
        self.get_preset(preset_id)
        conn = self._db.get_connection()
        total = conn.execute(
            "SELECT COUNT(*) FROM preset_revisions WHERE preset_id = ?",
            (preset_id,),
        ).fetchone()[0]

        rows = conn.execute(
            """
            SELECT revision, created_at, created_by, change_note, content_hash
            FROM preset_revisions
            WHERE preset_id = ?
            ORDER BY revision DESC
            LIMIT ? OFFSET ?
            """,
            (preset_id, limit, offset),
        ).fetchall()

        items = [
            {
                "revision": int(row[0]),
                "created_at": row[1],
                "created_by": row[2],
                "change_note": row[3] or "",
                "content_hash": row[4],
            }
            for row in rows
        ]
        return items, total

    def get_preset_revision(self, preset_id: str, revision: int | None = None) -> dict[str, Any]:
        self.get_preset(preset_id)
        conn = self._db.get_connection()

        if revision is None:
            row = conn.execute(
                """
                SELECT revision, content, frontmatter_json, tags_json, content_hash, created_at, created_by, change_note
                FROM preset_revisions
                WHERE preset_id = ?
                ORDER BY revision DESC
                LIMIT 1
                """,
                (preset_id,),
            ).fetchone()
        else:
            row = conn.execute(
                """
                SELECT revision, content, frontmatter_json, tags_json, content_hash, created_at, created_by, change_note
                FROM preset_revisions
                WHERE preset_id = ? AND revision = ?
                """,
                (preset_id, revision),
            ).fetchone()

        if row is None:
            raise PresetRevisionNotFoundError(f"{preset_id}:{revision}")

        return {
            "preset_id": preset_id,
            "revision": int(row[0]),
            "content": row[1] or "",
            "frontmatter": _from_json(row[2]) or {},
            "tags": _from_json(row[3]) or [],
            "content_hash": row[4],
            "created_at": row[5],
            "created_by": row[6],
            "change_note": row[7] or "",
        }

    def restore_preset_revision(
        self,
        preset_id: str,
        *,
        revision: int,
        change_note: str | None = None,
        created_by: str | None = None,
    ) -> dict[str, Any]:
        current = self.get_preset(preset_id)
        if current["scope"] == "system":
            raise PresetImmutableError(preset_id)

        source = self.get_preset_revision(preset_id, revision)
        conn = self._db.get_connection()
        now = _now_iso()

        latest_revision = self._append_preset_revision(
            conn,
            preset_id=preset_id,
            content=str(source["content"]),
            frontmatter=source["frontmatter"] if isinstance(source["frontmatter"], dict) else {},
            tags=_normalize_tags(source["tags"] if isinstance(source["tags"], list) else []),
            change_note=change_note or f"restore revision {revision}",
            created_by=created_by,
            created_at=now,
        )

        conn.execute(
            "UPDATE presets SET latest_revision = ?, updated_at = ? WHERE id = ?",
            (latest_revision, now, preset_id),
        )
        conn.commit()

        return self.get_preset_revision(preset_id, latest_revision)

    def _next_available_preset_name(
        self,
        conn: sqlite3.Connection,
        *,
        base_name: str,
        component_type: str,
        platform: str,
        scope: str,
    ) -> str:
        candidate = base_name.strip()
        suffix = 1
        while True:
            row = conn.execute(
                """
                SELECT 1
                FROM presets
                WHERE LOWER(name) = LOWER(?)
                  AND component_type = ?
                  AND platform = ?
                  AND scope = ?
                  AND deleted_at IS NULL
                """,
                (candidate, component_type, platform, scope),
            ).fetchone()
            if row is None:
                return candidate
            candidate = f"{base_name.strip()}-{suffix}"
            suffix += 1

    def create_preset_from_project(
        self,
        *,
        source_project_id: str,
        source_component_id: str,
        name: str,
        description: str | None,
        tags: list[str] | None,
        include_disabled: bool = False,
        conflict_if_name_exists: bool = True,
        scope: str = "user",
        change_note: str | None = None,
        created_by: str | None = None,
    ) -> dict[str, Any]:
        conn = self._db.get_connection()

        project_row = conn.execute("SELECT id FROM projects WHERE id = ?", (source_project_id,)).fetchone()
        if project_row is None:
            raise PresetSourceProjectNotFoundError(source_project_id)

        component_row = conn.execute(
            """
            SELECT id, type, name, description, platform, content, frontmatter, enabled
            FROM components
            WHERE id = ? AND project_id = ? AND deleted_at IS NULL
            """,
            (source_component_id, source_project_id),
        ).fetchone()
        if component_row is None:
            raise PresetSourceComponentNotFoundError(source_component_id)
        if not include_disabled and int(component_row[7] or 0) == 0:
            raise PresetSourceComponentNotFoundError(source_component_id)

        component_type = str(component_row[1]).strip().lower()
        platform = str(component_row[4]).strip().lower()
        resolved_scope = str(scope).strip().lower()
        resolved_name = _validate_name(name)

        if component_type not in _ALLOWED_COMPONENT_TYPES:
            raise PresetCollectionValidationError("invalid component_type")
        if platform not in _ALLOWED_PLATFORMS:
            raise PresetCollectionValidationError("invalid platform")
        if resolved_scope not in _ALLOWED_SCOPES:
            raise PresetCollectionValidationError("invalid scope")

        duplicate = conn.execute(
            """
            SELECT id
            FROM presets
            WHERE LOWER(name) = LOWER(?)
              AND component_type = ?
              AND platform = ?
              AND scope = ?
              AND deleted_at IS NULL
            """,
            (resolved_name, component_type, platform, resolved_scope),
        ).fetchone()
        if duplicate and conflict_if_name_exists:
            raise PresetNameConflictError(resolved_name)
        if duplicate:
            resolved_name = self._next_available_preset_name(
                conn,
                base_name=resolved_name,
                component_type=component_type,
                platform=platform,
                scope=resolved_scope,
            )

        tag_rows = conn.execute(
            "SELECT tag FROM tags WHERE component_id = ? ORDER BY tag ASC",
            (source_component_id,),
        ).fetchall()

        source_tags = [row[0] for row in tag_rows]
        merged_tags = _normalize_tags([*(tags or []), *source_tags])

        raw_frontmatter = _from_json(component_row[6]) if component_row[6] else {}
        if not isinstance(raw_frontmatter, dict):
            raw_frontmatter = {}

        resolved_description = (description or component_row[3] or "").strip()
        content = str(component_row[5] or "")

        return self.create_preset(
            name=resolved_name,
            component_type=component_type,
            platform=platform,
            description=resolved_description,
            scope=resolved_scope,
            tags=merged_tags,
            content=content,
            frontmatter=raw_frontmatter,
            change_note=change_note or "created from project component",
            created_by=created_by,
        )

    def get_collection(self, collection_id: str) -> dict[str, Any]:
        row = self._fetch_collection_row(collection_id)
        if row is None:
            raise CollectionNotFoundError(collection_id)
        return self._collection_row_to_summary(row)

    def list_collections(
        self,
        *,
        q: str | None = None,
        scope: str = "all",
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[dict[str, Any]], int]:
        conn = self._db.get_connection()

        where = ["c.deleted_at IS NULL"]
        params: list[Any] = []

        if scope in _ALLOWED_SCOPES:
            where.append("c.scope = ?")
            params.append(scope)

        if q:
            where.append("(LOWER(c.name) LIKE ? OR LOWER(c.description) LIKE ?)")
            q_like = f"%{q.lower()}%"
            params.extend([q_like, q_like])

        where_sql = " AND ".join(where)
        total = conn.execute(f"SELECT COUNT(*) FROM collections c WHERE {where_sql}", params).fetchone()[0]

        rows = conn.execute(
            f"""
            SELECT
              c.id,
              c.name,
              c.description,
              c.scope,
              c.tags,
              c.latest_revision,
              c.created_at,
              c.updated_at,
              COALESCE(
                (SELECT COUNT(*) FROM collection_revisions r WHERE r.collection_id = c.id),
                0
              ) AS revisions_count,
              COALESCE((SELECT COUNT(*) FROM collection_items i WHERE i.collection_id = c.id), 0) AS items_count
            FROM collections c
            WHERE {where_sql}
            ORDER BY CASE c.scope WHEN 'user' THEN 0 ELSE 1 END, c.updated_at DESC
            LIMIT ? OFFSET ?
            """,
            [*params, limit, offset],
        ).fetchall()

        return [self._collection_row_to_summary(row) for row in rows], total

    def _assert_collection_unique_name(
        self,
        conn: sqlite3.Connection,
        *,
        name: str,
        scope: str,
        exclude_id: str | None = None,
    ) -> None:
        if exclude_id:
            row = conn.execute(
                """
                SELECT id
                FROM collections
                WHERE LOWER(name) = LOWER(?)
                  AND scope = ?
                  AND id <> ?
                  AND deleted_at IS NULL
                """,
                (name, scope, exclude_id),
            ).fetchone()
        else:
            row = conn.execute(
                """
                SELECT id
                FROM collections
                WHERE LOWER(name) = LOWER(?)
                  AND scope = ?
                  AND deleted_at IS NULL
                """,
                (name, scope),
            ).fetchone()

        if row:
            raise CollectionNameConflictError(name)

    def _normalize_collection_items(
        self, conn: sqlite3.Connection, items: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        if not items:
            raise PresetCollectionValidationError("collection items are required")

        normalized: list[dict[str, Any]] = []

        for index, raw in enumerate(items):
            if not isinstance(raw, dict):
                raise PresetCollectionValidationError(f"item at index {index} must be object")

            preset_id = str(raw.get("preset_id") or "").strip()
            if not preset_id:
                raise PresetCollectionValidationError("preset_id is required")

            preset = self.get_preset(preset_id)
            latest_revision = int(preset.get("latest_revision") or 0)
            if latest_revision <= 0:
                raise PresetRevisionNotFoundError(f"{preset_id}:latest")

            pin_mode = str(raw.get("pin_mode") or "pin").strip().lower()
            if pin_mode not in _ALLOWED_PIN_MODES:
                raise PresetCollectionValidationError("invalid pin_mode")

            pinned_revision_raw = raw.get("pinned_revision")
            if pin_mode == "pin":
                if pinned_revision_raw is None:
                    pinned_revision = latest_revision
                else:
                    try:
                        pinned_revision = int(pinned_revision_raw)
                    except (TypeError, ValueError) as exc:
                        raise PresetCollectionValidationError("pinned_revision must be integer") from exc
                    if pinned_revision < 1:
                        raise PresetCollectionValidationError("pinned_revision must be >= 1")

                revision_exists = conn.execute(
                    "SELECT 1 FROM preset_revisions WHERE preset_id = ? AND revision = ?",
                    (preset_id, pinned_revision),
                ).fetchone()
                if revision_exists is None:
                    raise PresetRevisionNotFoundError(f"{preset_id}:{pinned_revision}")

                resolved_revision = pinned_revision
            else:
                pinned_revision = None
                resolved_revision = latest_revision

            alias_name = str(raw.get("alias_name") or "").strip() or None
            try:
                order_index = int(raw.get("order_index", index))
            except (TypeError, ValueError) as exc:
                raise PresetCollectionValidationError("order_index must be integer") from exc

            normalized.append(
                {
                    "preset_id": preset_id,
                    "pin_mode": pin_mode,
                    "pinned_revision": pinned_revision,
                    "resolved_revision": resolved_revision,
                    "alias_name": alias_name,
                    "order_index": order_index,
                }
            )

        normalized.sort(key=lambda item: int(item["order_index"]))
        for index, item in enumerate(normalized):
            item["order_index"] = index

        return normalized

    def _append_collection_revision(
        self,
        conn: sqlite3.Connection,
        *,
        collection_id: str,
        items: list[dict[str, Any]],
        change_note: str | None,
        created_by: str | None,
        force_revision: int | None = None,
        created_at: str | None = None,
    ) -> tuple[str, int]:
        if force_revision is None:
            row = conn.execute(
                "SELECT COALESCE(MAX(revision), 0) FROM collection_revisions WHERE collection_id = ?",
                (collection_id,),
            ).fetchone()
            revision = int(row[0] or 0) + 1
        else:
            revision = force_revision

        revision_id = str(uuid.uuid4())
        now = created_at or _now_iso()
        conn.execute(
            """
            INSERT INTO collection_revisions
            (id, collection_id, revision, created_at, created_by, change_note)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (revision_id, collection_id, revision, now, created_by, change_note),
        )

        for item in items:
            conn.execute(
                """
                INSERT INTO collection_revision_items
                (
                  id,
                  collection_revision_id,
                  order_index,
                  preset_id,
                  pin_mode,
                  pinned_revision,
                  resolved_revision,
                  alias_name
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    revision_id,
                    int(item["order_index"]),
                    item["preset_id"],
                    item["pin_mode"],
                    item.get("pinned_revision"),
                    int(item["resolved_revision"]),
                    item.get("alias_name"),
                ),
            )

        return revision_id, revision

    def _replace_collection_items(
        self,
        conn: sqlite3.Connection,
        *,
        collection_id: str,
        items: list[dict[str, Any]],
    ) -> None:
        conn.execute("DELETE FROM collection_items WHERE collection_id = ?", (collection_id,))
        for item in items:
            conn.execute(
                """
                INSERT INTO collection_items
                (id, collection_id, order_index, preset_id, pin_mode, pinned_revision, alias_name)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    collection_id,
                    int(item["order_index"]),
                    item["preset_id"],
                    item["pin_mode"],
                    item.get("pinned_revision"),
                    item.get("alias_name"),
                ),
            )

    def create_collection(
        self,
        *,
        name: str,
        description: str,
        scope: str,
        tags: list[str] | None,
        items: list[dict[str, Any]],
        change_note: str | None = None,
        created_by: str | None = None,
    ) -> dict[str, Any]:
        normalized_name = _validate_name(name)
        normalized_scope = str(scope).strip().lower()
        if normalized_scope not in _ALLOWED_SCOPES:
            raise PresetCollectionValidationError("invalid scope")

        normalized_tags = _normalize_tags(tags)
        conn = self._db.get_connection()

        self._assert_collection_unique_name(conn, name=normalized_name, scope=normalized_scope, exclude_id=None)
        normalized_items = self._normalize_collection_items(conn, items)

        collection_id = f"collection-{uuid.uuid4().hex[:10]}"
        now = _now_iso()

        conn.execute(
            """
            INSERT INTO collections
            (id, name, description, scope, tags, latest_revision, created_at, updated_at, deleted_at)
            VALUES (?, ?, ?, ?, ?, 0, ?, ?, NULL)
            """,
            (
                collection_id,
                normalized_name,
                description.strip(),
                normalized_scope,
                _to_json(normalized_tags),
                now,
                now,
            ),
        )

        self._replace_collection_items(conn, collection_id=collection_id, items=normalized_items)

        _, latest_revision = self._append_collection_revision(
            conn,
            collection_id=collection_id,
            items=normalized_items,
            change_note=change_note or "initial revision",
            created_by=created_by,
            force_revision=1,
            created_at=now,
        )

        conn.execute(
            "UPDATE collections SET latest_revision = ?, updated_at = ? WHERE id = ?",
            (latest_revision, now, collection_id),
        )
        conn.commit()

        return self.get_collection(collection_id)

    def update_collection(
        self,
        collection_id: str,
        *,
        name: str,
        description: str,
        scope: str,
        tags: list[str] | None,
        items: list[dict[str, Any]],
        change_note: str | None = None,
        created_by: str | None = None,
    ) -> dict[str, Any]:
        current = self.get_collection(collection_id)
        if current["scope"] == "system":
            raise CollectionImmutableError(collection_id)

        normalized_name = _validate_name(name)
        normalized_scope = str(scope).strip().lower()
        if normalized_scope not in _ALLOWED_SCOPES:
            raise PresetCollectionValidationError("invalid scope")

        normalized_tags = _normalize_tags(tags)
        conn = self._db.get_connection()

        self._assert_collection_unique_name(
            conn,
            name=normalized_name,
            scope=normalized_scope,
            exclude_id=collection_id,
        )
        normalized_items = self._normalize_collection_items(conn, items)
        self._replace_collection_items(conn, collection_id=collection_id, items=normalized_items)

        now = _now_iso()
        _, latest_revision = self._append_collection_revision(
            conn,
            collection_id=collection_id,
            items=normalized_items,
            change_note=change_note or "collection updated",
            created_by=created_by,
            created_at=now,
        )

        conn.execute(
            """
            UPDATE collections
            SET name = ?,
                description = ?,
                scope = ?,
                tags = ?,
                latest_revision = ?,
                updated_at = ?
            WHERE id = ? AND deleted_at IS NULL
            """,
            (
                normalized_name,
                description.strip(),
                normalized_scope,
                _to_json(normalized_tags),
                latest_revision,
                now,
                collection_id,
            ),
        )
        conn.commit()

        return self.get_collection(collection_id)

    def delete_collection(self, collection_id: str) -> None:
        current = self.get_collection(collection_id)
        if current["scope"] == "system":
            raise CollectionImmutableError(collection_id)

        now = _now_iso()
        conn = self._db.get_connection()
        conn.execute(
            "UPDATE collections SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
            (now, now, collection_id),
        )
        conn.commit()

    def list_collection_revisions(
        self,
        collection_id: str,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict[str, Any]], int]:
        self.get_collection(collection_id)
        conn = self._db.get_connection()

        total = conn.execute(
            "SELECT COUNT(*) FROM collection_revisions WHERE collection_id = ?",
            (collection_id,),
        ).fetchone()[0]

        rows = conn.execute(
            """
            SELECT
              r.id,
              r.revision,
              r.created_at,
              r.created_by,
              r.change_note,
              COALESCE(
                (SELECT COUNT(*) FROM collection_revision_items i WHERE i.collection_revision_id = r.id),
                0
              ) AS item_count
            FROM collection_revisions r
            WHERE r.collection_id = ?
            ORDER BY r.revision DESC
            LIMIT ? OFFSET ?
            """,
            (collection_id, limit, offset),
        ).fetchall()

        items = [
            {
                "revision": int(row[1]),
                "created_at": row[2],
                "created_by": row[3],
                "change_note": row[4] or "",
                "item_count": int(row[5] or 0),
            }
            for row in rows
        ]

        return items, total

    def get_collection_revision(self, collection_id: str, revision: int | None = None) -> dict[str, Any]:
        self.get_collection(collection_id)
        conn = self._db.get_connection()

        if revision is None:
            revision_row = conn.execute(
                """
                SELECT id, revision, created_at, created_by, change_note
                FROM collection_revisions
                WHERE collection_id = ?
                ORDER BY revision DESC
                LIMIT 1
                """,
                (collection_id,),
            ).fetchone()
        else:
            revision_row = conn.execute(
                """
                SELECT id, revision, created_at, created_by, change_note
                FROM collection_revisions
                WHERE collection_id = ? AND revision = ?
                """,
                (collection_id, revision),
            ).fetchone()

        if revision_row is None:
            raise CollectionRevisionNotFoundError(f"{collection_id}:{revision}")

        revision_id = revision_row[0]
        item_rows = conn.execute(
            """
            SELECT cri.order_index, cri.preset_id, cri.pin_mode, cri.pinned_revision,
                   cri.resolved_revision, cri.alias_name, p.name AS preset_name
            FROM collection_revision_items cri
            LEFT JOIN presets p ON p.id = cri.preset_id
            WHERE cri.collection_revision_id = ?
            ORDER BY cri.order_index ASC
            """,
            (revision_id,),
        ).fetchall()

        items = [
            {
                "order_index": int(row[0]),
                "preset_id": row[1],
                "pin_mode": row[2],
                "pinned_revision": int(row[3]) if row[3] is not None else None,
                "resolved_revision": int(row[4]),
                "alias_name": row[5],
                "preset_name": row[6],
            }
            for row in item_rows
        ]

        return {
            "collection_id": collection_id,
            "revision_id": revision_id,
            "revision": int(revision_row[1]),
            "created_at": revision_row[2],
            "created_by": revision_row[3],
            "change_note": revision_row[4] or "",
            "item_count": len(items),
            "items": items,
        }

    def resolve_collection_components(
        self,
        collection_id: str,
        *,
        revision: int | None = None,
    ) -> dict[str, Any]:
        collection = self.get_collection(collection_id)
        revision_info = self.get_collection_revision(collection_id, revision)

        resolved_items: list[dict[str, Any]] = []
        for item in revision_info["items"]:
            preset = self.get_preset(item["preset_id"])
            if item["pin_mode"] == "latest":
                resolved_revision = int(preset.get("latest_revision") or 0)
            else:
                resolved_revision = int(item.get("pinned_revision") or item["resolved_revision"])

            if resolved_revision < 1:
                raise PresetRevisionNotFoundError(f"{item['preset_id']}:latest")

            preset_revision = self.get_preset_revision(item["preset_id"], resolved_revision)

            resolved_items.append(
                {
                    "preset_id": item["preset_id"],
                    "preset_revision": resolved_revision,
                    "name": item.get("alias_name") or preset["name"],
                    "component_type": preset["component_type"],
                    "platform": preset["platform"],
                    "description": preset["description"],
                    "content": preset_revision["content"],
                    "frontmatter": preset_revision["frontmatter"],
                    "tags": preset_revision["tags"],
                }
            )

        return {
            "collection": collection,
            "revision": revision_info,
            "items": resolved_items,
        }

    def log_apply_result(
        self,
        *,
        collection_id: str,
        collection_revision_id: str,
        project_id: str,
        policy: ConflictPolicy,
        status: Literal["preview", "applied", "failed"],
        summary: dict[str, Any],
        created_by: str | None = None,
    ) -> None:
        if policy not in _ALLOWED_POLICIES:
            raise PresetCollectionValidationError("invalid conflict_policy")
        if status not in _ALLOWED_LOG_STATUS:
            raise PresetCollectionValidationError("invalid status")

        conn = self._db.get_connection()
        conn.execute(
            """
            INSERT INTO collection_apply_logs
            (
              id,
              collection_id,
              collection_revision_id,
              project_id,
              policy,
              status,
              summary_json,
              created_at,
              created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                collection_id,
                collection_revision_id,
                project_id,
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
            FROM collection_apply_logs
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
