"""Usage statistics repository — usage table CRUD (Issue #67)."""

import sqlite3
import uuid
from datetime import UTC, date, datetime, timedelta

from vibesmith_core.usage.cursor_usage_parser import canonicalize_cursor_component

_SIGNAL_QUALITY_STRICT = "strict"
_SIGNAL_QUALITY_FALLBACK = "fallback"
_VALID_SIGNAL_QUALITIES = {_SIGNAL_QUALITY_STRICT, _SIGNAL_QUALITY_FALLBACK}
_AGGREGATION_MODE_STRICT = "strict"
_AGGREGATION_MODE_EXPANDED = "expanded"


def save_parse_state(
    conn: sqlite3.Connection,
    project_path: str,
    session_file: str,
    byte_offset: int,
    parser_version: int = 1,
) -> None:
    """Save the parse state (upsert).

    `parser_version`은 이 시점에 파싱한 파서 로직의 버전이다. scanner가 나중에
    PARSER_VERSION과 비교해 낮으면 해당 세션을 재파싱한다. 기본값은 하위 호환용 1이며,
    신규 파싱/재파싱 경로에서는 명시적으로 현재 PARSER_VERSION을 전달한다.
    """
    now = datetime.now(UTC).isoformat()
    conn.execute(
        """
        INSERT INTO usage_parse_state
            (project_path, session_file, byte_offset, updated_at, parser_version)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(project_path, session_file)
        DO UPDATE SET
            byte_offset = excluded.byte_offset,
            updated_at = excluded.updated_at,
            parser_version = excluded.parser_version
        """,
        (project_path, session_file, byte_offset, now, parser_version),
    )
    conn.commit()


def get_parse_state(
    conn: sqlite3.Connection,
    project_path: str,
    session_file: str,
) -> dict | None:
    """Look up the parse state."""
    row = conn.execute(
        "SELECT byte_offset, updated_at, parser_version "
        "FROM usage_parse_state WHERE project_path = ? AND session_file = ?",
        (project_path, session_file),
    ).fetchone()
    if row is None:
        return None
    return {"byte_offset": row[0], "updated_at": row[1], "parser_version": row[2]}


