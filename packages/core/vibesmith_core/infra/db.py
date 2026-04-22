"""SQLite database management — schema initialization and connection management."""

import hashlib
import json
import sqlite3
import threading
import uuid
from datetime import UTC, datetime
from pathlib import Path

_SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    is_global INTEGER NOT NULL DEFAULT 0,
    component_count INTEGER NOT NULL DEFAULT 0,
    last_scanned_at TEXT NOT NULL,
    hidden_at TEXT
);

CREATE TABLE IF NOT EXISTS components (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    content TEXT,
    frontmatter TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    platform TEXT NOT NULL,
    deleted_at TEXT,
    original_path TEXT,
    last_used TEXT,
    UNIQUE(project_id, name, type, platform)
);

CREATE TABLE IF NOT EXISTS tags (
    component_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    PRIMARY KEY (component_id, tag)
);

CREATE TABLE IF NOT EXISTS dependencies (
    source_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    dep_type TEXT NOT NULL,
    PRIMARY KEY (source_id, target_id, dep_type)
);

CREATE TABLE IF NOT EXISTS versions (
    id TEXT PRIMARY KEY,
    component_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(component_id, version)
);

CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    component_id TEXT,
    activity_type TEXT NOT NULL,
    component_name TEXT NOT NULL,
    component_type TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_components_project_type ON components(project_id, type);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_components_enabled ON components(enabled);
