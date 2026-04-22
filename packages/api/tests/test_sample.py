"""POST /api/sample-project, POST /api/projects/sample 엔드포인트 테스트 — Issue #267, #504."""

from pathlib import Path

from fastapi.testclient import TestClient
from vibesmith_core import VibeSmithCore


class TestCreateSampleProject:
    """샘플 프로젝트 생성 테스트."""

    def test_creates_sample_project_with_default_path(self, client: TestClient, core: VibeSmithCore, tmp_path: Path):
        """기본 경로로 샘플 프로젝트를 생성한다."""
        target = tmp_path / "sample-default"

        resp = client.post("/api/sample-project", json={"target_path": str(target)})
        assert resp.status_code == 201

        data = resp.json()
        assert "project_id" in data
        assert data["path"] == str(target.resolve())
        assert data["components_count"] == 8
        assert len(data["components"]) == 8

        # 디렉토리가 생성되었는지 확인
        assert target.exists()
        assert (target / ".claude").exists()

    def test_creates_all_component_types(self, client: TestClient, tmp_path: Path):
        """Skills 4개, Agents 2개, Commands 2개를 생성한다."""
        target = tmp_path / "sample-types"

        resp = client.post("/api/sample-project", json={"target_path": str(target)})
        data = resp.json()

        # 타입별 개수 확인
        types = [c["type"] for c in data["components"]]
        assert types.count("skill") == 4
        assert types.count("agent") == 2
        assert types.count("command") == 2

    def test_component_names_are_correct(self, client: TestClient, tmp_path: Path):
        """생성된 구성요소 이름이 예상과 일치한다."""
        target = tmp_path / "sample-names"

        resp = client.post("/api/sample-project", json={"target_path": str(target)})
        data = resp.json()

        names = {c["name"] for c in data["components"]}
        expected_names = {
            "git-commit",
            "react-feature",
            "api-integration",
            "react-testing",
            "ui-implementer",
            "test-writer",
            "spec-create",
            "code-review",
        }
        assert names == expected_names

    def test_returns_400_when_path_exists(self, client: TestClient, tmp_path: Path):
        """이미 존재하는 경로는 400 에러를 반환한다."""
        target = tmp_path / "existing"
        target.mkdir()

        resp = client.post("/api/sample-project", json={"target_path": str(target)})
        assert resp.status_code == 400
        assert "already exists" in resp.json()["detail"]

    def test_project_is_registered_and_scanned(self, client: TestClient, core: VibeSmithCore, tmp_path: Path):
        """샘플 프로젝트가 자동으로 등록되고 스캔된다."""
        target = tmp_path / "sample-registered"

        resp = client.post("/api/sample-project", json={"target_path": str(target)})
        data = resp.json()
        project_id = data["project_id"]

        # 프로젝트가 등록되었는지 확인
        project = core.projects.get(project_id)
        assert project is not None
        assert project.path == str(target.resolve())

        # 구성요소가 스캔되었는지 확인
        components = core.operations.list_all({"project_id": project_id})
        assert len(components) == 8

    def test_api_projects_sample_equivalent_to_sample_project(self, client: TestClient, tmp_path: Path):
        """POST /api/projects/sample은 POST /api/sample-project와 동일한 응답을 반환한다. Issue #504."""
        target = tmp_path / "sample-via-projects"
        resp = client.post("/api/projects/sample", json={"target_path": str(target)})
        assert resp.status_code == 201
        data = resp.json()
        assert "project_id" in data
        assert data["path"] == str(target.resolve())
        assert data["components_count"] == 8
        assert len(data["components"]) == 8