def _resolve_component(
    conn: sqlite3.Connection,
    project_path: str,
    component_name: str,
    component_type: str,
    platform: str = "claude_code",
) -> tuple[str | None, str]:
    """Match a component by (name, platform) within a project and return (ID, actual type).

    Claude Code's Skill tool calls skills/commands interchangeably,
    so matching is done by name only without component_type (#639).
    On successful match, returns the component's actual type for accurate storage in usage_stats.

    Returns:
        (component_id, actual_type) — On match failure: (None, original type from parser)
    """
    if not isinstance(project_path, str):
        safe_type = component_type if isinstance(component_type, str) and component_type else "rule"
        return None, safe_type
    if not isinstance(component_name, str) or not component_name.strip():
        safe_type = component_type if isinstance(component_type, str) and component_type else "rule"
        return None, safe_type
    if not isinstance(component_type, str) or not component_type.strip():
        component_type = "rule"

    row = conn.execute(
        "SELECT id FROM projects WHERE path = ?",
        (project_path,),
    ).fetchone()

    canonical_name, inferred_type = (
        canonicalize_cursor_component(component_name) if platform == "cursor" else (component_name, component_type)
    )

    if row:
        project_id = row[0]

        row = conn.execute(
            "SELECT id, type FROM components WHERE project_id = ? AND name = ? AND platform = ? AND deleted_at IS NULL",
            (project_id, component_name, platform),
        ).fetchone()
        if row:
            return row[0], row[1]

        if platform == "cursor" and canonical_name != component_name:
            row = conn.execute(
                "SELECT id, type FROM components "
                "WHERE project_id = ? AND name = ? "
                "AND platform = ? AND deleted_at IS NULL",
                (project_id, canonical_name, platform),
            ).fetchone()
            if row:
                return row[0], row[1]

    # Cursor's project_path is cursor:global so project path matching is impossible.
    # Only link when there's a unique match across all components by name/type/platform.
    if platform == "cursor":
        # 1) exact name + type + platform (existing priority)
        name_candidates = [component_name]
        if canonical_name != component_name:
            name_candidates.append(canonical_name)

        type_candidates = [component_type]
        if inferred_type != component_type:
            type_candidates.append(inferred_type)

        for name_candidate in name_candidates:
            for type_candidate in type_candidates:
                rows = conn.execute(
                    "SELECT id, type FROM components "
                    "WHERE name = ? AND type = ? AND platform = ? AND deleted_at IS NULL "
                    "LIMIT 2",
                    (name_candidate, type_candidate, platform),
                ).fetchall()
                if len(rows) == 1:
                    return rows[0][0], rows[0][1]

        # 2) name + platform unique match (type mismatch correction)
        for name_candidate in name_candidates:
            rows = conn.execute(
                "SELECT id, type FROM components WHERE name = ? AND platform = ? AND deleted_at IS NULL LIMIT 2",
                (name_candidate, platform),
            ).fetchall()
            if len(rows) == 1:
                return rows[0][0], rows[0][1]

        # 3) path heuristic unique match
        slug = canonical_name.lower().strip()
        if slug:
            path_patterns = [
                f"%/{slug}/skill.md",
                f"%/{slug}/skill.md.disabled",
                f"%/{slug}.md",
                f"%/{slug}.md.disabled",
                f"%/{slug}.mdc",
                f"%/{slug}.mdc.disabled",
                f"%/{slug}/%",
            ]
            rows = conn.execute(
                "SELECT id, type FROM components "
                "WHERE platform = 'cursor' AND deleted_at IS NULL "
                "AND (" + " OR ".join(["LOWER(REPLACE(path, '\\\\', '/')) LIKE ?" for _ in path_patterns]) + ") "
                "LIMIT 2",
                path_patterns,
            ).fetchall()
            if len(rows) == 1:
                return rows[0][0], rows[0][1]

    return None, component_type


