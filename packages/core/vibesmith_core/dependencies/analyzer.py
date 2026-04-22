"""Dependency analysis — detects cross-references between components and cycles.

Context-hint based matching:
- Extract text within markers (backticks, quotes, slashes)
- Match against known component names
- Analyze frontmatter (context, agents) references

See docs/architecture/dependency-design.md for details.
"""

from __future__ import annotations

import re
from pathlib import Path

import networkx as nx

from vibesmith_core.components.models import (
    ComponentBase,
    Dependency,
    DependencyType,
    Skill,
    Subagent,
)

# Marker patterns (compiled at module level)
_PATTERNS = [
    (re.compile(r"`([a-zA-Z0-9_-]+)`"), "backtick"),
    (re.compile(r"(?<![a-zA-Z0-9/])/([a-zA-Z0-9_-]+)(?:\s|$|,|\))"), "slash"),
    (re.compile(r'"([a-zA-Z0-9_-]+)"'), "double_quote"),
    (re.compile(r"'([a-zA-Z0-9_-]+)'"), "single_quote"),
    (re.compile(r"skills/([a-zA-Z0-9_-]+)"), "skills_prefix"),
    (re.compile(r"agents/([a-zA-Z0-9_-]+)"), "agents_prefix"),
]


def _extract_candidate_refs(text: str | None) -> set[str]:
    """Extract candidate names from marker-enclosed text.

    Args:
        text: Text to analyze

    Returns:
        Set of candidate names normalized to lowercase
    """
    if not text:
        return set()

    candidates = set()
    for pat, _ in _PATTERNS:
        for m in pat.finditer(text):
            candidates.add(m.group(1).lower())
    return candidates


def _parse_context_to_names(context_files: list[str] | None) -> list[str]:
    """Convert context field paths to component names.

    Args:
        context_files: List of context field paths (e.g. ["skills/foo/SKILL.md"])

    Returns:
        List of component names (e.g. ["foo"])
    """
    if not context_files:
        return []

    names = []
    for path_str in context_files:
        path = Path(path_str)

        # skills/foo/SKILL.md → foo
        if "skills/" in path_str:
            parts = path_str.split("skills/", 1)
            if len(parts) == 2:
                name = parts[1].split("/")[0]
                names.append(name)
        # agents/bar.md → bar
        elif "agents/" in path_str:
            parts = path_str.split("agents/", 1)
            if len(parts) == 2:
                name = path.stem if path.stem != "AGENT" else parts[1].split("/")[0]
                names.append(name)

    return names


class DependencyAnalyzer:
    """Analyzes dependencies from a list of components."""

    def __init__(
        self,
        components: list[ComponentBase],
    ) -> None:
        self._components = components
        self._deps: list[Dependency] = []
        self._name_to_ids: dict[str, list[str]] = {}

    def _build_name_to_ids(self) -> dict[str, list[str]]:
        """Build name-to-ID mapping (allows multiple IDs per name)."""
        mapping: dict[str, list[str]] = {}
        for comp in self._components:
            name_lower = comp.name.lower()
            if name_lower not in mapping:
                mapping[name_lower] = []
            mapping[name_lower].append(comp.id)
        return mapping

    def analyze_all(self) -> list[Dependency]:
        """Analyze and return all dependencies."""
        if not self._components:
            return []

        self._name_to_ids = self._build_name_to_ids()
        self._deps = []
        seen = set()  # (source_id, target_id, dep_type) deduplication

        for comp in self._components:
            # 1. CONTEXT type (Skill's context field)
            if isinstance(comp, Skill) and comp.context_files:
                names = _parse_context_to_names(comp.context_files)
                for name in names:
                    target_ids = self._resolve_name(name, comp.project_id)
                    for target_id in target_ids:
                        if target_id != comp.id:
                            key = (comp.id, target_id, DependencyType.CONTEXT)
                            if key not in seen:
                                seen.add(key)
                                self._deps.append(
                                    Dependency(
                                        source_id=comp.id,
                                        target_id=target_id,
                                        dep_type=DependencyType.CONTEXT,
                                    )
                                )

            # 2. AGENTS_FIELD type (Subagent's agents field)
            if isinstance(comp, Subagent) and comp.agents:
                for agent_name in comp.agents:
                    target_ids = self._resolve_name(agent_name, comp.project_id)
                    for target_id in target_ids:
                        if target_id != comp.id:
                            key = (comp.id, target_id, DependencyType.AGENTS_FIELD)
                            if key not in seen:
                                seen.add(key)
                                self._deps.append(
                                    Dependency(
                                        source_id=comp.id,
                                        target_id=target_id,
                                        dep_type=DependencyType.AGENTS_FIELD,
                                    )
                                )

            # 3. BODY_REFERENCE type (body marker-based)
            if comp.content:
                candidates = _extract_candidate_refs(comp.content)
                for candidate in candidates:
                    target_ids = self._resolve_name(candidate, comp.project_id)
                    for target_id in target_ids:
                        if target_id != comp.id:
                            key = (comp.id, target_id, DependencyType.BODY_REFERENCE)
                            if key not in seen:
                                seen.add(key)
                                self._deps.append(
                                    Dependency(
                                        source_id=comp.id,
                                        target_id=target_id,
                                        dep_type=DependencyType.BODY_REFERENCE,
                                    )
                                )

        return self._deps

    def _resolve_name(self, name: str, project_id: str) -> list[str]:
        """Resolve a name to IDs (same project first, then global)."""
        name_lower = name.lower()
        if name_lower not in self._name_to_ids:
            return []

        ids = self._name_to_ids[name_lower]

        # Prefer components within the same project
        same_project = [comp.id for comp in self._components if comp.id in ids and comp.project_id == project_id]
        if same_project:
            return same_project

        # Fall back to all IDs (including global)
        return ids

    def detect_cycles(self) -> list[list[str]]:
        """Detect circular references."""
        if not self._deps:
            self.analyze_all()

        if not self._deps:
            return []

        # Build NetworkX DiGraph
        graph = nx.DiGraph()
        for dep in self._deps:
            graph.add_edge(dep.source_id, dep.target_id)

        # Detect cycles
        try:
            cycles = list(nx.simple_cycles(graph))
            return cycles
        except Exception:
            return []

    def get_dependents(self, component_id: str) -> list[str]:
        """List of component IDs that depend on (reference) this component."""
        if not self._deps:
            self.analyze_all()

        return [dep.source_id for dep in self._deps if dep.target_id == component_id]

    def get_dependencies(self, component_id: str) -> list[str]:
        """List of component IDs that this component depends on (references)."""
        if not self._deps:
            self.analyze_all()

        return [dep.target_id for dep in self._deps if dep.source_id == component_id]
