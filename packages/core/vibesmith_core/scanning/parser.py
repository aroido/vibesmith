"""MD/YAML/JSON parser — converts component files to Pydantic models."""

import json
import logging
import os
import uuid
from datetime import UTC, datetime
from pathlib import Path

import yaml

from vibesmith_core.components.models import (
    Command,
    ComponentBase,
    ComponentType,
    Hook,
    HookAction,
    HookMatcher,
    Rule,
    Skill,
    Subagent,
)

logger = logging.getLogger(__name__)


def _split_csv(value: str | list | None) -> list[str] | None:
    """Convert a comma-separated string to a list. Returns as-is if already a list."""
    if value is None:
        return None
    if isinstance(value, list):
        return [str(v).strip() for v in value]
    return [v.strip() for v in str(value).split(",") if v.strip()]


def _generate_id() -> str:
    return str(uuid.uuid4())


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _file_mtime_iso(file_path: str) -> str:
    """Return the file modification time (mtime) in ISO 8601 format."""
    mtime = os.path.getmtime(file_path)
    return datetime.fromtimestamp(mtime, tz=UTC).isoformat()


def _is_disabled_file(file_path: str) -> bool:
    """Check if the path ends with .md.disabled or .mdc.disabled."""
    return Path(file_path).name.endswith(".disabled")


def _stem_for_component(file_path: str) -> str:
    """Return the logical stem for .disabled extensions. e.g. foo.md.disabled -> foo."""
    name = Path(file_path).name
    if name.endswith(".md.disabled"):
        return name[: -len(".md.disabled")]
    if name.endswith(".mdc.disabled"):
        return name[: -len(".mdc.disabled")]
    return Path(file_path).stem


