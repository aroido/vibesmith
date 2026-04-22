"""Tests for TemplateValidator."""

import pytest

from vibesmith_core.templates.validator import TemplateValidator


@pytest.fixture
def validator():
    """Fixture providing TemplateValidator instance."""
    return TemplateValidator()


def test_validate_template_success(validator):
    """Test validation of a valid template."""
    result = validator.validate_template("python-dev")
    assert result["valid"] is True
    assert len(result["errors"]) == 0


def test_validate_template_not_found(validator):
    """Test validation of non-existent template."""
    result = validator.validate_template("nonexistent-template")
    assert result["valid"] is False
    assert any("not found in metadata" in err for err in result["errors"])


def test_validate_structure_success(validator):
    """Test structure validation for valid template."""
    metadata = validator._load_metadata()
    template = next((t for t in metadata["templates"] if t["id"] == "python-dev"), None)
    assert template is not None

    errors = validator.validate_structure(template)
    assert len(errors) == 0


def test_validate_structure_missing_file(validator, tmp_path):
    """Test structure validation with missing file."""
    # Create validator with temp directory
    temp_validator = TemplateValidator(tmp_path)

    template = {
        "id": "test",
        "config_file": "skills/test/config.json",
        "template_file": "skills/test/template.md.jinja2",
        "example_file": "skills/test/example.md",
    }

    errors = temp_validator.validate_structure(template)
    assert len(errors) == 3  # All 3 files missing


def test_validate_jinja2_syntax_success(validator):
    """Test Jinja2 syntax validation for valid template."""
    errors = validator.validate_jinja2_syntax("skills/python-dev/template.md.jinja2")
    assert len(errors) == 0


def test_validate_jinja2_syntax_missing_file(validator):
    """Test Jinja2 syntax validation with missing file."""
    errors = validator.validate_jinja2_syntax("nonexistent/template.md.jinja2")
    assert len(errors) == 1
    assert "not found" in errors[0]


def test_validate_jinja2_syntax_error(validator, tmp_path):
    """Test Jinja2 syntax validation with syntax error."""
    # Create temp template with syntax error
    temp_validator = TemplateValidator(tmp_path)
    template_dir = tmp_path / "skills" / "test"
    template_dir.mkdir(parents=True)
    template_file = template_dir / "template.md.jinja2"

    # Invalid Jinja2 syntax (unclosed tag)
    template_file.write_text("# Test\n{% if condition %}\nUnclosed if tag")

    errors = temp_validator.validate_jinja2_syntax("skills/test/template.md.jinja2")
    assert len(errors) == 1
    assert "syntax error" in errors[0].lower()


def test_validate_config_success(validator):
    """Test config validation for valid config."""
    errors, warnings = validator.validate_config("skills/python-dev/config.json")
    assert len(errors) == 0


def test_validate_config_missing_file(validator):
    """Test config validation with missing file."""
    errors, warnings = validator.validate_config("nonexistent/config.json")
    assert len(errors) == 1
    assert "not found" in errors[0]


def test_validate_config_invalid_json(validator, tmp_path):
    """Test config validation with invalid JSON."""
    temp_validator = TemplateValidator(tmp_path)
    config_dir = tmp_path / "skills" / "test"
    config_dir.mkdir(parents=True)
    config_file = config_dir / "config.json"

    # Invalid JSON
    config_file.write_text("{ invalid json }")

    errors, warnings = temp_validator.validate_config("skills/test/config.json")
    assert len(errors) == 1
    assert "Invalid JSON" in errors[0]


def test_validate_config_missing_fields_key(validator, tmp_path):
    """Test config validation with missing 'fields' key."""
    temp_validator = TemplateValidator(tmp_path)
    config_dir = tmp_path / "skills" / "test"
    config_dir.mkdir(parents=True)
    config_file = config_dir / "config.json"

    config_file.write_text('{"version": "1.0"}')

    errors, warnings = temp_validator.validate_config("skills/test/config.json")
    assert len(errors) == 1
    assert "Missing 'fields'" in errors[0]


def test_validate_field_success(validator):
    """Test field validation for valid field."""
    field = {
        "name": "test_field",
        "label": "Test Field",
        "type": "text",
        "required": True,
    }

    errors, warnings = validator.validate_field(field, 0, "test/config.json")
    assert len(errors) == 0


