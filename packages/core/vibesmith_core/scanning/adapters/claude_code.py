"""Claude Code adapter — ~/.claude/ path conventions."""

from pathlib import Path

from vibesmith_core.scanning.adapters.base import AgentAdapter


class ClaudeCodeAdapter(AgentAdapter, config_dir=".claude", adapter_type="claude_code"):
    """Implements path conventions for Claude Code."""

    def get_global_path(self) -> str:
        """Return the ~/.claude/ path."""
        return str(Path.home() / ".claude")

    def get_project_path(self, project_root: str) -> str:
        """Return the .claude/ path within the project."""
        return str(Path(project_root) / ".claude")

    def get_component_paths(self, base_path: str) -> dict[str, str]:
        """Path mapping by component type."""
        base = Path(base_path)
        return {
            "skills": str(base / "skills"),
            "agents": str(base / "agents"),
            "commands": str(base / "commands"),
            "rules": str(base / "rules"),
            "hooks": str(base / "settings.json"),
        }

    def get_extra_rules(self, project_path: str) -> list[str]:
        """Claude Code has no additional rule files."""
        return []
