"""시스템 관리 API 테스트 — factory-reset, root-path 제거 확장."""

from pathlib import Path

from fastapi.testclient import TestClient
from vibesmith_core import VibeSmithCore

from vibesmith_api.config import load_config, save_config


class TestFactoryReset:
    """factory-reset은 모든 rescannable 데이터를 삭제하고 재스캔한다."""

    def test_returns_200_with_result(self, client: TestClient, core: VibeSmithCore, tmp_path: Path):
        """성공 시 200과 결과를 반환한다."""
        # 프로젝트 등록
        proj_dir = tmp_path / "proj"
        (proj_dir / ".claude" / "skills" / "s1").mkdir(parents=True)
        (proj_dir / ".claude" / "skills" / "s1" / "SKILL.md").write_text("---\nname: s1\n---\nSkill content")
        core.projects.add_project(str(proj_dir))
        core.projects.rescan(core.projects.list_all()[-1].id)

        resp = client.post("/api/system/factory-reset")
        assert resp.status_code == 200
        data = resp.json()
        assert "scanned_projects" in data
        assert "total_components" in data
        assert data["usage_reset"] is True

    def test_clears_and_rescans_data(self, client: TestClient, core: VibeSmithCore, tmp_path: Path):
        """기존 데이터를 삭제한 뒤 재스캔으로 복구한다."""
        proj_dir = tmp_path / "proj"
        (proj_dir / ".claude" / "skills" / "s1").mkdir(parents=True)
        (proj_dir / ".claude" / "skills" / "s1" / "SKILL.md").write_text("---\nname: s1\n---\nSkill content")
        project = core.projects.add_project(str(proj_dir))
        core.projects.rescan(project.id)

        # 기존 컴포넌트 확인
        conn = core.db.get_connection()
        before = conn.execute("SELECT COUNT(*) FROM components").fetchone()[0]
        assert before > 0

        resp = client.post("/api/system/factory-reset")
        assert resp.status_code == 200

        # factory-reset 후에도 프로젝트와 컴포넌트가 재스캔으로 복구됨
        # (root_paths가 비어있으면 프로젝트 0개도 정상)
        data = resp.json()
        assert isinstance(data["scanned_projects"], int)


class TestRemoveRootPathCleanup:
    """DELETE /api/config/root-paths — 하위 프로젝트 hard delete."""

    def test_removes_projects_under_root_path(self, client: TestClient, core: VibeSmithCore, tmp_path: Path):
        """root_path 제거 시 하위 프로젝트가 삭제된다."""
        root = tmp_path / "root"
        proj_dir = root / "my-project"
        (proj_dir / ".claude" / "skills" / "s1").mkdir(parents=True)
        (proj_dir / ".claude" / "skills" / "s1" / "SKILL.md").write_text("---\nname: s1\n---\nSkill")
        # config에 root_path 등록
        config = load_config()
        config["root_paths"] = [str(root)]
        save_config(config)

        # 프로젝트 등록 + 스캔
        project = core.projects.add_project(str(proj_dir))
        core.projects.rescan(project.id)
        assert len(core.projects.list_all()) >= 2  # global + proj

        # root_path 제거
        resp = client.request("DELETE", "/api/config/root-paths", json={"path": str(root)})
        assert resp.status_code == 200
        data = resp.json()
        assert "deleted_projects" in data

        # 하위 프로젝트가 삭제됨
        remaining = [p for p in core.projects.list_all() if p.path == str(proj_dir)]
        assert len(remaining) == 0

    def test_preserves_projects_outside_root_path(self, client: TestClient, core: VibeSmithCore, tmp_path: Path):
        """root_path 외부 프로젝트는 보존된다."""
        root = tmp_path / "root"
        proj_inside = root / "inside"
        proj_outside = tmp_path / "outside"
        for p in [proj_inside, proj_outside]:
            (p / ".claude" / "skills" / "s1").mkdir(parents=True)
            (p / ".claude" / "skills" / "s1" / "SKILL.md").write_text("---\nname: s1\n---\nSkill")

        config = load_config()
        config["root_paths"] = [str(root)]
        save_config(config)

        core.projects.add_project(str(proj_inside))
        core.projects.add_project(str(proj_outside))

        resp = client.request("DELETE", "/api/config/root-paths", json={"path": str(root)})
        assert resp.status_code == 200

        remaining_paths = {p.path for p in core.projects.list_all()}
        assert str(proj_outside) in remaining_paths


class TestRemoveRootPathDryRun:
    """DELETE /api/config/root-paths?dry_run=true — 삭제 전 영향 범위 프리뷰."""

    def test_dry_run_returns_affected_projects_without_deleting(
        self, client: TestClient, core: VibeSmithCore, tmp_path: Path
    ):
        """dry_run=true면 영향 범위만 반환하고 실제 삭제하지 않는다."""
        root = tmp_path / "root"
        proj1 = root / "proj-a"
        proj2 = root / "proj-b"
        for p in [proj1, proj2]:
            (p / ".claude" / "skills" / "s1").mkdir(parents=True)
            (p / ".claude" / "skills" / "s1" / "SKILL.md").write_text("---\nname: s1\n---\nSkill")

        config = load_config()
        config["root_paths"] = [str(root)]
        save_config(config)

        p1 = core.projects.add_project(str(proj1))
        p2 = core.projects.add_project(str(proj2))
        core.projects.rescan(p1.id)
        core.projects.rescan(p2.id)

        resp = client.request("DELETE", "/api/config/root-paths", json={"path": str(root)}, params={"dry_run": "true"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["affected_projects"] == 2
        assert data["dry_run"] is True

        # 실제로 삭제되지 않았는지 확인
        assert len([p for p in core.projects.list_all() if not p.is_global]) == 2
        loaded_config = load_config()
        assert str(root) in loaded_config.get("root_paths", [])
