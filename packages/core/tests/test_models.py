"""models.py 테스트 — Pydantic 데이터 모델 검증."""

import pytest
from pydantic import ValidationError

from vibesmith_core.components.models import (
    Command,
    ComponentBase,
    ComponentType,
    Dependency,
    DependencyType,
    Hook,
    HookAction,
    HookMatcher,
    Project,
    Rule,
    Skill,
    Subagent,
    Version,
)


class TestComponentType:
    def test_enum_values(self):
        assert ComponentType.SKILL == "skill"
        assert ComponentType.AGENT == "agent"
        assert ComponentType.COMMAND == "command"
        assert ComponentType.HOOK == "hook"
        assert ComponentType.RULE == "rule"

    def test_enum_from_string(self):
        assert ComponentType("skill") == ComponentType.SKILL

    def test_invalid_value_raises(self):
        with pytest.raises(ValueError):
            ComponentType("invalid")


class TestDependencyType:
    def test_enum_values(self):
        assert DependencyType.CONTEXT == "context"
        assert DependencyType.BODY_REFERENCE == "body_reference"
        assert DependencyType.AGENTS_FIELD == "agents_field"


class TestProject:
    def test_create_project(self):
        project = Project(
            id="proj-1",
            name="my-project",
            path="/home/user/projects/my-project",
            last_scanned_at="2026-02-10T00:00:00",
        )
        assert project.id == "proj-1"
        assert project.name == "my-project"
        assert project.is_global is False
        assert project.component_count == 0

    def test_project_has_no_adapter_type_field(self):
        """Project 모델에 adapter_type 필드가 없다."""
        assert "adapter_type" not in Project.model_fields

    def test_global_project(self):
        project = Project(
            id="global",
            name="global",
            path="/home/user/.claude",
            is_global=True,
            last_scanned_at="2026-02-10T00:00:00",
        )
        assert project.is_global is True

    def test_missing_required_fields(self):
        with pytest.raises(ValidationError):
            Project(id="proj-1")


class TestComponentBase:
    def test_create_component(self):
        comp = ComponentBase(
            id="comp-1",
            type=ComponentType.SKILL,
            name="test-skill",
            project_id="proj-1",
            path="/path/to/skill",
            created_at="2026-02-10T00:00:00",
            updated_at="2026-02-10T00:00:00",
            platform="claude_code",
        )
        assert comp.id == "comp-1"
        assert comp.type == ComponentType.SKILL
        assert comp.enabled is True
        assert comp.tags == []
        assert comp.description is None
        assert comp.content is None
        assert comp.frontmatter is None

    def test_platform_is_required(self):
        """platform 없이 ComponentBase 생성 시 ValidationError."""
        with pytest.raises(ValidationError):
            ComponentBase(
                id="c1",
                type=ComponentType.SKILL,
                name="test",
                project_id="p1",
                path="/p",
                created_at="2026-02-10",
                updated_at="2026-02-10",
            )

    def test_with_optional_fields(self):
        comp = ComponentBase(
            id="comp-2",
            type=ComponentType.AGENT,
            name="test-agent",
            description="An agent",
            enabled=False,
            tags=["python", "review"],
            project_id="proj-1",
            path="/path/to/agent",
            content="# Agent content",
            frontmatter={"name": "test-agent"},
            created_at="2026-02-10T00:00:00",
            updated_at="2026-02-10T00:00:00",
            platform="claude_code",
        )
        assert comp.description == "An agent"
        assert comp.enabled is False
        assert comp.tags == ["python", "review"]
        assert comp.frontmatter == {"name": "test-agent"}


class TestSkill:
    def test_create_skill(self):
        skill = Skill(
            id="skill-1",
            name="tdd",
            project_id="proj-1",
            path="/path/to/skill",
            created_at="2026-02-10T00:00:00",
            updated_at="2026-02-10T00:00:00",
            platform="claude_code",
        )
        assert skill.type == ComponentType.SKILL
        assert skill.allowed_tools is None
        assert skill.context_files is None
        assert skill.agent is None

    def test_skill_with_all_fields(self):
        skill = Skill(
            id="skill-2",
            name="code-review",
            project_id="proj-1",
            path="/path/to/skill",
            allowed_tools=["Read", "Glob", "Grep"],
            context_files=["src/main.py"],
            agent="code-reviewer",
            created_at="2026-02-10T00:00:00",
            updated_at="2026-02-10T00:00:00",
            platform="claude_code",
        )
        assert skill.allowed_tools == ["Read", "Glob", "Grep"]
        assert skill.context_files == ["src/main.py"]
        assert skill.agent == "code-reviewer"


