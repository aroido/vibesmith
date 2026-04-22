"""Preset/Collection V1 API tests."""

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
    name: str,
    component_type: ComponentType = ComponentType.SKILL,
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


def test_preset_crud_and_revision_restore(client: TestClient):
    create_response = client.post(
        "/api/presets",
        json={
            "name": "v1-skill-preset",
            "component_type": "skill",
            "platform": "claude_code",
            "description": "preset v1",
            "scope": "user",
            "tags": ["v1"],
            "content": "---\nname: v1-skill-preset\n---\n\ncontent-v1",
            "frontmatter": {"name": "v1-skill-preset"},
            "change_note": "initial",
        },
    )
    assert create_response.status_code == 201
    created = create_response.json()
    preset_id = created["id"]
    assert created["latest_revision"] == 1

    update_response = client.put(
        f"/api/presets/{preset_id}",
        json={
            "name": "v1-skill-preset",
            "component_type": "skill",
            "platform": "claude_code",
            "description": "preset v2",
            "scope": "user",
            "tags": ["v2"],
            "content": "---\nname: v1-skill-preset\n---\n\ncontent-v2",
            "frontmatter": {"name": "v1-skill-preset"},
            "change_note": "update to v2",
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["latest_revision"] == 2

    revision_1 = client.get(f"/api/presets/{preset_id}/revisions/1")
    revision_2 = client.get(f"/api/presets/{preset_id}/revisions/2")
    assert revision_1.status_code == 200
    assert revision_2.status_code == 200
    assert "content-v1" in revision_1.json()["content"]
    assert "content-v2" in revision_2.json()["content"]

    restore_response = client.post(
        f"/api/presets/{preset_id}/revisions/1/restore",
        json={"change_note": "restore v1"},
    )
    assert restore_response.status_code == 200
    restored = restore_response.json()
    assert restored["revision"] == 3
    assert "content-v1" in restored["content"]

    list_response = client.get(f"/api/presets/{preset_id}/revisions")
    assert list_response.status_code == 200
    assert list_response.json()["total"] == 3


def test_create_preset_from_project_conflict_policy(client: TestClient, core, tmp_path):
    source_dir = tmp_path / "preset-source-project"
    source_dir.mkdir(parents=True)
    source_project = core.projects.add_project(str(source_dir))
    source_component = _create_component(
        core,
        project_id=source_project.id,
        name="source-skill",
        description="source",
        content="---\nname: source-skill\n---\n\nsource-content",
        tags=["from-project"],
    )

    first_create = client.post(
        "/api/presets/from-project",
        json={
            "source_project_id": source_project.id,
            "component_id": source_component.id,
            "name": "from-project-preset",
            "description": "created from project",
            "tags": ["team"],
            "include_disabled": False,
            "conflict_if_name_exists": True,
            "scope": "user",
        },
    )
    assert first_create.status_code == 201

    conflict_response = client.post(
        "/api/presets/from-project",
        json={
            "source_project_id": source_project.id,
            "component_id": source_component.id,
            "name": "from-project-preset",
            "description": "created from project",
            "tags": ["team"],
            "include_disabled": False,
            "conflict_if_name_exists": True,
            "scope": "user",
        },
    )
    assert conflict_response.status_code == 409
    assert conflict_response.json()["message_key"] == "errors.project_template_name_exists"

    rename_response = client.post(
        "/api/presets/from-project",
        json={
            "source_project_id": source_project.id,
            "component_id": source_component.id,
            "name": "from-project-preset",
            "description": "created from project",
            "tags": ["team"],
            "include_disabled": False,
            "conflict_if_name_exists": False,
            "scope": "user",
        },
    )
    assert rename_response.status_code == 201
    assert rename_response.json()["name"].startswith("from-project-preset")


def test_collection_pin_and_latest_resolve_on_preview(client: TestClient, core, tmp_path):
    pinned_response = client.post(
        "/api/presets",
        json={
            "name": "pinned-skill",
            "component_type": "skill",
            "platform": "claude_code",
            "description": "pinned target",
            "scope": "user",
            "tags": [],
            "content": "---\nname: pinned-skill\n---\n\npinned-v1",
            "frontmatter": {"name": "pinned-skill"},
        },
    )
    latest_response = client.post(
        "/api/presets",
        json={
            "name": "latest-skill",
            "component_type": "skill",
            "platform": "claude_code",
            "description": "latest target",
            "scope": "user",
            "tags": [],
            "content": "---\nname: latest-skill\n---\n\nlatest-v1",
            "frontmatter": {"name": "latest-skill"},
        },
    )
    assert pinned_response.status_code == 201
    assert latest_response.status_code == 201
    pinned_id = pinned_response.json()["id"]
    latest_id = latest_response.json()["id"]

    update_latest = client.put(
        f"/api/presets/{latest_id}",
        json={
            "name": "latest-skill",
            "component_type": "skill",
            "platform": "claude_code",
            "description": "latest target",
            "scope": "user",
            "tags": [],
            "content": "---\nname: latest-skill\n---\n\nlatest-v2",
            "frontmatter": {"name": "latest-skill"},
        },
    )
    assert update_latest.status_code == 200
    assert update_latest.json()["latest_revision"] == 2

    collection_create = client.post(
        "/api/collections",
        json={
            "name": "pin-latest-collection",
            "description": "resolve test",
            "scope": "user",
            "tags": ["resolve"],
            "items": [
                {"preset_id": pinned_id, "pin_mode": "pin", "pinned_revision": 1},
                {"preset_id": latest_id, "pin_mode": "latest"},
            ],
            "change_note": "initial",
        },
    )
    assert collection_create.status_code == 201
    collection_id = collection_create.json()["id"]

    project_dir = tmp_path / "collection-target"
    project_dir.mkdir(parents=True)
    project = core.projects.add_project(str(project_dir))

    preview_response = client.post(
        f"/api/collections/{collection_id}/preview",
        json={
            "project_id": project.id,
            "revision": 1,
            "conflict_policy": "fail",
        },
    )
    assert preview_response.status_code == 200
    preview_data = preview_response.json()
    by_preset = {item["preset_id"]: item for item in preview_data["items"]}
    assert by_preset[pinned_id]["preset_revision"] == 1
    assert by_preset[latest_id]["preset_revision"] == 2


def test_collection_preview_apply_policies_and_apply_log(client: TestClient, core, tmp_path):
    source_dir = tmp_path / "collection-source"
    target_dir = tmp_path / "collection-target"
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
        tags=["source"],
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
        "/api/presets/from-project",
        json={
            "source_project_id": source_project.id,
            "component_id": source_component.id,
            "name": "shared-skill",
            "description": "shared",
            "tags": ["shared"],
            "include_disabled": False,
            "conflict_if_name_exists": True,
            "scope": "user",
        },
    )
    assert preset_response.status_code == 201
    preset_id = preset_response.json()["id"]

    collection_response = client.post(
        "/api/collections",
        json={
            "name": "shared-collection",
            "description": "policy test",
            "scope": "user",
            "tags": [],
            "items": [{"preset_id": preset_id, "pin_mode": "pin", "pinned_revision": 1}],
        },
    )
    assert collection_response.status_code == 201
    collection_id = collection_response.json()["id"]

    preview_fail = client.post(
        f"/api/collections/{collection_id}/preview",
        json={"project_id": target_project.id, "revision": 1, "conflict_policy": "fail"},
    )
    assert preview_fail.status_code == 200
    assert preview_fail.json()["summary"]["conflicts"] == 1
    assert preview_fail.json()["items"][0]["action"] == "conflict"

    apply_fail = client.post(
        f"/api/collections/{collection_id}/apply",
        json={"project_id": target_project.id, "revision": 1, "conflict_policy": "fail"},
    )
    assert apply_fail.status_code == 409
    assert apply_fail.json()["message_key"] == "errors.project_template_apply_conflict"

    apply_skip = client.post(
        f"/api/collections/{collection_id}/apply",
        json={"project_id": target_project.id, "revision": 1, "conflict_policy": "skip"},
    )
    assert apply_skip.status_code == 200
    assert apply_skip.json()["summary"]["skipped"] >= 1

    apply_rename = client.post(
        f"/api/collections/{collection_id}/apply",
        json={"project_id": target_project.id, "revision": 1, "conflict_policy": "rename"},
    )
    assert apply_rename.status_code == 200
    assert apply_rename.json()["summary"]["renamed"] == 1
    assert apply_rename.json()["items"][0]["renamed_to"].startswith("shared-skill-preset-")

    apply_overwrite = client.post(
        f"/api/collections/{collection_id}/apply",
        json={"project_id": target_project.id, "revision": 1, "conflict_policy": "overwrite"},
    )
    assert apply_overwrite.status_code == 200
    assert apply_overwrite.json()["summary"]["updated"] >= 1

    overwritten = core.operations.read(target_component.id)
    assert overwritten is not None
    assert "new-content" in (overwritten.content or "")

    conn = core.db.get_connection()
    log_rows = conn.execute(
        """
        SELECT collection_revision_id, policy, status
        FROM collection_apply_logs
        WHERE collection_id = ? AND project_id = ?
        ORDER BY created_at ASC
        """,
        (collection_id, target_project.id),
    ).fetchall()
    assert len(log_rows) >= 5
    assert all(row[0] for row in log_rows)
    assert any(row[2] == "applied" for row in log_rows)


def test_collection_restore_revision_creates_new_revision(client: TestClient):
    preset_a = client.post(
        "/api/presets",
        json={
            "name": "restore-a",
            "component_type": "skill",
            "platform": "claude_code",
            "description": "a",
            "scope": "user",
            "tags": [],
            "content": "---\nname: restore-a\n---\n\na",
            "frontmatter": {"name": "restore-a"},
        },
    )
    preset_b = client.post(
        "/api/presets",
        json={
            "name": "restore-b",
            "component_type": "skill",
            "platform": "claude_code",
            "description": "b",
            "scope": "user",
            "tags": [],
            "content": "---\nname: restore-b\n---\n\nb",
            "frontmatter": {"name": "restore-b"},
        },
    )
    assert preset_a.status_code == 201
    assert preset_b.status_code == 201

    collection = client.post(
        "/api/collections",
        json={
            "name": "restore-collection",
            "description": "restore test",
            "scope": "user",
            "tags": [],
            "items": [{"preset_id": preset_a.json()["id"], "pin_mode": "pin", "pinned_revision": 1}],
        },
    )
    assert collection.status_code == 201
    collection_id = collection.json()["id"]
    assert collection.json()["latest_revision"] == 1

    update = client.put(
        f"/api/collections/{collection_id}",
        json={
            "name": "restore-collection",
            "description": "restore test",
            "scope": "user",
            "tags": [],
            "items": [
                {"preset_id": preset_a.json()["id"], "pin_mode": "pin", "pinned_revision": 1},
                {"preset_id": preset_b.json()["id"], "pin_mode": "pin", "pinned_revision": 1},
            ],
        },
    )
    assert update.status_code == 200
    assert update.json()["latest_revision"] == 2

    restore = client.post(
        f"/api/collections/{collection_id}/revisions/1/restore",
        json={"change_note": "restore v1"},
    )
    assert restore.status_code == 200
    restored = restore.json()
    assert restored["revision"] == 3
    assert restored["item_count"] == 1

    collection_detail = client.get(f"/api/collections/{collection_id}")
    assert collection_detail.status_code == 200
    assert collection_detail.json()["latest_revision"] == 3
    assert len(collection_detail.json()["items"]) == 1
