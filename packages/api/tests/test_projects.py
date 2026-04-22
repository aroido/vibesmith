"""GET /api/projects 엔드포인트 테스트."""

import shutil
import uuid
from datetime import UTC, datetime
from unittest.mock import patch

from fastapi.testclient import TestClient
from vibesmith_core.components.models import Command, Skill


def _now():
    return datetime.now(UTC).isoformat()


def _create_skill(core, project_id, name="test-skill", description="test"):
    """DB에 스킬을 직접 생성한다."""
    skill = Skill(
        id=str(uuid.uuid4()),
        name=name,
        description=description,
        enabled=True,
        tags=[],
        project_id=project_id,
        path=f"/fake/skills/{name}/SKILL.md",
        content=f"---\nname: {name}\n---\n\nBody of {name}",
        frontmatter={"name": name, "description": description},
        created_at=_now(),
        updated_at=_now(),
        platform="claude_code",
    )
    core.operations.create(skill)
    return skill


def _create_command(core, project_id, name="test-cmd", description="test cmd"):
    """DB에 커맨드를 직접 생성한다."""
    cmd = Command(
        id=str(uuid.uuid4()),
        name=name,
        description=description,
        enabled=True,
        tags=[],
        project_id=project_id,
        path=f"/fake/commands/{name}.md",
        content=f"# {name}\n\nCommand body",
        frontmatter=None,
        created_at=_now(),
        updated_at=_now(),
        platform="claude_code",
    )
    core.operations.create(cmd)
    return cmd


class TestListProjects:
    """프로젝트 목록 조회 API 테스트."""

    def test_returns_200(self, client: TestClient):
        resp = client.get("/api/projects")
        assert resp.status_code == 200

    def test_returns_list(self, client: TestClient):
        resp = client.get("/api/projects")
        assert isinstance(resp.json(), list)

    def test_includes_global_project(self, client: TestClient):
        resp = client.get("/api/projects")
        projects = resp.json()
        global_projects = [p for p in projects if p["is_global"] is True]
        assert len(global_projects) == 1

    def test_project_fields(self, client: TestClient):
        resp = client.get("/api/projects")
        projects = resp.json()
        assert len(projects) >= 1
        project = projects[0]
        assert "id" in project
        assert "name" in project
        assert "path" in project
        assert "is_global" in project
        assert "component_count" in project
        assert "last_scanned_at" in project
        assert "dir_exists" in project
        assert "platforms" in project

    def test_multiple_projects(self, client, core):
        core.projects.add_project("/tmp/fake-project-a")
        core.projects.add_project("/tmp/fake-project-b")
        resp = client.get("/api/projects")
        projects = resp.json()
        # global(1) + 추가한 2개
        assert len(projects) >= 3

    def test_component_count_reflects_db(self, client: TestClient):
        resp = client.get("/api/projects")
        projects = resp.json()
        for p in projects:
            assert isinstance(p["component_count"], int)
            assert p["component_count"] >= 0


class TestProjectStatus:
    """프로젝트 상태 필드 (dir_exists, platforms) 테스트."""

    def test_dir_exists_true_when_path_exists(self, client: TestClient):
        """실제 경로의 프로젝트 → dir_exists=True."""
        resp = client.get("/api/projects")
        projects = resp.json()
        global_proj = next(p for p in projects if p["is_global"])
        assert global_proj["dir_exists"] is True

    def test_dir_exists_false_when_path_missing(self, client, core):
        """존재하지 않는 경로 → dir_exists=False."""
        core.projects.add_project("/nonexistent/fake/path")
        resp = client.get("/api/projects")
        projects = resp.json()
        fake = next(p for p in projects if p["path"] == "/nonexistent/fake/path")
        assert fake["dir_exists"] is False

    def test_platforms_includes_claude_code(self, client, core, tmp_path):
        """.claude/ 있는 프로젝트 → platforms에 'claude_code' 포함."""
        proj_dir = tmp_path / "project_with_claude"
        (proj_dir / ".claude").mkdir(parents=True)
        core.projects.add_project(str(proj_dir))
        resp = client.get("/api/projects")
        proj = next(p for p in resp.json() if p["path"] == str(proj_dir))
        assert "claude_code" in proj["platforms"]

    def test_platforms_includes_cursor(self, client, core, tmp_path):
        """.cursor/ 있는 프로젝트 → platforms에 'cursor' 포함."""
        proj_dir = tmp_path / "project_with_cursor"
        (proj_dir / ".cursor").mkdir(parents=True)
        core.projects.add_project(str(proj_dir))
        resp = client.get("/api/projects")
        proj = next(p for p in resp.json() if p["path"] == str(proj_dir))
        assert "cursor" in proj["platforms"]

    def test_platforms_both(self, client, core, tmp_path):
        """.claude/와 .cursor/ 모두 있으면 둘 다 포함."""
        proj_dir = tmp_path / "project_both"
        (proj_dir / ".claude").mkdir(parents=True)
        (proj_dir / ".cursor").mkdir(parents=True)
        core.projects.add_project(str(proj_dir))
        resp = client.get("/api/projects")
        proj = next(p for p in resp.json() if p["path"] == str(proj_dir))
        assert "claude_code" in proj["platforms"]
        assert "cursor" in proj["platforms"]

    def test_platforms_empty_when_no_config(self, client, core, tmp_path):
        """config 디렉토리 없는 프로젝트 → platforms 빈 리스트."""
        no_config = tmp_path / "project_no_config"
        no_config.mkdir()
        core.projects.add_project(str(no_config))
        resp = client.get("/api/projects")
        proj = next(p for p in resp.json() if p["path"] == str(no_config))
        assert proj["platforms"] == []


