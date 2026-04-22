"""Worker auto-restart supervisor — WorkerSupervisor."""

import threading
from typing import Any, Protocol

import structlog

logger = structlog.get_logger("vibesmith.supervisor")


class Worker(Protocol):
    """Protocol for supervised workers."""

    @property
    def is_running(self) -> bool: ...

    def start(self) -> None: ...


class WorkerSupervisor:
    """Periodically check worker status and restart dead workers."""

    def __init__(
        self,
        workers: list[Any],
        interval_seconds: float = 30.0,
    ) -> None:
        self._workers = workers
        self._interval = interval_seconds
        self._running = False
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()

    @property
    def is_running(self) -> bool:
        return self._running

    def start(self) -> None:
        """Start supervision."""
        if self._running:
            return
        self._running = True
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        """Stop supervision."""
        self._running = False
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=2.0)
            self._thread = None

    def _run(self) -> None:
        """Periodically check worker status."""
        while not self._stop_event.is_set():
            self._check_workers()
            self._stop_event.wait(timeout=self._interval)

    def _check_workers(self) -> None:
        """Check all workers and restart dead ones."""
        for worker in self._workers:
            if not worker.is_running:
                worker_name = getattr(worker, "name", worker.__class__.__name__)
                logger.warning("restarting_worker", worker_name=worker_name)
                try:
                    worker.start()
                except Exception:
                    logger.exception("worker_restart_failed", worker_name=worker_name)
