"""CursorAdapter — Cursor agent path conventions."""

from pathlib import Path

from vibesmith_core.scanning.adapters.base import AgentAdapter


class CursorAdapter(AgentAdapter, config_dir=".cursor", adapter_type="cursor"):
    """Implements path conventions for the Cursor agent."""

    def get_global_path(self) -> None:
        """Cursor has no global config, so return None."""
        return None

    def get_project_path(self, project_root: str) -> str:
        """Return the .cursor directory path within the project."""
        return str(Path(project_root) / ".cursor")

    def get_component_paths(self, base_path: str) -> dict[str, str]:
        """Return Cursor component paths.

        Cursor can also use the skills/agents/commands/rules structure,
        so scan the same component types as Claude instead of assuming rules-only.
        """
        base = Path(base_path)
        return {
            "skills": str(base / "skills"),
            "agents": str(base / "agents"),
            "commands": str(base / "commands"),
            "rules": str(base / "rules"),
            "hooks": str(base / "settings.json"),
        }

    def get_extra_rules(self, project_path: str) -> list[str]:
        """Return the .cursorrules file path from the project root."""
        return [str(Path(project_path) / ".cursorrules")]
