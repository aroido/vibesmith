"""File change detection — watchdog wrapper with debounced callbacks."""

import os
import threading
from collections.abc import Callable

import structlog
from watchdog.events import FileSystemEvent, FileSystemEventHandler
from watchdog.observers import Observer

logger = structlog.get_logger("vibesmith.watcher")

# Only watch component-related paths under config directories (.claude/, .cursor/, etc.)
_WATCHED_SUBDIRS = {"skills", "agents", "commands", "rules"}
_WATCHED_FILES = {"settings.json"}


class _DebouncedHandler(FileSystemEventHandler):
    """Receives watchdog events and executes callbacks after per-project debounce."""

    def __init__(
        self,
        project_id: str,
        callbacks: list[Callable[[str], None]],
        debounce_seconds: float,
        base_path: str,
    ) -> None:
        self._project_id = project_id
        self._callbacks = callbacks
        self._debounce_seconds = debounce_seconds
        self._base_path = base_path
        self._timer: threading.Timer | None = None
        self._lock = threading.Lock()
        self._pending_events: list[str] = []

    def _is_relevant(self, src_path: str) -> bool:
        """Determine if the path is component-related."""
        rel = os.path.relpath(src_path, self._base_path)
        parts = rel.split(os.sep)
        # Files directly under config directory (settings.json)
        if len(parts) >= 1 and parts[0] in _WATCHED_FILES:
            return True
        # Component directories under config directory
        if len(parts) >= 1 and parts[0] in _WATCHED_SUBDIRS:
            return True
        return False

    def _on_any_event(self, event: FileSystemEvent) -> None:
        if event.is_directory:
            return
        if not self._is_relevant(event.src_path):
            return
        with self._lock:
            self._pending_events.append(f"{event.event_type}: {event.src_path}")
            if self._timer is not None:
                self._timer.cancel()
            self._timer = threading.Timer(self._debounce_seconds, self._fire)
            self._timer.daemon = True
            self._timer.start()

    def _fire(self) -> None:
        with self._lock:
            events = self._pending_events.copy()
            self._pending_events.clear()
        for e in events:
            logger.info("change_detected", project_id=self._project_id, detail=e)
        logger.info("executing_callbacks", project_id=self._project_id, change_count=len(events))
        for cb in self._callbacks:
            try:
                cb(self._project_id)
            except Exception:
                logger.exception("callback_execution_failed", project_id=self._project_id)

    def on_created(self, event: FileSystemEvent) -> None:
        self._on_any_event(event)

    def on_modified(self, event: FileSystemEvent) -> None:
        self._on_any_event(event)

    def on_deleted(self, event: FileSystemEvent) -> None:
        self._on_any_event(event)

    def on_moved(self, event: FileSystemEvent) -> None:
        self._on_any_event(event)


class FileWatcher:
    """Watch config directories (.claude/, .cursor/, etc.) of registered projects and invoke callbacks on changes."""

    def __init__(self, debounce_seconds: float = 0.5) -> None:
        self._debounce_seconds = debounce_seconds
        self._callbacks: list[Callable[[str], None]] = []
        self._watches: dict[str, list[str]] = {}  # project_id -> [paths]
        self._observer: Observer | None = None
        self._watch_handles: dict[str, list[object]] = {}  # project_id -> [handles]

    @property
    def is_running(self) -> bool:
        """Return whether the watcher is running."""
        return self._observer is not None and self._observer.is_alive()

    def watch(self, project_id: str, path: str) -> None:
        """Add a project path to watch list. Multiple paths per project are allowed."""
        if project_id not in self._watches:
            self._watches[project_id] = []
        if path in self._watches[project_id]:
            return
        self._watches[project_id].append(path)
        logger.info("watch_registered", project_id=project_id, path=path)
        if self.is_running:
            self._schedule_one(project_id, path)

    def unwatch(self, project_id: str) -> None:
        """Remove a project from the watch list."""
        if project_id not in self._watches:
            return
        paths = self._watches.pop(project_id)
        handles = self._watch_handles.pop(project_id, [])
        if self._observer is not None:
            for handle in handles:
                self._observer.unschedule(handle)
        for path in paths:
            logger.info("watch_removed", project_id=project_id, path=path)

    def on_change(self, callback: Callable[[str], None]) -> None:
        """Register a change callback. callback(project_id)."""
        self._callbacks.append(callback)

    def start(self) -> None:
        """Start watching."""
        if self.is_running:
            return
        self._observer = Observer()
        for project_id, paths in self._watches.items():
            for path in paths:
                self._schedule_one(project_id, path)
        self._observer.start()
        total = sum(len(paths) for paths in self._watches.values())
        logger.info("file_watcher_started", path_count=total)

    def stop(self) -> None:
        """Stop watching."""
        if self._observer is None:
            return
        self._observer.stop()
        self._observer.join(timeout=2)
        self._observer = None
        self._watch_handles.clear()
        logger.info("file_watcher_stopped")

    def _schedule_one(self, project_id: str, path: str) -> None:
        """Register one watch path with the observer."""
        if self._observer is None:
            return
        handler = _DebouncedHandler(project_id, self._callbacks, self._debounce_seconds, path)
        handle = self._observer.schedule(handler, path, recursive=True)
        if project_id not in self._watch_handles:
            self._watch_handles[project_id] = []
        self._watch_handles[project_id].append(handle)
