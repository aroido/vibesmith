"""구성요소 조회 엔드포인트 테스트."""

import uuid
from datetime import UTC, datetime

from vibesmith_core.components.models import Command, Skill


def _now():
    return datetime.now(UTC).isoformat()


def _make_skill(core, project_id, name="test-skill", description="test", tags=None):
    """DB에 스킬을 직접 생성한다."""
    skill = Skill(
        id=str(uuid.uuid4()),
        name=name,
        description=description,
        enabled=True,
        tags=tags or [],
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


def _make_command(core, project_id, name="test-cmd", description="test cmd"):
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


# ---------------------------------------------------------------------------
# GET /api/projects/{id}/components
# ---------------------------------------------------------------------------


class TestProjectComponents:
    """GET /api/projects/{id}/components 테스트."""

    def test_returns_components_for_project(self, client, core):
        projects = core.projects.list_all()
        proj = projects[0]
        _make_skill(core, proj.id, "skill-a")
        _make_command(core, proj.id, "cmd-a")

        resp = client.get(f"/api/projects/{proj.id}/components")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 2
        names = {c["name"] for c in data["items"]}
        assert names == {"skill-a", "cmd-a"}

    def test_returns_empty_for_project_with_no_components(self, client, core, tmp_path):
        proj_dir = tmp_path / "empty-proj"
        proj_dir.mkdir()
        proj = core.projects.add_project(str(proj_dir))

        resp = client.get(f"/api/projects/{proj.id}/components")
        assert resp.status_code == 200
        data = resp.json()
        assert data["items"] == []
        assert data["total"] == 0

    def test_filter_by_type(self, client, core):
        projects = core.projects.list_all()
        proj = projects[0]
        _make_skill(core, proj.id, "s1")
        _make_command(core, proj.id, "c1")

        resp = client.get(f"/api/projects/{proj.id}/components", params={"type": "skill"})
        data = resp.json()
        assert all(c["type"] == "skill" for c in data["items"])

    def test_returns_404_for_nonexistent_project(self, client):
        resp = client.get("/api/projects/nonexistent/components")
        assert resp.status_code == 404

    def test_returns_paginated_format(self, client, core):
        """응답이 {items: [...], total: N} 형식이다."""
        proj = core.projects.list_all()[0]
        _make_skill(core, proj.id, "pg-fmt")

        resp = client.get(f"/api/projects/{proj.id}/components")
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)
        assert isinstance(data["total"], int)

    def test_response_fields(self, client, core):
        projects = core.projects.list_all()
        proj = projects[0]
        _make_skill(core, proj.id, "field-test", tags=["python"])

        resp = client.get(f"/api/projects/{proj.id}/components")
        comp = resp.json()["items"][0]
        assert "id" in comp
        assert "type" in comp
        assert "name" in comp
        assert "description" in comp
        assert "enabled" in comp
        assert "tags" in comp
        assert "project_id" in comp
        assert "path" in comp
        assert "created_at" in comp
        assert "updated_at" in comp
        # 목록 뷰에는 content, frontmatter가 없어야 한다
        assert "content" not in comp
        assert "frontmatter" not in comp


# ---------------------------------------------------------------------------
# GET /api/components
# ---------------------------------------------------------------------------


