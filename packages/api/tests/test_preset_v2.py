"""Preset Bundle V2 API tests."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi.testclient import TestClient
from vibesmith_core.components.models import ComponentBase, ComponentType


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _create_component(
    core,
    *,
    project_id: str,
    component_type: ComponentType = ComponentType.SKILL,
    name: str,
    platform: str = "claude_code",
    description: str = "",
    content: str = "",
    tags: list[str] | None = None,
) -> ComponentBase:
    component = ComponentBase(
        id=str(uuid.uuid4()),
        type=component_type,
        name=name,
        description=description,
        enabled=True,
        tags=tags or [],
        project_id=project_id,
        path=f"/{component_type.value}s/{name}",
        content=content,
        frontmatter={"name": name},
        created_at=_now(),
        updated_at=_now(),
        platform=platform,
    )
    return core.operations.create(component)


def test_create_snapshot_template_from_project(client: TestClient, core, tmp_path):
    source_dir = tmp_path / "source-project"
    source_dir.mkdir(parents=True)
    source_project = core.projects.add_project(str(source_dir))
    source_component = _create_component(
        core,
        project_id=source_project.id,
        name="source-skill",
        description="source desc",
        content="---\nname: source-skill\n---\n\nsnapshot source",
        tags=["snapshot", "v2"],
    )

    response = client.post(
        "/api/project-templates/from-project",
        json={
            "source_project_id": source_project.id,
            "name": "Snapshot Preset",
            "description": "snapshot from project",
            "tags": ["team-standard"],
            "component_ids": [source_component.id],
            "include_disabled": False,
            "conflict_if_name_exists": True,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["preset_type"] == "snapshot"
    assert data["latest_revision"] == 1
    assert data["revisions_count"] == 1
    assert data["component_count"] == 1
    assert data["components"][0]["name"] == "source-skill"
    assert data["components"][0]["source_component_id"] == source_component.id

    revision_list = client.get(f"/api/project-templates/{data['id']}/revisions")
    assert revision_list.status_code == 200
    revisions = revision_list.json()
    assert revisions["total"] == 1
    assert revisions["items"][0]["revision"] == 1


def test_template_update_creates_immutable_revision_and_restore(client: TestClient):
    create_response = client.post(
        "/api/project-templates",
        json={
            "name": "Revision Target",
            "description": "rev test",
            "tags": ["rev"],
            "preset_type": "template",
            "components": [
                {
                    "component_type": "skill",
                    "template_id": "react-component",
                    "name": "rev-skill",
                    "description": "v1",
                    "platform": "claude_code",
                    "config": {},
                }
            ],
            "change_note": "initial",
        },
    )
    assert create_response.status_code == 201
    created = create_response.json()
    template_id = created["id"]
    assert created["latest_revision"] == 1

    update_response = client.put(
        f"/api/project-templates/{template_id}",
        json={
            "name": "Revision Target",
            "description": "rev test",
            "tags": ["rev", "v2"],
            "preset_type": "template",
            "components": [
                {
                    "component_type": "skill",
                    "template_id": "react-component",
                    "name": "rev-skill-updated",
                    "description": "v2",
                    "platform": "claude_code",
                    "config": {},
                }
            ],
            "change_note": "update to v2",
        },
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["latest_revision"] == 2
    assert updated["revisions_count"] == 2

    rev1 = client.get(f"/api/project-templates/{template_id}/revisions/1")
    rev2 = client.get(f"/api/project-templates/{template_id}/revisions/2")
    assert rev1.status_code == 200
    assert rev2.status_code == 200
    assert rev1.json()["items"][0]["name"] == "rev-skill"
    assert rev2.json()["items"][0]["name"] == "rev-skill-updated"

    restore_response = client.post(
        f"/api/project-templates/{template_id}/revisions/1/restore",
        json={"change_note": "restore to v1"},
    )
    assert restore_response.status_code == 200
    restored = restore_response.json()
    assert restored["revision"] == 3
    assert restored["items"][0]["name"] == "rev-skill"


def test_preview_and_apply_preset_with_conflict_policies(client: TestClient, core, tmp_path):
    source_dir = tmp_path / "preset-source"
    target_dir = tmp_path / "preset-target"
    source_dir.mkdir(parents=True)
    target_dir.mkdir(parents=True)

    source_project = core.projects.add_project(str(source_dir))
    target_project = core.projects.add_project(str(target_dir))

    source_component = _create_component(
        core,
        project_id=source_project.id,
        name="shared-skill",
        description="source",
        content="---\nname: shared-skill\n---\n\nnew-content",
        tags=["preset", "source"],
    )
    target_component = _create_component(
        core,
        project_id=target_project.id,
        name="shared-skill",
        description="target-old",
        content="---\nname: shared-skill\n---\n\nold-content",
        tags=["target"],
    )

    preset_response = client.post(
        "/api/project-templates/from-project",
        json={
            "source_project_id": source_project.id,
            "name": "Conflict Preset",
            "description": "conflict checks",
            "tags": ["conflict"],
            "component_ids": [source_component.id],
            "include_disabled": False,
            "conflict_if_name_exists": True,
        },
    )
    assert preset_response.status_code == 201
    preset = preset_response.json()

    preview_fail = client.post(
        f"/api/projects/{target_project.id}/preset-preview",
        json={"preset_id": preset["id"], "revision": 1, "conflict_policy": "fail"},
    )
    assert preview_fail.status_code == 200
    preview_data = preview_fail.json()
    assert preview_data["summary"]["conflicts"] == 1
    assert preview_data["items"][0]["action"] == "conflict"

    apply_fail = client.post(
        f"/api/projects/{target_project.id}/apply-preset",
        json={"preset_id": preset["id"], "revision": 1, "conflict_policy": "fail"},
    )
    assert apply_fail.status_code == 409
    assert apply_fail.json()["message_key"] == "errors.project_template_apply_conflict"

    apply_skip = client.post(
        f"/api/projects/{target_project.id}/apply-preset",
        json={"preset_id": preset["id"], "revision": 1, "conflict_policy": "skip"},
    )
    assert apply_skip.status_code == 200
    skip_data = apply_skip.json()
    assert skip_data["summary"]["skipped"] >= 1

    apply_rename = client.post(
        f"/api/projects/{target_project.id}/apply-preset",
        json={"preset_id": preset["id"], "revision": 1, "conflict_policy": "rename"},
    )
    assert apply_rename.status_code == 200
    rename_data = apply_rename.json()
    assert rename_data["summary"]["renamed"] == 1
    assert rename_data["items"][0]["renamed_to"].startswith("shared-skill-preset-")

    target_components_response = client.get(f"/api/projects/{target_project.id}/components")
    assert target_components_response.status_code == 200
    target_components = target_components_response.json()["items"]
    assert any(component["name"].startswith("shared-skill-preset-") for component in target_components)

    apply_overwrite = client.post(
        f"/api/projects/{target_project.id}/apply-preset",
        json={"preset_id": preset["id"], "revision": 1, "conflict_policy": "overwrite"},
    )
    assert apply_overwrite.status_code == 200
    overwrite_data = apply_overwrite.json()
    assert overwrite_data["summary"]["updated"] >= 1

    overwritten = core.operations.read(target_component.id)
    assert overwritten is not None
    assert "new-content" in (overwritten.content or "")
