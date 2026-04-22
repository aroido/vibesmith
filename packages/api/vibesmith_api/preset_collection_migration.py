"""Legacy project_templates -> Preset/Collection V1 migration service."""

from __future__ import annotations

import hashlib
import json
import sqlite3
import uuid
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from typing import Any

_ALLOWED_COMPONENT_TYPES = {"skill", "agent", "command", "hook", "rule"}
_ALLOWED_PLATFORMS = {"claude_code", "cursor"}
_ALLOWED_SCOPES = {"system", "user"}
_LEGACY_POLICIES = {"fail", "skip", "rename", "overwrite"}
_LEGACY_LOG_STATUS = {"preview", "applied", "failed"}


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _to_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def _from_json(value: str | None) -> Any:
    if not value:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None


def _normalize_name(raw_name: str) -> str:
    name = str(raw_name or "").strip()
    if not name:
        return ""
    if ".." in name or "/" in name or "\\" in name:
        return ""
    return name[:200]


def _normalize_tags(raw_tags: Any) -> list[str]:
    if not isinstance(raw_tags, list):
        return []
    return list(dict.fromkeys([str(tag).strip() for tag in raw_tags if str(tag).strip()]))


def _normalize_frontmatter(raw: Any) -> dict[str, Any]:
    return raw if isinstance(raw, dict) else {}


def _namespaced_id(prefix: str, key: str, length: int = 12) -> str:
    digest = uuid.uuid5(uuid.NAMESPACE_DNS, key).hex[:length]
    return f"{prefix}-{digest}"


def _compose_name(base: str, suffix: str) -> str:
    trimmed = base.strip() or "migrated-item"
    max_base_len = max(1, 200 - len(suffix))
    return f"{trimmed[:max_base_len]}{suffix}"


