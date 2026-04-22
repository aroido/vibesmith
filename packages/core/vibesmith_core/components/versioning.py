"""Version management — component history storage and rollback."""

import uuid
from datetime import UTC, datetime

from vibesmith_core.components.models import Version
from vibesmith_core.infra.db import DatabaseManager


class VersionManager:
    """Manages version history for components."""

    def __init__(self, db: DatabaseManager) -> None:
        self._db = db

    def save_version(self, component_id: str, content: str) -> int:
        """Save the current content as a new version and return the version number."""
        conn = self._db.get_connection()
        cursor = conn.execute(
            "SELECT COALESCE(MAX(version), 0) FROM versions WHERE component_id = ?",
            (component_id,),
        )
        next_version = cursor.fetchone()[0] + 1
        conn.execute(
            "INSERT INTO versions (id, component_id, version, content, created_at) VALUES (?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), component_id, next_version, content, datetime.now(UTC).isoformat()),
        )
        conn.commit()
        return next_version

    def list_versions(self, component_id: str) -> list[Version]:
        """Return the full version history of a component."""
        conn = self._db.get_connection()
        cursor = conn.execute(
            "SELECT id, component_id, version, content, created_at FROM versions"
            " WHERE component_id = ? ORDER BY version",
            (component_id,),
        )
        return [
            Version(id=row[0], component_id=row[1], version=row[2], content=row[3], created_at=row[4])
            for row in cursor.fetchall()
        ]

    def get_version_content(self, component_id: str, version: int) -> str:
        """Return the content of a specific version."""
        conn = self._db.get_connection()
        cursor = conn.execute(
            "SELECT content FROM versions WHERE component_id = ? AND version = ?",
            (component_id, version),
        )
        row = cursor.fetchone()
        if row is None:
            raise ValueError(f"Version {version} not found for component {component_id}")
        return row[0]

    def rollback(self, component_id: str, version: int) -> None:
        """Roll back the component content to the specified version."""
        content = self.get_version_content(component_id, version)
        conn = self._db.get_connection()
        conn.execute("UPDATE components SET content = ? WHERE id = ?", (content, component_id))
        conn.commit()
