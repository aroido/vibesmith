"""Template data — Mock template definitions for Component Wizard."""

from pathlib import Path

from vibesmith_api.schemas import TemplateField, TemplateFieldValidation, TemplateResponse

# Template base path (Jinja2 file location)
TEMPLATES_BASE = Path(__file__).parent / "templates"


def _skill_field(
    name: str,
    label: str,
    field_type: str = "text",
    required: bool = True,
    placeholder: str | None = None,
    options: list[str] | None = None,
    default: str | list[str] | bool | None = None,
    help_text: str | None = None,
    validation: TemplateFieldValidation | None = None,
) -> TemplateField:
    return TemplateField(
        name=name,
        label=label,
        type=field_type,
        required=required,
        placeholder=placeholder,
        options=options,
        default=default,
        help_text=help_text,
        validation=validation,
    )


# Template definitions compatible with frontend Mock
BUILTIN_TEMPLATES: list[TemplateResponse] = [
    # Skills
    TemplateResponse(
        id="python-dev",
        name="Python Development Skill",
        description="Skill for Python development",
        component_type="skill",
        category="development",
        icon="python",
        difficulty="beginner",
        estimated_time="2 min",
        fields=[
            _skill_field(
                "skill_name",
                "Skill name",
                required=True,
                placeholder="e.g. pytest-helper",
                validation=TemplateFieldValidation(
                    pattern="^[a-z0-9-]+$",
                    message="Only lowercase letters, numbers, and hyphens allowed",
                ),
            ),
            _skill_field(
                "description", "Description", "textarea", required=True, placeholder="Describe what this skill does"
            ),
            _skill_field(
                "tools",
                "Allowed tools",
                "multiselect",
                required=False,
                options=["read", "write", "shell", "search", "browser"],
                default=["read", "write"],
                help_text="Select tools that the AI agent can use",
            ),
        ],
        tags=["python", "testing"],
    ),
    TemplateResponse(
        id="react-component",
        name="React Component Skill",
        description="Skill for React component development",
        component_type="skill",
        category="development",
        icon="react",
        difficulty="beginner",
        estimated_time="2 min",
        fields=[
            _skill_field("skill_name", "Skill name", required=True, placeholder="e.g. react-component-helper"),
            _skill_field("description", "Description", "textarea", required=True),
        ],
        tags=["react", "frontend"],
    ),
    # Agents
    TemplateResponse(
        id="code-reviewer",
        name="Code Reviewer Agent",
        description="Agent for performing code reviews",
        component_type="agent",
        category="code-quality",
        icon="review",
        difficulty="intermediate",
        estimated_time="3 min",
        fields=[
            _skill_field("agent_name", "Agent name", required=True, placeholder="e.g. code-reviewer"),
            _skill_field("description", "Description", "textarea", required=True),
            _skill_field(
                "review_focus",
                "Review focus",
                "select",
                required=True,
                options=["security", "performance", "style", "architecture", "all"],
                default="all",
            ),
        ],
        tags=["code-review", "quality"],
    ),
]


def get_template_by_id(template_id: str) -> TemplateResponse | None:
    """Look up by template ID."""
    for t in BUILTIN_TEMPLATES:
        if t.id == template_id:
            return t
    return None


def list_templates(
    component_type: str | None = None,
    category: str | None = None,
    difficulty: str | None = None,
) -> list[TemplateResponse]:
    """Filtered template list query."""
    result = list(BUILTIN_TEMPLATES)
    if component_type:
        result = [t for t in result if t.component_type == component_type]
    if category:
        result = [t for t in result if t.category == category]
    if difficulty:
        result = [t for t in result if t.difficulty == difficulty]
    return result
