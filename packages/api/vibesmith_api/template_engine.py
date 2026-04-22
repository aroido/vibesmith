"""Jinja2 template rendering — for Component Wizard generate."""

import uuid
from datetime import UTC, datetime

from jinja2 import Environment, FileSystemLoader, select_autoescape

from vibesmith_api.templates_data import TEMPLATES_BASE, get_template_by_id

# template_id -> (component_type, relative_path) mapping
_TEMPLATE_PATH_MAP: dict[str, tuple[str, str]] = {
    "python-dev": ("skill", "skills/python-dev/template.md.jinja2"),
    "react-component": ("skill", "skills/react-component/template.md.jinja2"),
    "code-reviewer": ("agent", "agents/code-reviewer/template.md.jinja2"),
}

_FILE_NAMES: dict[str, str] = {
    "skill": "SKILL.md",
    "agent": "AGENT.md",
    "command": "COMMAND.md",
    "hook": "HOOK.md",
    "rule": "RULE.md",
}


def render_component(
    template_id: str,
    name: str,
    description: str,
    config: dict,
) -> tuple[str, str, str]:
    """Render a template to generate a component body.

    Returns:
        (content, component_type, file_name)
    """
    if template_id not in _TEMPLATE_PATH_MAP:
        raise ValueError(f"Unknown template: {template_id}")

    comp_type, rel_path = _TEMPLATE_PATH_MAP[template_id]
    env = Environment(
        loader=FileSystemLoader(str(TEMPLATES_BASE)),
        autoescape=select_autoescape(default=False),
    )
    template = env.get_template(rel_path)
    content = template.render(
        name=name,
        description=description or "",
        config=config or {},
    )
    file_name = _FILE_NAMES.get(comp_type, "SKILL.md")
    return content, comp_type, file_name


def generate_preview(
    template_id: str,
    name: str,
    description: str,
    config: dict,
    component_type: str,
) -> dict:
    """Generate a Component Wizard generate API response."""
    content, _, file_name = render_component(template_id, name, description, config)
    preview_id = f"preview-{uuid.uuid4().hex[:12]}"
    expires_at = datetime.now(UTC)
    from datetime import timedelta

    expires_at = (expires_at + timedelta(hours=1)).isoformat()

    return {
        "content": content,
        "preview_id": preview_id,
        "expires_at": expires_at,
        "component_type": component_type,
        "file_name": file_name,
    }


def validate_template_exists(template_id: str) -> None:
    """Validate that the template exists."""
    if get_template_by_id(template_id) is None:
        raise ValueError(f"Template not found: {template_id}")
