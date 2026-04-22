"""GET /api/system/scan-progress 엔드포인트 테스트."""

from vibesmith_core.infra.scan_progress import ScanProgressRegistry

from vibesmith_api.deps import get_scan_registry
from vibesmith_api.main import app


class TestGetScanProgress:
    """스캔 진행률 API 엔드포인트를 검증한다."""

    def test_returns_200(self, client):
        """항상 200을 반환한다."""
        registry = ScanProgressRegistry()
        app.dependency_overrides[get_scan_registry] = lambda: registry
        resp = client.get("/api/system/scan-progress")
        assert resp.status_code == 200

    def test_initial_not_scanning(self, client):
        """초기 상태에서 scanning=False."""
        registry = ScanProgressRegistry()
        app.dependency_overrides[get_scan_registry] = lambda: registry
        resp = client.get("/api/system/scan-progress")
        data = resp.json()
        assert data["scanning"] is False
        assert data["projects"] == []

    def test_returns_scanning_state(self, client):
        """스캔 중이면 scanning=True와 프로젝트 목록을 반환한다."""
        registry = ScanProgressRegistry()
        registry.start_scan("filesystem", ["p1", "p2"], {"p1": "P1", "p2": "P2"})
        registry.mark_scanning("p1")
        app.dependency_overrides[get_scan_registry] = lambda: registry
        resp = client.get("/api/system/scan-progress")
        data = resp.json()
        assert data["scanning"] is True
        assert len(data["projects"]) == 2

    def test_response_structure(self, client):
        """응답 필드 구조를 검증한다."""
        registry = ScanProgressRegistry()
        registry.start_scan("filesystem", ["p1"], {"p1": "My Project"})
        registry.mark_scanning("p1")
        registry.mark_done("p1")
        app.dependency_overrides[get_scan_registry] = lambda: registry
        resp = client.get("/api/system/scan-progress")
        proj = resp.json()["projects"][0]
        assert proj["id"] == "p1"
        assert proj["name"] == "My Project"
        assert proj["status"] == "done"
        assert proj["progress"] == 100
