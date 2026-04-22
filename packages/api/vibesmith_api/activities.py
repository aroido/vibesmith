"""Activity logging (Issue #216) — automatic logging on component CRUD."""

import uuid
from datetime import UTC, datetime

from vibesmith_core import VibeSmithCore

ActivityType = str  # "component_created" | "component_updated" | "component_deleted"


def log_activity(
    core: VibeSmithCore,
    project_id: str,
    activity_type: ActivityType,
    *,
    component_id: str | None = None,
    component_name: str = "",
    component_type: str = "",
) -> None:
    """Log component CRUD activity to the activities table.

    Recording starts from implementation. Existing data is not backfilled.
    """
    conn = core.db.get_connection()
    activity_id = str(uuid.uuid4())
    now = datetime.now(UTC).isoformat()
    conn.execute(
        """INSERT INTO activities
           (id, project_id, component_id, activity_type, component_name, component_type, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (activity_id, project_id, component_id, activity_type, component_name, component_type, now),
    )
    conn.commit()