CREATE INDEX IF NOT EXISTS idx_components_deleted_at ON components(deleted_at);
CREATE INDEX IF NOT EXISTS idx_projects_hidden_at ON projects(hidden_at);
CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag);
CREATE INDEX IF NOT EXISTS idx_dependencies_source ON dependencies(source_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_target ON dependencies(target_id);
CREATE INDEX IF NOT EXISTS idx_activities_project_created ON activities(project_id, created_at);

-- Issue #79: License system (Stripe integration)
CREATE TABLE IF NOT EXISTS licenses (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    plan TEXT NOT NULL,
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    status TEXT NOT NULL,
    created_at TEXT,
    expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_licenses_user_id ON licenses(user_id);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);

-- Issue #67: Usage Tracking (session log parsing)
CREATE TABLE IF NOT EXISTS usage_parse_state (
    project_path TEXT NOT NULL,
    session_file TEXT NOT NULL,
    byte_offset INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (project_path, session_file)
);

CREATE TABLE IF NOT EXISTS usage_sessions (
    id TEXT PRIMARY KEY,
    project_path TEXT NOT NULL,
    session_file TEXT NOT NULL,
    parsed_at TEXT NOT NULL,
    UNIQUE(project_path, session_file)
);

CREATE TABLE IF NOT EXISTS usage_stats (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES usage_sessions(id) ON DELETE CASCADE,
    component_name TEXT NOT NULL,
    component_type TEXT NOT NULL,
    component_id TEXT REFERENCES components(id) ON DELETE SET NULL,
    use_count INTEGER NOT NULL DEFAULT 1,
    used_at TEXT NOT NULL,
    has_timestamp INTEGER NOT NULL DEFAULT 1,
    signal_quality TEXT NOT NULL DEFAULT 'strict'
);

CREATE INDEX IF NOT EXISTS idx_usage_stats_session ON usage_stats(session_id);
CREATE INDEX IF NOT EXISTS idx_usage_stats_component ON usage_stats(component_name, component_type);
CREATE INDEX IF NOT EXISTS idx_usage_sessions_project ON usage_sessions(project_path);
CREATE INDEX IF NOT EXISTS idx_usage_stats_component_id ON usage_stats(component_id);
CREATE INDEX IF NOT EXISTS idx_usage_stats_signal_quality ON usage_stats(signal_quality);
CREATE INDEX IF NOT EXISTS idx_usage_stats_has_timestamp ON usage_stats(has_timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_stats_used_at ON usage_stats(used_at);
CREATE INDEX IF NOT EXISTS idx_usage_stats_component_id_used_at ON usage_stats(component_id, used_at);
CREATE INDEX IF NOT EXISTS idx_usage_stats_component_name_used_at ON usage_stats(component_name, used_at);

-- Issue #84: Local backup metadata
CREATE TABLE IF NOT EXISTS backups (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    checksum TEXT NOT NULL,
    file_path TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at);

-- Issue #764: Project preset (template) management
-- Preset UX phase 2: Remove default system seed + legacy seed deactivation migration
CREATE TABLE IF NOT EXISTS project_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'user',
    preset_type TEXT NOT NULL DEFAULT 'template',
    tags TEXT NOT NULL DEFAULT '[]',
    components TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_project_templates_scope ON project_templates(scope);
CREATE INDEX IF NOT EXISTS idx_project_templates_updated_at ON project_templates(updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_templates_name_unique_active
    ON project_templates(LOWER(name))
    WHERE deleted_at IS NULL;

-- Preset Bundle V2: immutable revisions
CREATE TABLE IF NOT EXISTS project_template_revisions (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL,
    preset_type TEXT NOT NULL DEFAULT 'snapshot',
    created_at TEXT NOT NULL,
    created_by TEXT,
    change_note TEXT,
    UNIQUE(template_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_project_template_revisions_template
    ON project_template_revisions(template_id, revision DESC);
CREATE INDEX IF NOT EXISTS idx_project_template_revisions_created_at
    ON project_template_revisions(created_at DESC);

CREATE TABLE IF NOT EXISTS project_template_revision_items (
    id TEXT PRIMARY KEY,
    revision_id TEXT NOT NULL REFERENCES project_template_revisions(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL DEFAULT 0,
    component_type TEXT NOT NULL,
    name TEXT NOT NULL,
    platform TEXT NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    frontmatter_json TEXT NOT NULL DEFAULT '{}',
    tags_json TEXT NOT NULL DEFAULT '[]',
    source_component_id TEXT,
    template_id TEXT,
    config_json TEXT NOT NULL DEFAULT '{}',
    content_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_template_revision_items_revision
    ON project_template_revision_items(revision_id, order_index ASC);
CREATE INDEX IF NOT EXISTS idx_project_template_revision_items_name
    ON project_template_revision_items(name, component_type, platform);

CREATE TABLE IF NOT EXISTS preset_apply_logs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    preset_id TEXT NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL,
    policy TEXT NOT NULL,
    status TEXT NOT NULL,
    summary_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_preset_apply_logs_project_created
    ON preset_apply_logs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_preset_apply_logs_preset_created
    ON preset_apply_logs(preset_id, created_at DESC);

-- Issue #921: Preset/Collection V1 (single preset + collection apply unit)
CREATE TABLE IF NOT EXISTS presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    component_type TEXT NOT NULL,
    platform TEXT NOT NULL,
    description TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'user',
    tags TEXT NOT NULL DEFAULT '[]',
    latest_revision INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_presets_identity_unique_active
    ON presets(LOWER(name), component_type, platform, scope)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_presets_scope_updated_at
    ON presets(scope, updated_at DESC);

CREATE TABLE IF NOT EXISTS preset_revisions (
    id TEXT PRIMARY KEY,
    preset_id TEXT NOT NULL REFERENCES presets(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL,
    content TEXT NOT NULL,
    frontmatter_json TEXT NOT NULL DEFAULT '{}',
    tags_json TEXT NOT NULL DEFAULT '[]',
    content_hash TEXT NOT NULL,
    change_note TEXT,
    created_at TEXT NOT NULL,
    created_by TEXT,
    UNIQUE(preset_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_preset_revisions_preset_revision
    ON preset_revisions(preset_id, revision DESC);

CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'user',
    tags TEXT NOT NULL DEFAULT '[]',
    latest_revision INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_collections_name_unique_active
    ON collections(LOWER(name), scope)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_collections_scope_updated_at
    ON collections(scope, updated_at DESC);

CREATE TABLE IF NOT EXISTS collection_items (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL DEFAULT 0,
    preset_id TEXT NOT NULL REFERENCES presets(id) ON DELETE CASCADE,
    pin_mode TEXT NOT NULL DEFAULT 'pin',
    pinned_revision INTEGER,
    alias_name TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_collection_items_collection_order
    ON collection_items(collection_id, order_index);
CREATE INDEX IF NOT EXISTS idx_collection_items_preset
    ON collection_items(preset_id);

CREATE TABLE IF NOT EXISTS collection_revisions (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    created_by TEXT,
    change_note TEXT,
    UNIQUE(collection_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_collection_revisions_collection_revision
    ON collection_revisions(collection_id, revision DESC);

CREATE TABLE IF NOT EXISTS collection_revision_items (
    id TEXT PRIMARY KEY,
    collection_revision_id TEXT NOT NULL REFERENCES collection_revisions(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL DEFAULT 0,
    preset_id TEXT NOT NULL REFERENCES presets(id) ON DELETE CASCADE,
    pin_mode TEXT NOT NULL DEFAULT 'pin',
    pinned_revision INTEGER,
    resolved_revision INTEGER NOT NULL,
    alias_name TEXT
);

CREATE INDEX IF NOT EXISTS idx_collection_revision_items_revision
    ON collection_revision_items(collection_revision_id, order_index ASC);
CREATE INDEX IF NOT EXISTS idx_collection_revision_items_preset
    ON collection_revision_items(preset_id, resolved_revision);

CREATE TABLE IF NOT EXISTS collection_apply_logs (
    id TEXT PRIMARY KEY,
    collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
    collection_revision_id TEXT REFERENCES collection_revisions(id) ON DELETE SET NULL,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    policy TEXT NOT NULL,
    status TEXT NOT NULL,
    summary_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_collection_apply_logs_project_created
    ON collection_apply_logs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collection_apply_logs_collection_created
    ON collection_apply_logs(collection_id, created_at DESC);
"""

# Hash for schema version management
_SCHEMA_VERSION = hashlib.md5(_SCHEMA_SQL.encode()).hexdigest()
_LEGACY_SYSTEM_PRESET_IDS = ("preset-react-fastapi",)


class DatabaseManager:
    """SQLite database connection and schema management."""

    def __init__(self, db_path: str) -> None:
        self._db_path = str(Path(db_path).expanduser())
        self._connections_by_thread: dict[int, sqlite3.Connection] = {}
        self._connection_lock = threading.Lock()
        # Backward compatibility: default connection pointer referenced by existing code (first created connection)
        self._connection: sqlite3.Connection | None = None

    def get_connection(self) -> sqlite3.Connection:
        """Return the DB connection for the current thread. Creates one if it doesn't exist."""
        thread_id = threading.get_ident()

        with self._connection_lock:
            existing = self._connections_by_thread.get(thread_id)
            if existing is not None:
                return existing

            Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)
            conn = sqlite3.connect(
                self._db_path,
                check_same_thread=False,
                timeout=30.0,
            )
            conn.execute("PRAGMA foreign_keys = ON")
            conn.execute("PRAGMA busy_timeout = 30000")
            conn.execute("PRAGMA journal_mode = WAL")

            self._connections_by_thread[thread_id] = conn
            if self._connection is None:
                self._connection = conn
            return conn

    def _get_schema_version(self) -> str | None:
        """Return the stored schema version."""
        conn = self.get_connection()
        try:
            cursor = conn.execute("SELECT value FROM _schema_meta WHERE key = 'version'")
            row = cursor.fetchone()
            return row[0] if row else None
        except sqlite3.OperationalError:
            # Return None if _schema_meta table doesn't exist
            return None

    def _set_schema_version(self, version: str) -> None:
        """Save the schema version."""
        conn = self.get_connection()
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS _schema_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
            """
        )
        conn.execute(
            "INSERT OR REPLACE INTO _schema_meta (key, value) VALUES ('version', ?)",
            (version,),
        )
        conn.commit()

    def _needs_migration(self) -> bool:
        """Check if schema migration is needed."""
        current_version = self._get_schema_version()
        return current_version != _SCHEMA_VERSION

    def _migrate_schema(self) -> None:
        """Perform schema migration."""
        conn = self.get_connection()

        # Check existing table structure
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        existing_tables = {row[0] for row in cursor.fetchall()}

        # Issue #164: Add conflict_ignores table (stores is_intentional for ignored conflicts)
        # Issue #79: Add licenses table
        if "licenses" not in existing_tables:
            print("DB migration: adding licenses table...")
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS licenses (
                    id TEXT PRIMARY KEY,
                    user_id TEXT,
                    plan TEXT NOT NULL,
                    stripe_subscription_id TEXT,
                    stripe_customer_id TEXT,
                    status TEXT NOT NULL,
                    created_at TEXT,
                    expires_at TEXT
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_licenses_user_id ON licenses(user_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status)")
            conn.commit()
            print("licenses table added successfully")

        if "conflict_ignores" not in existing_tables:
            print("DB migration: adding conflict_ignores table...")
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS conflict_ignores (
                    global_component_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
                    project_component_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
                    PRIMARY KEY (global_component_id, project_component_id)
                )
                """
            )
            conn.commit()
            print("conflict_ignores table added successfully")

        # Issue #67: Add usage_parse_state table
        if "usage_parse_state" not in existing_tables:
            print("DB migration: adding usage_parse_state table...")
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS usage_parse_state (
                    project_path TEXT NOT NULL,
                    session_file TEXT NOT NULL,
                    byte_offset INTEGER NOT NULL DEFAULT 0,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (project_path, session_file)
                )
                """
            )
            conn.commit()
            print("usage_parse_state table added successfully")

        # Issue #67: Add usage_sessions table
        if "usage_sessions" not in existing_tables:
            print("DB migration: adding usage_sessions table...")
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS usage_sessions (
                    id TEXT PRIMARY KEY,
                    project_path TEXT NOT NULL,
                    session_file TEXT NOT NULL,
                    parsed_at TEXT NOT NULL,
                    UNIQUE(project_path, session_file)
                )
                """
            )
            conn.commit()
            print("usage_sessions table added successfully")

        # Issue #67: Add usage_stats table
        if "usage_stats" not in existing_tables:
            print("DB migration: adding usage_stats table...")
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS usage_stats (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL REFERENCES usage_sessions(id) ON DELETE CASCADE,
                    component_name TEXT NOT NULL,
                    component_type TEXT NOT NULL,
                    component_id TEXT REFERENCES components(id) ON DELETE SET NULL,
                    use_count INTEGER NOT NULL DEFAULT 1,
                    used_at TEXT NOT NULL,
                    has_timestamp INTEGER NOT NULL DEFAULT 1,
                    signal_quality TEXT NOT NULL DEFAULT 'strict'
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_usage_stats_session ON usage_stats(session_id)")
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_usage_stats_component ON usage_stats(component_name, component_type)"
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_usage_sessions_project ON usage_sessions(project_path)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_usage_stats_component_id ON usage_stats(component_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_usage_stats_signal_quality ON usage_stats(signal_quality)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_usage_stats_has_timestamp ON usage_stats(has_timestamp)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_usage_stats_used_at ON usage_stats(used_at)")
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_usage_stats_component_id_used_at ON usage_stats(component_id, used_at)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_usage_stats_component_name_used_at "
                "ON usage_stats(component_name, used_at)"
            )
            conn.commit()
            print("usage_stats table added successfully")

        # Issue #84: Add backups table
        if "backups" not in existing_tables:
            print("DB migration: adding backups table...")
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS backups (
                    id TEXT PRIMARY KEY,
                    version TEXT NOT NULL,
                    size_bytes INTEGER NOT NULL,
                    checksum TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at)")
            conn.commit()
            print("backups table added successfully")

        # Issue #764: Add project_templates table
        if "project_templates" not in existing_tables:
            print("DB migration: adding project_templates table...")
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS project_templates (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL,
                    scope TEXT NOT NULL DEFAULT 'user',
                    preset_type TEXT NOT NULL DEFAULT 'template',
                    tags TEXT NOT NULL DEFAULT '[]',
                    components TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    deleted_at TEXT
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_project_templates_scope ON project_templates(scope)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_project_templates_updated_at ON project_templates(updated_at)")
            conn.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_project_templates_name_unique_active
                ON project_templates(LOWER(name))
                WHERE deleted_at IS NULL
                """
            )
            conn.commit()
            print("project_templates table added successfully")
        else:
            cursor = conn.execute("PRAGMA table_info(project_templates)")
            project_template_columns = {row[1] for row in cursor.fetchall()}
            if "preset_type" not in project_template_columns:
                print("DB migration: adding preset_type column to project_templates table...")
                conn.execute("ALTER TABLE project_templates ADD COLUMN preset_type TEXT NOT NULL DEFAULT 'template'")
                conn.commit()
                print("preset_type column added successfully")

        if "project_templates" in existing_tables:
            placeholders = ",".join(["?"] * len(_LEGACY_SYSTEM_PRESET_IDS))
            if placeholders:
                print("DB migration: checking legacy system preset deactivation...")
                disabled_at = datetime.now(UTC).isoformat()
                cursor = conn.execute(
                    f"""
                    UPDATE project_templates
                    SET deleted_at = ?, updated_at = ?
                    WHERE scope = 'system'
                      AND deleted_at IS NULL
                      AND id IN ({placeholders})
                    """,
                    [disabled_at, disabled_at, *_LEGACY_SYSTEM_PRESET_IDS],
                )
                if cursor.rowcount > 0:
                    conn.commit()
                    print(f"Legacy system preset deactivation complete ({cursor.rowcount} items)")
                else:
                    print("No legacy system presets to deactivate")

        if "project_template_revisions" not in existing_tables:
            print("DB migration: adding project_template_revisions table...")
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS project_template_revisions (
                    id TEXT PRIMARY KEY,
                    template_id TEXT NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
                    revision INTEGER NOT NULL,
                    preset_type TEXT NOT NULL DEFAULT 'snapshot',
                    created_at TEXT NOT NULL,
                    created_by TEXT,
                    change_note TEXT,
                    UNIQUE(template_id, revision)
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_project_template_revisions_template
                ON project_template_revisions(template_id, revision DESC)
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_project_template_revisions_created_at
                ON project_template_revisions(created_at DESC)
                """
            )
            conn.commit()
            print("project_template_revisions table added successfully")

        if "project_template_revision_items" not in existing_tables:
            print("DB migration: adding project_template_revision_items table...")
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS project_template_revision_items (
                    id TEXT PRIMARY KEY,
                    revision_id TEXT NOT NULL REFERENCES project_template_revisions(id) ON DELETE CASCADE,
                    order_index INTEGER NOT NULL DEFAULT 0,
                    component_type TEXT NOT NULL,
                    name TEXT NOT NULL,
                    platform TEXT NOT NULL,
                    description TEXT,
                    content TEXT NOT NULL,
                    frontmatter_json TEXT NOT NULL DEFAULT '{}',
                    tags_json TEXT NOT NULL DEFAULT '[]',
                    source_component_id TEXT,
                    template_id TEXT,
                    config_json TEXT NOT NULL DEFAULT '{}',
                    content_hash TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_project_template_revision_items_revision
                ON project_template_revision_items(revision_id, order_index ASC)
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_project_template_revision_items_name
                ON project_template_revision_items(name, component_type, platform)
                """
            )
            conn.commit()
            print("project_template_revision_items table added successfully")

        if "preset_apply_logs" not in existing_tables:
            print("DB migration: adding preset_apply_logs table...")
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS preset_apply_logs (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    preset_id TEXT NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
                    revision INTEGER NOT NULL,
                    policy TEXT NOT NULL,
                    status TEXT NOT NULL,
                    summary_json TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT NOT NULL,
                    created_by TEXT
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_preset_apply_logs_project_created
                ON preset_apply_logs(project_id, created_at DESC)
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_preset_apply_logs_preset_created
                ON preset_apply_logs(preset_id, created_at DESC)
                """
            )
            conn.commit()
            print("preset_apply_logs table added successfully")

        if "project_templates" in existing_tables or "project_templates" in {
            row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        }:
            print("DB migration: checking preset revision backfill...")
            template_rows = conn.execute(
                """
                SELECT id, COALESCE(preset_type, 'template'), components, created_at, updated_at
                FROM project_templates
                WHERE deleted_at IS NULL
                """
            ).fetchall()

            backfilled_count = 0
            for template_id, preset_type, components_raw, created_at, updated_at in template_rows:
                existing_revision = conn.execute(
                    "SELECT COUNT(*) FROM project_template_revisions WHERE template_id = ?",
                    (template_id,),
                ).fetchone()
                if existing_revision and existing_revision[0] > 0:
                    continue

                revision_id = str(uuid.uuid4())
                revision_created_at = created_at or updated_at or datetime.now(UTC).isoformat()
                conn.execute(
                    """
                    INSERT INTO project_template_revisions
                    (id, template_id, revision, preset_type, created_at, created_by, change_note)
                    VALUES (?, ?, 1, ?, ?, NULL, ?)
                    """,
                    (
                        revision_id,
                        template_id,
                        preset_type or "template",
                        revision_created_at,
                        "auto backfill from legacy project_templates.components",
                    ),
                )

                try:
                    components = json.loads(components_raw) if components_raw else []
                except json.JSONDecodeError:
                    components = []

                if not isinstance(components, list):
                    components = []

                for idx, component in enumerate(components):
                    if not isinstance(component, dict):
                        continue

                    component_type = str(component.get("component_type") or "skill")
                    name = str(component.get("name") or f"component-{idx + 1}")
                    platform = str(component.get("platform") or "claude_code")
                    description = component.get("description")
                    content = str(component.get("content") or "")
                    frontmatter_json = json.dumps(component.get("frontmatter") or {}, ensure_ascii=False)
                    tags_json = json.dumps(component.get("tags") or [], ensure_ascii=False)
                    template_ref = component.get("template_id")
                    config_json = json.dumps(component.get("config") or {}, ensure_ascii=False)
                    content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()

                    conn.execute(
                        """
                        INSERT INTO project_template_revision_items
                        (id, revision_id, order_index, component_type, name, platform, description,
                         content, frontmatter_json, tags_json, source_component_id, template_id,
                         config_json, content_hash)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            str(uuid.uuid4()),
                            revision_id,
                            idx,
                            component_type,
                            name,
                            platform,
                            description,
                            content,
                            frontmatter_json,
                            tags_json,
                            None,
                            template_ref,
                            config_json,
                            content_hash,
                        ),
                    )

                backfilled_count += 1

            if backfilled_count > 0:
                conn.commit()
                print(f"Preset revision backfill complete ({backfilled_count} templates)")
            else:
                print("No preset revision backfill needed")

        # Issue #563: Add component_id column to usage_stats table
        if "usage_stats" in existing_tables:
            cursor = conn.execute("PRAGMA table_info(usage_stats)")
            usage_stats_columns = {row[1] for row in cursor.fetchall()}
            if "component_id" not in usage_stats_columns:
                print("DB migration: adding component_id column to usage_stats table...")
                try:
                    conn.execute(
                        "ALTER TABLE usage_stats ADD COLUMN component_id TEXT "
                        "REFERENCES components(id) ON DELETE SET NULL"
                    )
                    conn.execute("CREATE INDEX IF NOT EXISTS idx_usage_stats_component_id ON usage_stats(component_id)")
                    conn.commit()
                    print("component_id column added successfully")
                except sqlite3.OperationalError as e:
                    print(f"Migration failed: {e}")
            if "signal_quality" not in usage_stats_columns:
                print("DB migration: adding signal_quality column to usage_stats table...")
                try:
                    conn.execute("ALTER TABLE usage_stats ADD COLUMN signal_quality TEXT NOT NULL DEFAULT 'strict'")
                    conn.execute(
                        "CREATE INDEX IF NOT EXISTS idx_usage_stats_signal_quality ON usage_stats(signal_quality)"
                    )
                    conn.commit()
                    print("signal_quality column added successfully")
                except sqlite3.OperationalError as e:
                    print(f"Migration failed: {e}")
            if "has_timestamp" not in usage_stats_columns:
                print("DB migration: adding has_timestamp column to usage_stats table...")
                try:
                    conn.execute("ALTER TABLE usage_stats ADD COLUMN has_timestamp INTEGER NOT NULL DEFAULT 1")
                    conn.execute("UPDATE usage_stats SET has_timestamp = 0 WHERE signal_quality = 'fallback'")
                    conn.execute(
                        "CREATE INDEX IF NOT EXISTS idx_usage_stats_has_timestamp ON usage_stats(has_timestamp)"
                    )
                    conn.commit()
                    print("has_timestamp column added successfully")
                except sqlite3.OperationalError as e:
                    print(f"Migration failed: {e}")

            conn.execute("CREATE INDEX IF NOT EXISTS idx_usage_stats_has_timestamp ON usage_stats(has_timestamp)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_usage_stats_used_at ON usage_stats(used_at)")
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_usage_stats_component_id_used_at ON usage_stats(component_id, used_at)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_usage_stats_component_name_used_at "
                "ON usage_stats(component_name, used_at)"
            )
            conn.commit()

        if "components" in existing_tables:
            # Check columns in components table
            cursor = conn.execute("PRAGMA table_info(components)")
            columns = {row[1] for row in cursor.fetchall()}

            # Issue #67: Add last_used column
            if "last_used" not in columns:
                print("DB migration: adding last_used column to components table...")
                try:
                    conn.execute("ALTER TABLE components ADD COLUMN last_used TEXT")
                    conn.commit()
                    print("last_used column added successfully")
                except sqlite3.OperationalError as e:
                    print(f"Migration failed: {e}")

            # Add platform column if missing
            if "platform" not in columns:
                print("DB migration: adding platform column to components table...")
                try:
                    conn.execute("ALTER TABLE components ADD COLUMN platform TEXT NOT NULL DEFAULT 'claude_code'")
                    conn.commit()
                    print("platform column added successfully")
                except sqlite3.OperationalError as e:
                    print(f"Migration failed: {e}")
                    print("Tip: Delete the DB file and restart")
                    raise

        if "projects" in existing_tables:
            cursor = conn.execute("PRAGMA table_info(projects)")
            project_columns = {row[1] for row in cursor.fetchall()}

            if "hidden_at" not in project_columns:
                print("DB migration: adding hidden_at column to projects table...")
                try:
                    conn.execute("ALTER TABLE projects ADD COLUMN hidden_at TEXT")
                    conn.execute("CREATE INDEX IF NOT EXISTS idx_projects_hidden_at ON projects(hidden_at)")
                    conn.commit()
                    print("hidden_at column added successfully")
                except sqlite3.OperationalError as e:
                    print(f"Migration failed: {e}")

    def initialize_schema(self) -> None:
        """Create tables and indexes. Idempotent."""
        # Check if migration is needed
        if self._needs_migration():
            print("DB schema change detected - starting migration...")
            self._migrate_schema()

        conn = self.get_connection()
        conn.executescript(_SCHEMA_SQL)
        conn.commit()

        # Update schema version
        self._set_schema_version(_SCHEMA_VERSION)

    def clear_rescannable_data(self) -> dict:
        """For factory-reset: Delete data that can be recovered via rescan.

        Deleted: projects, components(CASCADE), dependencies(CASCADE),
                 activities(CASCADE), usage_sessions, usage_parse_state, usage_stats
        Preserved: presets, preset_revisions, collections, config, and other user-created data
        """
        conn = self.get_connection()
        # usage tables reference project_path as string without FK -> manual deletion required
        tables_to_clear = [
            "usage_stats",
            "usage_parse_state",
            "usage_sessions",
            "activities",
            "dependencies",
            "components",
            "projects",
        ]
        cleared = 0
        for table in tables_to_clear:
            try:
                conn.execute(f"DELETE FROM {table}")  # noqa: S608
                cleared += 1
            except sqlite3.OperationalError:
                pass  # Ignore if table doesn't exist
        conn.commit()
        return {"tables_cleared": cleared}

    def close(self) -> None:
        """Close the DB connection."""
        with self._connection_lock:
            for conn in self._connections_by_thread.values():
                conn.close()
            self._connections_by_thread.clear()
            self._connection = None
