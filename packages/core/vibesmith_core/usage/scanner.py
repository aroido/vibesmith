"""UsageScanner — periodic/manual session parsing (Issue #67, #566, #630).

Parses Claude Code session logs and Cursor state.vscdb for registered projects and saves to usage DB.
- 1-minute periodic background scan (start/stop)
- Manual scan (scan_once)
"""

from __future__ import annotations

import os
import sqlite3
import threading
from pathlib import Path
from typing import TYPE_CHECKING

import structlog

if TYPE_CHECKING:
    from vibesmith_core.infra.scan_progress import ScanProgressRegistry

from vibesmith_core.usage.adapters import (
    CURSOR_GLOBAL_PROJECT_PATH,
    CURSOR_SESSION_FILE_ID,
    ClaudeCodeUsageAdapter,
    CursorUsageAdapter,
)
from vibesmith_core.usage.cursor_usage_parser import parse_cursor_agentkv_db, parse_cursor_db
from vibesmith_core.usage.parser import PARSER_VERSION, parse_session_file
from vibesmith_core.usage.repo import (
    get_parse_state,
    reset_usage_data_selective,
    save_parse_state,
    save_usage_stats,
)

logger = structlog.get_logger("vibesmith.usage_scanner")
_CURSOR_PARSE_STATE_VERSION = "v2"
_CURSOR_PARSE_STATE_KEY = f"{CURSOR_SESSION_FILE_ID}:{_CURSOR_PARSE_STATE_VERSION}"
_CURSOR_AGENTKV_ROWID_STATE_VERSION = "v2"
_CURSOR_AGENTKV_ROWID_STATE_KEY = f"agentKv:blob:rowid:{_CURSOR_AGENTKV_ROWID_STATE_VERSION}"
_CURSOR_AGENTKV_ROWID_OVERLAP = 5000


