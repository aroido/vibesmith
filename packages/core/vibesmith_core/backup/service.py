"""Local backup/restore service (Issue #84)."""

from __future__ import annotations

import hashlib
import json
import sqlite3
import uuid
from datetime import UTC, datetime
from pathlib import Path

BACKUP_VERSION = "1.0.0"
BACKUP_FILENAME_SUFFIX = ".vibesmith.json"


class LocalBackupManager:
    """Manages local backup/restore of SQLite-based data."""

    def __init__(self, conn: sqlite3.Connection, backup_dir: str | Path | None = None) -> None:
        self._conn = conn
        self._backup_dir = (
            Path(backup_dir).expanduser() if backup_dir is not None else (Path.home() / ".vibesmith" / "backups")
        )
        self._backup_dir.mkdir(parents=True, exist_ok=True)

    def _now(self) -> str:
        return datetime.now(UTC).isoformat()

    def _table_columns(self, table_name: str) -> list[str]:
        rows = self._conn.execute(f"PRAGMA table_info({table_name})").fetchall()
        return [row[1] for row in rows]

    def _fetch_table_rows(self, table_name: str) -> list[dict]:
        cursor = self._conn.execute(f"SELECT * FROM {table_name}")
        columns = [col[0] for col in cursor.description]
        return [dict(zip(columns, row, strict=True)) for row in cursor.fetchall()]

    def _normalized_payload(self, payload: dict) -> bytes:
        return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")

    def _compute_checksum(self, payload: dict) -> str:
        return hashlib.sha256(self._normalized_payload(payload)).hexdigest()

    def _get_backup_row(self, backup_id: str) -> tuple | None:
        return self._conn.execute(
            "SELECT id, version, size_bytes, checksum, file_path, created_at FROM backups WHERE id = ?",
            (backup_id,),
        ).fetchone()

    def create_backup(self) -> dict:
        """Back up the current DB state to a local file and save metadata."""
        backup_id = str(uuid.uuid4())
        created_at = self._now()
        data = {
            "projects": self._fetch_table_rows("projects"),
            "components": self._fetch_table_rows("components"),
            "tags": self._fetch_table_rows("tags"),
            "dependencies": self._fetch_table_rows("dependencies"),
            "versions": self._fetch_table_rows("versions"),
        }
        payload_without_checksum = {
            "version": BACKUP_VERSION,
            "timestamp": created_at,
            "user_id": None,
            "data": data,
        }
        checksum = self._compute_checksum(payload_without_checksum)
        payload = {**payload_without_checksum, "checksum": checksum}

        backup_path = self._backup_dir / f"{backup_id}{BACKUP_FILENAME_SUFFIX}"
        backup_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        size_bytes = backup_path.stat().st_size

        self._conn.execute(
            "INSERT INTO backups (id, version, size_bytes, checksum, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (backup_id, BACKUP_VERSION, size_bytes, checksum, str(backup_path), created_at),
        )
        self._conn.commit()

        return {
            "id": backup_id,
            "version": BACKUP_VERSION,
            "size_bytes": size_bytes,
            "checksum": checksum,
            "created_at": created_at,
        }

    def list_backups(self) -> list[dict]:
        """Return the list of saved backups in reverse chronological order."""
        rows = self._conn.execute(
            "SELECT id, version, size_bytes, checksum, created_at FROM backups ORDER BY created_at DESC",
        ).fetchall()
        return [
            {
                "id": row[0],
                "version": row[1],
                "size_bytes": row[2],
                "checksum": row[3],
                "created_at": row[4],
            }
            for row in rows
        ]

    def get_backup(self, backup_id: str) -> dict | None:
        """Return backup metadata + payload."""
        row = self._get_backup_row(backup_id)
        if row is None:
            return None

        backup_path = Path(row[4])
        if not backup_path.is_file():
            return None

        payload = json.loads(backup_path.read_text(encoding="utf-8"))
        return {
            "id": row[0],
            "version": row[1],
            "size_bytes": row[2],
            "checksum": row[3],
            "created_at": row[5],
            "payload": payload,
        }

    def delete_backup(self, backup_id: str) -> bool:
        """Delete backup file and metadata."""
        row = self._get_backup_row(backup_id)
        if row is None:
            return False

        backup_path = Path(row[4])
        if backup_path.is_file():
            backup_path.unlink()

        self._conn.execute("DELETE FROM backups WHERE id = ?", (backup_id,))
        self._conn.commit()
        return True

    def _bulk_insert(self, table_name: str, rows: list[dict]) -> None:
        if not rows:
            return
        available_columns = set(self._table_columns(table_name))
        columns = [c for c in rows[0].keys() if c in available_columns]
        if not columns:
            return

        placeholders = ", ".join("?" for _ in columns)
        sql = f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({placeholders})"
        params = [tuple(row.get(c) for c in columns) for row in rows]
        self._conn.executemany(sql, params)

    def restore_backup(self, backup_id: str) -> dict:
        """Validate the backup and restore core table data."""
        backup = self.get_backup(backup_id)
        if backup is None:
            raise FileNotFoundError("Backup not found")

        payload = backup["payload"]
        checksum = payload.get("checksum")
        payload_without_checksum = {k: v for k, v in payload.items() if k != "checksum"}
        if not checksum or checksum != self._compute_checksum(payload_without_checksum):
            raise ValueError("Invalid backup checksum")

        data = payload.get("data", {})

        self._conn.execute("BEGIN")
        try:
            self._conn.execute("DELETE FROM tags")
            self._conn.execute("DELETE FROM dependencies")
            self._conn.execute("DELETE FROM versions")
            self._conn.execute("DELETE FROM activities")
            self._conn.execute("DELETE FROM components")
            self._conn.execute("DELETE FROM projects")

            self._bulk_insert("projects", data.get("projects", []))
            self._bulk_insert("components", data.get("components", []))
            self._bulk_insert("tags", data.get("tags", []))
            self._bulk_insert("dependencies", data.get("dependencies", []))
            self._bulk_insert("versions", data.get("versions", []))
            self._conn.commit()
        except Exception:
            self._conn.rollback()
            raise

        return {
            "restored_projects": len(data.get("projects", [])),
            "restored_components": len(data.get("components", [])),
            "restored_tags": len(data.get("tags", [])),
            "restored_dependencies": len(data.get("dependencies", [])),
            "restored_versions": len(data.get("versions", [])),
        }
