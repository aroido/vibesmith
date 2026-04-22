"""Tests for parser.py — MD/YAML/JSON parser verification."""

import json

import pytest

from vibesmith_core.components.models import (
    ComponentType,
    Hook,
    Rule,
    Skill,
    Subagent,
)
from vibesmith_core.scanning.parser import ComponentParser


@pytest.fixture
def parser():
    return ComponentParser(platform="claude_code")


@pytest.fixture
def project_id():
    return "proj-test"


class TestParseFrontmatter:
    def test_parse_valid_frontmatter(self, parser):
        content = "---\nname: my-skill\ndescription: A skill\n---\n\n# Body\n"
        fm, body = parser._parse_frontmatter(content)
        assert fm["name"] == "my-skill"
        assert fm["description"] == "A skill"
        assert body.strip() == "# Body"

    def test_parse_no_frontmatter(self, parser):
        content = "# Just a body\nNo frontmatter here."
        fm, body = parser._parse_frontmatter(content)
        assert fm == {}
        assert body == content

    def test_parse_empty_frontmatter(self, parser):
        content = "---\n---\n\nBody text"
        fm, body = parser._parse_frontmatter(content)
        assert fm == {}
        assert body.strip() == "Body text"

    def test_parse_malformed_yaml_returns_empty_dict(self, parser):
        """Issue #320: prevent server crash from malformed YAML."""
        content = "---\ndescription: [oops\n---\n\nBody"
        fm, body = parser._parse_frontmatter(content)
        # Returns empty dict on parse failure (no exception raised)
        assert fm == {}
        assert body.strip() == "Body"

    def test_parse_invalid_yaml_syntax(self, parser):
        """Issue #320: various YAML error cases."""
        cases = [
            "---\ndescription: [unclosed\n---\n\nBody",
            "---\nkey: {invalid\n---\n\nBody",
            "---\nkey: value:\n---\n\nBody",
        ]
        for content in cases:
            fm, body = parser._parse_frontmatter(content)
            assert fm == {}  # No exception even on parse failure


class TestParseSkill:
    def _write_skill(self, tmp_path, content):
        skill_dir = tmp_path / "skills" / "my-skill"
        skill_dir.mkdir(parents=True)
        skill_file = skill_dir / "SKILL.md"
        skill_file.write_text(content)
        return str(skill_file)

    def test_parse_skill_basic(self, parser, project_id, tmp_path):
        content = (
            "---\n"
            "name: my-skill\n"
            "description: A great skill\n"
            "allowed-tools: Read, Write, Edit\n"
            "---\n\n"
            "# My Skill\n\nDo something."
        )
        path = self._write_skill(tmp_path, content)
        skill = parser.parse_skill(path, project_id)
        assert isinstance(skill, Skill)
        assert skill.name == "my-skill"
        assert skill.description == "A great skill"
        assert skill.allowed_tools == ["Read", "Write", "Edit"]
        assert skill.type == ComponentType.SKILL
        assert skill.project_id == project_id

    def test_parse_skill_with_context_and_agent(self, parser, project_id, tmp_path):
        content = (
            "---\n"
            "name: code-review\n"
            "description: Review code\n"
            "allowed-tools: Read, Glob, Grep\n"
            "context: src/main.py, src/utils.py\n"
            "agent: code-reviewer\n"
            "---\n\n"
            "# Code Review Skill"
        )
        path = self._write_skill(tmp_path, content)
        skill = parser.parse_skill(path, project_id)
        assert skill.context_files == ["src/main.py", "src/utils.py"]
        assert skill.agent == "code-reviewer"

    def test_parse_skill_content_preserved(self, parser, project_id, tmp_path):
        body = "# My Skill\n\nDetailed instructions here."
        content = f"---\nname: test\n---\n\n{body}"
        path = self._write_skill(tmp_path, content)
        skill = parser.parse_skill(path, project_id)
        assert skill.content is not None
        assert "Detailed instructions here." in skill.content

    def test_parse_skill_has_id_and_timestamps(self, parser, project_id, tmp_path):
        content = "---\nname: test\n---\n\nBody"
        path = self._write_skill(tmp_path, content)
        skill = parser.parse_skill(path, project_id)
        assert skill.id is not None and len(skill.id) > 0
        assert skill.created_at is not None
        assert skill.updated_at is not None

    def test_parse_skill_name_from_frontmatter(self, parser, project_id, tmp_path):
        content = "---\nname: custom-name\n---\n\nBody"
        path = self._write_skill(tmp_path, content)
        skill = parser.parse_skill(path, project_id)
        assert skill.name == "custom-name"

    def test_parse_skill_name_fallback_to_dir(self, parser, project_id, tmp_path):
        content = "---\ndescription: no name field\n---\n\nBody"
        path = self._write_skill(tmp_path, content)
        skill = parser.parse_skill(path, project_id)
        assert skill.name == "my-skill"


