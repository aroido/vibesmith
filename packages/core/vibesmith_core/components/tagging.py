"""Tag management — assign and search tags on components."""

from vibesmith_core.infra.db import DatabaseManager


class TagManager:
    """Component tag CRUD and search."""

    def __init__(self, db: DatabaseManager) -> None:
        self._db = db

    def add_tag(self, component_id: str, tag: str) -> None:
        """Add a tag to a component. Ignored if already exists."""
        conn = self._db.get_connection()
        conn.execute(
            "INSERT OR IGNORE INTO tags (component_id, tag) VALUES (?, ?)",
            (component_id, tag),
        )
        conn.commit()

    def remove_tag(self, component_id: str, tag: str) -> None:
        """Remove a tag from a component."""
        conn = self._db.get_connection()
        conn.execute(
            "DELETE FROM tags WHERE component_id = ? AND tag = ?",
            (component_id, tag),
        )
        conn.commit()

    def get_tags(self, component_id: str) -> list[str]:
        """Return the list of tags for a component."""
        conn = self._db.get_connection()
        cursor = conn.execute(
            "SELECT tag FROM tags WHERE component_id = ? ORDER BY tag",
            (component_id,),
        )
        return [row[0] for row in cursor.fetchall()]

    def search_by_tags(self, tags: list[str]) -> list[str]:
        """Return component IDs that have all the given tags (AND search)."""
        if not tags:
            return []
        conn = self._db.get_connection()
        placeholders = ",".join("?" for _ in tags)
        cursor = conn.execute(
            f"SELECT component_id FROM tags WHERE tag IN ({placeholders})"  # noqa: S608
            f" GROUP BY component_id HAVING COUNT(DISTINCT tag) = ?",
            [*tags, len(tags)],
        )
        return [row[0] for row in cursor.fetchall()]

    def list_all_tags(self) -> list[str]:
        """Return all unique tags in the system."""
        conn = self._db.get_connection()
        cursor = conn.execute("SELECT DISTINCT tag FROM tags ORDER BY tag")
        return [row[0] for row in cursor.fetchall()]
