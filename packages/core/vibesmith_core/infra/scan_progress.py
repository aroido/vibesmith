"""Scan progress registry — tracks per-project scan progress for all scan types."""

import threading
from dataclasses import dataclass
from enum import StrEnum


class ScanStatus(StrEnum):
    PENDING = "pending"
    SCANNING = "scanning"
    DONE = "done"


@dataclass
class ProjectScanState:
    project_id: str
    project_name: str
    status: ScanStatus
    project_path: str = ""


class ScanProgressRegistry:
    """Thread-safe registry for tracking scan progress.

    Shared across all scan types (filesystem, usage).
    Nested start_scan calls overwrite the previous state.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._projects: dict[str, ProjectScanState] = {}

    def start_scan(
        self,
        scan_type: str,
        project_ids: list[str],
        project_names: dict[str, str] | None = None,
        project_paths: dict[str, str] | None = None,
    ) -> None:
        """Start scan — initialize the project list as PENDING.

        If already scanning, overwrites the previous state (overwrite policy).
        """
        names = project_names or {}
        paths = project_paths or {}
        with self._lock:
            self._projects = {
                pid: ProjectScanState(
                    project_id=pid,
                    project_name=names.get(pid, pid),
                    status=ScanStatus.PENDING,
                    project_path=paths.get(pid, ""),
                )
                for pid in project_ids
            }

    def try_start_scan(
        self,
        scan_type: str,
        project_ids: list[str],
        project_names: dict[str, str] | None = None,
        project_paths: dict[str, str] | None = None,
    ) -> bool:
        """Atomic scan start — returns False if already scanning.

        TOCTOU prevention: check and start within a single lock.
        """
        names = project_names or {}
        paths = project_paths or {}
        with self._lock:
            is_scanning = any(s.status in (ScanStatus.PENDING, ScanStatus.SCANNING) for s in self._projects.values())
            if is_scanning:
                return False
            self._projects = {
                pid: ProjectScanState(
                    project_id=pid,
                    project_name=names.get(pid, pid),
                    status=ScanStatus.PENDING,
                    project_path=paths.get(pid, ""),
                )
                for pid in project_ids
            }
            return True

    def mark_scanning(self, project_id: str) -> None:
        """Transition a project to SCANNING status."""
        with self._lock:
            state = self._projects.get(project_id)
            if state is not None:
                state.status = ScanStatus.SCANNING

    def mark_done(self, project_id: str) -> None:
        """Transition a project to DONE status."""
        with self._lock:
            state = self._projects.get(project_id)
            if state is not None:
                state.status = ScanStatus.DONE

    def finish_scan(self) -> None:
        """Finish scan — transition incomplete projects to DONE and retain results.

        Keeps the project list so the frontend can detect completion via polling.
        Automatically reset on the next start_scan() call.
        """
        with self._lock:
            for state in self._projects.values():
                state.status = ScanStatus.DONE

    def get_progress(self) -> dict:
        """Return a snapshot of the current scan progress."""
        with self._lock:
            projects = [
                {
                    "id": s.project_id,
                    "name": s.project_name,
                    "path": s.project_path,
                    "status": s.status.value,
                    "progress": 100 if s.status == ScanStatus.DONE else 0,
                }
                for s in self._projects.values()
            ]
            scanning = any(s.status in (ScanStatus.PENDING, ScanStatus.SCANNING) for s in self._projects.values())
        return {"scanning": scanning, "projects": projects}