class TestParseAgent:
    def _write_agent(self, tmp_path, filename, content):
        agents_dir = tmp_path / "agents"
        agents_dir.mkdir(parents=True, exist_ok=True)
        agent_file = agents_dir / filename
        agent_file.write_text(content)
        return str(agent_file)

    def test_parse_agent_basic(self, parser, project_id, tmp_path):
        content = (
            "---\n"
            "name: test-runner\n"
            "description: Run tests\n"
            "tools: Bash, Read, Glob\n"
            "model: haiku\n"
            "---\n\n"
            "# Test Runner"
        )
        path = self._write_agent(tmp_path, "test-runner.md", content)
        agent = parser.parse_agent(path, project_id)
        assert isinstance(agent, Subagent)
        assert agent.name == "test-runner"
        assert agent.description == "Run tests"
        assert agent.tools == ["Bash", "Read", "Glob"]
        assert agent.model == "haiku"
        assert agent.type == ComponentType.AGENT

    def test_parse_agent_with_agents_field(self, parser, project_id, tmp_path):
        content = (
            "---\n"
            "name: orchestrator\n"
            "description: Orchestrate\n"
            "tools: Read\n"
            "agents: planner, reviewer\n"
            "---\n\n"
            "# Orchestrator"
        )
        path = self._write_agent(tmp_path, "orchestrator.md", content)
        agent = parser.parse_agent(path, project_id)
        assert agent.agents == ["planner", "reviewer"]

    def test_parse_agent_with_permission_mode(self, parser, project_id, tmp_path):
        content = (
            "---\n"
            "name: secure-agent\n"
            "description: Secure\n"
            "tools: Read\n"
            "permissionMode: bypassPermissions\n"
            "---\n\n"
            "Prompt"
        )
        path = self._write_agent(tmp_path, "secure-agent.md", content)
        agent = parser.parse_agent(path, project_id)
        assert agent.permission_mode == "bypassPermissions"

    def test_parse_agent_name_fallback_to_filename(self, parser, project_id, tmp_path):
        content = "---\ndescription: no name\ntools: Read\n---\n\nPrompt"
        path = self._write_agent(tmp_path, "my-agent.md", content)
        agent = parser.parse_agent(path, project_id)
        assert agent.name == "my-agent"


class TestParseCommand:
    def _write_command(self, tmp_path, filename, content):
        cmd_dir = tmp_path / "commands"
        cmd_dir.mkdir(parents=True, exist_ok=True)
        cmd_file = cmd_dir / filename
        cmd_file.write_text(content)
        return str(cmd_file)

    def test_parse_command_no_frontmatter(self, parser, project_id, tmp_path):
        content = "Run the tests and report results.\n\n$ARGUMENTS"
        path = self._write_command(tmp_path, "test.md", content)
        cmd = parser.parse_command(path, project_id)
        assert cmd.type == ComponentType.COMMAND
        assert cmd.content == content
        assert cmd.frontmatter is None

    def test_parse_command_name_from_filename(self, parser, project_id, tmp_path):
        content = "Check things."
        path = self._write_command(tmp_path, "check.md", content)
        cmd = parser.parse_command(path, project_id)
        assert cmd.name == "check"

    def test_parse_command_preserves_full_body(self, parser, project_id, tmp_path):
        content = "Line 1\n\nLine 2\n\n## Section\n\nMore content"
        path = self._write_command(tmp_path, "my-cmd.md", content)
        cmd = parser.parse_command(path, project_id)
        assert cmd.content == content


