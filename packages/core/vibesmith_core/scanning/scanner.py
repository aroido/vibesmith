"""Filesystem scanner — adapter-based component discovery."""

from pathlib import Path

import vibesmith_core.scanning.adapters as adapters  # Ensure all adapters are registered
from vibesmith_core.components.models import ComponentBase
from vibesmith_core.scanning.adapters.base import AgentAdapter
from vibesmith_core.scanning.parser import ComponentParser


class FileSystemScanner:
    """Scan components from the filesystem."""

    def __init__(self, parser: ComponentParser | None = None, adapter=None) -> None:
        self._adapter = adapter or adapters.ClaudeCodeAdapter()
        self._parser = parser or ComponentParser(platform=self._adapter.adapter_type)

    _SCAN_DISPATCH: dict[str, str] = {
        "skills": "_scan_skills",
        "agents": "_scan_agents",
        "commands": "_scan_commands",
        "rules": "_scan_rules",
        "hooks": "_scan_hooks",
    }

    def scan_project(self, project_path: str, project_id: str) -> list[ComponentBase]:
        """Scan components supported by the adapter from the project path."""
        base_dir = Path(self._adapter.get_project_path(project_path))
        if not base_dir.is_dir():
            return []
        component_paths = self._adapter.get_component_paths(str(base_dir))
        components: list[ComponentBase] = []
        for key, method_name in self._SCAN_DISPATCH.items():
            if key in component_paths:
                method = getattr(self, method_name)
                components.extend(method(base_dir, project_id))
        for extra_path in self._adapter.get_extra_rules(project_path):
            if Path(extra_path).is_file():
                components.append(self._parser.parse_rule(extra_path, project_id))
        return components

    def scan_project_all_adapters(self, project_path: str, project_id: str) -> list[ComponentBase]:
        """Scan a project with all registered adapters and tag platforms."""
        all_components: list[ComponentBase] = []
        for adapter in AgentAdapter.all_adapters():
            parser = ComponentParser(platform=adapter.adapter_type)
            scanner = FileSystemScanner(parser=parser, adapter=adapter)
            components = scanner.scan_project(project_path, project_id)
            all_components.extend(components)
        return all_components

    _SKIP_DIRS = frozenset(
        {
            "Library",
            "Applications",
            ".Trash",
            "node_modules",
            "__pycache__",
            ".git",
            ".svn",
            "venv",
            ".venv",
            "env",
            ".tox",
            ".cache",
            ".npm",
            ".cargo",
            ".rustup",
            ".local",
            ".pyenv",
        }
    )

    def discover_projects(self, root_path: str, max_depth: int = 1) -> list[str]:
        """Discover projects with config directories under root_path."""
        root = Path(root_path)
        if not root.is_dir():
            return []
        results: list[str] = []
        self._walk(root, 0, max_depth, results)
        return sorted(results)

    def _walk(self, dir_path: Path, depth: int, max_depth: int, results: list[str], *, is_root: bool = True) -> None:
        if depth > max_depth:
            return
        try:
            for child in dir_path.iterdir():
                if not child.is_dir() or child.is_symlink():
                    continue
                if child.name in AgentAdapter.all_config_dirs():
                    if not is_root:
                        results.append(str(dir_path))
                        return  # This directory is a project — don't go deeper
                    continue  # Config dir at root itself is global config, skip
                if child.name.startswith(".") or child.name in self._SKIP_DIRS:
                    continue
                self._walk(child, depth + 1, max_depth, results, is_root=False)
        except PermissionError:
            pass

    def _scan_skills(self, base_dir: Path, project_id: str) -> list[ComponentBase]:
        skills_dir = base_dir / "skills"
        if not skills_dir.is_dir():
            return []
        results = []
        for skill_dir in sorted(skills_dir.iterdir()):
            if not skill_dir.is_dir():
                continue
            skill_file = skill_dir / "SKILL.md"
            skill_file_disabled = skill_dir / "SKILL.md.disabled"
            if skill_file.is_file():
                results.append(self._parser.parse_skill(str(skill_file), project_id))
            elif skill_file_disabled.is_file():
                results.append(self._parser.parse_skill(str(skill_file_disabled), project_id))
        return results

    def _scan_agents(self, base_dir: Path, project_id: str) -> list[ComponentBase]:
        agents_dir = base_dir / "agents"
        if not agents_dir.is_dir():
            return []
        files = sorted(agents_dir.glob("*.md")) + sorted(agents_dir.glob("*.md.disabled"))
        return [self._parser.parse_agent(str(f), project_id) for f in files]

    def _scan_commands(self, base_dir: Path, project_id: str) -> list[ComponentBase]:
        cmd_dir = base_dir / "commands"
        if not cmd_dir.is_dir():
            return []
        files = sorted(cmd_dir.glob("*.md")) + sorted(cmd_dir.glob("*.md.disabled"))
        return [self._parser.parse_command(str(f), project_id) for f in files]

    def _scan_rules(self, base_dir: Path, project_id: str) -> list[ComponentBase]:
        rules_dir = base_dir / "rules"
        if not rules_dir.is_dir():
            return []
        md_files = sorted(rules_dir.glob("*.md")) + sorted(rules_dir.glob("*.md.disabled"))
        mdc_files = sorted(rules_dir.glob("*.mdc")) + sorted(rules_dir.glob("*.mdc.disabled"))
        return [self._parser.parse_rule(str(f), project_id) for f in (md_files + mdc_files)]

    def _scan_hooks(self, base_dir: Path, project_id: str) -> list[ComponentBase]:
        settings_file = base_dir / "settings.json"
        if not settings_file.is_file():
            return []
        return self._parser.parse_hooks(str(settings_file), project_id)
