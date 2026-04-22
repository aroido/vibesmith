"""충돌 API 테스트 (Issue #164)."""

import uuid
from datetime import UTC, datetime

from vibesmith_core.components.conflicts import CONFLICT_ID_SEP, list_conflicts
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


def test_get_conflicts_empty(client, core):
    """충돌 없을 때 빈 리스트."""
    resp = client.get("/api/conflicts")
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_conflicts_with_conflict(client, core, tmp_path):
    """글로벌과 프로젝트에 동일 이름 구성요소 있을 때 충돌 반환."""
    projects = core.projects.list_all()
    global_proj = next(p for p in projects if p.is_global)
    global_skill = _make_skill(core, global_proj.id, "git-commit")

    proj_dir = tmp_path / "conflict-proj"
    proj_dir.mkdir()
    (proj_dir / ".claude" / "skills" / "git-commit").mkdir(parents=True)
    (proj_dir / ".claude" / "skills" / "git-commit" / "SKILL.md").write_text("---\nname: git-commit\n---\nProj body")
    proj = core.projects.add_project(str(proj_dir))
    core.projects.rescan(proj.id)
    proj_skills = core.operations.list_all({"project_id": proj.id})
    proj_skill = next((s for s in proj_skills if s.name == "git-commit"), None)
    if not proj_skill:
        proj_skill = _make_skill(core, proj.id, "git-commit")

    resp = client.get("/api/conflicts")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    c = next((x for x in data if x["name"] == "git-commit"), data[0])
    assert c["name"] == "git-commit"
    assert c["type"] == "skill"
    assert c["global_component_id"] == global_skill.id
    assert c["project_component_id"] == proj_skill.id
    assert c["priority"] == "project"
    assert c["is_intentional"] is False
    assert CONFLICT_ID_SEP in c["id"]


def test_resolve_conflict_ignore(client, core, tmp_path):
    """ignore 액션 — conflict_ignores에 저장, is_intentional=true."""
    projects = core.projects.list_all()
    global_proj = next(p for p in projects if p.is_global)
    proj_dir = tmp_path / "resolve-proj"
    proj_dir.mkdir()
    (proj_dir / ".claude" / "skills" / "dup-skill").mkdir(parents=True)
    (proj_dir / ".claude" / "skills" / "dup-skill" / "SKILL.md").write_text("---\nname: dup-skill\n---\n")
    proj = core.projects.add_project(str(proj_dir))
    core.projects.rescan(proj.id)
    global_skill = _make_skill(core, global_proj.id, "dup-skill")
    proj_skills = core.operations.list_all({"project_id": proj.id})
    proj_skill = next((s for s in proj_skills if s.name == "dup-skill"), None)
    if not proj_skill:
        proj_skill = _make_skill(core, proj.id, "dup-skill")

    conflict_id = f"{global_skill.id}{CONFLICT_ID_SEP}{proj_skill.id}"
    resp = client.post(
        f"/api/conflicts/{conflict_id}/resolve",
        json={"action": "ignore"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["conflict_id"] == conflict_id
    assert data["updated_component_ids"] == []

    # 다시 조회 시 is_intentional=true
    conflicts = list_conflicts(core._db)
    c = next((x for x in conflicts if x["name"] == "dup-skill"), None)
    assert c is not None
    assert c["is_intentional"] is True


def test_resolve_conflict_disable_global(client, core, tmp_path):
    """disable_global — 글로벌 구성요소 비활성화."""
    projects = core.projects.list_all()
    global_proj = next(p for p in projects if p.is_global)
    proj_dir = tmp_path / "disable-proj"
    proj_dir.mkdir()
    (proj_dir / ".claude" / "skills" / "dis-skill").mkdir(parents=True)
    (proj_dir / ".claude" / "skills" / "dis-skill" / "SKILL.md").write_text("---\nname: dis-skill\n---\n")
    proj = core.projects.add_project(str(proj_dir))
    core.projects.rescan(proj.id)
    global_skill = _make_skill(core, global_proj.id, "dis-skill")
    proj_skills = core.operations.list_all({"project_id": proj.id})
    proj_skill = next((s for s in proj_skills if s.name == "dis-skill"), None)
    if not proj_skill:
        proj_skill = _make_skill(core, proj.id, "dis-skill")

    conflict_id = f"{global_skill.id}{CONFLICT_ID_SEP}{proj_skill.id}"
    resp = client.post(
        f"/api/conflicts/{conflict_id}/resolve",
        json={"action": "disable_global"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert global_skill.id in data["updated_component_ids"]
    comp = core.operations.read(global_skill.id)
    assert comp.enabled is False


def test_resolve_conflict_invalid_id_returns_404(client):
    """잘못된 conflict_id — 404."""
    resp = client.post(
        "/api/conflicts/invalid-id/resolve",
        json={"action": "ignore"},
    )
    assert resp.status_code == 404