class TestListComponents:
    """GET /api/components 테스트."""

    def test_returns_all_components(self, client, core):
        projects = core.projects.list_all()
        proj = projects[0]
        _make_skill(core, proj.id, "all-s1")
        _make_command(core, proj.id, "all-c1")

        resp = client.get("/api/components")
        assert resp.status_code == 200
        names = {c["name"] for c in resp.json()}
        assert "all-s1" in names
        assert "all-c1" in names

    def test_filter_by_type(self, client, core):
        projects = core.projects.list_all()
        proj = projects[0]
        _make_skill(core, proj.id, "ft-s1")
        _make_command(core, proj.id, "ft-c1")

        resp = client.get("/api/components", params={"type": "skill"})
        data = resp.json()
        assert all(c["type"] == "skill" for c in data)
        assert any(c["name"] == "ft-s1" for c in data)

    def test_filter_by_project_id(self, client, core, tmp_path):
        proj_dir = tmp_path / "filter-proj"
        proj_dir.mkdir()
        proj_a = core.projects.add_project(str(proj_dir))
        _make_skill(core, proj_a.id, "proj-a-skill")

        resp = client.get("/api/components", params={"project_id": proj_a.id})
        data = resp.json()
        assert all(c["project_id"] == proj_a.id for c in data)

    def test_filter_by_enabled(self, client, core):
        projects = core.projects.list_all()
        proj = projects[0]
        s = _make_skill(core, proj.id, "en-s1")
        core.operations.toggle(s.id, enabled=False)

        resp = client.get("/api/components", params={"enabled": "true"})
        data = resp.json()
        assert all(c["enabled"] is True for c in data)

    def test_filter_by_tag(self, client, core):
        projects = core.projects.list_all()
        proj = projects[0]
        _make_skill(core, proj.id, "tagged-skill", tags=["python", "web"])
        _make_skill(core, proj.id, "untagged-skill", tags=[])

        resp = client.get("/api/components", params={"tag": "python"})
        data = resp.json()
        assert any(c["name"] == "tagged-skill" for c in data)
        assert not any(c["name"] == "untagged-skill" for c in data)

    def test_search_by_q(self, client, core):
        projects = core.projects.list_all()
        proj = projects[0]
        _make_skill(core, proj.id, "fastapi-route", description="FastAPI scaffolding")
        _make_skill(core, proj.id, "pydantic-model", description="Pydantic helper")

        resp = client.get("/api/components", params={"q": "fastapi"})
        data = resp.json()
        assert any(c["name"] == "fastapi-route" for c in data)
        assert not any(c["name"] == "pydantic-model" for c in data)

    def test_includes_project_name(self, client, core):
        projects = core.projects.list_all()
        proj = projects[0]
        _make_skill(core, proj.id, "pn-skill")

        resp = client.get("/api/components")
        comp = next(c for c in resp.json() if c["name"] == "pn-skill")
        assert "project_name" in comp
        assert comp["project_name"] == proj.name

    def test_returns_empty_when_no_match(self, client):
        resp = client.get("/api/components", params={"type": "hook", "project_id": "nonexistent"})
        assert resp.json() == []


# ---------------------------------------------------------------------------
# GET /api/components/{id}
# ---------------------------------------------------------------------------


class TestPlatformFilter:
    """GET /api/components?platform=xxx 필터 테스트."""

    def test_list_components_filter_by_platform(self, client, core):
        """platform=cursor 필터가 동작한다."""
        proj = core.projects.list_all()[0]
        _make_skill(core, proj.id, "claude-skill")
        resp = client.get("/api/components", params={"platform": "cursor"})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 0  # cursor 컴포넌트 없으므로 빈 리스트

    def test_list_components_response_includes_platform(self, client, core):
        """구성요소 응답에 platform 필드가 포함된다."""
        proj = core.projects.list_all()[0]
        _make_skill(core, proj.id, "platform-check")
        resp = client.get("/api/components")
        data = resp.json()
        assert len(data) >= 1
        assert "platform" in data[0]

    def test_component_detail_includes_platform(self, client, core):
        """GET /api/components/{id} 응답에 platform 필드가 포함된다."""
        proj = core.projects.list_all()[0]
        skill = _make_skill(core, proj.id, "detail-platform")
        resp = client.get(f"/api/components/{skill.id}")
        data = resp.json()
        assert "platform" in data