class TestDeleteProject:
    """DELETE /api/projects/{id} 엔드포인트 테스트."""

    def test_delete_returns_200(self, client, core):
        """삭제 성공 시 200 + message."""
        core.projects.add_project("/tmp/delete-test-proj")
        resp = client.get("/api/projects")
        proj = next(p for p in resp.json() if p["path"] == "/tmp/delete-test-proj")

        resp = client.delete(f"/api/projects/{proj['id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["message"] == "Project has been hidden"
        assert data.get("message_key") == "common.project_hidden"

    def test_delete_removes_project(self, client, core):
        """DELETE 후 목록에서 사라짐."""
        core.projects.add_project("/tmp/delete-test-proj2")
        resp = client.get("/api/projects")
        proj = next(p for p in resp.json() if p["path"] == "/tmp/delete-test-proj2")

        client.delete(f"/api/projects/{proj['id']}")

        resp = client.get("/api/projects")
        paths = [p["path"] for p in resp.json()]
        assert "/tmp/delete-test-proj2" not in paths

    def test_delete_nonexistent_returns_404(self, client):
        """없는 ID → 404."""
        resp = client.delete("/api/projects/nonexistent_id")
        assert resp.status_code == 404

    def test_delete_global_project_returns_400(self, client, core):
        """글로벌 프로젝트 삭제 시도 → 400 (Issue #302)."""
        proj = next(p for p in core.projects.list_all() if p.is_global)
        resp = client.delete(f"/api/projects/{proj.id}")
        assert resp.status_code == 400
        data = resp.json()
        assert "global_project_cannot_delete" in data.get("message_key", "")
        assert "message" in data

    def test_delete_unwatches_project(self, client, core, watcher):
        """DELETE 시 watcher.unwatch 호출됨."""
        core.projects.add_project("/tmp/delete-unwatch-proj")
        resp = client.get("/api/projects")
        proj = next(p for p in resp.json() if p["path"] == "/tmp/delete-unwatch-proj")

        with patch.object(watcher, "unwatch") as mock_unwatch:
            client.delete(f"/api/projects/{proj['id']}")
            mock_unwatch.assert_called_once_with(proj["id"])


class TestCreateProjectFromPreset:
    """POST /api/projects (프리셋 기반 생성) 테스트."""

    def _preset_id(self, client: TestClient) -> str:
        response = client.get("/api/project-templates")
        assert response.status_code == 200
        items = response.json()["items"]
        if len(items) >= 1:
            return items[0]["id"]

        create_response = client.post(
            "/api/project-templates",
            json={
                "name": "Test Project Preset",
                "description": "preset for project create tests",
                "tags": ["test"],
                "preset_type": "template",
                "components": [
                    {
                        "component_type": "skill",
                        "template_id": "react-component",
                        "name": "test-project-skill",
                        "description": "generated from template",
                        "platform": "claude_code",
                        "config": {},
                    }
                ],
            },
        )
        assert create_response.status_code == 201
        return create_response.json()["id"]

    def test_create_project_success(self, client: TestClient, tmp_path):
        project_path = tmp_path / "preset-created-project"
        payload = {
            "path": str(project_path),
            "preset_id": self._preset_id(client),
            "scan_after_create": True,
        }

        response = client.post("/api/projects", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["project"]["path"] == str(project_path)
        assert data["applied_preset"]["id"] == payload["preset_id"]
        assert data["created_components"] >= 1
        assert data["scanned_components"] >= 1

        projects = client.get("/api/projects").json()
        assert any(p["path"] == str(project_path) for p in projects)

    def test_create_project_relative_path_returns_400(self, client: TestClient):
        payload = {
            "path": "relative/path",
            "preset_id": self._preset_id(client),
        }
        response = client.post("/api/projects", json=payload)
        assert response.status_code in (400, 422)

    def test_create_project_preset_not_found_returns_404(self, client: TestClient, tmp_path):
        payload = {
            "path": str(tmp_path / "not-found-preset-project"),
            "preset_id": "preset-not-found",
        }
        response = client.post("/api/projects", json=payload)
        assert response.status_code == 404
        assert response.json()["message_key"] == "errors.project_template_not_found"

    def test_create_project_existing_registered_path_returns_409(self, client, core, tmp_path):
        existing_path = tmp_path / "existing-project"
        existing_path.mkdir(parents=True)
        core.projects.add_project(str(existing_path))

        payload = {
            "path": str(existing_path),
            "preset_id": self._preset_id(client),
        }
        response = client.post("/api/projects", json=payload)
        assert response.status_code == 409
        assert response.json()["message_key"] == "errors.project_already_exists"

    def test_create_project_non_empty_path_returns_409(self, client: TestClient, tmp_path):
        project_path = tmp_path / "non-empty-project-path"
        project_path.mkdir(parents=True)
        (project_path / "README.md").write_text("already exists")
        payload = {
            "path": str(project_path),
            "preset_id": self._preset_id(client),
        }
        response = client.post("/api/projects", json=payload)
        assert response.status_code == 409
        assert response.json()["message_key"] == "errors.project_path_not_empty"


def _make_skill(project_dir, skill_name="test-skill"):
    """프로젝트 디렉토리 안에 .claude/skills/{name}/SKILL.md 를 생성한다."""
    skill_dir = project_dir / ".claude" / "skills" / skill_name
    skill_dir.mkdir(parents=True, exist_ok=True)
    (skill_dir / "SKILL.md").write_text(f"---\nname: {skill_name}\ndescription: test\n---\n\nBody")


def _find_project(resp_json, path):
    return next(p for p in resp_json if p["path"] == path)


class TestProjectLifecycle:
    """시나리오별 프로젝트 라이프사이클 통합 테스트.

    실제 디렉토리/스킬 파일을 생성·삭제하며 API 응답 상태를 검증한다.
    """

    def test_normal_project_with_skill(self, client, core, tmp_path):
        """시나리오 1: 디렉토리 + .claude/ + 스킬 → 정상 상태."""
        proj_dir = tmp_path / "my-app"
        proj_dir.mkdir()
        _make_skill(proj_dir, "my-skill")

        core.projects.add_project(str(proj_dir))
        proj = _find_project(client.get("/api/projects").json(), str(proj_dir))

        assert proj["dir_exists"] is True
        assert "claude_code" in proj["platforms"]
        assert proj["component_count"] == 0  # add_project은 스캔 안 함

        # rescan 후 스킬이 반영된다
        core.projects.rescan(proj["id"])
        proj = _find_project(client.get("/api/projects").json(), str(proj_dir))
        assert proj["component_count"] >= 1

    def test_remove_claude_dir(self, client, core, tmp_path):
        """시나리오 2: .claude/ 삭제 → dir_exists=true, platforms에서 제거, 컴포넌트 0."""
        proj_dir = tmp_path / "app-lose-claude"
        proj_dir.mkdir()
        _make_skill(proj_dir)

        core.projects.add_project(str(proj_dir))
        proj = _find_project(client.get("/api/projects").json(), str(proj_dir))
        core.projects.rescan(proj["id"])

        # .claude/ 삭제
        shutil.rmtree(proj_dir / ".claude")

        proj = _find_project(client.get("/api/projects").json(), str(proj_dir))
        assert proj["dir_exists"] is True
        assert "claude_code" not in proj["platforms"]

        # rescan → 컴포넌트 0개로 갱신
        core.projects.rescan(proj["id"])
        proj = _find_project(client.get("/api/projects").json(), str(proj_dir))
        assert proj["component_count"] == 0

    def test_remove_entire_directory(self, client, core, tmp_path):
        """시나리오 3: 프로젝트 폴더 통째로 삭제 → dir_exists=false, DB에는 남아 있음."""
        proj_dir = tmp_path / "app-deleted"
        proj_dir.mkdir()
        _make_skill(proj_dir)

        core.projects.add_project(str(proj_dir))
        proj = _find_project(client.get("/api/projects").json(), str(proj_dir))
        proj_id = proj["id"]

        # 폴더 통째로 삭제
        shutil.rmtree(proj_dir)

        proj = _find_project(client.get("/api/projects").json(), str(proj_dir))
        assert proj["dir_exists"] is False
        assert "claude_code" not in proj["platforms"]

        # DB에는 여전히 남아 있다 (자동 삭제 안 함)
        projects = client.get("/api/projects").json()
        assert any(p["id"] == proj_id for p in projects)

    def test_delete_stale_project_via_api(self, client, core, tmp_path):
        """시나리오 4: 폴더 삭제 후 사용자가 DELETE → DB에서 완전 제거."""
        proj_dir = tmp_path / "app-to-purge"
        proj_dir.mkdir()
        _make_skill(proj_dir)

        core.projects.add_project(str(proj_dir))
        proj = _find_project(client.get("/api/projects").json(), str(proj_dir))
        proj_id = proj["id"]

        shutil.rmtree(proj_dir)

        # DELETE 호출
        resp = client.delete(f"/api/projects/{proj_id}")
        assert resp.status_code == 200

        # 목록에서 사라짐
        projects = client.get("/api/projects").json()
        assert not any(p["id"] == proj_id for p in projects)

    def test_recreate_claude_dir_recovers(self, client, core, tmp_path):
        """시나리오 5: .claude/ 삭제 후 재생성 → 상태 복구 + rescan 시 스킬 반영."""
        proj_dir = tmp_path / "app-recover"
        proj_dir.mkdir()
        _make_skill(proj_dir, "original-skill")

        core.projects.add_project(str(proj_dir))
        proj = _find_project(client.get("/api/projects").json(), str(proj_dir))
        core.projects.rescan(proj["id"])
        assert _find_project(client.get("/api/projects").json(), str(proj_dir))["component_count"] >= 1

        # .claude/ 삭제
        shutil.rmtree(proj_dir / ".claude")
        proj = _find_project(client.get("/api/projects").json(), str(proj_dir))
        assert "claude_code" not in proj["platforms"]

        # .claude/ 재생성 + 새 스킬
        _make_skill(proj_dir, "new-skill")
        proj = _find_project(client.get("/api/projects").json(), str(proj_dir))
        assert "claude_code" in proj["platforms"]

        # rescan으로 새 스킬 반영
        core.projects.rescan(proj["id"])
        proj = _find_project(client.get("/api/projects").json(), str(proj_dir))
        assert proj["component_count"] >= 1

    def test_add_and_remove_skill(self, client, core, tmp_path):
        """스킬 추가 → rescan → 스킬 삭제 → rescan → 카운트 변화 확인."""
        proj_dir = tmp_path / "app-skill-toggle"
        proj_dir.mkdir()
        _make_skill(proj_dir, "skill-a")

        core.projects.add_project(str(proj_dir))
        proj = _find_project(client.get("/api/projects").json(), str(proj_dir))
        core.projects.rescan(proj["id"])

        proj = _find_project(client.get("/api/projects").json(), str(proj_dir))
        assert proj["component_count"] == 1

        # 스킬 하나 더 추가
        _make_skill(proj_dir, "skill-b")
        core.projects.rescan(proj["id"])
        proj = _find_project(client.get("/api/projects").json(), str(proj_dir))
        assert proj["component_count"] == 2

        # 스킬 하나 삭제
        shutil.rmtree(proj_dir / ".claude" / "skills" / "skill-a")
        core.projects.rescan(proj["id"])
        proj = _find_project(client.get("/api/projects").json(), str(proj_dir))
        assert proj["component_count"] == 1


# ---------------------------------------------------------------------------
# GET /api/projects/{id}
# ---------------------------------------------------------------------------


class TestProjectDetail:
    """GET /api/projects/{id} 프로젝트 상세 조회 테스트."""

    def test_returns_200(self, client, core):
        """프로젝트 상세 조회 성공 시 200."""
        proj = core.projects.list_all()[0]
        resp = client.get(f"/api/projects/{proj.id}")
        assert resp.status_code == 200

    def test_returns_project_fields(self, client, core):
        """응답에 프로젝트 기본 필드가 모두 포함된다."""
        proj = core.projects.list_all()[0]
        resp = client.get(f"/api/projects/{proj.id}")
        data = resp.json()
        assert data["id"] == proj.id
        assert data["name"] == proj.name
        assert data["path"] == proj.path
        assert "is_global" in data
        assert "component_count" in data
        assert "last_scanned_at" in data
        assert "dir_exists" in data
        assert "platforms" in data

    def test_includes_breakdown(self, client, core):
        """응답에 breakdown 필드가 포함된다."""
        proj = core.projects.list_all()[0]
        _create_skill(core, proj.id, "bd-skill")
        resp = client.get(f"/api/projects/{proj.id}")
        data = resp.json()
        assert "breakdown" in data
        assert isinstance(data["breakdown"], dict)

    def test_breakdown_counts_by_type(self, client, core):
        """breakdown이 타입별 컴포넌트 수를 정확히 반영한다."""
        proj = core.projects.list_all()[0]
        _create_skill(core, proj.id, "bd-s1")
        _create_skill(core, proj.id, "bd-s2")
        _create_command(core, proj.id, "bd-c1")

        resp = client.get(f"/api/projects/{proj.id}")
        data = resp.json()
        assert data["breakdown"]["skill"] == 2
        assert data["breakdown"]["command"] == 1

    def test_breakdown_empty_when_no_components(self, client, core, tmp_path):
        """컴포넌트가 없으면 breakdown은 빈 dict."""
        proj_dir = tmp_path / "empty-detail"
        proj_dir.mkdir()
        proj = core.projects.add_project(str(proj_dir))

        resp = client.get(f"/api/projects/{proj.id}")
        data = resp.json()
        assert data["breakdown"] == {}

    def test_returns_404_for_nonexistent(self, client):
        """없는 프로젝트 ID → 404."""
        resp = client.get("/api/projects/nonexistent-id")
        assert resp.status_code == 404

    def test_dir_exists_true_with_platforms(self, client, core, tmp_path):
        """실제 디렉토리가 있으면 dir_exists=true, platforms 포함."""
        proj_dir = tmp_path / "detail-proj"
        (proj_dir / ".claude").mkdir(parents=True)
        proj = core.projects.add_project(str(proj_dir))

        resp = client.get(f"/api/projects/{proj.id}")
        data = resp.json()
        assert data["dir_exists"] is True
        assert "claude_code" in data["platforms"]

    def test_dir_exists_false_when_path_missing(self, client, core):
        """존재하지 않는 경로 → dir_exists=false."""
        core.projects.add_project("/nonexistent/detail/path")
        projects = core.projects.list_all()
        proj = next(p for p in projects if p.path == "/nonexistent/detail/path")

        resp = client.get(f"/api/projects/{proj.id}")
        data = resp.json()
        assert data["dir_exists"] is False


# ---------------------------------------------------------------------------
# GET /api/projects/{id}/activities (Issue #216)
# ---------------------------------------------------------------------------


class TestProjectActivities:
    """GET /api/projects/{id}/activities 활동 로그 조회 테스트."""

    def test_returns_200(self, client, core):
        """활동 목록 조회 성공 시 200."""
        proj = core.projects.list_all()[0]
        resp = client.get(f"/api/projects/{proj.id}/activities")
        assert resp.status_code == 200

    def test_returns_empty_list_initially(self, client, core, tmp_path):
        """구현 이후부터 기록 — 기존 데이터 소급 불가."""
        proj_dir = tmp_path / "activities-proj"
        proj_dir.mkdir()
        (proj_dir / ".claude").mkdir()
        proj = core.projects.add_project(str(proj_dir))
        resp = client.get(f"/api/projects/{proj.id}/activities")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_returns_404_for_nonexistent_project(self, client):
        """없는 프로젝트 ID → 404."""
        resp = client.get("/api/projects/nonexistent-id/activities")
        assert resp.status_code == 404

    def test_supports_limit_and_offset_params(self, client, core):
        """limit, offset 쿼리 파라미터 지원."""
        proj = core.projects.list_all()[0]
        resp = client.get(
            f"/api/projects/{proj.id}/activities",
            params={"limit": 10, "offset": 0},
        )
        assert resp.status_code == 200


class TestHideProject:
    """PATCH /api/projects/{id}/hide 엔드포인트 테스트."""

    def test_hide_returns_200(self, client, core):
        core.projects.add_project("/tmp/hide-test-proj")
        resp = client.get("/api/projects")
        proj = next(p for p in resp.json() if p["path"] == "/tmp/hide-test-proj")
        resp = client.patch(f"/api/projects/{proj['id']}/hide")
        assert resp.status_code == 200

    def test_hide_excludes_from_default_list(self, client, core):
        core.projects.add_project("/tmp/hide-list-proj")
        resp = client.get("/api/projects")
        proj = next(p for p in resp.json() if p["path"] == "/tmp/hide-list-proj")
        client.patch(f"/api/projects/{proj['id']}/hide")
        resp = client.get("/api/projects")
        paths = [p["path"] for p in resp.json()]
        assert "/tmp/hide-list-proj" not in paths

    def test_hide_included_with_include_hidden(self, client, core):
        core.projects.add_project("/tmp/hide-visible-proj")
        resp = client.get("/api/projects")
        proj = next(p for p in resp.json() if p["path"] == "/tmp/hide-visible-proj")
        client.patch(f"/api/projects/{proj['id']}/hide")
        resp = client.get("/api/projects", params={"include_hidden": True})
        paths = [p["path"] for p in resp.json()]
        assert "/tmp/hide-visible-proj" in paths

    def test_hide_global_returns_400(self, client, core):
        proj = next(p for p in core.projects.list_all() if p.is_global)
        resp = client.patch(f"/api/projects/{proj.id}/hide")
        assert resp.status_code == 400

    def test_hide_nonexistent_returns_404(self, client):
        resp = client.patch("/api/projects/nonexistent/hide")
        assert resp.status_code == 404


class TestUnhideProject:
    """PATCH /api/projects/{id}/unhide 엔드포인트 테스트."""

    def test_unhide_returns_200(self, client, core):
        core.projects.add_project("/tmp/unhide-test-proj")
        resp = client.get("/api/projects")
        proj = next(p for p in resp.json() if p["path"] == "/tmp/unhide-test-proj")
        client.patch(f"/api/projects/{proj['id']}/hide")
        resp = client.patch(f"/api/projects/{proj['id']}/unhide")
        assert resp.status_code == 200

    def test_unhide_restores_to_list(self, client, core):
        core.projects.add_project("/tmp/unhide-restore-proj")
        resp = client.get("/api/projects")
        proj = next(p for p in resp.json() if p["path"] == "/tmp/unhide-restore-proj")
        client.patch(f"/api/projects/{proj['id']}/hide")
        client.patch(f"/api/projects/{proj['id']}/unhide")
        resp = client.get("/api/projects")
        paths = [p["path"] for p in resp.json()]
        assert "/tmp/unhide-restore-proj" in paths


class TestDeleteBecomesHide:
    """DELETE /api/projects/{id} soft delete 전환 검증."""

    def test_delete_hides_project_not_removes(self, client, core):
        """DELETE 후 include_hidden=true로 조회 시 존재."""
        core.projects.add_project("/tmp/softdel-proj")
        resp = client.get("/api/projects")
        proj = next(p for p in resp.json() if p["path"] == "/tmp/softdel-proj")
        client.delete(f"/api/projects/{proj['id']}")
        resp = client.get("/api/projects", params={"include_hidden": True})
        paths = [p["path"] for p in resp.json()]
        assert "/tmp/softdel-proj" in paths

    def test_hidden_at_field_in_response(self, client, core):
        """include_hidden=true 응답에 hidden_at 필드."""
        core.projects.add_project("/tmp/hidden-field-proj")
        resp = client.get("/api/projects")
        proj = next(p for p in resp.json() if p["path"] == "/tmp/hidden-field-proj")
        client.patch(f"/api/projects/{proj['id']}/hide")
        resp = client.get("/api/projects", params={"include_hidden": True})
        hidden = next(p for p in resp.json() if p["path"] == "/tmp/hidden-field-proj")
        assert hidden["hidden_at"] is not None