class TestParseRule:
    def _write_rule(self, tmp_path, filename, content):
        rules_dir = tmp_path / "rules"
        rules_dir.mkdir(parents=True, exist_ok=True)
        rule_file = rules_dir / filename
        rule_file.write_text(content)
        return str(rule_file)

    def test_parse_rule_with_globs(self, parser, project_id, tmp_path):
        content = (
            '---\ndescription: Python style\nglobs: "packages/core/**/*.py,packages/api/**/*.py"\n---\n\n'
            "# Python Style\n\nUse ruff."
        )
        path = self._write_rule(tmp_path, "python-style.md", content)
        rule = parser.parse_rule(path, project_id)
        assert isinstance(rule, Rule)
        assert rule.type == ComponentType.RULE
        assert rule.globs == ["packages/core/**/*.py", "packages/api/**/*.py"]
        assert rule.description == "Python style"

    def test_parse_rule_no_globs(self, parser, project_id, tmp_path):
        content = "---\ndescription: General rule\n---\n\n# General\n\nApply everywhere."
        path = self._write_rule(tmp_path, "general.md", content)
        rule = parser.parse_rule(path, project_id)
        assert rule.globs is None

    def test_parse_rule_name_from_filename(self, parser, project_id, tmp_path):
        content = "---\ndescription: Test rule\n---\n\nBody"
        path = self._write_rule(tmp_path, "my-rule.md", content)
        rule = parser.parse_rule(path, project_id)
        assert rule.name == "my-rule"

    def test_parse_rule_content_preserved(self, parser, project_id, tmp_path):
        content = "---\ndescription: Test\n---\n\n# Rule Body\n\nDetails here."
        path = self._write_rule(tmp_path, "test.md", content)
        rule = parser.parse_rule(path, project_id)
        assert "Rule Body" in rule.content

    def test_parse_rule_cursorrules_name_fallback(self, parser, project_id, tmp_path):
        """'.cursorrules' file has empty stem, falls back to 'cursorrules'."""
        content = "# Cursor Rules\n\nUse TypeScript."
        cursorrules_file = tmp_path / ".cursorrules"
        cursorrules_file.write_text(content)
        rule = parser.parse_rule(str(cursorrules_file), project_id)
        assert rule.name == "cursorrules"

    def test_parse_rule_mdc_frontmatter_name(self, parser, project_id, tmp_path):
        """'.mdc' file uses frontmatter name when present."""
        content = "---\nname: custom-mdc-rule\ndescription: MDC rule\n---\n\n# MDC Content"
        mdc_dir = tmp_path / "mdc"
        mdc_dir.mkdir(parents=True, exist_ok=True)
        mdc_file = mdc_dir / "my-rule.mdc"
        mdc_file.write_text(content)
        rule = parser.parse_rule(str(mdc_file), project_id)
        assert rule.name == "custom-mdc-rule"

    def test_parse_mdc_always_apply(self, parser, project_id, tmp_path):
        """'.mdc' file with alwaysApply: true is stored in frontmatter."""
        content = "---\nname: always-rule\nalwaysApply: true\n---\n\n# Always Apply Rule"
        mdc_dir = tmp_path / "mdc"
        mdc_dir.mkdir(parents=True, exist_ok=True)
        mdc_file = mdc_dir / "always.mdc"
        mdc_file.write_text(content)
        rule = parser.parse_rule(str(mdc_file), project_id)
        assert rule.frontmatter is not None
        assert rule.frontmatter["alwaysApply"] is True