class TestComponentDetail:
    """GET /api/components/{id} 테스트."""

    def test_returns_component_detail(self, client, core):
        projects = core.projects.list_all()
        proj = projects[0]
        skill = _make_skill(core, proj.id, "detail-skill")

        resp = client.get(f"/api/components/{skill.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == skill.id
        assert data["name"] == "detail-skill"

    def test_includes_content_and_frontmatter(self, client, core):
        projects = core.projects.list_all()
        proj = projects[0]
        skill = _make_skill(core, proj.id, "content-skill")

        resp = client.get(f"/api/components/{skill.id}")
        data = resp.json()
        assert "content" in data
        assert data["content"] is not None
        assert "frontmatter" in data
        assert data["frontmatter"] is not None

    def test_includes_project_name(self, client, core):
        projects = core.projects.list_all()
        proj = projects[0]
        skill = _make_skill(core, proj.id, "pn-detail-skill")

        resp = client.get(f"/api/components/{skill.id}")
        data = resp.json()
        assert data["project_name"] == proj.name

    def test_includes_dependencies_structure(self, client, core):
        projects = core.projects.list_all()
        proj = projects[0]
        skill = _make_skill(core, proj.id, "dep-skill")

        resp = client.get(f"/api/components/{skill.id}")
        data = resp.json()
        assert "dependencies" in data
        assert "depends_on" in data["dependencies"]
        assert "depended_by" in data["dependencies"]

    def test_returns_404_for_nonexistent(self, client):
        resp = client.get("/api/components/nonexistent_id")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/components
# ---------------------------------------------------------------------------


class TestCreateComponent:
    """POST /api/components 테스트."""

    def test_create_returns_201(self, client, core):
        proj = core.projects.list_all()[0]
        resp = client.post(
            "/api/components",
            json={
                "type": "skill",
                "name": "new-skill",
                "project_id": proj.id,
                "content": "---\nname: new-skill\ndescription: A new skill\n---\nBody content",
                "platform": "claude_code",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "new-skill"
        assert data["type"] == "skill"
        assert data["project_id"] == proj.id
        assert data["enabled"] is True

    def test_create_parses_frontmatter_description(self, client, core):
        proj = core.projects.list_all()[0]
        resp = client.post(
            "/api/components",
            json={
                "type": "skill",
                "name": "fm-skill",
                "project_id": proj.id,
                "content": "---\nname: fm-skill\ndescription: Parsed desc\n---\nBody",
                "platform": "claude_code",
            },
        )
        data = resp.json()
        assert data["description"] == "Parsed desc"

    def test_create_with_tags(self, client, core):
        proj = core.projects.list_all()[0]
        resp = client.post(
            "/api/components",
            json={
                "type": "skill",
                "name": "tagged-new",
                "project_id": proj.id,
                "content": "---\nname: tagged-new\n---\nBody",
                "tags": ["python", "web"],
                "platform": "claude_code",
            },
        )
        data = resp.json()
        assert set(data["tags"]) == {"python", "web"}

    def test_create_duplicate_returns_409(self, client, core):
        """Issue #33: 중복 생성 시 409 Conflict 반환."""
        proj = core.projects.list_all()[0]
        payload = {
            "type": "skill",
            "name": "dup-skill",
            "project_id": proj.id,
            "content": "---\nname: dup-skill\n---\nBody",
            "platform": "claude_code",
        }
        resp1 = client.post("/api/components", json=payload)
        assert resp1.status_code == 201
        resp2 = client.post("/api/components", json=payload)
        assert resp2.status_code == 409
        assert "already exists" in resp2.json()["detail"].lower() or "duplicate" in resp2.json()["message"].lower()

    def test_create_duplicate_case_insensitive_returns_409(self, client, core):
        """Issue #33: 대소문자 무시 중복 검사."""
        proj = core.projects.list_all()[0]
        payload1 = {
            "type": "skill",
            "name": "MySkill",
            "project_id": proj.id,
            "content": "# MySkill",
            "platform": "claude_code",
        }
        payload2 = {
            "type": "skill",
            "name": "myskill",  # 대소문자만 다름
            "project_id": proj.id,
            "content": "# myskill",
            "platform": "claude_code",
        }
        resp1 = client.post("/api/components", json=payload1)
        assert resp1.status_code == 201
        resp2 = client.post("/api/components", json=payload2)
        assert resp2.status_code == 409
        assert "already exists" in resp2.json()["detail"].lower() or "MySkill" in resp2.json()["detail"]

    def test_create_nonexistent_project_returns_404(self, client):
        resp = client.post(
            "/api/components",
            json={
                "type": "skill",
                "name": "orphan",
                "project_id": "nonexistent-proj",
                "content": "body",
                "platform": "claude_code",
            },
        )
        assert resp.status_code == 404

    def test_create_writes_file_to_disk(self, client, core, tmp_path):
        """Issue #307: POST /api/components가 파일시스템에 파일을 생성해야 함."""

        # 프로젝트 생성
        project_dir = tmp_path / "test-project"
        project_dir.mkdir()
        proj = core.projects.add_project(str(project_dir))

        # 컴포넌트 생성
        resp = client.post(
            "/api/components",
            json={
                "type": "skill",
                "name": "file-test",
                "project_id": proj.id,
                "content": "---\nname: file-test\n---\nTest content",
                "platform": "claude_code",
            },
        )
        assert resp.status_code == 201

        # 파일이 실제로 생성되었는지 확인
        expected_file = project_dir / ".claude" / "skills" / "file-test" / "SKILL.md"
        assert expected_file.exists()
        assert "Test content" in expected_file.read_text()

    def test_create_returns_absolute_path(self, client, core, tmp_path):
        """Issue #315: POST /api/components 응답 path가 절대 경로로 통일."""
        project_dir = tmp_path / "path-test-proj"
        project_dir.mkdir()
        proj = core.projects.add_project(str(project_dir))

        resp = client.post(
            "/api/components",
            json={
                "type": "skill",
                "name": "path-format-skill",
                "project_id": proj.id,
                "content": "---\nname: path-format-skill\n---\nBody",
                "platform": "claude_code",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        path = data["path"]
        assert path, "path should be non-empty"
        assert path[0] == "/" or (len(path) > 1 and path[1] == ":"), "path should be absolute"
        assert str(project_dir) in path, "path should contain project directory"
        assert "skills/path-format-skill/SKILL.md" in path, "path should point to SKILL.md"

    def test_create_missing_fields_returns_422(self, client):
        resp = client.post("/api/components", json={"type": "skill"})
        assert resp.status_code == 422

    def test_create_malformed_yaml_returns_400(self, client, core):
        """Issue #319: malformed YAML frontmatter 입력 시 400 반환."""
        proj = core.projects.list_all()[0]
        resp = client.post(
            "/api/components",
            json={
                "type": "skill",
                "name": "bad-yaml",
                "project_id": proj.id,
                "content": "---\nname: bad\ndescription: [oops\n---\nBody",
                "platform": "claude_code",
            },
        )
        assert resp.status_code == 400
        assert "Invalid YAML" in resp.json()["detail"]

    def test_create_invalid_type_returns_422(self, client, core):
        """Issue #318: 잘못된 type 값 입력 시 422 반환."""
        proj = core.projects.list_all()[0]
        resp = client.post(
            "/api/components",
            json={
                "type": "invalid_type",
                "name": "bad-type",
                "project_id": proj.id,
                "content": "content",
                "platform": "claude_code",
            },
        )
        assert resp.status_code == 422

    def test_create_invalid_platform_returns_422(self, client, core):
        """Issue #318: 잘못된 platform 값 입력 시 422 반환."""
        proj = core.projects.list_all()[0]
        resp = client.post(
            "/api/components",
            json={
                "type": "skill",
                "name": "bad-platform",
                "project_id": proj.id,
                "content": "content",
                "platform": "invalid_platform",
            },
        )
        assert resp.status_code == 422

    def test_create_invalid_name_path_traversal_returns_422(self, client, core):
        """Issue #335: name에 '..' 포함 시 422 반환."""
        proj = core.projects.list_all()[0]
        resp = client.post(
            "/api/components",
            json={
                "type": "skill",
                "name": "../evil",
                "project_id": proj.id,
                "content": "---\nname: evil\n---\nbody",
                "platform": "claude_code",
            },
        )
        assert resp.status_code == 422
        detail_str = str(resp.json()["detail"]).lower()
        assert "path" in detail_str or ".." in detail_str

    def test_create_invalid_name_path_separator_returns_422(self, client, core):
        """Issue #335: name에 '/', '\\\\' 포함 시 422 반환."""
        proj = core.projects.list_all()[0]
        for bad_name in ["foo/bar", "foo\\bar"]:
            resp = client.post(
                "/api/components",
                json={
                    "type": "skill",
                    "name": bad_name,
                    "project_id": proj.id,
                    "content": "body",
                    "platform": "claude_code",
                },
            )
            assert resp.status_code == 422, f"Expected 422 for name={bad_name!r}"

    def test_create_empty_name_returns_422(self, client, core):
        """Issue #335: name이 빈 문자열이면 422 반환."""
        proj = core.projects.list_all()[0]
        resp = client.post(
            "/api/components",
            json={
                "type": "skill",
                "name": "",
                "project_id": proj.id,
                "content": "body",
                "platform": "claude_code",
            },
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# PUT /api/components/{id}
# ---------------------------------------------------------------------------


class TestUpdateComponent:
    """PUT /api/components/{id} 테스트."""

    def test_update_content_returns_200(self, client, core):
        proj = core.projects.list_all()[0]
        skill = _make_skill(core, proj.id, "upd-content")

        resp = client.put(
            f"/api/components/{skill.id}",
            json={"content": "---\nname: upd-content\ndescription: Updated\n---\nNew body"},
        )
        assert resp.status_code == 200
        assert resp.json()["description"] == "Updated"

    def test_update_tags(self, client, core):
        proj = core.projects.list_all()[0]
        skill = _make_skill(core, proj.id, "upd-tags", tags=["old"])

        resp = client.put(
            f"/api/components/{skill.id}",
            json={"tags": ["new-a", "new-b"]},
        )
        assert resp.status_code == 200
        assert set(resp.json()["tags"]) == {"new-a", "new-b"}

    def test_update_with_duplicate_tags_dedupes(self, client, core):
        """Issue #334: 중복 tags update 시 자동 제거 후 200 반환 (500 방지)."""
        proj = core.projects.list_all()[0]
        skill = _make_skill(core, proj.id, "upd-dup-tags", tags=["a"])

        resp = client.put(
            f"/api/components/{skill.id}",
            json={"tags": ["dup", "dup"]},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["tags"] == ["dup"]

    def test_update_content_and_tags(self, client, core):
        proj = core.projects.list_all()[0]
        skill = _make_skill(core, proj.id, "upd-both")

        resp = client.put(
            f"/api/components/{skill.id}",
            json={
                "content": "---\nname: upd-both\ndescription: Both updated\n---\nNew",
                "tags": ["alpha"],
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["description"] == "Both updated"
        assert data["tags"] == ["alpha"]

    def test_update_nonexistent_returns_404(self, client):
        resp = client.put("/api/components/nonexistent", json={"tags": ["x"]})
        assert resp.status_code == 404

    def test_update_reparses_frontmatter(self, client, core):
        proj = core.projects.list_all()[0]
        skill = _make_skill(core, proj.id, "reparse-test")

        client.put(
            f"/api/components/{skill.id}",
            json={"content": "---\nname: reparse-test\ndescription: Reparsed\n---\nBody"},
        )
        detail = client.get(f"/api/components/{skill.id}").json()
        assert detail["frontmatter"]["description"] == "Reparsed"

    def test_update_malformed_yaml_returns_400(self, client, core):
        """Issue #319: malformed YAML frontmatter 입력 시 400 반환."""
        proj = core.projects.list_all()[0]
        skill = _make_skill(core, proj.id, "update-bad-yaml")

        resp = client.put(
            f"/api/components/{skill.id}",
            json={"content": "---\nname: bad\ndescription: {invalid\n---\nBody"},
        )
        assert resp.status_code == 400
        assert "Invalid YAML" in resp.json()["detail"]

    def test_update_removes_description_when_frontmatter_absent(self, client, core):
        """Issue #321: frontmatter에서 description 제거 시 DB에서도 제거되는지 확인."""
        proj = core.projects.list_all()[0]
        # description이 있는 컴포넌트 생성
        skill = _make_skill(core, proj.id, "desc-remove-test", description="Original desc")

        # frontmatter에서 description 제거
        resp = client.put(
            f"/api/components/{skill.id}",
            json={"content": "---\nname: desc-remove-test\n---\nBody without description"},
        )
        assert resp.status_code == 200
        # description이 None으로 변경되어야 함
        assert resp.json()["description"] is None

        # 상세 조회로 재확인
        detail = client.get(f"/api/components/{skill.id}").json()
        assert detail["description"] is None
        assert "description" not in detail["frontmatter"]


# ---------------------------------------------------------------------------
# DELETE /api/components/{id}
# ---------------------------------------------------------------------------


class TestDeleteComponent:
    """DELETE /api/components/{id} 테스트."""

    def test_delete_returns_200(self, client, core):
        proj = core.projects.list_all()[0]
        skill = _make_skill(core, proj.id, "del-test")

        resp = client.delete(f"/api/components/{skill.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["message"] == "Deleted"  # default locale (en) when no Accept-Language
        assert data.get("message_key") == "common.deleted"

    def test_delete_removes_from_db(self, client, core):
        """기본 삭제는 soft delete — normal API에서 404."""
        proj = core.projects.list_all()[0]
        skill = _make_skill(core, proj.id, "del-gone")

        client.delete(f"/api/components/{skill.id}")  # default: soft delete
        resp = client.get(f"/api/components/{skill.id}")
        assert resp.status_code == 404  # deleted 항목은 list/detail에서 제외

    def test_delete_permanent_removes_completely(self, client, core):
        """permanent=true면 DB에서 완전 삭제."""
        proj = core.projects.list_all()[0]
        skill = _make_skill(core, proj.id, "perm-del")

        client.delete(f"/api/components/{skill.id}?permanent=true")
        resp = client.get(f"/api/components/{skill.id}")
        assert resp.status_code == 404
        trash_resp = client.get("/api/trash")
        assert not any(t["id"] == skill.id for t in trash_resp.json())

    def test_delete_returns_affected_dependencies(self, client, core):
        proj = core.projects.list_all()[0]
        skill = _make_skill(core, proj.id, "del-deps")

        resp = client.delete(f"/api/components/{skill.id}")
        data = resp.json()
        assert "affected_dependencies" in data
        assert isinstance(data["affected_dependencies"], list)

    def test_delete_nonexistent_returns_404(self, client):
        resp = client.delete("/api/components/nonexistent")
        assert resp.status_code == 404

    def test_delete_soft_delete_moves_to_trash(self, client, core):
        """Issue #165: 기본 삭제는 soft delete, 휴지통으로 이동."""
        proj = core.projects.list_all()[0]
        skill = _make_skill(core, proj.id, "soft-del")

        resp = client.delete(f"/api/components/{skill.id}")  # default: soft delete
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("message_key") == "common.deleted"

        # normal API에서는 404, 휴지통에는 존재
        get_resp = client.get(f"/api/components/{skill.id}")
        assert get_resp.status_code == 404
        trash_resp = client.get("/api/trash")
        trash_ids = [t["id"] for t in trash_resp.json()]
        assert skill.id in trash_ids


# ---------------------------------------------------------------------------
# POST /api/components/{id}/toggle
# ---------------------------------------------------------------------------


class TestToggleComponent:
    """POST /api/components/{id}/toggle 테스트."""

    def test_toggle_reverses_state(self, client, core):
        proj = core.projects.list_all()[0]
        skill = _make_skill(core, proj.id, "toggle-rev")
        assert skill.enabled is True

        resp = client.post(f"/api/components/{skill.id}/toggle")
        assert resp.status_code == 200
        assert resp.json()["enabled"] is False

    def test_toggle_with_explicit_enabled(self, client, core):
        proj = core.projects.list_all()[0]
        skill = _make_skill(core, proj.id, "toggle-explicit")

        resp = client.post(
            f"/api/components/{skill.id}/toggle",
            json={"enabled": False},
        )
        assert resp.status_code == 200
        assert resp.json()["enabled"] is False

    def test_toggle_returns_affected_dependencies(self, client, core):
        proj = core.projects.list_all()[0]
        skill = _make_skill(core, proj.id, "toggle-deps")

        resp = client.post(f"/api/components/{skill.id}/toggle")
        data = resp.json()
        assert "affected_dependencies" in data
        assert isinstance(data["affected_dependencies"], list)

    def test_toggle_nonexistent_returns_404(self, client):
        resp = client.post("/api/components/nonexistent/toggle")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# PATCH /api/components/bulk-toggle
# ---------------------------------------------------------------------------


class TestBulkToggle:
    """PATCH /api/components/bulk-toggle 테스트."""

    def test_bulk_disable(self, client, core):
        proj = core.projects.list_all()[0]
        s1 = _make_skill(core, proj.id, "bulk-1")
        s2 = _make_skill(core, proj.id, "bulk-2")

        resp = client.patch(
            "/api/components/bulk-toggle",
            json={"component_ids": [s1.id, s2.id], "enabled": False},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["updated_count"] == 2
        assert set(data["updated_ids"]) == {s1.id, s2.id}

    def test_bulk_skips_already_same_state(self, client, core):
        proj = core.projects.list_all()[0]
        s1 = _make_skill(core, proj.id, "bulk-same")
        # s1 is already enabled=True, request enabled=True → skip
        resp = client.patch(
            "/api/components/bulk-toggle",
            json={"component_ids": [s1.id], "enabled": True},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["updated_count"] == 0
        assert data["updated_ids"] == []

    def test_bulk_skips_nonexistent(self, client, core):
        proj = core.projects.list_all()[0]
        s1 = _make_skill(core, proj.id, "bulk-exist")

        resp = client.patch(
            "/api/components/bulk-toggle",
            json={"component_ids": [s1.id, "nonexistent-id"], "enabled": False},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["updated_count"] == 1
        assert data["updated_ids"] == [s1.id]

    def test_bulk_empty_ids_returns_422(self, client):
        resp = client.patch(
            "/api/components/bulk-toggle",
            json={"component_ids": [], "enabled": False},
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /api/components/{id}/copy
# ---------------------------------------------------------------------------


class TestCopyComponent:
    """POST /api/components/{id}/copy 테스트."""

    def test_copy_returns_201(self, client, core, tmp_path):
        proj = core.projects.list_all()[0]
        skill = _make_skill(core, proj.id, "copy-src")
        target_dir = tmp_path / "target-proj"
        target_dir.mkdir()
        target = core.projects.add_project(str(target_dir))

        resp = client.post(
            f"/api/components/{skill.id}/copy",
            json={"target_project_id": target.id},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert len(data["copied"]) == 1
        assert data["copied"][0]["name"] == "copy-src"

    def test_copy_creates_file_on_disk(self, client, core, tmp_path):
        """복사 시 대상 프로젝트 .claude/{type}s/{name}/ 경로에 파일이 생성되는지 검증."""
        proj = core.projects.list_all()[0]
        skill = _make_skill(core, proj.id, "copy-fs")
        target_dir = tmp_path / "target-fs"
        target_dir.mkdir()
        target = core.projects.add_project(str(target_dir))

        resp = client.post(
            f"/api/components/{skill.id}/copy",
            json={"target_project_id": target.id},
        )
        assert resp.status_code == 201
        skill_file = target_dir / ".claude" / "skills" / "copy-fs" / "SKILL.md"
        assert skill_file.exists()
        assert "copy-fs" in skill_file.read_text()

    def test_copy_include_deps_returns_201(self, client, core, tmp_path):
        """include_dependencies=true 요청도 복사가 성공한다."""
        proj = core.projects.list_all()[0]
        skill = _make_skill(core, proj.id, "copy-dep")
        target_dir = tmp_path / "target-dep"
        target_dir.mkdir()
        target = core.projects.add_project(str(target_dir))

        resp = client.post(
            f"/api/components/{skill.id}/copy",
            json={"target_project_id": target.id, "include_dependencies": True},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert len(data["copied"]) >= 1
        assert data["copied"][0]["name"] == "copy-dep"

    def test_copy_duplicate_returns_409(self, client, core, tmp_path):
        """Issue #33: 복사 시 중복도 409 Conflict 반환."""
        proj = core.projects.list_all()[0]
        skill = _make_skill(core, proj.id, "copy-dup")
        target_dir = tmp_path / "target-dup"
        target_dir.mkdir()
        target = core.projects.add_project(str(target_dir))
        # 첫 번째 복사 성공
        client.post(
            f"/api/components/{skill.id}/copy",
            json={"target_project_id": target.id},
        )
        # 두 번째 복사 → 중복
        resp = client.post(
            f"/api/components/{skill.id}/copy",
            json={"target_project_id": target.id},
        )
        assert resp.status_code == 409

    def test_copy_nonexistent_source_returns_404(self, client):
        resp = client.post(
            "/api/components/nonexistent/copy",
            json={"target_project_id": "any"},
        )
        assert resp.status_code == 404

    def test_copy_nonexistent_target_returns_404(self, client, core):
        proj = core.projects.list_all()[0]
        skill = _make_skill(core, proj.id, "copy-no-target")

        resp = client.post(
            f"/api/components/{skill.id}/copy",
            json={"target_project_id": "nonexistent-proj"},
        )
        assert resp.status_code == 404

    def test_copy_invalid_name_returns_400(self, client, core, tmp_path):
        """Issue #335: 유효하지 않은 name(경로 탐색 등)으로 생성된 컴포넌트 복사 시 400 반환."""
        proj = core.projects.list_all()[0]
        skill = _make_skill(core, proj.id, "../evil")
        target_dir = tmp_path / "target-invalid"
        target_dir.mkdir()
        target = core.projects.add_project(str(target_dir))

        resp = client.post(
            f"/api/components/{skill.id}/copy",
            json={"target_project_id": target.id},
        )
        assert resp.status_code == 400
        assert "Invalid component name" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# GET /api/projects/{id}/components — 강화 기능 (검색, 정렬, 페이지네이션)
# ---------------------------------------------------------------------------


class TestProjectComponentsEnhanced:
    """GET /api/projects/{id}/components 강화 기능 테스트."""

    def test_search_by_q_name(self, client, core):
        """q 파라미터로 이름 검색."""
        proj = core.projects.list_all()[0]
        _make_skill(core, proj.id, "fastapi-route", description="FastAPI scaffolding")
        _make_skill(core, proj.id, "pydantic-model", description="Pydantic helper")

        resp = client.get(f"/api/projects/{proj.id}/components", params={"q": "fastapi"})
        data = resp.json()
        names = {c["name"] for c in data["items"]}
        assert "fastapi-route" in names
        assert "pydantic-model" not in names

    def test_search_by_q_description(self, client, core):
        """q 파라미터로 설명 검색."""
        proj = core.projects.list_all()[0]
        _make_skill(core, proj.id, "route-gen", description="Generate FastAPI routes")
        _make_skill(core, proj.id, "db-helper", description="Database utilities")

        resp = client.get(f"/api/projects/{proj.id}/components", params={"q": "database"})
        data = resp.json()
        names = {c["name"] for c in data["items"]}
        assert "db-helper" in names
        assert "route-gen" not in names

    def test_sort_by_name_asc(self, client, core):
        """name 오름차순 정렬."""
        proj = core.projects.list_all()[0]
        _make_skill(core, proj.id, "charlie-skill")
        _make_skill(core, proj.id, "alpha-skill")
        _make_skill(core, proj.id, "bravo-skill")

        resp = client.get(
            f"/api/projects/{proj.id}/components",
            params={"sort": "name", "order": "asc"},
        )
        data = resp.json()
        names = [c["name"] for c in data["items"]]
        assert names == sorted(names)

    def test_sort_by_name_desc(self, client, core):
        """name 내림차순 정렬."""
        proj = core.projects.list_all()[0]
        _make_skill(core, proj.id, "charlie-d")
        _make_skill(core, proj.id, "alpha-d")
        _make_skill(core, proj.id, "bravo-d")

        resp = client.get(
            f"/api/projects/{proj.id}/components",
            params={"sort": "name", "order": "desc"},
        )
        data = resp.json()
        names = [c["name"] for c in data["items"]]
        assert names == sorted(names, reverse=True)

    def test_sort_by_type(self, client, core):
        """type으로 정렬."""
        proj = core.projects.list_all()[0]
        _make_skill(core, proj.id, "sort-skill")
        _make_command(core, proj.id, "sort-cmd")

        resp = client.get(
            f"/api/projects/{proj.id}/components",
            params={"sort": "type", "order": "asc"},
        )
        data = resp.json()
        types = [c["type"] for c in data["items"]]
        assert types == sorted(types)

    def test_pagination_limit(self, client, core):
        """limit으로 결과 수 제한."""
        proj = core.projects.list_all()[0]
        for i in range(5):
            _make_skill(core, proj.id, f"lim-skill-{i:02d}")

        resp = client.get(
            f"/api/projects/{proj.id}/components",
            params={"limit": 2},
        )
        data = resp.json()
        assert len(data["items"]) == 2
        assert data["total"] == 5

    def test_pagination_offset(self, client, core):
        """offset으로 건너뛰기."""
        proj = core.projects.list_all()[0]
        for i in range(5):
            _make_skill(core, proj.id, f"off-skill-{i:02d}")

        resp = client.get(
            f"/api/projects/{proj.id}/components",
            params={"limit": 2, "offset": 2, "sort": "name", "order": "asc"},
        )
        data = resp.json()
        assert len(data["items"]) == 2
        assert data["items"][0]["name"] == "off-skill-02"
        assert data["items"][1]["name"] == "off-skill-03"

    def test_total_reflects_filtered_count(self, client, core):
        """total은 필터 적용 후 전체 수."""
        proj = core.projects.list_all()[0]
        _make_skill(core, proj.id, "tf-s1")
        _make_skill(core, proj.id, "tf-s2")
        _make_command(core, proj.id, "tf-c1")

        resp = client.get(
            f"/api/projects/{proj.id}/components",
            params={"type": "skill"},
        )
        data = resp.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2

    def test_default_returns_all_with_total(self, client, core):
        """파라미터 없이 호출하면 전체 반환 + total."""
        proj = core.projects.list_all()[0]
        _make_skill(core, proj.id, "def-s1")
        _make_skill(core, proj.id, "def-s2")
        _make_skill(core, proj.id, "def-s3")

        resp = client.get(f"/api/projects/{proj.id}/components")
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert data["total"] == 3
        assert len(data["items"]) == 3

    def test_combined_q_and_sort(self, client, core):
        """q + sort 조합."""
        proj = core.projects.list_all()[0]
        _make_skill(core, proj.id, "react-hook", description="React custom hook")
        _make_skill(core, proj.id, "react-component", description="React component gen")
        _make_command(core, proj.id, "vue-cmd", description="Vue.js helper")

        resp = client.get(
            f"/api/projects/{proj.id}/components",
            params={"q": "react", "sort": "name", "order": "asc"},
        )
        data = resp.json()
        assert data["total"] == 2
        names = [c["name"] for c in data["items"]]
        assert names == ["react-component", "react-hook"]
