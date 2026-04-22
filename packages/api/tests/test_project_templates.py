"""Project template (preset) API tests."""

from fastapi.testclient import TestClient


def _blueprint(
    *,
    component_type: str = "skill",
    template_id: str = "react-component",
    name: str = "react-ui-helper",
    platform: str = "claude_code",
) -> dict:
    return {
        "component_type": component_type,
        "template_id": template_id,
        "name": name,
        "description": "preset blueprint",
        "platform": platform,
        "config": {},
    }


def _payload(name: str = "Custom Preset") -> dict:
    return {
        "name": name,
        "description": "custom preset for tests",
        "tags": ["test", "preset"],
        "components": [
            _blueprint(),
            _blueprint(
                component_type="agent",
                template_id="code-reviewer",
                name="review-agent",
                platform="cursor",
            ),
        ],
    }


def _create_system_template(client: TestClient, core, *, name: str = "System Preset") -> str:
    created = client.post("/api/project-templates", json=_payload(name)).json()
    template_id = created["id"]
    conn = core.db.get_connection()
    conn.execute("UPDATE project_templates SET scope = 'system' WHERE id = ?", (template_id,))
    conn.commit()
    return template_id


def test_list_project_templates_initially_empty(client: TestClient):
    response = client.get("/api/project-templates")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert data["items"] == []


def test_get_project_template_detail(client: TestClient):
    created = client.post("/api/project-templates", json=_payload("Detail Target"))
    assert created.status_code == 201
    template_id = created.json()["id"]

    response = client.get(f"/api/project-templates/{template_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == template_id
    assert "components" in data
    assert len(data["components"]) >= 1


def test_create_project_template_returns_201(client: TestClient):
    response = client.post("/api/project-templates", json=_payload("My Preset"))
    assert response.status_code == 201
    data = response.json()
    assert data["scope"] == "user"
    assert data["name"] == "My Preset"
    assert data["component_count"] == 2
    assert len(data["components"]) == 2


def test_create_project_template_duplicate_name_returns_400(client: TestClient):
    client.post("/api/project-templates", json=_payload("Duplicate Preset"))
    response = client.post("/api/project-templates", json=_payload("duplicate preset"))
    assert response.status_code == 400
    assert response.json()["message_key"] == "errors.project_template_name_exists"


def test_create_project_template_invalid_template_returns_404(client: TestClient):
    payload = _payload("Invalid Template")
    payload["components"][0]["template_id"] = "not-found-template"
    response = client.post("/api/project-templates", json=payload)
    assert response.status_code == 404
    assert response.json()["message_key"] == "errors.template_not_found"


def test_update_user_template_increments_version(client: TestClient):
    created = client.post("/api/project-templates", json=_payload("Update Target")).json()
    template_id = created["id"]
    previous_version = created["version"]

    payload = _payload("Update Target Renamed")
    payload["description"] = "updated description"

    response = client.put(f"/api/project-templates/{template_id}", json=payload)
    assert response.status_code == 200
    updated = response.json()
    assert updated["name"] == "Update Target Renamed"
    assert updated["version"] == previous_version + 1


def test_update_system_template_returns_403(client: TestClient, core):
    template_id = _create_system_template(client, core, name="System Update Target")
    response = client.put(f"/api/project-templates/{template_id}", json=_payload("System Update"))
    assert response.status_code == 403
    assert response.json()["message_key"] == "errors.project_template_system_immutable"


def test_delete_user_template_soft_delete(client: TestClient):
    created = client.post("/api/project-templates", json=_payload("Delete Target")).json()
    template_id = created["id"]

    delete_response = client.delete(f"/api/project-templates/{template_id}")
    assert delete_response.status_code == 200
    assert delete_response.json()["message_key"] == "common.deleted"

    get_response = client.get(f"/api/project-templates/{template_id}")
    assert get_response.status_code == 404
    assert get_response.json()["message_key"] == "errors.project_template_not_found"


def test_delete_system_template_returns_403(client: TestClient, core):
    template_id = _create_system_template(client, core, name="System Delete Target")
    response = client.delete(f"/api/project-templates/{template_id}")
    assert response.status_code == 403
    assert response.json()["message_key"] == "errors.project_template_system_immutable"
