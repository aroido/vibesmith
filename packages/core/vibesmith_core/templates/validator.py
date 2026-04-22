"""Template validation system for component templates."""

import json
from pathlib import Path
from typing import Any

from jinja2 import Environment, TemplateSyntaxError


class TemplateValidator:
    """Validates template structure, syntax, and configuration."""

    def __init__(self, templates_dir: Path | None = None):
        """Initialize TemplateValidator.

        Args:
            templates_dir: Path to templates directory. Defaults to package templates.
        """
        if templates_dir is None:
            templates_dir = Path(__file__).parent / "data"
        self.templates_dir = Path(templates_dir)
        self.jinja_env = Environment()

    def validate_template(self, template_id: str) -> dict[str, Any]:
        """Validate a template completely.

        Args:
            template_id: Template identifier

        Returns:
            Validation result with errors and warnings

        Example:
            >>> validator = TemplateValidator()
            >>> result = validator.validate_template("python-dev")
            >>> result["valid"]
            True
        """
        errors: list[str] = []
        warnings: list[str] = []

        # Load template metadata
        try:
            metadata = self._load_metadata()
            template = next((t for t in metadata["templates"] if t["id"] == template_id), None)
            if not template:
                errors.append(f"Template '{template_id}' not found in metadata")
                return {"valid": False, "errors": errors, "warnings": warnings}
        except Exception as e:
            errors.append(f"Failed to load metadata: {e}")
            return {"valid": False, "errors": errors, "warnings": warnings}

        # Validate structure
        structure_errors = self.validate_structure(template)
        errors.extend(structure_errors)

        # Validate config.json
        if template.get("config_file"):
            config_errors, config_warnings = self.validate_config(template["config_file"])
            errors.extend(config_errors)
            warnings.extend(config_warnings)

        # Validate Jinja2 syntax
        if template.get("template_file"):
            syntax_errors = self.validate_jinja2_syntax(template["template_file"])
            errors.extend(syntax_errors)

        # Validate example.md
        if template.get("example_file"):
            example_errors = self.validate_example(template["example_file"])
            errors.extend(example_errors)

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
        }

    def validate_structure(self, template: dict[str, Any]) -> list[str]:
        """Validate template folder structure.

        Args:
            template: Template metadata dictionary

        Returns:
            List of error messages
        """
        errors = []

        required_files = ["config_file", "template_file", "example_file"]
        for file_key in required_files:
            if file_key not in template:
                errors.append(f"Missing '{file_key}' in template metadata")
                continue

            file_path = self.templates_dir / template[file_key]
            if not file_path.exists():
                errors.append(f"File not found: {template[file_key]}")
            elif not file_path.is_file():
                errors.append(f"Not a file: {template[file_key]}")

        return errors

    def validate_jinja2_syntax(self, template_file: str) -> list[str]:
        """Validate Jinja2 template syntax.

        Args:
            template_file: Relative path to template file

        Returns:
            List of syntax error messages
        """
        errors = []
        template_path = self.templates_dir / template_file

        if not template_path.exists():
            errors.append(f"Template file not found: {template_file}")
            return errors

        try:
            with open(template_path, encoding="utf-8") as f:
                template_source = f.read()
            # Parse template to check for syntax errors
            self.jinja_env.parse(template_source)
        except TemplateSyntaxError as e:
            errors.append(f"Jinja2 syntax error in {template_file}: {e.message} (line {e.lineno})")
        except Exception as e:
            errors.append(f"Failed to parse {template_file}: {e}")

        return errors

    def validate_config(self, config_file: str) -> tuple[list[str], list[str]]:
        """Validate config.json schema and field definitions.

        Args:
            config_file: Relative path to config.json

        Returns:
            Tuple of (errors, warnings)
        """
        errors = []
        warnings = []
        config_path = self.templates_dir / config_file

        if not config_path.exists():
            errors.append(f"Config file not found: {config_file}")
            return errors, warnings

        try:
            with open(config_path, encoding="utf-8") as f:
                config = json.load(f)
        except json.JSONDecodeError as e:
            errors.append(f"Invalid JSON in {config_file}: {e}")
            return errors, warnings
        except Exception as e:
            errors.append(f"Failed to read {config_file}: {e}")
            return errors, warnings

        # Validate config structure
        if "fields" not in config:
            errors.append(f"Missing 'fields' key in {config_file}")
            return errors, warnings

        if not isinstance(config["fields"], list):
            errors.append(f"'fields' must be an array in {config_file}")
            return errors, warnings

        # Validate each field
        for idx, field in enumerate(config["fields"]):
            field_errors, field_warnings = self.validate_field(field, idx, config_file)
            errors.extend(field_errors)
            warnings.extend(field_warnings)

        return errors, warnings

    def validate_field(self, field: dict[str, Any], idx: int, config_file: str) -> tuple[list[str], list[str]]:
        """Validate a single field definition.

        Args:
            field: Field definition dictionary
            idx: Field index in array
            config_file: Config file path for error messages

        Returns:
            Tuple of (errors, warnings)
        """
        errors = []
        warnings = []

        # Required keys
        required_keys = ["name", "label", "type", "required"]
        for key in required_keys:
            if key not in field:
                errors.append(f"Field {idx} in {config_file}: missing '{key}'")

        # Validate field type
        valid_types = ["text", "textarea", "select", "multiselect", "checkbox", "number"]
        if "type" in field and field["type"] not in valid_types:
            errors.append(
                f"Field {idx} in {config_file}: invalid type '{field['type']}'. "
                f"Must be one of: {', '.join(valid_types)}"
            )

        # Type-specific validations
        if field.get("type") in ["select", "multiselect"]:
            if "options" not in field:
                errors.append(f"Field {idx} in {config_file}: select/multiselect requires 'options'")
            elif not isinstance(field["options"], list):
                errors.append(f"Field {idx} in {config_file}: 'options' must be an array")
            elif len(field["options"]) == 0:
                warnings.append(f"Field {idx} in {config_file}: 'options' is empty")

        # Validate validation rules
        if "validation" in field:
            validation = field["validation"]
            if not isinstance(validation, dict):
                errors.append(f"Field {idx} in {config_file}: 'validation' must be an object")
            else:
                # Check for valid validation keys
                valid_validation_keys = [
                    "pattern",
                    "min_length",
                    "max_length",
                    "min",
                    "max",
                    "message",
                ]
                for key in validation:
                    if key not in valid_validation_keys:
                        warnings.append(f"Field {idx} in {config_file}: unknown validation key '{key}'")

        return errors, warnings

    def validate_example(self, example_file: str) -> list[str]:
        """Validate example.md file.

        Args:
            example_file: Relative path to example.md

        Returns:
            List of error messages
        """
        errors = []
        example_path = self.templates_dir / example_file

        if not example_path.exists():
            errors.append(f"Example file not found: {example_file}")
            return errors

        try:
            with open(example_path, encoding="utf-8") as f:
                content = f.read()

            # Check if file is empty
            if not content.strip():
                errors.append(f"Example file is empty: {example_file}")
                return errors

            # Check for basic markdown structure
            if not content.startswith("#"):
                errors.append(f"Example file should start with a heading: {example_file}")

        except Exception as e:
            errors.append(f"Failed to read {example_file}: {e}")

        return errors

    def validate_all_templates(self) -> dict[str, Any]:
        """Validate all templates in templates.json.

        Returns:
            Validation summary with results for each template
        """
        try:
            metadata = self._load_metadata()
        except Exception as e:
            return {
                "valid": False,
                "error": f"Failed to load metadata: {e}",
                "results": {},
            }

        results = {}
        total_errors = 0
        total_warnings = 0

        for template in metadata["templates"]:
            template_id = template["id"]
            result = self.validate_template(template_id)
            results[template_id] = result
            total_errors += len(result["errors"])
            total_warnings += len(result["warnings"])

        return {
            "valid": total_errors == 0,
            "total_templates": len(metadata["templates"]),
            "total_errors": total_errors,
            "total_warnings": total_warnings,
            "results": results,
        }

    def _load_metadata(self) -> dict[str, Any]:
        """Load templates.json metadata.

        Returns:
            Metadata dictionary

        Raises:
            FileNotFoundError: If templates.json not found
            json.JSONDecodeError: If JSON is invalid
        """
        metadata_path = self.templates_dir / "templates.json"
        if not metadata_path.exists():
            raise FileNotFoundError(f"templates.json not found at {metadata_path}")

        with open(metadata_path, encoding="utf-8") as f:
            return json.load(f)