def save_usage_stats(
    conn: sqlite3.Connection,
    project_path: str,
    session_file: str,
    stats: list[dict],
    platform: str = "claude_code",
    *,
    replace_existing_stats: bool = False,
) -> None:
    """Save usage statistics for a session.

    - Default: append incremental data to existing session
    - replace_existing_stats=True: delete existing session stats and replace with latest snapshot
    """
    now = datetime.now(UTC).isoformat()
    preserved_used_at_by_name_type: dict[tuple[str, str], str] = {}
    preserved_used_at_by_name: dict[str, str] = {}
    preserved_has_timestamp_by_name_type: dict[tuple[str, str], bool] = {}
    preserved_has_timestamp_by_name: dict[str, bool] = {}

    existing = conn.execute(
        "SELECT id FROM usage_sessions WHERE project_path = ? AND session_file = ?",
        (project_path, session_file),
    ).fetchone()

    if existing:
        session_id = existing[0]
        conn.execute(
            "UPDATE usage_sessions SET parsed_at = ? WHERE id = ?",
            (now, session_id),
        )
        if replace_existing_stats:
            previous_rows = conn.execute(
                "SELECT component_name, component_type, used_at, has_timestamp FROM usage_stats WHERE session_id = ?",
                (session_id,),
            ).fetchall()
            for component_name, component_type, used_at, has_timestamp in previous_rows:
                if not isinstance(component_name, str) or not component_name:
                    continue
                if not isinstance(component_type, str) or not component_type:
                    continue
                if not isinstance(used_at, str) or not used_at:
                    continue
                key = (component_name, component_type)
                saved_used_at = preserved_used_at_by_name_type.get(key)
                if saved_used_at is None or used_at < saved_used_at:
                    preserved_used_at_by_name_type[key] = used_at
                by_name_saved_used_at = preserved_used_at_by_name.get(component_name)
                if by_name_saved_used_at is None or used_at < by_name_saved_used_at:
                    preserved_used_at_by_name[component_name] = used_at
                has_timestamp_bool = bool(has_timestamp)
                preserved_has_timestamp_by_name_type[key] = (
                    preserved_has_timestamp_by_name_type.get(key, False) or has_timestamp_bool
                )
                preserved_has_timestamp_by_name[component_name] = (
                    preserved_has_timestamp_by_name.get(component_name, False) or has_timestamp_bool
                )
            conn.execute("DELETE FROM usage_stats WHERE session_id = ?", (session_id,))
    else:
        session_id = str(uuid.uuid4())
        try:
            conn.execute(
                "INSERT INTO usage_sessions (id, project_path, session_file, parsed_at) VALUES (?, ?, ?, ?)",
                (session_id, project_path, session_file, now),
            )
        except sqlite3.IntegrityError:
            # Re-query if the same (project_path, session_file) was created by a concurrent scan race.
            existing = conn.execute(
                "SELECT id FROM usage_sessions WHERE project_path = ? AND session_file = ?",
                (project_path, session_file),
            ).fetchone()
            if not existing:
                raise
            session_id = existing[0]
            conn.execute(
                "UPDATE usage_sessions SET parsed_at = ? WHERE id = ?",
                (now, session_id),
            )
            if replace_existing_stats:
                conn.execute("DELETE FROM usage_stats WHERE session_id = ?", (session_id,))

    for stat in stats:
        stat_id = str(uuid.uuid4())
        component_id, actual_type = _resolve_component(
            conn, project_path, stat["component_name"], stat["component_type"], platform=platform
        )
        raw_signal_quality = stat.get("signal_quality")
        signal_quality = (
            raw_signal_quality
            if isinstance(raw_signal_quality, str) and raw_signal_quality in _VALID_SIGNAL_QUALITIES
            else _SIGNAL_QUALITY_STRICT
        )
        component_name = stat["component_name"]
        component_type = stat["component_type"]
        incoming_used_at = stat["used_at"]
        incoming_has_timestamp = bool(stat.get("has_timestamp", True))
        persisted_used_at = (
            preserved_used_at_by_name_type.get((component_name, actual_type))
            or preserved_used_at_by_name_type.get((component_name, component_type))
            or preserved_used_at_by_name.get(component_name)
            or incoming_used_at
        )
        persisted_has_timestamp = (
            incoming_has_timestamp
            or preserved_has_timestamp_by_name_type.get((component_name, actual_type), False)
            or preserved_has_timestamp_by_name_type.get((component_name, component_type), False)
            or preserved_has_timestamp_by_name.get(component_name, False)
        )

        conn.execute(
            "INSERT INTO usage_stats "
            "(id, session_id, component_name, component_type, component_id, "
            "use_count, used_at, has_timestamp, signal_quality) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                stat_id,
                session_id,
                component_name,
                actual_type,
                component_id,
                stat["use_count"],
                persisted_used_at,
                1 if persisted_has_timestamp else 0,
                signal_quality,
            ),
        )

        if component_id and persisted_has_timestamp:
            conn.execute(
                "UPDATE components SET last_used = ? WHERE id = ? AND (last_used IS NULL OR last_used < ?)",
                (persisted_used_at, component_id, persisted_used_at),
            )

    conn.commit()


def _normalize_dedupe_mode(dedupe_by_session: bool | str) -> str:
    """Normalize the dedupe_by_session parameter.

    Returns:
        One of "auto", "true", "false"
    """
    if isinstance(dedupe_by_session, bool):
        return "true" if dedupe_by_session else "false"
    raw = str(dedupe_by_session).strip().lower()
    if raw in ("auto", "true", "false"):
        return raw
    return "auto"