class ComponentParser:
    """Parse MD/YAML/JSON files from the filesystem into Pydantic models."""

    def __init__(self, platform: str) -> None:
        self._platform = platform

    def parse_file(self, file_path: str, component_type: ComponentType, project_id: str) -> ComponentBase:
        """Dispatch to the type-specific parser. For HOOK, call parse_hooks directly."""
        if component_type == ComponentType.HOOK:
            raise ValueError("Use parse_hooks() for HOOK type.")
        dispatch = {
            ComponentType.SKILL: self.parse_skill,
            ComponentType.AGENT: self.parse_agent,
            ComponentType.COMMAND: self.parse_command,
            ComponentType.RULE: self.parse_rule,
        }
        return dispatch[component_type](file_path, project_id)

    def parse_skill(self, file_path: str, project_id: str) -> Skill:
        """Parse a SKILL.md or SKILL.md.disabled file."""
        content = Path(file_path).read_text(encoding="utf-8")
        fm, body = self._parse_frontmatter(content)
        name = fm.get("name") or Path(file_path).parent.name
        enabled = not _is_disabled_file(file_path)
        return Skill(
            id=_generate_id(),
            name=name,
            description=fm.get("description"),
            project_id=project_id,
            path=file_path,
            content=body,
            frontmatter=fm or None,
            allowed_tools=_split_csv(fm.get("allowed-tools")),
            context_files=_split_csv(fm.get("context")),
            agent=fm.get("agent"),
            created_at=_now_iso(),
            updated_at=_file_mtime_iso(file_path),
            platform=self._platform,
            enabled=enabled,
        )

    def parse_agent(self, file_path: str, project_id: str) -> Subagent:
        """Parse an agent .md or .md.disabled file."""
        content = Path(file_path).read_text(encoding="utf-8")
        fm, body = self._parse_frontmatter(content)
        name = fm.get("name") or _stem_for_component(file_path)
        enabled = not _is_disabled_file(file_path)
        return Subagent(
            id=_generate_id(),
            name=name,
            description=fm.get("description"),
            project_id=project_id,
            path=file_path,
            content=body,
            frontmatter=fm or None,
            tools=_split_csv(fm.get("tools")),
            model=fm.get("model"),
            permission_mode=fm.get("permissionMode"),
            agents=_split_csv(fm.get("agents")),
            created_at=_now_iso(),
            updated_at=_file_mtime_iso(file_path),
            platform=self._platform,
            enabled=enabled,
        )

    def parse_command(self, file_path: str, project_id: str) -> Command:
        """Parse a command .md or .md.disabled file. No frontmatter."""
        content = Path(file_path).read_text(encoding="utf-8")
        name = _stem_for_component(file_path)
        enabled = not _is_disabled_file(file_path)
        return Command(
            id=_generate_id(),
            name=name,
            project_id=project_id,
            path=file_path,
            content=content,
            frontmatter=None,
            created_at=_now_iso(),
            updated_at=_file_mtime_iso(file_path),
            platform=self._platform,
            enabled=enabled,
        )

    def parse_hooks(self, settings_path: str, project_id: str) -> list[Hook]:
        """Parse the hooks section from settings.json. Returns an empty list on parse failure."""
        try:
            raw = json.loads(Path(settings_path).read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            logger.warning(
                "Failed to parse settings.json — skipping. path=%s error=%s",
                settings_path,
                e,
                exc_info=True,
            )
            return []
        hooks_section = raw.get("hooks", {})
        result: list[Hook] = []
        for event_type, matcher_list in hooks_section.items():
            # Skip if matcher_list is not a list
            if not isinstance(matcher_list, list):
                continue

            matchers = []
            for m in matcher_list:
                # Skip if not a dict or missing required keys
                if not isinstance(m, dict) or "matcher" not in m or "hooks" not in m:
                    continue

                try:
                    matchers.append(
                        HookMatcher(
                            matcher=m["matcher"],
                            hooks=[HookAction(**h) for h in m["hooks"]],
                        )
                    )
                except (KeyError, TypeError, ValueError):
                    # Skip only this matcher on parse failure
                    continue

            # Only add Hook when matchers exist
            if matchers:
                result.append(
                    Hook(
                        id=_generate_id(),
                        name=f"{event_type}",
                        project_id=project_id,
                        path=settings_path,
                        event_type=event_type,
                        matchers=matchers,
                        created_at=_now_iso(),
                        updated_at=_file_mtime_iso(settings_path),
                        platform=self._platform,
                    )
                )
        return result

    def parse_rule(self, file_path: str, project_id: str) -> Rule:
        """Parse a rule .md/.mdc or .md.disabled/.mdc.disabled file."""
        content = Path(file_path).read_text(encoding="utf-8")
        fm, body = self._parse_frontmatter(content)
        stem = _stem_for_component(file_path)
        name = fm.get("name") or stem.lstrip(".") or "unnamed-rule"
        globs_raw = fm.get("globs")
        globs = _split_csv(globs_raw) if globs_raw else None
        enabled = not _is_disabled_file(file_path)
        return Rule(
            id=_generate_id(),
            name=name,
            description=fm.get("description"),
            project_id=project_id,
            path=file_path,
            content=body,
            frontmatter=fm or None,
            globs=globs,
            created_at=_now_iso(),
            updated_at=_file_mtime_iso(file_path),
            platform=self._platform,
            enabled=enabled,
        )

    def _parse_frontmatter(self, content: str) -> tuple[dict, str]:
        """Separate YAML frontmatter. Returns (frontmatter_dict, body_str)."""
        if not content.startswith("---"):
            return {}, content
        parts = content.split("---", 2)
        if len(parts) < 3:
            return {}, content
        fm_raw = parts[1].strip()
        body = parts[2]
        if body.startswith("\n"):
            body = body[1:]
        if not fm_raw:
            return {}, body
        try:
            fm = yaml.safe_load(fm_raw)
        except yaml.YAMLError as e:
            # Issue #320: prevent server crash on malformed YAML
            # Log a warning for individual file parse failures and continue
            import logging

            logger = logging.getLogger("vibesmith.parser")
            logger.warning(f"Failed to parse YAML frontmatter (skip): {e}")
            return {}, body
        if not isinstance(fm, dict):
            return {}, body
        return fm, body