class TestSubagent:
    def test_create_subagent(self):
        agent = Subagent(
            id="agent-1",
            name="planner",
            project_id="proj-1",
            path="/path/to/agent",
            tools=["Read", "Glob", "Grep"],
            model="sonnet",
            created_at="2026-02-10T00:00:00",
            updated_at="2026-02-10T00:00:00",
            platform="claude_code",
        )
        assert agent.type == ComponentType.AGENT
        assert agent.tools == ["Read", "Glob", "Grep"]
        assert agent.model == "sonnet"
        assert agent.permission_mode is None
        assert agent.agents is None

    def test_subagent_with_agents_field(self):
        agent = Subagent(
            id="agent-2",
            name="orchestrator",
            project_id="proj-1",
            path="/path/to/agent",
            agents=["planner", "reviewer"],
            created_at="2026-02-10T00:00:00",
            updated_at="2026-02-10T00:00:00",
            platform="claude_code",
        )
        assert agent.agents == ["planner", "reviewer"]


class TestCommand:
    def test_create_command(self):
        cmd = Command(
            id="cmd-1",
            name="check",
            project_id="proj-1",
            path="/path/to/command",
            content="ruff check하고 결과 보고해줘",
            created_at="2026-02-10T00:00:00",
            updated_at="2026-02-10T00:00:00",
            platform="claude_code",
        )
        assert cmd.type == ComponentType.COMMAND
        assert cmd.content == "ruff check하고 결과 보고해줘"


class TestHookModels:
    def test_hook_action(self):
        action = HookAction(
            type="command",
            command='ruff format --quiet "$CLAUDE_FILE_PATH"',
            timeout=10000,
        )
        assert action.type == "command"
        assert action.timeout == 10000

    def test_hook_action_no_timeout(self):
        action = HookAction(
            type="command",
            command="echo hello",
        )
        assert action.timeout is None

    def test_hook_matcher(self):
        matcher = HookMatcher(
            matcher="Write|Edit",
            hooks=[
                HookAction(type="command", command="ruff format", timeout=10000),
            ],
        )
        assert matcher.matcher == "Write|Edit"
        assert len(matcher.hooks) == 1

    def test_hook_component(self):
        hook = Hook(
            id="hook-1",
            name="PostToolUse-format",
            project_id="proj-1",
            path="/path/to/settings.json",
            event_type="PostToolUse",
            matchers=[
                HookMatcher(
                    matcher="Write|Edit",
                    hooks=[HookAction(type="command", command="ruff format", timeout=10000)],
                ),
            ],
            created_at="2026-02-10T00:00:00",
            updated_at="2026-02-10T00:00:00",
            platform="claude_code",
        )
        assert hook.type == ComponentType.HOOK
        assert hook.event_type == "PostToolUse"
        assert len(hook.matchers) == 1
        assert hook.matchers[0].matcher == "Write|Edit"


class TestRule:
    def test_create_rule(self):
        rule = Rule(
            id="rule-1",
            name="python-style",
            project_id="proj-1",
            path="/path/to/rule",
            globs=["packages/core/**/*.py", "packages/api/**/*.py"],
            created_at="2026-02-10T00:00:00",
            updated_at="2026-02-10T00:00:00",
            platform="claude_code",
        )
        assert rule.type == ComponentType.RULE
        assert rule.globs == ["packages/core/**/*.py", "packages/api/**/*.py"]

    def test_rule_no_globs(self):
        rule = Rule(
            id="rule-2",
            name="docs-first",
            project_id="proj-1",
            path="/path/to/rule",
            created_at="2026-02-10T00:00:00",
            updated_at="2026-02-10T00:00:00",
            platform="claude_code",
        )
        assert rule.globs is None


class TestDependency:
    def test_create_dependency(self):
        dep = Dependency(
            source_id="skill-1",
            target_id="skill-2",
            dep_type=DependencyType.CONTEXT,
        )
        assert dep.source_id == "skill-1"
        assert dep.target_id == "skill-2"
        assert dep.dep_type == DependencyType.CONTEXT


class TestVersion:
    def test_create_version(self):
        ver = Version(
            id="ver-1",
            component_id="comp-1",
            version=1,
            content="# Original content",
            created_at="2026-02-10T00:00:00",
        )
        assert ver.version == 1
        assert ver.content == "# Original content"