def test_validate_field_missing_required_keys(validator):
    """Test field validation with missing required keys."""
    field = {"name": "test_field"}  # Missing label, type, required

    errors, warnings = validator.validate_field(field, 0, "test/config.json")
    assert len(errors) == 3  # Missing 3 required keys


def test_validate_field_invalid_type(validator):
    """Test field validation with invalid type."""
    field = {
        "name": "test_field",
        "label": "Test",
        "type": "invalid_type",
        "required": True,
    }

    errors, warnings = validator.validate_field(field, 0, "test/config.json")
    assert len(errors) == 1
    assert "invalid type" in errors[0]


def test_validate_field_select_without_options(validator):
    """Test field validation for select without options."""
    field = {
        "name": "test_field",
        "label": "Test",
        "type": "select",
        "required": True,
    }

    errors, warnings = validator.validate_field(field, 0, "test/config.json")
    assert len(errors) == 1
    assert "requires 'options'" in errors[0]


def test_validate_field_select_with_empty_options(validator):
    """Test field validation for select with empty options."""
    field = {
        "name": "test_field",
        "label": "Test",
        "type": "select",
        "required": True,
        "options": [],
    }

    errors, warnings = validator.validate_field(field, 0, "test/config.json")
    assert len(errors) == 0
    assert len(warnings) == 1
    assert "empty" in warnings[0]


def test_validate_field_with_validation_rules(validator):
    """Test field validation with validation rules."""
    field = {
        "name": "test_field",
        "label": "Test",
        "type": "text",
        "required": True,
        "validation": {
            "pattern": "^[a-z]+$",
            "min_length": 3,
            "max_length": 50,
        },
    }

    errors, warnings = validator.validate_field(field, 0, "test/config.json")
    assert len(errors) == 0


def test_validate_field_with_unknown_validation_key(validator):
    """Test field validation with unknown validation key."""
    field = {
        "name": "test_field",
        "label": "Test",
        "type": "text",
        "required": True,
        "validation": {
            "unknown_key": "value",
        },
    }

    errors, warnings = validator.validate_field(field, 0, "test/config.json")
    assert len(errors) == 0
    assert len(warnings) == 1
    assert "unknown validation key" in warnings[0]


def test_validate_example_success(validator):
    """Test example validation for valid example."""
    errors = validator.validate_example("skills/python-dev/example.md")
    assert len(errors) == 0


def test_validate_example_missing_file(validator):
    """Test example validation with missing file."""
    errors = validator.validate_example("nonexistent/example.md")
    assert len(errors) == 1
    assert "not found" in errors[0]


def test_validate_example_empty_file(validator, tmp_path):
    """Test example validation with empty file."""
    temp_validator = TemplateValidator(tmp_path)
    example_dir = tmp_path / "skills" / "test"
    example_dir.mkdir(parents=True)
    example_file = example_dir / "example.md"

    example_file.write_text("")

    errors = temp_validator.validate_example("skills/test/example.md")
    assert len(errors) == 1
    assert "empty" in errors[0]


def test_validate_example_no_heading(validator, tmp_path):
    """Test example validation without heading."""
    temp_validator = TemplateValidator(tmp_path)
    example_dir = tmp_path / "skills" / "test"
    example_dir.mkdir(parents=True)
    example_file = example_dir / "example.md"

    example_file.write_text("Content without heading")

    errors = temp_validator.validate_example("skills/test/example.md")
    assert len(errors) == 1
    assert "should start with a heading" in errors[0]


def test_validate_all_templates(validator):
    """Test validation of all templates."""
    result = validator.validate_all_templates()

    assert result["valid"] is True
    assert result["total_templates"] == 18  # 10 skills + 8 agents
    assert result["total_errors"] == 0
    assert "results" in result


def test_validate_all_templates_summary(validator):
    """Test that all current templates pass validation."""
    result = validator.validate_all_templates()

    # Check that all templates are valid
    for template_id, template_result in result["results"].items():
        assert template_result["valid"], f"Template {template_id} validation failed: {template_result['errors']}"

    # Verify expected templates exist
    assert "python-dev" in result["results"]
    assert "react-component" in result["results"]
    assert "code-reviewer-agent" in result["results"]
    assert "test-writer-agent" in result["results"]
