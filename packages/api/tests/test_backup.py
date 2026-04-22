"""로컬 백업 API 테스트 (Issue #84)."""

from pathlib import Path

from fastapi.testclient import TestClient
from vibesmith_core import VibeSmithCore


def _create_project_with_skill(core: VibeSmithCore, tmp_path: Path, project_name: str, skill_name: str) -> dict:
    project_dir = tmp_path / project_name
    skill_dir = project_dir / ".claude" / "skills" / skill_name
    skill_dir.mkdir(parents=True)
    (skill_dir / "SKILL.md").write_text(f"---\nname: {skill_name}\n---\n\n{skill_name} body", encoding="utf-8")

    project = core.projects.add_project(str(project_dir))
    core.projects.rescan(project.id)
    return {"id": project.id, "path": str(project_dir), "skill_name": skill_name}


def test_backup_create_list_get(client: TestClient, core: VibeSmithCore, tmp_path: Path):
    from vibesmith_api.main import app

    app.state.backup_dir = str(tmp_path / "backups")
    created = _create_project_with_skill(core, tmp_path, "proj-backup-1", "skill-backup-1")

    create_resp = client.post("/api/backup/create")
    assert create_resp.status_code == 201
    created_backup = create_resp.json()
    backup_id = created_backup["id"]

    list_resp = client.get("/api/backup/list")
    assert list_resp.status_code == 200
    list_items = list_resp.json()
    assert any(item["id"] == backup_id for item in list_items)

    get_resp = client.get(f"/api/backup/{backup_id}")
    assert get_resp.status_code == 200
    detail = get_resp.json()
    assert detail["id"] == backup_id
    assert detail["checksum"] == created_backup["checksum"]

    payload = detail["payload"]
    assert payload["version"] == "1.0.0"
    project_paths = {p["path"] for p in payload["data"]["projects"]}
    assert created["path"] in project_paths


def test_backup_restore_restores_projects_and_components(client: TestClient, core: VibeSmithCore, tmp_path: Path):
    from vibesmith_api.main import app

    app.state.backup_dir = str(tmp_path / "backups")
    created = _create_project_with_skill(core, tmp_path, "proj-backup-restore", "skill-backup-restore")

    create_resp = client.post("/api/backup/create")
    assert create_resp.status_code == 201
    backup_id = create_resp.json()["id"]

    core.projects.remove_project(created["id"])
    projects_after_delete = client.get("/api/projects").json()
    assert created["id"] not in {p["id"] for p in projects_after_delete}

    restore_resp = client.post("/api/backup/restore", json={"backup_id": backup_id})
    assert restore_resp.status_code == 200
    restore_data = restore_resp.json()
    assert restore_data["restored_projects"] >= 1
    assert restore_data["restored_components"] >= 1

    projects_after_restore = client.get("/api/projects").json()
    assert created["id"] in {p["id"] for p in projects_after_restore}

    components_resp = client.get("/api/components")
    assert components_resp.status_code == 200
    names = {item["name"] for item in components_resp.json()}
    assert created["skill_name"] in names


def test_backup_delete_and_not_found(client: TestClient, core: VibeSmithCore, tmp_path: Path):
    from vibesmith_api.main import app

    app.state.backup_dir = str(tmp_path / "backups")
    _create_project_with_skill(core, tmp_path, "proj-backup-delete", "skill-backup-delete")

    create_resp = client.post("/api/backup/create")
    assert create_resp.status_code == 201
    backup_id = create_resp.json()["id"]

    delete_resp = client.delete(f"/api/backup/{backup_id}")
    assert delete_resp.status_code == 200

    list_resp = client.get("/api/backup/list")
    assert list_resp.status_code == 200
    assert not any(item["id"] == backup_id for item in list_resp.json())

    get_resp = client.get(f"/api/backup/{backup_id}")
    assert get_resp.status_code == 404

    delete_again_resp = client.delete(f"/api/backup/{backup_id}")
    assert delete_again_resp.status_code == 404
