"""휴지통 API 테스트 (Issue #165)."""

import uuid
from datetime import UTC, datetime

from vibesmith_core.components.models import Skill


def _make_skill(core, project_id, name="test-skill"):
    skill = Skill(
        id=str(uuid.uuid4()),
        name=name,
        description="test",
        enabled=True,
        tags=[],
        project_id=project_id,
        path=f"/fake/skills/{name}/SKILL.md",
        content=f"---\nname: {name}\n---\nBody",
        frontmatter={"name": name},
        created_at=datetime.now(UTC).isoformat(),
        updated_at=datetime.now(UTC).isoformat(),
        platform="claude_code",
    )
    core.operations.create(skill)
    return skill


def test_list_trash_empty(client, core):
    """빈 휴지통은 빈 리스트."""
    resp = client.get("/api/trash")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_trash_after_soft_delete(client, core, tmp_path):
    """Soft delete 후 휴지통에 표시."""
    proj_dir = tmp_path / "trash-proj"
    proj_dir.mkdir()
    (proj_dir / ".claude" / "skills" / "trash-skill").mkdir(parents=True)
    (proj_dir / ".claude" / "skills" / "trash-skill" / "SKILL.md").write_text("---\nname: trash-skill\n---\nbody")
    proj = core.projects.add_project(str(proj_dir))
    core.projects.rescan(proj.id)
    skills = core.operations.list_all({"project_id": proj.id})
    skill = skills[0]

    client.delete(f"/api/components/{skill.id}")
    resp = client.get("/api/trash")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) >= 1
    assert any(t["id"] == skill.id for t in items)
    trash_item = next(t for t in items if t["id"] == skill.id)
    assert "deleted_at" in trash_item
    assert trash_item["name"] == "trash-skill"


def test_restore_from_trash(client, core, tmp_path):
    """휴지통에서 복원."""
    proj_dir = tmp_path / "restore-proj"
    proj_dir.mkdir()
    (proj_dir / ".claude" / "skills" / "restore-skill").mkdir(parents=True)
    (proj_dir / ".claude" / "skills" / "restore-skill" / "SKILL.md").write_text("---\nname: restore-skill\n---\nbody")
    proj = core.projects.add_project(str(proj_dir))
    core.projects.rescan(proj.id)
    skills = core.operations.list_all({"project_id": proj.id})
    skill = skills[0]

    client.delete(f"/api/components/{skill.id}")
    resp = client.post(f"/api/trash/{skill.id}/restore")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == skill.id
    assert data["name"] == "restore-skill"

    get_resp = client.get(f"/api/components/{skill.id}")
    assert get_resp.status_code == 200


def test_permanent_delete_from_trash(client, core, tmp_path):
    """휴지통 항목 영구 삭제."""
    proj_dir = tmp_path / "perm-proj"
    proj_dir.mkdir()
    (proj_dir / ".claude" / "skills" / "perm-skill").mkdir(parents=True)
    (proj_dir / ".claude" / "skills" / "perm-skill" / "SKILL.md").write_text("---\nname: perm-skill\n---\nbody")
    proj = core.projects.add_project(str(proj_dir))
    core.projects.rescan(proj.id)
    skills = core.operations.list_all({"project_id": proj.id})
    skill = skills[0]

    client.delete(f"/api/components/{skill.id}")
    resp = client.delete(f"/api/trash/{skill.id}")
    assert resp.status_code == 200
    trash_resp = client.get("/api/trash")
    assert not any(t["id"] == skill.id for t in trash_resp.json())
    get_resp = client.get(f"/api/components/{skill.id}")
    assert get_resp.status_code == 404


def test_empty_trash(client, core, tmp_path):
    """휴지통 비우기."""
    proj_dir = tmp_path / "empty-proj"
    proj_dir.mkdir()
    (proj_dir / ".claude" / "skills" / "e1").mkdir(parents=True)
    (proj_dir / ".claude" / "skills" / "e1" / "SKILL.md").write_text("---\nname: e1\n---\n")
    proj = core.projects.add_project(str(proj_dir))
    core.projects.rescan(proj.id)
    skills = core.operations.list_all({"project_id": proj.id})
    skill = skills[0]

    client.delete(f"/api/components/{skill.id}")
    assert len(client.get("/api/trash").json()) >= 1
    resp = client.delete("/api/trash")
    assert resp.status_code == 200
    assert client.get("/api/trash").json() == []


def test_restore_nonexistent_returns_404(client):
    resp = client.post("/api/trash/nonexistent-id/restore")
    assert resp.status_code == 404


def test_delete_trash_nonexistent_returns_404(client):
    resp = client.delete("/api/trash/nonexistent-id")
    assert resp.status_code == 404
