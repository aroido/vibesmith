"""버전 히스토리 및 롤백 API 테스트 (Issue #29)."""

import uuid
from datetime import UTC, datetime

from vibesmith_core.components.models import Skill


def _now():
    return datetime.now(UTC).isoformat()


def _make_skill(core, project_id, name="version-skill", content=None):
    """DB에 스킬을 직접 생성한다."""
    body = content or f"---\nname: {name}\n---\n\nOriginal content"
    skill = Skill(
        id=str(uuid.uuid4()),
        name=name,
        description="Version test",
        enabled=True,
        tags=[],
        project_id=project_id,
        path=f"/fake/skills/{name}/SKILL.md",
        content=body,
        frontmatter={"name": name},
        created_at=_now(),
        updated_at=_now(),
        platform="claude_code",
    )
    core.operations.create(skill)
    return skill


# ---------------------------------------------------------------------------
# GET /api/components/{id}/versions
# ---------------------------------------------------------------------------


class TestListVersions:
    """GET /api/components/{id}/versions 테스트."""

    def test_returns_empty_when_no_versions(self, client, core):
        """버전 히스토리가 없으면 빈 배열 반환."""
        proj = core.projects.list_all()[0]
        skill = _make_skill(core, proj.id)
        resp = client.get(f"/api/components/{skill.id}/versions")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_returns_versions_after_put(self, client, core):
        """PUT 후 버전이 저장되면 목록에 표시됨."""
        proj = core.projects.list_all()[0]
        skill = _make_skill(core, proj.id, content="# Original\n")

        resp = client.put(
            f"/api/components/{skill.id}",
            json={"content": "# Modified v1\n"},
        )
        assert resp.status_code == 200

        resp = client.get(f"/api/components/{skill.id}/versions")
        assert resp.status_code == 200
        versions = resp.json()
        assert len(versions) == 1
        assert versions[0]["version"] == 1
        assert "# Original" in versions[0]["content"]
        assert "created_at" in versions[0]

    def test_versions_ordered_newest_first(self, client, core):
        """버전 목록은 최신이 먼저 (내림차순)."""
        proj = core.projects.list_all()[0]
        skill = _make_skill(core, proj.id, content="# V0")

        client.put(f"/api/components/{skill.id}", json={"content": "# V1"})
        client.put(f"/api/components/{skill.id}", json={"content": "# V2"})

        resp = client.get(f"/api/components/{skill.id}/versions")
        assert resp.status_code == 200
        versions = resp.json()
        assert len(versions) == 2
        assert versions[0]["version"] == 2
        assert versions[1]["version"] == 1
        assert "# V1" in versions[0]["content"]
        assert "# V0" in versions[1]["content"]

    def test_returns_404_for_nonexistent_component(self, client):
        resp = client.get("/api/components/nonexistent-id/versions")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/components/{id}/rollback
# ---------------------------------------------------------------------------


class TestRollback:
    """POST /api/components/{id}/rollback 테스트."""

    def test_rollback_restores_content(self, client, core):
        """롤백 시 지정된 버전 content로 복원됨."""
        proj = core.projects.list_all()[0]
        skill = _make_skill(core, proj.id, content="# Original content\n")
        client.put(f"/api/components/{skill.id}", json={"content": "# Modified\n"})

        resp = client.post(
            f"/api/components/{skill.id}/rollback",
            json={"version": 1},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == skill.id
        assert data["restored_version"] == 1
        assert data["new_version"] == 2
        assert "message" in data

        detail = client.get(f"/api/components/{skill.id}").json()
        assert "# Original" in detail["content"]
        assert "# Modified" not in detail["content"]

    def test_rollback_nonexistent_version_returns_404(self, client, core):
        """존재하지 않는 버전으로 롤백 시 404."""
        proj = core.projects.list_all()[0]
        skill = _make_skill(core, proj.id)

        resp = client.post(
            f"/api/components/{skill.id}/rollback",
            json={"version": 99},
        )
        assert resp.status_code == 404

    def test_rollback_nonexistent_component_returns_404(self, client):
        resp = client.post(
            "/api/components/nonexistent-id/rollback",
            json={"version": 1},
        )
        assert resp.status_code == 404

    def test_rollback_backs_up_current_before_restore(self, client, core):
        """롤백 전 현재 내용이 새 버전으로 백업됨."""
        proj = core.projects.list_all()[0]
        skill = _make_skill(core, proj.id, content="# V0")
        client.put(f"/api/components/{skill.id}", json={"content": "# V1"})

        resp = client.post(
            f"/api/components/{skill.id}/rollback",
            json={"version": 1},
        )
        assert resp.status_code == 200
        assert resp.json()["new_version"] == 2

        versions = client.get(f"/api/components/{skill.id}/versions").json()
        version_nums = [v["version"] for v in versions]
        assert 1 in version_nums
        assert 2 in version_nums


# ---------------------------------------------------------------------------
# PUT 자동 버전 백업
# ---------------------------------------------------------------------------


class TestPutAutoVersionBackup:
    """PUT /api/components/{id} 시 자동 버전 백업 테스트."""

    def test_put_saves_previous_version(self, client, core):
        """content 변경 시 이전 버전이 versions에 저장됨."""
        proj = core.projects.list_all()[0]
        skill = _make_skill(core, proj.id, content="# Original\n")

        resp = client.put(
            f"/api/components/{skill.id}",
            json={"content": "# Modified\n"},
        )
        assert resp.status_code == 200

        versions = client.get(f"/api/components/{skill.id}/versions").json()
        assert len(versions) == 1
        assert "# Original" in versions[0]["content"]

    def test_put_no_backup_when_content_unchanged(self, client, core):
        """동일 content로 PUT 시 버전 생성 안 함."""
        proj = core.projects.list_all()[0]
        content = "# Same content\n"
        skill = _make_skill(core, proj.id, content=content)

        client.put(f"/api/components/{skill.id}", json={"content": content})
        client.put(f"/api/components/{skill.id}", json={"content": content})

        versions = client.get(f"/api/components/{skill.id}/versions").json()
        assert len(versions) == 0

    def test_put_no_backup_when_only_tags_change(self, client, core):
        """tags만 변경 시 content 백업 안 함."""
        proj = core.projects.list_all()[0]
        skill = _make_skill(core, proj.id)

        client.put(
            f"/api/components/{skill.id}",
            json={"tags": ["new-tag"]},
        )

        versions = client.get(f"/api/components/{skill.id}/versions").json()
        assert len(versions) == 0