def get_usage_ranking(
    conn: sqlite3.Connection,
    component_type: str | None = None,
    days: int | None = None,
    platform: str | None = None,
    project_id: str | None = None,
    matched_only: bool = False,
    aggregation_mode: str = _AGGREGATION_MODE_EXPANDED,
    dedupe_by_session: bool | str = "auto",
) -> list[dict]:
    """Return component ranking sorted by usage count in descending order.

    Args:
        component_type: Component type filter (skill, agent, hook)
        days: Only aggregate data from the last N days (None for all)
        platform: Platform filter ('claude_code', 'cursor'). None for all.
        project_id: Project ID filter. When specified, only aggregate sessions for that project.
        matched_only: If True, only return items with matched component_id (exclude built-ins).
        aggregation_mode: strict for high-confidence signals only, expanded includes fallback.
        dedupe_by_session: Aggregation mode.
            - "auto" (default): Cursor->session dedupe, Claude Code hook->session dedupe, rest->SUM
            - "true"/True: Full session dedupe
            - "false"/False: Full SUM(use_count)
    """
    normalized_mode = (
        aggregation_mode.strip().lower() if isinstance(aggregation_mode, str) else _AGGREGATION_MODE_EXPANDED
    )
    if normalized_mode not in {_AGGREGATION_MODE_STRICT, _AGGREGATION_MODE_EXPANDED}:
        normalized_mode = _AGGREGATION_MODE_EXPANDED

    dedupe_mode = _normalize_dedupe_mode(dedupe_by_session)

    if dedupe_mode == "true":
        count_expr = "COUNT(DISTINCT us.session_id)"
        time_qualified_expr = "COUNT(DISTINCT CASE WHEN us.has_timestamp = 1 THEN us.session_id END)"
        count_only_expr = "COUNT(DISTINCT CASE WHEN us.has_timestamp = 0 THEN us.session_id END)"
    elif dedupe_mode == "false":
        count_expr = "SUM(us.use_count)"
        time_qualified_expr = "SUM(CASE WHEN us.has_timestamp = 1 THEN us.use_count ELSE 0 END)"
        count_only_expr = "SUM(CASE WHEN us.has_timestamp = 0 THEN us.use_count ELSE 0 END)"
    else:
        # auto: Cursor->session dedupe, Claude Code hook->session dedupe, Claude Code non-hook->SUM
        _cursor_dedupe = "CASE WHEN sess.project_path LIKE 'cursor:%' THEN us.session_id END"
        _cc_hook_dedupe = (
            "CASE WHEN sess.project_path NOT LIKE 'cursor:%' AND us.component_type = 'hook' THEN us.session_id END"
        )
        _cc_non_hook = (
            "CASE WHEN sess.project_path NOT LIKE 'cursor:%' "
            "AND us.component_type != 'hook' THEN us.use_count ELSE 0 END"
        )

        count_expr = f"COUNT(DISTINCT {_cursor_dedupe}) + COUNT(DISTINCT {_cc_hook_dedupe}) + SUM({_cc_non_hook})"

        _cursor_dedupe_tq = (
            "CASE WHEN sess.project_path LIKE 'cursor:%' AND us.has_timestamp = 1 THEN us.session_id END"
        )
        _cc_hook_dedupe_tq = (
            "CASE WHEN sess.project_path NOT LIKE 'cursor:%' "
            "AND us.component_type = 'hook' AND us.has_timestamp = 1 THEN us.session_id END"
        )
        _cc_non_hook_tq = (
            "CASE WHEN sess.project_path NOT LIKE 'cursor:%' "
            "AND us.component_type != 'hook' AND us.has_timestamp = 1 THEN us.use_count ELSE 0 END"
        )
        time_qualified_expr = (
            f"COUNT(DISTINCT {_cursor_dedupe_tq}) + COUNT(DISTINCT {_cc_hook_dedupe_tq}) + SUM({_cc_non_hook_tq})"
        )

        _cursor_dedupe_co = (
            "CASE WHEN sess.project_path LIKE 'cursor:%' AND us.has_timestamp = 0 THEN us.session_id END"
        )
        _cc_hook_dedupe_co = (
            "CASE WHEN sess.project_path NOT LIKE 'cursor:%' "
            "AND us.component_type = 'hook' AND us.has_timestamp = 0 THEN us.session_id END"
        )
        _cc_non_hook_co = (
            "CASE WHEN sess.project_path NOT LIKE 'cursor:%' "
            "AND us.component_type != 'hook' AND us.has_timestamp = 0 THEN us.use_count ELSE 0 END"
        )
        count_only_expr = (
            f"COUNT(DISTINCT {_cursor_dedupe_co}) + COUNT(DISTINCT {_cc_hook_dedupe_co}) + SUM({_cc_non_hook_co})"
        )

    query = (
        "SELECT us.component_name, us.component_type, "
        f"{count_expr} as total_count, "
        f"{time_qualified_expr} as time_qualified_count, "
        f"{count_only_expr} as count_only_count, "
        "MAX(us.component_id) as component_id "
        "FROM usage_stats us "
        "JOIN usage_sessions sess ON us.session_id = sess.id"
    )
    conditions: list[str] = []
    params: list = []

    if component_type:
        conditions.append("us.component_type = ?")
        params.append(component_type)

    if days is not None:
        # has_timestamp=0 events are also included only within the stored used_at (estimated time) range.
        # Including unlimited historical count-only data would distort rate/density calculations.
        conditions.append("datetime(us.used_at) >= datetime('now', ?)")
        params.append(f"-{days} days")

    if project_id is not None:
        row = conn.execute("SELECT path FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not row:
            return []
        conditions.append("sess.project_path = ?")
        params.append(row[0])

    if platform == "cursor":
        conditions.append("sess.project_path LIKE 'cursor:%'")
    elif platform == "claude_code":
        conditions.append("sess.project_path NOT LIKE 'cursor:%'")

    if matched_only:
        conditions.append("us.component_id IS NOT NULL")

    if normalized_mode == _AGGREGATION_MODE_STRICT:
        conditions.append("us.signal_quality = ?")
        params.append(_SIGNAL_QUALITY_STRICT)

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " GROUP BY us.component_name, us.component_type ORDER BY total_count DESC"

    rows = conn.execute(query, params).fetchall()
    return [
        {
            "component_name": row[0],
            "component_type": row[1],
            "use_count": row[2],
            "time_qualified_count": row[3] or 0,
            "count_only_count": row[4] or 0,
            "component_id": row[5],
        }
        for row in rows
    ]


def get_unused_components(
    conn: sqlite3.Connection,
    component_type: str | None = None,
    project_id: str | None = None,
) -> list[dict]:
    """Return components that have never been used."""
    params: list[str] = []
    if project_id is None:
        query = """
            SELECT c.name, c.type, c.created_at
            FROM components c
            WHERE c.deleted_at IS NULL
              AND c.project_id NOT IN (
                  SELECT id FROM projects WHERE hidden_at IS NOT NULL
              )
              AND c.name NOT IN (
                  SELECT DISTINCT us.component_name FROM usage_stats us
              )
        """
        if component_type:
            query += " AND c.type = ?"
            params.append(component_type)
    else:
        query = """
            SELECT c.name, c.type, c.created_at
            FROM components c
            JOIN projects p ON p.id = c.project_id
            WHERE c.deleted_at IS NULL
              AND c.project_id = ?
              AND NOT EXISTS (
                  SELECT 1
                  FROM usage_stats us
                  JOIN usage_sessions sess ON us.session_id = sess.id
                  WHERE sess.project_path = p.path
                    AND (
                        us.component_id = c.id
                        OR (
                            us.component_id IS NULL
                            AND us.component_name = c.name
                        )
                    )
              )
        """
        params.append(project_id)
        if component_type:
            query += " AND c.type = ?"
            params.append(component_type)

    rows = conn.execute(query, params).fetchall()
    return [
        {
            "component_name": row[0],
            "component_type": row[1],
            "created_at": row[2],
        }
        for row in rows
    ]


def get_total_sessions(conn: sqlite3.Connection, project_id: str | None = None) -> int:
    """Return the total number of parsed sessions."""
    if project_id is None:
        row = conn.execute("SELECT COUNT(*) FROM usage_sessions").fetchone()
    else:
        project_row = conn.execute("SELECT path FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not project_row:
            return 0
        row = conn.execute(
            "SELECT COUNT(*) FROM usage_sessions WHERE project_path = ?",
            (project_row[0],),
        ).fetchone()
    return row[0] if row else 0


def reset_usage_data(conn: sqlite3.Connection) -> dict:
    """Reset all 3 usage-related tables.

    Returns:
        {"deleted_sessions": int, "deleted_parse_states": int}
    """
    sessions_count = conn.execute("SELECT COUNT(*) FROM usage_sessions").fetchone()[0]
    parse_states_count = conn.execute("SELECT COUNT(*) FROM usage_parse_state").fetchone()[0]

    conn.execute("DELETE FROM usage_stats")
    conn.execute("DELETE FROM usage_sessions")
    conn.execute("DELETE FROM usage_parse_state")
    conn.commit()

    return {
        "deleted_sessions": sessions_count,
        "deleted_parse_states": parse_states_count,
    }


def reset_usage_data_selective(
    conn: sqlite3.Connection,
    resettable_keys: list[tuple[str, str]],
) -> dict:
    """Reset only data matching the specified (project_path, session_file) pairs.

    Only resets sessions whose files still exist on disk, preserving data from deleted files.

    Returns:
        {"deleted_sessions": int, "deleted_parse_states": int}
    """
    if not resettable_keys:
        return {"deleted_sessions": 0, "deleted_parse_states": 0}

    deleted_sessions = 0
    deleted_parse_states = 0

    for project_path, session_file in resettable_keys:
        # Look up session_id from usage_sessions
        row = conn.execute(
            "SELECT id FROM usage_sessions WHERE project_path = ? AND session_file = ?",
            (project_path, session_file),
        ).fetchone()
        if row:
            session_id = row[0]
            conn.execute("DELETE FROM usage_stats WHERE session_id = ?", (session_id,))
            conn.execute("DELETE FROM usage_sessions WHERE id = ?", (session_id,))
            deleted_sessions += 1

        # Delete parse_state
        cursor = conn.execute(
            "DELETE FROM usage_parse_state WHERE project_path = ? AND session_file = ?",
            (project_path, session_file),
        )
        deleted_parse_states += cursor.rowcount

    conn.commit()
    return {"deleted_sessions": deleted_sessions, "deleted_parse_states": deleted_parse_states}


def get_component_timeline(
    conn: sqlite3.Connection,
    component_name: str | None = None,
    *,
    component_id: str | None = None,
    days: int = 1,
    limit: int = 10,
    aggregation_mode: str = _AGGREGATION_MODE_STRICT,
    reference_date: date | None = None,
) -> list[dict]:
    """Return the time-series usage trend for a component.

    Args:
        component_name: Component name to query (for legacy name-based lookup)
        component_id: Component ID to query (primary aggregation key, no name fallback)
        days: Aggregation interval (0=per-session, 1=daily, 7=weekly, etc.)
        limit: Number of items to return
        aggregation_mode: strict for high-confidence signals only, expanded includes fallback
        reference_date: Reference date (for testing, defaults to today)
    """
    if component_id and not component_name:
        row = conn.execute(
            "SELECT name FROM components WHERE id = ?",
            (component_id,),
        ).fetchone()
        if row:
            component_name = row[0]

    if not component_id and not component_name:
        return []

    normalized_mode = (
        aggregation_mode.strip().lower() if isinstance(aggregation_mode, str) else _AGGREGATION_MODE_EXPANDED
    )
    if normalized_mode not in {_AGGREGATION_MODE_STRICT, _AGGREGATION_MODE_EXPANDED}:
        normalized_mode = _AGGREGATION_MODE_EXPANDED

    quality_condition = ""
    quality_params: list[str] = []
    if normalized_mode == _AGGREGATION_MODE_STRICT:
        quality_condition = " AND signal_quality = ?"
        quality_params.append(_SIGNAL_QUALITY_STRICT)
    timestamp_condition = " AND has_timestamp = 1"

    if days == 0:
        # Per-session mode: individual records in reverse chronological order
        rows: list[tuple[str, int]]
        if component_id:
            rows = conn.execute(
                "SELECT used_at, use_count FROM usage_stats "
                "WHERE component_id = ?"
                f"{timestamp_condition}"
                f"{quality_condition} "
                "ORDER BY used_at DESC LIMIT ?",
                [component_id, *quality_params, limit],
            ).fetchall()
        elif component_name:
            rows = conn.execute(
                "SELECT used_at, use_count FROM usage_stats "
                "WHERE component_name = ?"
                f"{timestamp_condition}"
                f"{quality_condition} "
                "ORDER BY used_at DESC LIMIT ?",
                [component_name, *quality_params, limit],
            ).fetchall()
        else:
            rows = []
        if not rows:
            return []
        max_count = max(r[1] for r in rows)
        return [
            {
                "date": row[0],
                "count": row[1],
                "intensity": round(row[1] / max_count, 2) if max_count > 0 else 0.0,
            }
            for row in rows
        ]

    # days >= 1: interval-based aggregation
    # used_at is stored as UTC ISO string, so the reference date also uses UTC.
    ref = reference_date or datetime.now(UTC).date()

    # SQL query for daily totals
    if component_id:
        rows = conn.execute(
            "SELECT date(used_at) as day, SUM(use_count) as total "
            "FROM usage_stats WHERE component_id = ? "
            f"{timestamp_condition} "
            f"{quality_condition} "
            "GROUP BY date(used_at)",
            [component_id, *quality_params],
        ).fetchall()
    elif component_name:
        rows = conn.execute(
            "SELECT date(used_at) as day, SUM(use_count) as total "
            "FROM usage_stats WHERE component_name = ? "
            f"{timestamp_condition} "
            f"{quality_condition} "
            "GROUP BY date(used_at)",
            [component_name, *quality_params],
        ).fetchall()
    else:
        rows = []
    day_counts: dict[str, int] = {row[0]: row[1] for row in rows}

    # Interval aggregation + fill empty dates
    timeline: list[dict] = []
    for i in range(limit):
        end = ref - timedelta(days=i * days)
        start = end - timedelta(days=days - 1)

        total = 0
        d = start
        while d <= end:
            total += day_counts.get(d.isoformat(), 0)
            d += timedelta(days=1)

        timeline.append({"date": end.isoformat(), "count": total})

    # Calculate intensity
    max_count = max((t["count"] for t in timeline), default=0)
    for t in timeline:
        t["intensity"] = round(t["count"] / max_count, 2) if max_count > 0 else 0.0

    return timeline


def get_last_parsed_at(conn: sqlite3.Connection) -> str | None:
    """Return the most recent parsing timestamp."""
    row = conn.execute("SELECT MAX(parsed_at) FROM usage_sessions").fetchone()
    return row[0] if row and row[0] else None


def backfill_component_ids(conn: sqlite3.Connection) -> dict:
    """Perform retroactive matching for usage_stats records with NULL component_id.

    Returns:
        {"matched": int, "unmatched": int}
    """
    rows = conn.execute(
        "SELECT us.id, us.component_name, us.component_type, sess.project_path "
        "FROM usage_stats us "
        "JOIN usage_sessions sess ON us.session_id = sess.id "
        "WHERE us.component_id IS NULL"
    ).fetchall()

    matched = 0
    unmatched = 0

    for stat_id, name, type_, project_path in rows:
        if not isinstance(project_path, str):
            unmatched += 1
            continue
        if not isinstance(name, str) or not name.strip():
            unmatched += 1
            continue

        normalized_type = type_ if isinstance(type_, str) and type_ else "rule"
        platform = "cursor" if project_path.startswith("cursor:") else "claude_code"
        component_id, actual_type = _resolve_component(
            conn,
            project_path,
            name,
            normalized_type,
            platform=platform,
        )
        if component_id:
            conn.execute(
                "UPDATE usage_stats SET component_id = ?, component_type = ? WHERE id = ?",
                (component_id, actual_type, stat_id),
            )
            matched += 1
        else:
            unmatched += 1

    conn.commit()
    return {"matched": matched, "unmatched": unmatched}