class UsageScanner:
    """Periodically parse session logs for registered projects."""

    def __init__(
        self,
        conn: sqlite3.Connection,
        claude_base_dir: str | None = None,
        cursor_base_dir: str | None = None,
        interval_seconds: int = 60,
        registry: ScanProgressRegistry | None = None,
    ) -> None:
        self._conn = conn
        self._claude_base_dir = claude_base_dir or str(Path.home() / ".claude" / "projects")
        self._cursor_base_dir = cursor_base_dir
        self._interval = interval_seconds
        self._timer: threading.Timer | None = None
        self._running = False
        self._lock = threading.Lock()
        self._scan_lock = threading.Lock()
        self._registry = registry

        # Adapters (#630)
        self._claude_adapter = ClaudeCodeUsageAdapter(self._claude_base_dir)
        self._cursor_adapter = CursorUsageAdapter(self._cursor_base_dir)

    @property
    def is_running(self) -> bool:
        return self._running

    def wait_for_idle(self, timeout: float = 10.0) -> bool:
        """Wait for an in-progress scan to complete.

        Returns:
            True — scan completed or not in progress
            False — timeout exceeded
        """
        acquired = self._scan_lock.acquire(timeout=timeout)
        if acquired:
            self._scan_lock.release()
        return acquired

    def _get_registered_projects(self) -> list[dict]:
        """Query registered project list from DB."""
        try:
            rows = self._conn.execute("SELECT id, path FROM projects WHERE hidden_at IS NULL").fetchall()
            return [{"id": row[0], "path": row[1]} for row in rows]
        except Exception:
            logger.exception("failed_to_query_project_list")
            return []

    def scan_once(self, *, update_registry: bool = True) -> dict:
        """Scan sessions for all registered projects once (Claude Code + Cursor).

        Args:
            update_registry: If False, do not update ScanProgressRegistry state.
                Used to prevent progress overwrite when chained after filesystem scan.

        Returns:
            {"sessions_parsed": int, "stats_saved": int}
        """
        if not self._scan_lock.acquire(blocking=False):
            logger.info("usage_scan_skipped", reason="already_running")
            return {"sessions_parsed": 0, "stats_saved": 0}

        try:
            # Registry: start scan
            if update_registry and self._registry is not None:
                projects = self._get_registered_projects()
                self._registry.start_scan(
                    scan_type="usage",
                    project_ids=[p["id"] for p in projects],
                    project_names={p["id"]: p.get("path", p["id"]) for p in projects},
                )

            cc_result = self._scan_claude_code()
            cursor_result = self._scan_cursor()

            total_sessions = cc_result["sessions_parsed"] + cursor_result["sessions_parsed"]
            total_stats = cc_result["stats_saved"] + cursor_result["stats_saved"]

            logger.info(
                "usage_scan_complete",
                sessions_parsed=total_sessions,
                stats_saved=total_stats,
            )

            return {"sessions_parsed": total_sessions, "stats_saved": total_stats}
        finally:
            if update_registry and self._registry is not None:
                self._registry.finish_scan()
            self._scan_lock.release()

    def _scan_claude_code(self) -> dict:
        """Claude Code JSONL session scan."""
        total_sessions = 0
        total_stats = 0

        projects = self._get_registered_projects()

        for project in projects:
            project_id = project["id"]
            project_path = project["path"]

            if self._registry is not None:
                self._registry.mark_scanning(project_id)

            session_dir = self._claude_adapter.session_dir_for(project_path)
            if session_dir is None:
                if self._registry is not None:
                    self._registry.mark_done(project_id)
                continue

            for jsonl_file in sorted(session_dir.glob("*.jsonl")):
                filename = jsonl_file.name

                state = get_parse_state(self._conn, project_path, filename)
                file_size = jsonl_file.stat().st_size

                # Issue #2: 파서 로직이 업그레이드되면 이미 파싱된 세션도 자동 재파싱한다
                needs_reparse = state is not None and state["parser_version"] < PARSER_VERSION
                if needs_reparse:
                    offset = 0
                    replace_existing = True
                else:
                    offset = state["byte_offset"] if state else 0
                    replace_existing = False

                if not needs_reparse and offset >= file_size:
                    continue

                stats = parse_session_file(str(jsonl_file), byte_offset=offset)
                if not stats:
                    save_parse_state(
                        self._conn,
                        project_path,
                        filename,
                        file_size,
                        parser_version=PARSER_VERSION,
                    )
                    continue

                save_usage_stats(
                    self._conn,
                    project_path=project_path,
                    session_file=filename,
                    stats=stats,
                    replace_existing_stats=replace_existing,
                )
                save_parse_state(
                    self._conn,
                    project_path,
                    filename,
                    file_size,
                    parser_version=PARSER_VERSION,
                )

                total_sessions += 1
                total_stats += len(stats)

            if self._registry is not None:
                self._registry.mark_done(project_id)

        return {"sessions_parsed": total_sessions, "stats_saved": total_stats}

    def _scan_cursor(self) -> dict:
        """Cursor state.vscdb scan (Issue #566, #853)."""
        if not self._cursor_base_dir:
            return {"sessions_parsed": 0, "stats_saved": 0}

        from vibesmith_core.usage.cursor_discovery import discover_cursor_db_path

        db_path = discover_cursor_db_path(base_dir=self._cursor_base_dir)
        if not db_path:
            return {"sessions_parsed": 0, "stats_saved": 0}

        try:
            # Cursor may only have sqlite WAL (-wal/-shm) updates,
            # so also check sidecar file mtime.
            current_mtime = self._get_cursor_change_mtime(db_path)
            state = get_parse_state(self._conn, CURSOR_GLOBAL_PROJECT_PATH, _CURSOR_PARSE_STATE_KEY)
            last_mtime = state["byte_offset"] if state else 0
            should_scan_composer = (state is None) or (current_mtime > last_mtime)

            composer_results = parse_cursor_db(db_path) if should_scan_composer else []

            rowid_state = get_parse_state(self._conn, CURSOR_GLOBAL_PROJECT_PATH, _CURSOR_AGENTKV_ROWID_STATE_KEY)
            last_rowid = rowid_state["byte_offset"] if rowid_state else 0
            # Apply overlap re-query (for recovery) only when DB change signal is detected.
            # In other periodic scans, only read after last_rowid to reduce load.
            if should_scan_composer:
                effective_min_rowid = max(0, last_rowid - _CURSOR_AGENTKV_ROWID_OVERLAP)
            else:
                effective_min_rowid = last_rowid
            agentkv_results, checkpoint_rowid = parse_cursor_agentkv_db(db_path, min_rowid=effective_min_rowid)
            next_rowid = max(last_rowid, checkpoint_rowid)
            next_mtime = current_mtime if should_scan_composer else last_mtime

            # TODO(Issue #2): Cursor parser_version 지원은 별도 Issue. 현재는 parser_version=1(기본값) 저장됨.
            if not composer_results and not agentkv_results:
                save_parse_state(self._conn, CURSOR_GLOBAL_PROJECT_PATH, _CURSOR_PARSE_STATE_KEY, next_mtime)
                save_parse_state(self._conn, CURSOR_GLOBAL_PROJECT_PATH, _CURSOR_AGENTKV_ROWID_STATE_KEY, next_rowid)
                return {"sessions_parsed": 0, "stats_saved": 0}

            total_sessions = 0
            total_stats = 0

            # composerData is snapshot-like, so save by overwriting the same session.
            for session in composer_results:
                save_usage_stats(
                    self._conn,
                    project_path=CURSOR_GLOBAL_PROJECT_PATH,
                    session_file=session["session_key"],
                    stats=session["stats"],
                    platform="cursor",
                    replace_existing_stats=True,
                )
                total_sessions += 1
                total_stats += len(session["stats"])

            # agentKv uses tool-call event-level session_key.
            for session in agentkv_results:
                save_usage_stats(
                    self._conn,
                    project_path=CURSOR_GLOBAL_PROJECT_PATH,
                    session_file=session["session_key"],
                    stats=session["stats"],
                    platform="cursor",
                    replace_existing_stats=True,
                )
                total_sessions += 1
                total_stats += len(session["stats"])

            # Save parse state
            save_parse_state(self._conn, CURSOR_GLOBAL_PROJECT_PATH, _CURSOR_PARSE_STATE_KEY, next_mtime)
            save_parse_state(self._conn, CURSOR_GLOBAL_PROJECT_PATH, _CURSOR_AGENTKV_ROWID_STATE_KEY, next_rowid)

            return {"sessions_parsed": total_sessions, "stats_saved": total_stats}
        except Exception:
            logger.exception("cursor_scan_failed")
            return {"sessions_parsed": 0, "stats_saved": 0}

    @staticmethod
    def _get_cursor_change_mtime(db_path: str) -> int:
        """Return the combined modification time of Cursor sqlite main file + WAL/SHM."""
        mtimes: list[int] = []
        for candidate in (db_path, f"{db_path}-wal", f"{db_path}-shm"):
            try:
                mtimes.append(int(os.path.getmtime(candidate)))
            except OSError:
                continue
        return max(mtimes) if mtimes else 0

    def reset(self) -> dict:
        """Reset only session data for which files still exist.

        Preserves data from deleted session files to prevent data loss.

        Returns:
            {"deleted_sessions": int, "deleted_parse_states": int,
             "preserved_sessions": int, "preserved_parse_states": int}
        """
        # Query all session records from DB
        all_sessions = self._conn.execute("SELECT project_path, session_file FROM usage_sessions").fetchall()
        all_parse_states = self._conn.execute("SELECT project_path, session_file FROM usage_parse_state").fetchall()

        # Collect all unique (project_path, session_file) keys from sessions + parse_state
        all_keys = {(row[0], row[1]) for row in all_sessions} | {(row[0], row[1]) for row in all_parse_states}

        # Classify by file existence — delegate to adapters (#630)
        resettable: list[tuple[str, str]] = []
        for project_path, session_file in all_keys:
            if self._claude_adapter.is_session_file_accessible(
                project_path, session_file
            ) or self._cursor_adapter.is_session_file_accessible(project_path, session_file):
                resettable.append((project_path, session_file))

        # Execute selective reset
        result = reset_usage_data_selective(self._conn, resettable)

        # Calculate preserved count
        total_sessions = len(all_sessions)
        total_parse_states = len(all_parse_states)

        logger.info(
            "usage_reset_complete",
            deleted_sessions=result["deleted_sessions"],
            preserved_sessions=total_sessions - result["deleted_sessions"],
            deleted_parse_states=result["deleted_parse_states"],
            preserved_parse_states=total_parse_states - result["deleted_parse_states"],
        )

        return {
            "deleted_sessions": result["deleted_sessions"],
            "deleted_parse_states": result["deleted_parse_states"],
            "preserved_sessions": total_sessions - result["deleted_sessions"],
            "preserved_parse_states": total_parse_states - result["deleted_parse_states"],
        }

    def _periodic_scan(self) -> None:
        """Execute periodic scan and schedule the next timer."""
        if not self._running:
            return
        try:
            self.scan_once()
        except Exception:
            logger.exception("periodic_usage_scan_failed")
        finally:
            if self._running:
                self._timer = threading.Timer(self._interval, self._periodic_scan)
                self._timer.daemon = True
                self._timer.start()

    def start(self) -> None:
        """Start periodic scanning."""
        with self._lock:
            if self._running:
                return
            self._running = True
            # Scan once immediately then repeat periodically
            self._timer = threading.Timer(0, self._periodic_scan)
            self._timer.daemon = True
            self._timer.start()
            logger.info(
                "usage_scanner_started",
                interval_seconds=self._interval,
            )

    def stop(self) -> None:
        """Stop periodic scanning."""
        with self._lock:
            if not self._running:
                return
            self._running = False
            if self._timer is not None:
                self._timer.cancel()
                self._timer = None
            logger.info("usage_scanner_stopped")
