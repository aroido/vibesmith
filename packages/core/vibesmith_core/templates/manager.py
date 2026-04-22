"""Template management system."""

import json
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, TemplateNotFound


class TemplateManager:
    """Handles template loading, retrieval, and validation."""

    def __init__(self, templates_dir: Path | None = None):
        """Initialize the Template Manager.

        Args:
            templates_dir: Template directory path (default: vibesmith_core/templates)
        """
        if templates_dir is None:
            templates_dir = Path(__file__).parent / "data"

        self.templates_dir = templates_dir
        self.metadata_file = templates_dir / "templates.json"

        # Jinja2 Environment setup
        self.jinja_env = Environment(
            loader=FileSystemLoader(str(templates_dir)),
            autoescape=False,  # Disable autoescaping since we generate markdown
            trim_blocks=True,
            lstrip_blocks=True,
        )

        # Load metadata
        self._metadata: dict[str, Any] = {}
        self._load_metadata()

    def _load_metadata(self) -> None:
        """Load metadata from templates.json."""
        if not self.metadata_file.exists():
            raise FileNotFoundError(f"Template metadata file not found: {self.metadata_file}")

        with open(self.metadata_file, encoding="utf-8") as f:
            data = json.load(f)
            self._metadata = {template["id"]: template for template in data.get("templates", [])}

    def get_templates(
        self,
        component_type: str | None = None,
        category: str | None = None,
    ) -> list[dict[str, Any]]:
        """Retrieve the list of templates.

        Args:
            component_type: Component type filter (skill, agent, command, hook, rule)
            category: Category filter (development, testing, etc)

        Returns:
            Filtered list of template metadata
        """
        templates = list(self._metadata.values())

        if component_type:
            templates = [t for t in templates if t.get("component_type") == component_type]

        if category:
            templates = [t for t in templates if t.get("category") == category]

        return templates

    def get_template(self, template_id: str) -> dict[str, Any]:
        """Retrieve metadata for a specific template.

        Args:
            template_id: Template ID

        Returns:
            Template metadata

        Raises:
            ValueError: If the template is not found
        """
        if template_id not in self._metadata:
            raise ValueError(f"Template not found: {template_id}")

        return self._metadata[template_id]

    def get_template_fields(self, template_id: str) -> list[dict[str, Any]]:
        """Retrieve field definitions for a template.

        Args:
            template_id: Template ID

        Returns:
            List of field definitions

        Raises:
            ValueError: If the template is not found
            FileNotFoundError: If the config.json file is not found
        """
        template = self.get_template(template_id)
        config_file = self.templates_dir / template["config_file"]

        if not config_file.exists():
            raise FileNotFoundError(f"Template config file not found: {config_file}")

        with open(config_file, encoding="utf-8") as f:
            config = json.load(f)
            return config.get("fields", [])

    def render_template(
        self,
        template_id: str,
        variables: dict[str, Any],
    ) -> str:
        """Render a template to produce the final component body.

        Args:
            template_id: Template ID
            variables: Jinja2 template variable dictionary

        Returns:
            Rendered markdown text

        Raises:
            ValueError: If the template is not found
            TemplateNotFound: If the Jinja2 template file is not found
        """
        template_meta = self.get_template(template_id)
        template_file = template_meta["template_file"]

        try:
            template = self.jinja_env.get_template(template_file)
            return template.render(**variables)
        except TemplateNotFound as e:
            raise TemplateNotFound(f"Template file not found: {template_file}") from e

    def validate_template(self, template_id: str) -> dict[str, Any]:
        """Validate the structure of a template.

        Args:
            template_id: Template ID

        Returns:
            Validation result dictionary
            {
                "valid": bool,
                "errors": list[str],
                "warnings": list[str]
            }

        Raises:
            ValueError: If the template is not found
        """
        errors: list[str] = []
        warnings: list[str] = []

        try:
            template = self.get_template(template_id)
        except ValueError as e:
            return {"valid": False, "errors": [str(e)], "warnings": []}

        # Check config.json existence
        config_file = self.templates_dir / template["config_file"]
        if not config_file.exists():
            errors.append(f"Config file not found: {template['config_file']}")

        # Check template.md.jinja2 existence
        template_file = self.templates_dir / template["template_file"]
        if not template_file.exists():
            errors.append(f"Template file not found: {template['template_file']}")
        else:
            # Validate Jinja2 syntax (attempt to load)
            try:
                self.jinja_env.get_template(template["template_file"])
            except Exception as e:
                errors.append(f"Template syntax error: {e}")

        # Check example.md existence (optional)
        if "example_file" in template:
            example_file = self.templates_dir / template["example_file"]
            if not example_file.exists():
                warnings.append(f"Example file not found: {template['example_file']}")

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
        }