class TestParseHooks:
    def _write_settings(self, tmp_path, data):
        settings_file = tmp_path / "settings.json"
        settings_file.write_text(json.dumps(data))
        return str(settings_file)

    def test_parse_hooks_single_event(self, parser, project_id, tmp_path):
        data = {
            "hooks": {
                "PostToolUse": [
                    {
                        "matcher": "Write|Edit",
                        "hooks": [{"type": "command", "command": "ruff format", "timeout": 10000}],
                    }
                ]
            }
        }
        path = self._write_settings(tmp_path, data)
        hooks = parser.parse_hooks(path, project_id)
        assert len(hooks) == 1
        hook = hooks[0]
        assert isinstance(hook, Hook)
        assert hook.type == ComponentType.HOOK
        assert hook.event_type == "PostToolUse"
        assert len(hook.matchers) == 1
        assert hook.matchers[0].matcher == "Write|Edit"
        assert hook.matchers[0].hooks[0].command == "ruff format"
        assert hook.matchers[0].hooks[0].timeout == 10000

    def test_parse_hooks_no_hooks_key(self, parser, project_id, tmp_path):
        data = {"permissions": {"allow": []}}
        path = self._write_settings(tmp_path, data)
        hooks = parser.parse_hooks(path, project_id)
        assert hooks == []

    def test_parse_hooks_malformed_json_returns_empty_list(self, parser, project_id, tmp_path):
        """Corrupted settings.json returns empty list instead of raising."""
        settings_file = tmp_path / "settings.json"
        settings_file.write_text('{"hooks": {"PostToolUse": [', encoding="utf-8")
        hooks = parser.parse_hooks(str(settings_file), project_id)
        assert hooks == []

    def test_parse_hooks_multiple_events(self, parser, project_id, tmp_path):
        data = {
            "hooks": {
                "PostToolUse": [{"matcher": "Write", "hooks": [{"type": "command", "command": "fmt"}]}],
                "PreToolUse": [{"matcher": "Bash", "hooks": [{"type": "command", "command": "check"}]}],
            }
        }
        path = self._write_settings(tmp_path, data)
        hooks = parser.parse_hooks(path, project_id)
        assert len(hooks) == 2
        event_types = {h.event_type for h in hooks}
        assert event_types == {"PostToolUse", "PreToolUse"}

    def test_parse_hooks_empty_hooks_section(self, parser, project_id, tmp_path):
        data = {"hooks": {}}
        path = self._write_settings(tmp_path, data)
        hooks = parser.parse_hooks(path, project_id)
        assert hooks == []

    def test_parse_hooks_name_includes_event_type(self, parser, project_id, tmp_path):
        data = {"hooks": {"PostToolUse": [{"matcher": "Write", "hooks": [{"type": "command", "command": "fmt"}]}]}}
        path = self._write_settings(tmp_path, data)
        hooks = parser.parse_hooks(path, project_id)
        assert "PostToolUse" in hooks[0].name


class TestParseFileDispatch:
    def _write_skill(self, tmp_path, content):
        skill_dir = tmp_path / "skills" / "test-skill"
        skill_dir.mkdir(parents=True)
        skill_file = skill_dir / "SKILL.md"
        skill_file.write_text(content)
        return str(skill_file)

    def _write_command(self, tmp_path, content):
        cmd_dir = tmp_path / "commands"
        cmd_dir.mkdir(parents=True)
        cmd_file = cmd_dir / "test.md"
        cmd_file.write_text(content)
        return str(cmd_file)

    def test_dispatch_to_skill(self, parser, project_id, tmp_path):
        content = "---\nname: test-skill\n---\n\nBody"
        path = self._write_skill(tmp_path, content)
        result = parser.parse_file(path, ComponentType.SKILL, project_id)
        assert isinstance(result, Skill)

    def test_dispatch_to_command(self, parser, project_id, tmp_path):
        content = "Do something."
        path = self._write_command(tmp_path, content)
        result = parser.parse_file(path, ComponentType.COMMAND, project_id)
        assert result.type == ComponentType.COMMAND

    def test_dispatch_invalid_type_for_hooks(self, parser, project_id, tmp_path):
        """parse_file raises ValueError for HOOK type since parse_hooks should be used."""
        with pytest.raises(ValueError):
            parser.parse_file("/fake/path", ComponentType.HOOK, project_id)
