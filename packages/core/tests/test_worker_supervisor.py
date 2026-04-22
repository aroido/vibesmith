"""WorkerSupervisor 테스트 — 워커 자동 재시작."""

import time

from vibesmith_core.infra.worker_supervisor import WorkerSupervisor


class _MockWorker:
    """테스트용 워커 스텁."""

    def __init__(self, name: str, alive: bool = True) -> None:
        self.name = name
        self._alive = alive
        self.start_count = 0
        self.stop_count = 0

    @property
    def is_running(self) -> bool:
        return self._alive

    def start(self) -> None:
        self.start_count += 1
        self._alive = True

    def stop(self) -> None:
        self.stop_count += 1
        self._alive = False

    def kill(self) -> None:
        """테스트에서 워커를 죽인 상태로 만든다."""
        self._alive = False


class TestWorkerSupervisor:
    """WorkerSupervisor — 워커 헬스체크 및 재시작."""

    def test_restarts_dead_worker(self):
        """죽은 워커를 자동으로 재시작한다."""
        worker = _MockWorker("test-worker")
        worker.kill()

        supervisor = WorkerSupervisor(workers=[worker], interval_seconds=0.1)
        supervisor.start()
        time.sleep(0.3)
        supervisor.stop()

        assert worker.start_count >= 1
        assert worker.is_running is True

    def test_does_not_restart_healthy_worker(self):
        """정상 워커는 재시작하지 않는다."""
        worker = _MockWorker("healthy-worker", alive=True)

        supervisor = WorkerSupervisor(workers=[worker], interval_seconds=0.1)
        supervisor.start()
        time.sleep(0.3)
        supervisor.stop()

        assert worker.start_count == 0

    def test_stop_terminates_supervisor(self):
        """stop() 호출 후 감시 스레드가 종료된다."""
        worker = _MockWorker("test-worker")
        supervisor = WorkerSupervisor(workers=[worker], interval_seconds=0.1)
        supervisor.start()
        assert supervisor.is_running is True
        supervisor.stop()
        time.sleep(0.2)
        assert supervisor.is_running is False

    def test_is_daemon_thread(self):
        """감시 스레드는 daemon이다."""
        worker = _MockWorker("test-worker")
        supervisor = WorkerSupervisor(workers=[worker], interval_seconds=0.5)
        supervisor.start()
        assert supervisor._thread.daemon is True
        supervisor.stop()
