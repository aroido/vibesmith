"""Test all skill templates are properly configured and renderable."""

import pytest

from vibesmith_core import ComponentGenerator, TemplateManager


@pytest.fixture
def template_manager():
    """Fixture providing TemplateManager instance."""
    return TemplateManager()


@pytest.fixture
def component_generator(template_manager):
    """Fixture providing ComponentGenerator instance."""
    return ComponentGenerator(template_manager)


def test_all_skill_templates_exist(template_manager):
    """Test that all expected skill templates are present."""
    expected_skills = [
        "python-dev",
        "react-component",
        "api-testing",
        "code-review",
        "database-migration",
        "documentation",
        "git-workflow",
        "devops-automation",
        "security-audit",
        "custom-blank-skill",
    ]

    templates = template_manager.get_templates(component_type="skill")
    skill_ids = [t["id"] for t in templates]

    for skill_id in expected_skills:
        assert skill_id in skill_ids, f"Expected skill template '{skill_id}' not found"


def test_all_skill_templates_have_required_files(template_manager):
    """Test that all skill templates have required files (config, template, example)."""
    templates = template_manager.get_templates(component_type="skill")

    for template in templates:
        template_id = template["id"]

        # Check config file exists
        config_path = template_manager.templates_dir / template["config_file"]
        assert config_path.exists(), f"Config file for '{template_id}' not found: {config_path}"

        # Check template file exists
        template_path = template_manager.templates_dir / template["template_file"]
        assert template_path.exists(), f"Template file for '{template_id}' not found: {template_path}"

        # Check example file exists
        example_path = template_manager.templates_dir / template["example_file"]
        assert example_path.exists(), f"Example file for '{template_id}' not found: {example_path}"


def test_render_react_component_template(component_generator):
    """Test rendering react-component template."""
    result = component_generator.generate(
        name="TestComponent",
        description="A test React component for demonstration purposes",
        component_type="skill",
        template_id="react-component",
        config={
            "component_type": "functional",
            "ui_library": "chakra-ui",
            "features": ["typescript", "hooks"],
        },
    )

    assert "# Skill: TestComponent" in result["content"]
    assert "React" in result["content"]
    assert "chakra-ui" in result["content"]
    assert "typescript" in result["content"]


def test_render_api_testing_template(component_generator):
    """Test rendering api-testing template."""
    result = component_generator.generate(
        name="APITestHelper",
        description="Automated API testing helper for FastAPI endpoints",
        component_type="skill",
        template_id="api-testing",
        config={
            "api_framework": "fastapi",
            "test_framework": "pytest",
            "test_types": ["unit", "integration"],
        },
    )

    assert "# Skill: APITestHelper" in result["content"]
    assert "pytest" in result["content"]
    assert "fastapi" in result["content"]


def test_render_code_review_template(component_generator):
    """Test rendering code-review template."""
    result = component_generator.generate(
        name="SecurityReviewer",
        description="Security-focused code review automation tool",
        component_type="skill",
        template_id="code-review",
        config={
            "review_focus": ["security", "code-quality"],
            "severity_level": "high",
        },
    )

    assert "# Skill: SecurityReviewer" in result["content"]
    assert "security" in result["content"].lower()
    assert "code-quality" in result["content"].lower()


def test_render_git_workflow_template(component_generator):
    """Test rendering git-workflow template."""
    result = component_generator.generate(
        name="CommitHelper",
        description="Automated git commit message generator following conventions",
        component_type="skill",
        template_id="git-workflow",
        config={
            "workflow_type": "commit-message",
            "convention": "conventional-commits",
        },
    )

    assert "# Skill: CommitHelper" in result["content"]
    assert "Conventional Commits" in result["content"]


def test_render_custom_blank_template(component_generator):
    """Test rendering custom-blank-skill template."""
    result = component_generator.generate(
        name="MyCustomSkill",
        description="A completely customizable blank skill for any purpose",
        component_type="skill",
        template_id="custom-blank-skill",
        config={},
    )

    assert "# Skill: MyCustomSkill" in result["content"]
    assert "A completely customizable blank skill" in result["content"]
