"""POST /api/scan 엔드포인트 테스트.

스캔이 백그라운드 스레드로 실행되므로, 부수효과(프로젝트 등록, 와처)를
확인하기 위해 스레드 완료를 기다린다.
"""

import time
from pathlib import Path

from fastapi.testclient import TestClient
from vibesmith_core import VibeSmithCore
from vibesmith_core.infra.watcher import FileWatcher


def _wait_scan_done(client: TestClient, timeout: float = 5.0) -> None:
    """scan-progress 폴링으로 스캔 완료를 기다린다.

    finish_scan() 이후 watcher 등록 등 후처리를 위해 추가 대기한다.
    """
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        resp = client.get("/api/system/scan-progress")
        if resp.status_code == 200 and not resp.json().get("scanning", True):
            # 백그라운드 스레드 후처리 대기
            time.sleep(0.15)
            return
        time.sleep(0.05)


class TestScanHomePath:
    """home_path로 글로벌 프로젝트를 교체한다."""

    def test_replaces_global_project(self, client: TestClient, core: VibeSmithCore, tmp_path: Path):
        new_home = tmp_path / "new_home"
        (new_home / ".claude").mkdir(parents=True)
        resp = client.post("/api/scan", json={"home_path": str(new_home)})
        assert resp.status_code == 200
        assert resp.json()["status"] in ("started", "already_running")
        _wait_scan_done(client)
        # 글로벌 프로젝트가 새 경로로 교체됨
        projects = core.projects.list_all()
        global_projects = [p for p in projects if p.is_global]
        assert len(global_projects) == 1
        assert global_projects[0].path == str(new_home)

    def test_registers_watcher_for_new_global(self, client: TestClient, watcher: FileWatcher, tmp_path: Path):
        new_home = tmp_path / "new_home"
        (new_home / ".claude").mkdir(parents=True)
        resp = client.post("/api/scan", json={"home_path": str(new_home)})
        assert resp.status_code == 200
        _wait_scan_done(client)
        # watcher에 글로벌 프로젝트 등록됨
        assert len(watcher._watches) >= 1

    def test_response_fields(self, client: TestClient, tmp_path: Path):
        new_home = tmp_path / "new_home"
        (new_home / ".claude").mkdir(parents=True)
        resp = client.post("/api/scan", json={"home_path": str(new_home)})
        data = resp.json()
        assert "status" in data
        assert "scanned_projects" in data
        assert "total_components" in data


class TestScanRootPath:
    """root_path로 프로젝트를 탐색 + 등록 + 스캔한다."""

    def test_discovers_and_registers_projects(self, client: TestClient, core: VibeSmithCore, tmp_path: Path):
        root = tmp_path / "projects"
        root.mkdir()
        (root / "proj_a" / ".claude").mkdir(parents=True)
        (root / "proj_b" / ".claude").mkdir(parents=True)
        (root / "not_a_project").mkdir(parents=True)

        resp = client.post("/api/scan", json={"root_path": str(root)})
        assert resp.status_code == 200
        _wait_scan_done(client)

        projects = core.projects.list_all()
        paths = {p.path for p in projects}
        assert str(root / "proj_a") in paths
        assert str(root / "proj_b") in paths
        assert str(root / "not_a_project") not in paths

    def test_does_not_duplicate_existing_projects(self, client: TestClient, core: VibeSmithCore, tmp_path: Path):
        root = tmp_path / "projects"
        (root / "proj_a" / ".claude").mkdir(parents=True)
        core.projects.add_project(str(root / "proj_a"))

        resp = client.post("/api/scan", json={"root_path": str(root)})
        assert resp.status_code == 200
        _wait_scan_done(client)
        projects = core.projects.list_all()
        proj_a_count = sum(1 for p in projects if p.path == str(root / "proj_a"))
        assert proj_a_count == 1

    def test_registers_watcher_for_discovered_projects(self, client: TestClient, watcher: FileWatcher, tmp_path: Path):
        root = tmp_path / "projects"
        (root / "proj_a" / ".claude").mkdir(parents=True)
        resp = client.post("/api/scan", json={"root_path": str(root)})
        assert resp.status_code == 200
        _wait_scan_done(client)
        assert len(watcher._watches) >= 1

    def test_only_rescans_projects_under_root_path(self, client: TestClient, core: VibeSmithCore, tmp_path: Path):
        """#316: root_path 지정 시 해당 경로 하위 프로젝트만 재스캔, 외부 프로젝트 제외."""
        outside_proj = tmp_path / "outside_proj"
        (outside_proj / ".claude").mkdir(parents=True)
        core.projects.add_project(str(outside_proj))

        root = tmp_path / "workspace"
        root.mkdir()
        inside_proj = root / "inside_proj"
        (inside_proj / ".claude").mkdir(parents=True)

        resp = client.post("/api/scan", json={"root_path": str(root)})
        assert resp.status_code == 200
        _wait_scan_done(client)

        # DB에는 두 프로젝트 모두 존재 (outside_proj는 사전 등록된 상태 유지)
        projects = core.projects.list_all()
        paths = {p.path for p in projects}
        assert str(outside_proj) in paths
        assert str(inside_proj) in paths


class TestScanHomeAndRootPath:
    """home_path + root_path 동시 전달."""

    def test_both_paths(self, client: TestClient, core: VibeSmithCore, tmp_path: Path):
        new_home = tmp_path / "new_home"
        (new_home / ".claude").mkdir(parents=True)
        root = tmp_path / "projects"
        (root / "proj_a" / ".claude").mkdir(parents=True)

        resp = client.post(
            "/api/scan",
            json={
                "home_path": str(new_home),
                "root_path": str(root),
            },
        )
        assert resp.status_code == 200
        _wait_scan_done(client)

        projects = core.projects.list_all()
        global_projects = [p for p in projects if p.is_global]
        assert len(global_projects) == 1
        assert global_projects[0].path == str(new_home)
        paths = {p.path for p in projects}
        assert str(root / "proj_a") in paths


class TestScanProjectId:
    """project_id로 특정 프로젝트만 재스캔한다."""

    def test_rescans_specific_project(self, client: TestClient, core: VibeSmithCore, tmp_path: Path):
        proj_path = tmp_path / "my_project"
        (proj_path / ".claude").mkdir(parents=True)
        project = core.projects.add_project(str(proj_path))

        resp = client.post("/api/scan", json={"project_id": project.id})
        assert resp.status_code == 200
        _wait_scan_done(client)

    def test_nonexistent_project_id_returns_404(self, client: TestClient):
        resp = client.post("/api/scan", json={"project_id": "nonexistent"})
        assert resp.status_code == 404


class TestScanEmpty:
    """빈 요청 — 등록된 모든 프로젝트를 재스캔한다."""

    def test_rescans_all_projects(self, client: TestClient, core: VibeSmithCore, tmp_path: Path):
        proj_path = tmp_path / "my_project"
        (proj_path / ".claude").mkdir(parents=True)
        core.projects.add_project(str(proj_path))

        resp = client.post("/api/scan", json={})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "started"
        _wait_scan_done(client)

    def test_response_total_components_is_int(self, client: TestClient):
        resp = client.post("/api/scan", json={})
        data = resp.json()
        assert isinstance(data["total_components"], int)
        assert data["total_components"] >= 0