@dataclass
class MigrationSummary:
    mode: str
    run_id: str
    started_at: str
    finished_at: str | None = None
    templates_scanned: int = 0
    templates_migrated: int = 0
    templates_skipped: int = 0
    collections_created: int = 0
    collections_updated: int = 0
    collection_revisions_created: int = 0
    collection_items_rewritten: int = 0
    presets_created: int = 0
    preset_revisions_created: int = 0
    apply_logs_migrated: int = 0
    malformed_rows: int = 0
    warnings: list[str] = field(default_factory=list)
    before_counts: dict[str, int] = field(default_factory=dict)
    after_counts: dict[str, int] = field(default_factory=dict)
    mismatches: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class LegacyPresetMigrationService:
    """Backfill legacy bundle presets to Preset/Collection V1 tables."""

    def __init__(self, source_conn: sqlite3.Connection):
        self._source_conn = source_conn
        self._source_conn.row_factory = sqlite3.Row

    def run(
        self,
        *,
        dry_run: bool = False,
        verify_only: bool = False,
        limit: int | None = None,
        template_id: str | None = None,
    ) -> dict[str, Any]:
        self._ensure_metadata_tables(self._source_conn)
        mode = "verify" if verify_only else ("dry-run" if dry_run else "real-run")
        run_id = self._create_run(mode=mode)

        summary = MigrationSummary(
            mode=mode,
            run_id=run_id,
            started_at=_now_iso(),
        )

        work_conn: sqlite3.Connection | None = None
        try:
            if verify_only:
                summary.before_counts = self._collect_counts(self._source_conn)
                summary.after_counts = dict(summary.before_counts)
                summary.mismatches = self._verify_integrity(self._source_conn)
            else:
                if dry_run:
                    work_conn = sqlite3.connect(":memory:")
                    work_conn.row_factory = sqlite3.Row
                    self._source_conn.backup(work_conn)
                    self._ensure_metadata_tables(work_conn)
                else:
                    work_conn = self._source_conn

                assert work_conn is not None
                summary.before_counts = self._collect_counts(work_conn)
                self._migrate_all(work_conn, summary=summary, limit=limit, template_id=template_id)
                summary.after_counts = self._collect_counts(work_conn)
                summary.mismatches = self._verify_integrity(work_conn)
        except Exception as error:
            summary.finished_at = _now_iso()
            self._finish_run(run_id=run_id, status="failed", summary=summary.to_dict(), error=str(error))
            raise
        finally:
            if work_conn is not None and dry_run:
                work_conn.close()

        summary.finished_at = _now_iso()
        self._finish_run(run_id=run_id, status="completed", summary=summary.to_dict(), error=None)
        return summary.to_dict()

    def _ensure_metadata_tables(self, conn: sqlite3.Connection) -> None:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS migration_runs (
                id TEXT PRIMARY KEY,
                migration_key TEXT NOT NULL,
                mode TEXT NOT NULL,
                status TEXT NOT NULL,
                summary_json TEXT NOT NULL DEFAULT '{}',
                started_at TEXT NOT NULL,
                finished_at TEXT,
                error_message TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_migration_runs_key_started
                ON migration_runs(migration_key, started_at DESC);

            CREATE TABLE IF NOT EXISTS preset_collection_migration_checkpoints (
                template_id TEXT PRIMARY KEY,
                latest_revision_migrated INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS preset_collection_template_map (
                template_id TEXT PRIMARY KEY,
                collection_id TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS preset_collection_identity_map (
                scope TEXT NOT NULL,
                component_type TEXT NOT NULL,
                platform TEXT NOT NULL,
                legacy_name TEXT NOT NULL,
                preset_id TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (scope, component_type, platform, legacy_name)
            );
            """
        )
        conn.commit()

    def _create_run(self, *, mode: str) -> str:
        run_id = str(uuid.uuid4())
        self._source_conn.execute(
            """
            INSERT INTO migration_runs
            (id, migration_key, mode, status, summary_json, started_at, finished_at, error_message)
            VALUES (?, 'preset_collection_v1_backfill', ?, 'running', '{}', ?, NULL, NULL)
            """,
            (run_id, mode, _now_iso()),
        )
        self._source_conn.commit()
        return run_id

    def _finish_run(self, *, run_id: str, status: str, summary: dict[str, Any], error: str | None) -> None:
        self._source_conn.execute(
            """
            UPDATE migration_runs
            SET status = ?, summary_json = ?, finished_at = ?, error_message = ?
            WHERE id = ?
            """,
            (status, _to_json(summary), _now_iso(), error, run_id),
        )
        self._source_conn.commit()

    def _collect_counts(self, conn: sqlite3.Connection) -> dict[str, int]:
        return {
            "legacy_templates_active": int(
                conn.execute("SELECT COUNT(*) FROM project_templates WHERE deleted_at IS NULL").fetchone()[0]
            ),
            "legacy_revisions": int(
                conn.execute(
                    """
                    SELECT COUNT(*)
                    FROM project_template_revisions r
                    JOIN project_templates t ON r.template_id = t.id
                    WHERE t.deleted_at IS NULL
                    """
                ).fetchone()[0]
            ),
            "legacy_revision_items": int(
                conn.execute(
                    """
                    SELECT COUNT(*)
                    FROM project_template_revision_items i
                    JOIN project_template_revisions r ON i.revision_id = r.id
                    JOIN project_templates t ON r.template_id = t.id
                    WHERE t.deleted_at IS NULL
                    """
                ).fetchone()[0]
            ),
            "legacy_apply_logs": int(conn.execute("SELECT COUNT(*) FROM preset_apply_logs").fetchone()[0]),
            "presets": int(conn.execute("SELECT COUNT(*) FROM presets WHERE deleted_at IS NULL").fetchone()[0]),
            "preset_revisions": int(conn.execute("SELECT COUNT(*) FROM preset_revisions").fetchone()[0]),
            "collections": int(conn.execute("SELECT COUNT(*) FROM collections WHERE deleted_at IS NULL").fetchone()[0]),
            "collection_revisions": int(conn.execute("SELECT COUNT(*) FROM collection_revisions").fetchone()[0]),
            "collection_revision_items": int(
                conn.execute("SELECT COUNT(*) FROM collection_revision_items").fetchone()[0]
            ),
            "collection_apply_logs": int(conn.execute("SELECT COUNT(*) FROM collection_apply_logs").fetchone()[0]),
            "checkpoints": int(
                conn.execute("SELECT COUNT(*) FROM preset_collection_migration_checkpoints").fetchone()[0]
            ),
        }

    def _migrate_all(
        self,
        conn: sqlite3.Connection,
        *,
        summary: MigrationSummary,
        limit: int | None,
        template_id: str | None,
    ) -> None:
        templates = self._load_templates(conn, limit=limit, template_id=template_id)
        summary.templates_scanned = len(templates)

        for template in templates:
            latest_revision = int(template["latest_revision"] or 0)
            if self._is_checkpointed(conn, template_id=template["id"], latest_revision=latest_revision):
                summary.templates_skipped += 1
                continue

            conn.execute("BEGIN")
            try:
                self._migrate_single_template(conn, template=template, summary=summary)
                self._upsert_checkpoint(
                    conn,
                    template_id=template["id"],
                    latest_revision=latest_revision,
                )
                conn.commit()
                summary.templates_migrated += 1
            except Exception:
                conn.rollback()
                raise

    def _load_templates(
        self, conn: sqlite3.Connection, *, limit: int | None, template_id: str | None
    ) -> list[dict[str, Any]]:
        where = ["t.deleted_at IS NULL"]
        params: list[Any] = []

        if template_id:
            where.append("t.id = ?")
            params.append(template_id)

        sql = """
            SELECT
                t.id,
                t.name,
                t.description,
                t.scope,
                t.tags,
                t.components,
                t.created_at,
                t.updated_at,
                COALESCE((SELECT MAX(r.revision) FROM project_template_revisions r WHERE r.template_id = t.id), 0)
                    AS latest_revision
            FROM project_templates t
            WHERE {where_clause}
            ORDER BY t.updated_at ASC
        """.format(where_clause=" AND ".join(where))

        if limit is not None:
            sql += " LIMIT ?"
            params.append(limit)

        rows = list(conn.execute(sql, params).fetchall())
        normalized: list[dict[str, Any]] = []
        for row in rows:
            row_dict = dict(row)
            latest_revision = int(row_dict["latest_revision"] or 0)
            if latest_revision <= 0:
                components = _from_json(row_dict["components"])
                if isinstance(components, list) and components:
                    row_dict["latest_revision"] = 1
            normalized.append(row_dict)
        return normalized

    def _is_checkpointed(self, conn: sqlite3.Connection, *, template_id: str, latest_revision: int) -> bool:
        checkpoint = conn.execute(
            """
            SELECT latest_revision_migrated
            FROM preset_collection_migration_checkpoints
            WHERE template_id = ?
            """,
            (template_id,),
        ).fetchone()
        if checkpoint is None:
            return False

        mapped = conn.execute(
            "SELECT collection_id FROM preset_collection_template_map WHERE template_id = ?",
            (template_id,),
        ).fetchone()
        if mapped is None:
            return False

        collection_exists = conn.execute(
            "SELECT 1 FROM collections WHERE id = ? AND deleted_at IS NULL",
            (mapped[0],),
        ).fetchone()
        if collection_exists is None:
            return False

        return int(checkpoint[0] or 0) >= latest_revision

    def _upsert_checkpoint(self, conn: sqlite3.Connection, *, template_id: str, latest_revision: int) -> None:
        conn.execute(
            """
            INSERT INTO preset_collection_migration_checkpoints (template_id, latest_revision_migrated, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(template_id) DO UPDATE SET
                latest_revision_migrated = excluded.latest_revision_migrated,
                updated_at = excluded.updated_at
            """,
            (template_id, latest_revision, _now_iso()),
        )

    def _migrate_single_template(
        self,
        conn: sqlite3.Connection,
        *,
        template: dict[str, Any],
        summary: MigrationSummary,
    ) -> None:
        scope = str(template["scope"] or "user").strip().lower()
        if scope not in _ALLOWED_SCOPES:
            scope = "user"
            summary.malformed_rows += 1

        collection_id = self._resolve_collection_id(conn, template_id=template["id"])
        self._upsert_collection(
            conn,
            collection_id=collection_id,
            template=template,
            scope=scope,
            summary=summary,
        )

        revisions = self._load_legacy_revisions(conn, template=template, summary=summary)
        latest_revision = max([revision["revision"] for revision in revisions], default=0)

        latest_collection_items: list[dict[str, Any]] = []
        for revision in revisions:
            migrated_items: list[dict[str, Any]] = []
            for item in revision["items"]:
                preset = self._resolve_preset_for_item(
                    conn,
                    scope=scope,
                    legacy_name=item["name"],
                    item=item,
                    summary=summary,
                )
                alias_name = item["name"] if preset["name"].lower() != item["name"].lower() else None
                migrated_items.append(
                    {
                        "order_index": int(item["order_index"]),
                        "preset_id": preset["id"],
                        "pin_mode": "pin",
                        "pinned_revision": int(preset["revision"]),
                        "resolved_revision": int(preset["revision"]),
                        "alias_name": alias_name,
                    }
                )

            self._upsert_collection_revision(
                conn,
                collection_id=collection_id,
                revision=revision,
                items=migrated_items,
                summary=summary,
            )

            if int(revision["revision"]) == latest_revision:
                latest_collection_items = migrated_items

        self._replace_collection_head_items(
            conn,
            collection_id=collection_id,
            items=latest_collection_items,
            summary=summary,
        )

        conn.execute(
            "UPDATE collections SET latest_revision = ?, updated_at = ? WHERE id = ?",
            (latest_revision, _now_iso(), collection_id),
        )

        self._migrate_apply_logs(
            conn,
            template_id=template["id"],
            collection_id=collection_id,
            summary=summary,
        )

    def _resolve_collection_id(self, conn: sqlite3.Connection, *, template_id: str) -> str:
        mapped = conn.execute(
            "SELECT collection_id FROM preset_collection_template_map WHERE template_id = ?",
            (template_id,),
        ).fetchone()
        if mapped is not None:
            return str(mapped[0])

        candidate = _namespaced_id("collection", f"legacy-template:{template_id}")
        conn.execute(
            """
            INSERT INTO preset_collection_template_map (template_id, collection_id, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(template_id) DO UPDATE SET
                collection_id = excluded.collection_id,
                updated_at = excluded.updated_at
            """,
            (template_id, candidate, _now_iso()),
        )
        return candidate

    def _upsert_collection(
        self,
        conn: sqlite3.Connection,
        *,
        collection_id: str,
        template: dict[str, Any],
        scope: str,
        summary: MigrationSummary,
    ) -> None:
        tags = _normalize_tags(_from_json(template["tags"]))
        existing = conn.execute(
            """
            SELECT name, description, scope, tags, deleted_at
            FROM collections
            WHERE id = ?
            """,
            (collection_id,),
        ).fetchone()

        if existing is None:
            conn.execute(
                """
                INSERT INTO collections
                (id, name, description, scope, tags, latest_revision, created_at, updated_at, deleted_at)
                VALUES (?, ?, ?, ?, ?, 0, ?, ?, NULL)
                """,
                (
                    collection_id,
                    str(template["name"] or "").strip(),
                    str(template["description"] or "").strip(),
                    scope,
                    _to_json(tags),
                    template["created_at"] or _now_iso(),
                    _now_iso(),
                ),
            )
            summary.collections_created += 1
            return

        current_tags = _normalize_tags(_from_json(existing["tags"]))
        should_update = (
            str(existing["name"] or "") != str(template["name"] or "").strip()
            or str(existing["description"] or "") != str(template["description"] or "").strip()
            or str(existing["scope"] or "") != scope
            or current_tags != tags
            or existing["deleted_at"] is not None
        )

        if should_update:
            conn.execute(
                """
                UPDATE collections
                SET name = ?, description = ?, scope = ?, tags = ?, updated_at = ?, deleted_at = NULL
                WHERE id = ?
                """,
                (
                    str(template["name"] or "").strip(),
                    str(template["description"] or "").strip(),
                    scope,
                    _to_json(tags),
                    _now_iso(),
                    collection_id,
                ),
            )
            summary.collections_updated += 1

    def _load_legacy_revisions(
        self, conn: sqlite3.Connection, *, template: dict[str, Any], summary: MigrationSummary
    ) -> list[dict[str, Any]]:
        revision_rows = conn.execute(
            """
            SELECT id, revision, created_at, created_by, change_note
            FROM project_template_revisions
            WHERE template_id = ?
            ORDER BY revision ASC
            """,
            (template["id"],),
        ).fetchall()

        revisions: list[dict[str, Any]] = []
        if not revision_rows:
            legacy_components = _from_json(template["components"])
            if not isinstance(legacy_components, list):
                legacy_components = []
            items = []
            for index, raw_component in enumerate(legacy_components):
                normalized = self._normalize_legacy_item(raw_component, index=index, summary=summary)
                if normalized is not None:
                    items.append(normalized)
            revisions.append(
                {
                    "revision": 1,
                    "created_at": template["updated_at"] or template["created_at"] or _now_iso(),
                    "created_by": None,
                    "change_note": "synthetic migration revision from project_templates.components",
                    "items": items,
                }
            )
            return revisions

        for revision_row in revision_rows:
            item_rows = conn.execute(
                """
                SELECT
                    order_index,
                    component_type,
                    name,
                    platform,
                    description,
                    content,
                    frontmatter_json,
                    tags_json
                FROM project_template_revision_items
                WHERE revision_id = ?
                ORDER BY order_index ASC
                """,
                (revision_row["id"],),
            ).fetchall()

            items = []
            for index, item_row in enumerate(item_rows):
                normalized = self._normalize_legacy_item(dict(item_row), index=index, summary=summary)
                if normalized is not None:
                    items.append(normalized)

            revisions.append(
                {
                    "revision": int(revision_row["revision"] or 0),
                    "created_at": revision_row["created_at"] or _now_iso(),
                    "created_by": revision_row["created_by"],
                    "change_note": revision_row["change_note"] or "",
                    "items": items,
                }
            )

        return revisions

    def _normalize_legacy_item(
        self, raw_item: dict[str, Any], *, index: int, summary: MigrationSummary
    ) -> dict[str, Any] | None:
        component_type = str(raw_item.get("component_type") or "").strip().lower()
        if component_type not in _ALLOWED_COMPONENT_TYPES:
            summary.malformed_rows += 1
            summary.warnings.append(f"skip invalid component_type at item {index}: {component_type}")
            return None

        platform = str(raw_item.get("platform") or "").strip().lower()
        if platform not in _ALLOWED_PLATFORMS:
            summary.malformed_rows += 1
            summary.warnings.append(f"skip invalid platform at item {index}: {platform}")
            return None

        name = _normalize_name(str(raw_item.get("name") or ""))
        if not name:
            summary.malformed_rows += 1
            summary.warnings.append(f"skip invalid name at item {index}")
            return None

        description = str(raw_item.get("description") or "")
        content = str(raw_item.get("content") or "")
        frontmatter = _normalize_frontmatter(_from_json(raw_item.get("frontmatter_json")))
        tags = _normalize_tags(_from_json(raw_item.get("tags_json")))
        if not frontmatter:
            frontmatter = _normalize_frontmatter(raw_item.get("frontmatter"))
        if not tags:
            tags = _normalize_tags(raw_item.get("tags"))

        return {
            "order_index": int(raw_item.get("order_index", index)),
            "component_type": component_type,
            "name": name,
            "platform": platform,
            "description": description,
            "content": content,
            "frontmatter": frontmatter,
            "tags": tags,
            "content_hash": hashlib.sha256(content.encode("utf-8")).hexdigest(),
        }

    def _resolve_preset_for_item(
        self,
        conn: sqlite3.Connection,
        *,
        scope: str,
        legacy_name: str,
        item: dict[str, Any],
        summary: MigrationSummary,
    ) -> dict[str, Any]:
        mapping = conn.execute(
            """
            SELECT preset_id
            FROM preset_collection_identity_map
            WHERE scope = ? AND component_type = ? AND platform = ? AND legacy_name = ?
            """,
            (scope, item["component_type"], item["platform"], legacy_name),
        ).fetchone()

        if mapping is not None:
            preset_row = conn.execute(
                "SELECT id, name FROM presets WHERE id = ? AND deleted_at IS NULL",
                (mapping["preset_id"],),
            ).fetchone()
            if preset_row is not None:
                revision = self._find_or_create_preset_revision(
                    conn,
                    preset_id=preset_row["id"],
                    item=item,
                    summary=summary,
                )
                return {"id": preset_row["id"], "name": preset_row["name"], "revision": revision}

        exact = self._find_preset_by_identity(
            conn,
            scope=scope,
            name=legacy_name,
            component_type=item["component_type"],
            platform=item["platform"],
        )

        if (
            exact is not None
            and self._find_preset_revision_by_hash(conn, preset_id=exact["id"], content_hash=item["content_hash"])
            is not None
        ):
            target = exact
        else:
            if exact is None:
                target_name = legacy_name
            else:
                target_name = self._build_deterministic_conflict_name(
                    conn,
                    scope=scope,
                    base_name=legacy_name,
                    component_type=item["component_type"],
                    platform=item["platform"],
                    content_hash=item["content_hash"],
                )

            target = self._find_preset_by_identity(
                conn,
                scope=scope,
                name=target_name,
                component_type=item["component_type"],
                platform=item["platform"],
            )

            if target is None:
                preset_id = _namespaced_id(
                    "preset",
                    f"legacy:{scope}:{item['component_type']}:{item['platform']}:{target_name}",
                )
                created_at = _now_iso()
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
                        target_name,
                        item["component_type"],
                        item["platform"],
                        item["description"],
                        scope,
                        _to_json(item["tags"]),
                        created_at,
                        created_at,
                    ),
                )
                summary.presets_created += 1
                target = {"id": preset_id, "name": target_name}

        conn.execute(
            """
            INSERT INTO preset_collection_identity_map
            (scope, component_type, platform, legacy_name, preset_id, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(scope, component_type, platform, legacy_name) DO UPDATE SET
                preset_id = excluded.preset_id,
                updated_at = excluded.updated_at
            """,
            (scope, item["component_type"], item["platform"], legacy_name, target["id"], _now_iso()),
        )

        revision = self._find_or_create_preset_revision(conn, preset_id=target["id"], item=item, summary=summary)
        return {"id": target["id"], "name": target["name"], "revision": revision}

    def _find_preset_by_identity(
        self,
        conn: sqlite3.Connection,
        *,
        scope: str,
        name: str,
        component_type: str,
        platform: str,
    ) -> sqlite3.Row | None:
        return conn.execute(
            """
            SELECT id, name
            FROM presets
            WHERE deleted_at IS NULL
              AND scope = ?
              AND component_type = ?
              AND platform = ?
              AND LOWER(name) = LOWER(?)
            """,
            (scope, component_type, platform, name),
        ).fetchone()

    def _build_deterministic_conflict_name(
        self,
        conn: sqlite3.Connection,
        *,
        scope: str,
        base_name: str,
        component_type: str,
        platform: str,
        content_hash: str,
    ) -> str:
        for prefix_len in (8, 12, 16, 20):
            candidate = _compose_name(base_name, f"-legacy-{content_hash[:prefix_len]}")
            row = self._find_preset_by_identity(
                conn,
                scope=scope,
                name=candidate,
                component_type=component_type,
                platform=platform,
            )
            if row is None:
                return candidate
            if self._find_preset_revision_by_hash(conn, preset_id=row["id"], content_hash=content_hash) is not None:
                return candidate

        index = 1
        while True:
            candidate = _compose_name(base_name, f"-legacy-{content_hash[:8]}-{index}")
            row = self._find_preset_by_identity(
                conn,
                scope=scope,
                name=candidate,
                component_type=component_type,
                platform=platform,
            )
            if row is None:
                return candidate
            index += 1

    def _find_preset_revision_by_hash(
        self, conn: sqlite3.Connection, *, preset_id: str, content_hash: str
    ) -> int | None:
        row = conn.execute(
            """
            SELECT revision
            FROM preset_revisions
            WHERE preset_id = ? AND content_hash = ?
            ORDER BY revision ASC
            LIMIT 1
            """,
            (preset_id, content_hash),
        ).fetchone()
        return int(row["revision"]) if row is not None else None

    def _find_or_create_preset_revision(
        self, conn: sqlite3.Connection, *, preset_id: str, item: dict[str, Any], summary: MigrationSummary
    ) -> int:
        existing_revision = self._find_preset_revision_by_hash(
            conn,
            preset_id=preset_id,
            content_hash=item["content_hash"],
        )
        if existing_revision is not None:
            return existing_revision

        row = conn.execute(
            "SELECT COALESCE(MAX(revision), 0) AS max_revision FROM preset_revisions WHERE preset_id = ?",
            (preset_id,),
        ).fetchone()
        next_revision = int(row["max_revision"] or 0) + 1

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
                next_revision,
                item["content"],
                _to_json(item["frontmatter"]),
                _to_json(item["tags"]),
                item["content_hash"],
                "legacy backfill from project_template_revision_items",
                _now_iso(),
                "migration",
            ),
        )
        conn.execute(
            "UPDATE presets SET latest_revision = ?, updated_at = ? WHERE id = ?",
            (next_revision, _now_iso(), preset_id),
        )
        summary.preset_revisions_created += 1
        return next_revision

    def _upsert_collection_revision(
        self,
        conn: sqlite3.Connection,
        *,
        collection_id: str,
        revision: dict[str, Any],
        items: list[dict[str, Any]],
        summary: MigrationSummary,
    ) -> None:
        revision_row = conn.execute(
            """
            SELECT id
            FROM collection_revisions
            WHERE collection_id = ? AND revision = ?
            """,
            (collection_id, int(revision["revision"])),
        ).fetchone()

        if revision_row is None:
            revision_id = str(uuid.uuid4())
            conn.execute(
                """
                INSERT INTO collection_revisions
                (id, collection_id, revision, created_at, created_by, change_note)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    revision_id,
                    collection_id,
                    int(revision["revision"]),
                    revision["created_at"] or _now_iso(),
                    revision["created_by"],
                    revision["change_note"],
                ),
            )
            summary.collection_revisions_created += 1
        else:
            revision_id = str(revision_row["id"])

        existing_items = conn.execute(
            """
            SELECT order_index, preset_id, pin_mode, pinned_revision, resolved_revision, alias_name
            FROM collection_revision_items
            WHERE collection_revision_id = ?
            ORDER BY order_index ASC
            """,
            (revision_id,),
        ).fetchall()

        existing_tuples = [
            (
                int(row["order_index"]),
                row["preset_id"],
                row["pin_mode"],
                int(row["pinned_revision"]) if row["pinned_revision"] is not None else None,
                int(row["resolved_revision"]),
                row["alias_name"],
            )
            for row in existing_items
        ]
        new_tuples = [
            (
                int(item["order_index"]),
                item["preset_id"],
                item["pin_mode"],
                int(item["pinned_revision"]) if item["pinned_revision"] is not None else None,
                int(item["resolved_revision"]),
                item["alias_name"],
            )
            for item in items
        ]

        if existing_tuples == new_tuples:
            return

        conn.execute("DELETE FROM collection_revision_items WHERE collection_revision_id = ?", (revision_id,))
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
                    item["pinned_revision"],
                    int(item["resolved_revision"]),
                    item["alias_name"],
                ),
            )
        summary.collection_items_rewritten += len(items)

    def _replace_collection_head_items(
        self, conn: sqlite3.Connection, *, collection_id: str, items: list[dict[str, Any]], summary: MigrationSummary
    ) -> None:
        existing_rows = conn.execute(
            """
            SELECT order_index, preset_id, pin_mode, pinned_revision, alias_name
            FROM collection_items
            WHERE collection_id = ?
            ORDER BY order_index ASC
            """,
            (collection_id,),
        ).fetchall()

        existing_tuples = [
            (
                int(row["order_index"]),
                row["preset_id"],
                row["pin_mode"],
                int(row["pinned_revision"]) if row["pinned_revision"] is not None else None,
                row["alias_name"],
            )
            for row in existing_rows
        ]
        new_tuples = [
            (
                int(item["order_index"]),
                item["preset_id"],
                item["pin_mode"],
                int(item["pinned_revision"]) if item["pinned_revision"] is not None else None,
                item["alias_name"],
            )
            for item in items
        ]

        if existing_tuples == new_tuples:
            return

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
                    item["pinned_revision"],
                    item["alias_name"],
                ),
            )
        summary.collection_items_rewritten += len(items)

    def _migrate_apply_logs(
        self,
        conn: sqlite3.Connection,
        *,
        template_id: str,
        collection_id: str,
        summary: MigrationSummary,
    ) -> None:
        rows = conn.execute(
            """
            SELECT id, project_id, revision, policy, status, summary_json, created_at, created_by
            FROM preset_apply_logs
            WHERE preset_id = ?
            ORDER BY created_at ASC
            """,
            (template_id,),
        ).fetchall()

        for row in rows:
            policy = str(row["policy"] or "fail")
            if policy not in _LEGACY_POLICIES:
                policy = "fail"
                summary.malformed_rows += 1

            status = str(row["status"] or "failed")
            if status not in _LEGACY_LOG_STATUS:
                status = "failed"
                summary.malformed_rows += 1

            revision_row = conn.execute(
                """
                SELECT id
                FROM collection_revisions
                WHERE collection_id = ? AND revision = ?
                """,
                (collection_id, int(row["revision"] or 0)),
            ).fetchone()
            revision_id = revision_row["id"] if revision_row is not None else None

            new_log_id = _namespaced_id("applylog", f"legacy:{row['id']}", length=24)
            existing = conn.execute(
                "SELECT id FROM collection_apply_logs WHERE id = ?",
                (new_log_id,),
            ).fetchone()
            if existing is not None:
                continue

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
                    new_log_id,
                    collection_id,
                    revision_id,
                    row["project_id"],
                    policy,
                    status,
                    row["summary_json"] or "{}",
                    row["created_at"] or _now_iso(),
                    row["created_by"],
                ),
            )
            summary.apply_logs_migrated += 1

    def _verify_integrity(self, conn: sqlite3.Connection) -> list[str]:
        mismatches: list[str] = []

        templates = conn.execute(
            """
            SELECT
                id,
                name,
                COALESCE(
                    (SELECT MAX(revision) FROM project_template_revisions r WHERE r.template_id = t.id),
                    0
                ) AS latest_revision
            FROM project_templates t
            WHERE t.deleted_at IS NULL
            ORDER BY updated_at ASC
            """
        ).fetchall()

        for template in templates:
            mapped = conn.execute(
                "SELECT collection_id FROM preset_collection_template_map WHERE template_id = ?",
                (template["id"],),
            ).fetchone()
            if mapped is None:
                mismatches.append(f"missing collection mapping for template {template['id']}")
                continue

            collection = conn.execute(
                "SELECT id, latest_revision FROM collections WHERE id = ? AND deleted_at IS NULL",
                (mapped["collection_id"],),
            ).fetchone()
            if collection is None:
                mismatches.append(f"mapped collection missing for template {template['id']}")
                continue

            latest_revision = int(template["latest_revision"] or 0)
            if int(collection["latest_revision"] or 0) < latest_revision:
                mismatches.append(
                    f"collection latest revision lag for template {template['id']}:"
                    f" {collection['latest_revision']} < {latest_revision}"
                )

            revision_rows = conn.execute(
                """
                SELECT r.revision, COUNT(i.id) AS item_count
                FROM project_template_revisions r
                LEFT JOIN project_template_revision_items i ON i.revision_id = r.id
                WHERE r.template_id = ?
                GROUP BY r.revision
                ORDER BY r.revision ASC
                """,
                (template["id"],),
            ).fetchall()

            for revision_row in revision_rows:
                collection_revision = conn.execute(
                    """
                    SELECT cr.id
                    FROM collection_revisions cr
                    WHERE cr.collection_id = ? AND cr.revision = ?
                    """,
                    (collection["id"], int(revision_row["revision"])),
                ).fetchone()
                if collection_revision is None:
                    mismatches.append(
                        f"missing collection revision for template {template['id']} revision {revision_row['revision']}"
                    )
                    continue

                mapped_item_count = conn.execute(
                    "SELECT COUNT(*) FROM collection_revision_items WHERE collection_revision_id = ?",
                    (collection_revision["id"],),
                ).fetchone()[0]
                if int(mapped_item_count) != int(revision_row["item_count"]):
                    mismatches.append(
                        f"item count mismatch template {template['id']} revision {revision_row['revision']}:"
                        f" legacy={revision_row['item_count']} migrated={mapped_item_count}"
                    )

        return mismatches
