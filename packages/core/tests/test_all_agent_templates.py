"""Test all agent templates are properly configured and renderable."""

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


def test_all_agent_templates_exist(template_manager):
    """Test that all expected agent templates are present."""
    expected_agents = [
        "code-reviewer-agent",
        "test-writer-agent",
        "documentation-writer-agent",
        "refactoring-assistant-agent",
        "bug-fixer-agent",
        "performance-optimizer-agent",
        "api-designer-agent",
        "custom-blank-agent",
    ]

    templates = template_manager.get_templates(component_type="agent")
    agent_ids = [t["id"] for t in templates]

    for agent_id in expected_agents:
        assert agent_id in agent_ids, f"Expected agent template '{agent_id}' not found"


def test_all_agent_templates_have_required_files(template_manager):
    """Test that all agent templates have required files (config, template, example)."""
    templates = template_manager.get_templates(component_type="agent")

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


def test_render_code_reviewer_agent(component_generator):
    """Test rendering code-reviewer-agent template."""
    result = component_generator.generate(
        name="SecurityCodeReviewer",
        description="Security-focused code review agent for vulnerability detection",
        component_type="agent",
        template_id="code-reviewer-agent",
        config={
            "review_scope": ["security", "code-quality"],
            "auto_fix": False,
            "report_format": "markdown",
        },
    )

    assert "# Agent: SecurityCodeReviewer" in result["content"]
    assert "security" in result["content"].lower()
    assert "code-quality" in result["content"].lower()


def test_render_test_writer_agent(component_generator):
    """Test rendering test-writer-agent template."""
    result = component_generator.generate(
        name="PytestTestWriter",
        description="Automated pytest test generation agent",
        component_type="agent",
        template_id="test-writer-agent",
        config={
            "test_framework": "pytest",
            "test_types": ["unit", "integration"],
            "coverage_threshold": 80,
        },
    )

    assert "# Agent: PytestTestWriter" in result["content"]
    assert "pytest" in result["content"]
    assert "80" in result["content"]


def test_render_documentation_writer_agent(component_generator):
    """Test rendering documentation-writer-agent template."""
    result = component_generator.generate(
        name="APIDocWriter",
        description="Automated API documentation generation agent",
        component_type="agent",
        template_id="documentation-writer-agent",
        config={
            "doc_types": ["api"],
            "doc_format": "markdown",
            "include_examples": True,
        },
    )

    assert "# Agent: APIDocWriter" in result["content"]
    assert "api" in result["content"].lower()


def test_render_refactoring_assistant_agent(component_generator):
    """Test rendering refactoring-assistant-agent template."""
    result = component_generator.generate(
        name="CodeRefactoringAssistant",
        description="Code complexity reduction and readability improvement agent",
        component_type="agent",
        template_id="refactoring-assistant-agent",
        config={
            "refactoring_goals": ["reduce-complexity", "improve-readability"],
            "preserve_behavior": True,
            "run_tests_after": True,
        },
    )

    assert "# Agent: CodeRefactoringAssistant" in result["content"]
    assert "reduce-complexity" in result["content"]


def test_render_bug_fixer_agent(component_generator):
    """Test rendering bug-fixer-agent template."""
    result = component_generator.generate(
        name="AutoBugFixer",
        description="Automated bug detection and fixing agent",
        component_type="agent",
        template_id="bug-fixer-agent",
        config={
            "bug_sources": ["test-failures", "linter-errors"],
            "auto_fix_level": "safe-only",
            "create_tests": True,
        },
    )

    assert "# Agent: AutoBugFixer" in result["content"]
    assert "test-failures" in result["content"]


def test_render_performance_optimizer_agent(component_generator):
    """Test rendering performance-optimizer-agent template."""
    result = component_generator.generate(
        name="PerfOptimizer",
        description="Algorithm and database performance optimization agent",
        component_type="agent",
        template_id="performance-optimizer-agent",
        config={
            "optimization_areas": ["algorithm", "database"],
            "run_benchmarks": True,
        },
    )

    assert "# Agent: PerfOptimizer" in result["content"]
    assert "algorithm" in result["content"].lower()


def test_render_api_designer_agent(component_generator):
    """Test rendering api-designer-agent template."""
    result = component_generator.generate(
        name="RestAPIDesigner",
        description="RESTful API design and specification generation agent",
        component_type="agent",
        template_id="api-designer-agent",
        config={
            "api_style": "rest",
            "design_principles": ["restful", "versioned"],
            "generate_spec": "openapi",
        },
    )

    assert "# Agent: RestAPIDesigner" in result["content"]
    assert "rest" in result["content"].lower()


def test_render_custom_blank_agent(component_generator):
    """Test rendering custom-blank-agent template."""
    result = component_generator.generate(
        name="MyCustomAgent",
        description="A completely customizable blank agent for any purpose",
        component_type="agent",
        template_id="custom-blank-agent",
        config={},
    )

    assert "# Agent: MyCustomAgent" in result["content"]
    assert "A completely customizable blank agent" in result["content"]
