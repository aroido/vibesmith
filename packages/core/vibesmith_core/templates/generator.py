"""Component generation engine."""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from .manager import TemplateManager


class ComponentGenerator:
    """Handles template-based component generation."""

    def __init__(self, template_manager: TemplateManager | None = None):
        """Initialize the Component Generator.

        Args:
            template_manager: TemplateManager instance (default: creates a new one)
        """
        self.template_manager = template_manager or TemplateManager()
        self._preview_cache: dict[str, dict[str, Any]] = {}

    def generate(
        self,
        component_type: str,
        template_id: str,
        name: str,
        description: str | None,
        config: dict[str, Any],
    ) -> dict[str, Any]:
        """Generate a component and return a preview ID.

        Args:
            component_type: Component type (skill, agent, command, hook, rule)
            template_id: Template ID to use
            name: Component name
            description: Component description (optional)
            config: Template variable dictionary

        Returns:
            {
                "content": str,  # Rendered body
                "preview_id": str,  # Preview ID
                "expires_at": str,  # Expiration time (ISO 8601)
                "component_type": str,
                "file_name": str  # File name for saving
            }

        Raises:
            ValueError: If the template is not found or required fields are missing
        """
        # Verify template exists
        template = self.template_manager.get_template(template_id)

        # Verify template type matches the requested type
        if template.get("component_type") != component_type:
            raise ValueError(
                f"Template type mismatch: template is '{template.get('component_type')}' "
                f"but requested '{component_type}'"
            )

        # Prepare template variables (name and description are pre-set)
        variables = {
            "skill_name": name,  # backward compatibility
            "agent_name": name,
            "command_name": name,
            "hook_name": name,
            "rule_name": name,
            "name": name,
            "description": description or "",
            **config,
        }

        # Validate required fields (including variables)
        fields = self.template_manager.get_template_fields(template_id)
        self._validate_config(fields, variables)

        # Render template
        content = self.template_manager.render_template(template_id, variables)

        # Generate preview ID and cache
        preview_id = f"preview-{uuid.uuid4().hex[:12]}"
        expires_at = datetime.now(UTC) + timedelta(hours=1)

        self._preview_cache[preview_id] = {
            "content": content,
            "component_type": component_type,
            "template_id": template_id,
            "name": name,
            "expires_at": expires_at,
        }

        # Determine file name
        file_name = self._get_file_name(component_type)

        return {
            "content": content,
            "preview_id": preview_id,
            "expires_at": expires_at.isoformat(),
            "component_type": component_type,
            "file_name": file_name,
        }

    def _validate_config(
        self,
        fields: list[dict[str, Any]],
        config: dict[str, Any],
    ) -> None:
        """Validate config against field definitions.

        Args:
            fields: List of field definitions
            config: Config dictionary to validate

        Raises:
            ValueError: If required fields are missing or validation fails
        """
        for field in fields:
            field_name = field["name"]
            is_required = field.get("required", False)
            value = config.get(field_name)

            # Check required fields
            if is_required and value is None:
                raise ValueError(f"Required field missing: {field_name}")

            # Validate if value is present
            if value is not None:
                self._validate_field_value(field, value)

    def _validate_field_value(
        self,
        field: dict[str, Any],
        value: Any,
    ) -> None:
        """Validate an individual field value.

        Args:
            field: Field definition
            value: Value to validate

        Raises:
            ValueError: If validation fails
        """
        field_name = field["name"]
        field_type = field["type"]
        validation = field.get("validation", {})

        # Type-specific validation
        if field_type in ["text", "textarea"]:
            if not isinstance(value, str):
                raise ValueError(f"Field '{field_name}' must be a string")

            # Length validation
            min_length = validation.get("min_length")
            max_length = validation.get("max_length")

            if min_length and len(value) < min_length:
                raise ValueError(f"Field '{field_name}' must be at least {min_length} characters")

            if max_length and len(value) > max_length:
                raise ValueError(f"Field '{field_name}' must be at most {max_length} characters")

        elif field_type in ["select", "multiselect"]:
            options = field.get("options", [])

            if field_type == "select":
                if value not in options:
                    raise ValueError(f"Field '{field_name}' must be one of: {', '.join(options)}")
            else:  # multiselect
                if not isinstance(value, list):
                    raise ValueError(f"Field '{field_name}' must be a list")

                for item in value:
                    if item not in options:
                        raise ValueError(
                            f"Invalid option '{item}' for field '{field_name}'. Must be one of: {', '.join(options)}"
                        )

        elif field_type == "checkbox":
            if not isinstance(value, bool):
                raise ValueError(f"Field '{field_name}' must be a boolean")

    def _get_file_name(self, component_type: str) -> str:
        """Determine the file name based on component type.

        Args:
            component_type: Component type

        Returns:
            File name (e.g. SKILL.md, AGENT.md)
        """
        file_names = {
            "skill": "SKILL.md",
            "agent": "AGENT.md",
            "command": "COMMAND.md",
            "hook": "HOOK.md",
            "rule": "RULE.md",
        }
        return file_names.get(component_type, "UNKNOWN.md")

    def get_preview(self, preview_id: str) -> dict[str, Any]:
        """Retrieve stored content by preview ID.

        Args:
            preview_id: Preview ID

        Returns:
            Stored preview data

        Raises:
            ValueError: If the preview ID is not found or has expired
        """
        if preview_id not in self._preview_cache:
            raise ValueError(f"Preview not found: {preview_id}")

        preview = self._preview_cache[preview_id]

        # Check expiration
        if datetime.now(UTC) > preview["expires_at"]:
            del self._preview_cache[preview_id]
            raise ValueError(f"Preview expired: {preview_id}")

        return preview

    def cleanup_expired_previews(self) -> int:
        """Clean up expired previews.

        Returns:
            Number of deleted previews
        """
        now = datetime.now(UTC)
        expired_ids = [pid for pid, preview in self._preview_cache.items() if now > preview["expires_at"]]

        for pid in expired_ids:
            del self._preview_cache[pid]

        return len(expired_ids)
