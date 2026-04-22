"""scanner.py 테스트 — 파일시스템 스캐너 검증."""

import json

from vibesmith_core.components.models import ComponentType
from vibesmith_core.scanning.scanner import FileSystemScanner


def _setup_claude_dir(base_path, *, skills=None, agents=None, commands=None, rules=None, hooks=None):
    """테스트용 .claude 디렉토리 구조를 생성한다."""
    claude_dir = base_path / ".claude"
    claude_dir.mkdir(parents=True, exist_ok=True)

    if skills:
        for name, content in skills.items():
            skill_dir = claude_dir / "skills" / name
            skill_dir.mkdir(parents=True)
            (skill_dir / "SKILL.md").write_text(content)

    if agents:
        agents_dir = claude_dir / "agents"
        agents_dir.mkdir(parents=True, exist_ok=True)
        for name, content in agents.items():
            (agents_dir / f"{name}.md").write_text(content)

    if commands:
        cmd_dir = claude_dir / "commands"
        cmd_dir.mkdir(parents=True, exist_ok=True)
        for name, content in commands.items():
            (cmd_dir / f"{name}.md").write_text(content)

    if rules:
        rules_dir = claude_dir / "rules"
        rules_dir.mkdir(parents=True, exist_ok=True)
        for name, content in rules.items():
            (rules_dir / f"{name}.md").write_text(content)

    if hooks:
        (claude_dir / "settings.json").write_text(json.dumps(hooks))

    return str(base_path)


def _setup_cursor_dir(base_path, *, rules=None):
    """테스트용 .cursor 디렉토리 구조를 생성한다."""
    cursor_dir = base_path / ".cursor"
    cursor_dir.mkdir(parents=True, exist_ok=True)

    if rules:
        rules_dir = cursor_dir / "rules"
        rules_dir.mkdir(parents=True, exist_ok=True)
        for name, content in rules.items():
            (rules_dir / name).write_text(content)

    return str(base_path)


class TestScanProject:
    def test_scan_skills(self, tmp_path):
        project_path = _setup_claude_dir(
            tmp_path / "project-a",
            skills={"my-skill": "---\nname: my-skill\n---\n\nBody"},
        )
        scanner = FileSystemScanner()
        result = scanner.scan_project(project_path, "proj-1")
        skills = [c for c in result if c.type == ComponentType.SKILL]
        assert len(skills) == 1
        assert skills[0].name == "my-skill"

    def test_scan_agents(self, tmp_path):
        project_path = _setup_claude_dir(
            tmp_path / "project-a",
            agents={"reviewer": "---\nname: reviewer\ntools: Read\n---\n\nPrompt"},
        )
        scanner = FileSystemScanner()
        result = scanner.scan_project(project_path, "proj-1")
        agents = [c for c in result if c.type == ComponentType.AGENT]
        assert len(agents) == 1
        assert agents[0].name == "reviewer"

    def test_scan_commands(self, tmp_path):
        project_path = _setup_claude_dir(
            tmp_path / "project-a",
            commands={"check": "Run checks."},
        )
        scanner = FileSystemScanner()
        result = scanner.scan_project(project_path, "proj-1")
        commands = [c for c in result if c.type == ComponentType.COMMAND]
        assert len(commands) == 1
        assert commands[0].name == "check"

    def test_scan_rules(self, tmp_path):
        project_path = _setup_claude_dir(
            tmp_path / "project-a",
            rules={"style": "---\ndescription: Style guide\n---\n\nUse ruff."},
        )
        scanner = FileSystemScanner()
        result = scanner.scan_project(project_path, "proj-1")
        rules = [c for c in result if c.type == ComponentType.RULE]
        assert len(rules) == 1
        assert rules[0].name == "style"

    def test_scan_hooks(self, tmp_path):
        project_path = _setup_claude_dir(
            tmp_path / "project-a",
            hooks={"hooks": {"PostToolUse": [{"matcher": "Write", "hooks": [{"type": "command", "command": "fmt"}]}]}},
        )
        scanner = FileSystemScanner()
        result = scanner.scan_project(project_path, "proj-1")
        hooks = [c for c in result if c.type == ComponentType.HOOK]
        assert len(hooks) == 1

    def test_scan_malformed_settings_json_skips_hooks_continues_scan(self, tmp_path):
        """손상된 settings.json이 있어도 스캔은 계속되고 다른 컴포넌트는 반환된다."""
        project_path = _setup_claude_dir(
            tmp_path / "project-a",
            skills={"s1": "---\nname: s1\n---\n\nBody"},
        )
        (tmp_path / "project-a" / ".claude" / "settings.json").write_text('{"hooks": [', encoding="utf-8")
        scanner = FileSystemScanner()
        result = scanner.scan_project(project_path, "proj-1")
        skills = [c for c in result if c.type == ComponentType.SKILL]
        hooks = [c for c in result if c.type == ComponentType.HOOK]
        assert len(skills) == 1
        assert skills[0].name == "s1"
        assert len(hooks) == 0

    def test_scan_all_types_together(self, tmp_path):
        project_path = _setup_claude_dir(
            tmp_path / "project-a",
            skills={"s1": "---\nname: s1\n---\n\nBody"},
            agents={"a1": "---\nname: a1\ntools: Read\n---\n\nPrompt"},
            commands={"c1": "Run it."},
            rules={"r1": "---\ndescription: R1\n---\n\nRule"},
            hooks={"hooks": {"Stop": [{"matcher": "*", "hooks": [{"type": "command", "command": "echo"}]}]}},
        )
        scanner = FileSystemScanner()
        result = scanner.scan_project(project_path, "proj-1")
        types = {c.type for c in result}
        assert ComponentType.SKILL in types
        assert ComponentType.AGENT in types
        assert ComponentType.COMMAND in types
        assert ComponentType.RULE in types
        assert ComponentType.HOOK in types

    def test_scan_empty_project(self, tmp_path):
        """프로젝트에 .claude 디렉토리가 없으면 빈 리스트."""
        project_path = tmp_path / "empty-project"
        project_path.mkdir()
        scanner = FileSystemScanner()
        result = scanner.scan_project(str(project_path), "proj-1")
        assert result == []

    def test_scan_missing_subdirs(self, tmp_path):
        """.claude는 있지만 skills/ 등 하위 디렉토리가 없어도 에러 없음."""
        claude_dir = tmp_path / "project" / ".claude"
        claude_dir.mkdir(parents=True)
        scanner = FileSystemScanner()
        result = scanner.scan_project(str(tmp_path / "project"), "proj-1")
        assert result == []

    def test_scan_multiple_skills(self, tmp_path):
        project_path = _setup_claude_dir(
            tmp_path / "project-a",
            skills={
                "skill-a": "---\nname: skill-a\n---\n\nA",
                "skill-b": "---\nname: skill-b\n---\n\nB",
            },
        )
        scanner = FileSystemScanner()
        result = scanner.scan_project(project_path, "proj-1")
        skills = [c for c in result if c.type == ComponentType.SKILL]
        assert len(skills) == 2
        names = {s.name for s in skills}
        assert names == {"skill-a", "skill-b"}


class TestDiscoverProjects:
    def test_discovers_claude_projects(self, tmp_path):
        (tmp_path / "proj-a" / ".claude").mkdir(parents=True)
        (tmp_path / "proj-b" / ".claude").mkdir(parents=True)
        (tmp_path / "no-claude").mkdir(parents=True)
        scanner = FileSystemScanner()
        projects = scanner.discover_projects(str(tmp_path))
        assert len(projects) == 2
        names = {p.split("/")[-1] for p in projects}
        assert names == {"proj-a", "proj-b"}

    def test_empty_root(self, tmp_path):
        scanner = FileSystemScanner()
        projects = scanner.discover_projects(str(tmp_path))
        assert projects == []

    def test_default_depth_ignores_nested(self, tmp_path):
        """기본 max_depth=1은 직계 하위만 탐색."""
        (tmp_path / "proj" / ".claude").mkdir(parents=True)
        (tmp_path / "proj" / "sub" / ".claude").mkdir(parents=True)
        scanner = FileSystemScanner()
        projects = scanner.discover_projects(str(tmp_path))
        assert len(projects) == 1

    def test_includes_cursor(self, tmp_path):
        """.cursor 디렉토리가 있는 프로젝트도 발견한다."""
        (tmp_path / "proj-cursor" / ".cursor").mkdir(parents=True)
        (tmp_path / "proj-claude" / ".claude").mkdir(parents=True)
        scanner = FileSystemScanner()
        projects = scanner.discover_projects(str(tmp_path))
        assert len(projects) == 2
        names = {p.split("/")[-1] for p in projects}
        assert names == {"proj-cursor", "proj-claude"}

    def test_mixed_no_duplicates(self, tmp_path):
        """.claude와 .cursor가 공존하는 프로젝트는 중복 없이 1개만 발견."""
        (tmp_path / "proj-both" / ".claude").mkdir(parents=True)
        (tmp_path / "proj-both" / ".cursor").mkdir(parents=True)
        scanner = FileSystemScanner()
        projects = scanner.discover_projects(str(tmp_path))
        assert len(projects) == 1
        assert projects[0].endswith("proj-both")

    def test_deeper_with_max_depth(self, tmp_path):
        """max_depth를 높이면 깊은 경로도 탐색한다."""
        (tmp_path / "level1" / "proj-cursor" / ".cursor").mkdir(parents=True)
        (tmp_path / "level1" / "proj-claude" / ".claude").mkdir(parents=True)
        scanner = FileSystemScanner()
        projects = scanner.discover_projects(str(tmp_path), max_depth=4)
        assert len(projects) == 2
        names = {p.split("/")[-1] for p in projects}
        assert names == {"proj-cursor", "proj-claude"}

    def test_discovers_new_adapter(self, tmp_path):
        """새 adapter가 등록되면 자동으로 해당 config_dir을 탐색한다."""
        from vibesmith_core.scanning.adapters.base import AgentAdapter

        class _WindsurfAdapter(AgentAdapter, config_dir=".windsurf"):
            def get_global_path(self):
                return None

            def get_project_path(self, project_root):
                return ""

            def get_component_paths(self, base_path):
                return {}

            def get_extra_rules(self, project_path):
                return []

        (tmp_path / "proj-windsurf" / ".windsurf").mkdir(parents=True)
        (tmp_path / "proj-claude" / ".claude").mkdir(parents=True)
        scanner = FileSystemScanner()
        projects = scanner.discover_projects(str(tmp_path))
        assert len(projects) == 2
        names = {p.split("/")[-1] for p in projects}
        assert names == {"proj-windsurf", "proj-claude"}
        AgentAdapter._config_dirs.discard(".windsurf")

    def test_discovers_new_adapter_deep(self, tmp_path):
        """새 adapter + 깊은 탐색도 동작한다."""
        from vibesmith_core.scanning.adapters.base import AgentAdapter

        class _WindsurfAdapter(AgentAdapter, config_dir=".windsurf2"):
            def get_global_path(self):
                return None

            def get_project_path(self, project_root):
                return ""

            def get_component_paths(self, base_path):
                return {}

            def get_extra_rules(self, project_path):
                return []

        (tmp_path / "level1" / "proj-ws" / ".windsurf2").mkdir(parents=True)
        scanner = FileSystemScanner()
        projects = scanner.discover_projects(str(tmp_path), max_depth=4)
        assert len(projects) == 1
        assert projects[0].endswith("proj-ws")
        AgentAdapter._config_dirs.discard(".windsurf2")


class TestScanProjectWithAdapter:
    def test_scan_project_with_cursor_adapter(self, tmp_path):
        """CursorAdapter 주입 시 .cursor 디렉토리를 스캔한다."""
        from vibesmith_core.scanning.adapters.cursor import CursorAdapter

        project_path = _setup_cursor_dir(
            tmp_path / "cursor-project",
            rules={"style.md": "---\ndescription: Style guide\n---\n\nUse prettier."},
        )
        scanner = FileSystemScanner(adapter=CursorAdapter())
        result = scanner.scan_project(project_path, "cursor-1")
        rules = [c for c in result if c.type == ComponentType.RULE]
        assert len(rules) == 1
        assert rules[0].name == "style"


class TestScanDisabledFiles:
    """스캐너가 .md.disabled 파일을 인식하고 enabled=False로 파싱한다."""

    def test_scan_skill_md_disabled(self, tmp_path):
        """SKILL.md.disabled 스캔 시 enabled=False."""
        claude_dir = tmp_path / "project" / ".claude"
        skill_dir = claude_dir / "skills" / "disabled-skill"
        skill_dir.mkdir(parents=True)
        (skill_dir / "SKILL.md.disabled").write_text("---\nname: disabled-skill\n---\n\nDisabled body")
        scanner = FileSystemScanner()
        result = scanner.scan_project(str(tmp_path / "project"), "proj-1")
        skills = [c for c in result if c.type == ComponentType.SKILL]
        assert len(skills) == 1
        assert skills[0].enabled is False
        assert skills[0].name == "disabled-skill"

    def test_scan_agent_md_disabled(self, tmp_path):
        """agent .md.disabled 스캔 시 enabled=False."""
        project_path = _setup_claude_dir(
            tmp_path / "project",
            agents={"reviewer": "---\nname: reviewer\ntools: Read\n---\n\nPrompt"},
        )
        agent_file = tmp_path / "project" / ".claude" / "agents" / "reviewer.md"
        agent_file.rename(agent_file.parent / "reviewer.md.disabled")
        scanner = FileSystemScanner()
        result = scanner.scan_project(project_path, "proj-1")
        agents = [c for c in result if c.type == ComponentType.AGENT]
        assert len(agents) == 1
        assert agents[0].enabled is False
        assert agents[0].name == "reviewer"

    def test_scan_command_md_disabled(self, tmp_path):
        """command .md.disabled 스캔 시 enabled=False."""
        project_path = _setup_claude_dir(
            tmp_path / "project",
            commands={"check": "Run checks."},
        )
        cmd_file = tmp_path / "project" / ".claude" / "commands" / "check.md"
        cmd_file.rename(cmd_file.parent / "check.md.disabled")
        scanner = FileSystemScanner()
        result = scanner.scan_project(project_path, "proj-1")
        commands = [c for c in result if c.type == ComponentType.COMMAND]
        assert len(commands) == 1
        assert commands[0].enabled is False
        assert commands[0].name == "check"

    def test_scan_rule_md_disabled(self, tmp_path):
        """rule .md.disabled 스캔 시 enabled=False."""
        project_path = _setup_claude_dir(
            tmp_path / "project",
            rules={"style": "---\ndescription: Style\n---\n\nUse ruff."},
        )
        rule_file = tmp_path / "project" / ".claude" / "rules" / "style.md"
        rule_file.rename(rule_file.parent / "style.md.disabled")
        scanner = FileSystemScanner()
        result = scanner.scan_project(project_path, "proj-1")
        rules = [c for c in result if c.type == ComponentType.RULE]
        assert len(rules) == 1
        assert rules[0].enabled is False
        assert rules[0].name == "style"

    def test_scan_prefers_md_over_disabled(self, tmp_path):
        """SKILL.md와 SKILL.md.disabled 둘 다 있으면 SKILL.md 우선."""
        skill_dir = tmp_path / "project" / ".claude" / "skills" / "both"
        skill_dir.mkdir(parents=True)
        (skill_dir / "SKILL.md").write_text("---\nname: both\n---\n\nActive")
        (skill_dir / "SKILL.md.disabled").write_text("---\nname: both\n---\n\nDisabled")
        scanner = FileSystemScanner()
        result = scanner.scan_project(str(tmp_path / "project"), "proj-1")
        skills = [c for c in result if c.type == ComponentType.SKILL]
        assert len(skills) == 1
        assert skills[0].enabled is True
        assert "SKILL.md" in skills[0].path
        assert "disabled" not in skills[0].path


class TestScanRulesMdc:
    def test_scan_rules_mdc_files(self, tmp_path):
        """.mdc 파일도 rule로 스캔한다."""
        # 헬퍼 함수가 key를 파일 이름으로 사용하므로 확장자 제외한 이름을 key로
        claude_dir = tmp_path / "project-a" / ".claude"
        rules_dir = claude_dir / "rules"
        rules_dir.mkdir(parents=True)
        (rules_dir / "style.md").write_text("---\ndescription: Style MD\n---\n\nMD content")
        (rules_dir / "cursor.mdc").write_text("---\ndescription: Cursor MDC\n---\n\nMDC content")

        scanner = FileSystemScanner()
        result = scanner.scan_project(str(tmp_path / "project-a"), "proj-1")
        rules = [c for c in result if c.type == ComponentType.RULE]
        assert len(rules) == 2
        names = {r.name for r in rules}
        assert names == {"style", "cursor"}


class TestScanCursorrules:
    def test_scan_cursorrules_root(self, tmp_path):
        """CursorAdapter 사용 시 프로젝트 루트의 .cursorrules 파일을 스캔한다."""
        from vibesmith_core.scanning.adapters.cursor import CursorAdapter

        project_dir = tmp_path / "project"
        cursor_dir = project_dir / ".cursor"
        cursor_dir.mkdir(parents=True)
        (project_dir / ".cursorrules").write_text("---\ndescription: Cursor root rules\n---\n\nRoot rules content")
        scanner = FileSystemScanner(adapter=CursorAdapter())
        result = scanner.scan_project(str(project_dir), "proj-1")
        rules = [c for c in result if c.type == ComponentType.RULE]
        assert len(rules) == 1
        assert rules[0].name == "cursorrules"

    def test_claude_code_does_not_scan_cursorrules(self, tmp_path):
        """ClaudeCodeAdapter 사용 시 .cursorrules를 스캔하지 않는다."""
        project_dir = tmp_path / "project"
        claude_dir = project_dir / ".claude"
        claude_dir.mkdir(parents=True)
        (project_dir / ".cursorrules").write_text("# Legacy rules")
        scanner = FileSystemScanner()
        result = scanner.scan_project(str(project_dir), "proj-1")
        rules = [c for c in result if c.type == ComponentType.RULE]
        assert len(rules) == 0


class TestScanProjectAllAdapters:
    def test_scan_all_adapters_returns_components_with_platform(self, tmp_path):
        """scan_project_all_adapters가 platform을 태그한 컴포넌트를 반환한다."""
        project_dir = tmp_path / "mixed-project"
        _setup_claude_dir(project_dir, skills={"s1": "---\nname: s1\n---\n\nBody"})
        _setup_cursor_dir(project_dir, rules={"style.md": "---\ndescription: Style\n---\n\nContent"})
        scanner = FileSystemScanner()
        result = scanner.scan_project_all_adapters(str(project_dir), "proj-1")
        assert len(result) >= 2
        platforms = {c.platform for c in result}
        assert "claude_code" in platforms
        assert "cursor" in platforms

    def test_scan_all_adapters_claude_components_have_claude_code_platform(self, tmp_path):
        """Claude Code 컴포넌트의 platform은 'claude_code'이다."""
        project_dir = tmp_path / "claude-only"
        _setup_claude_dir(project_dir, skills={"s1": "---\nname: s1\n---\n\nBody"})
        scanner = FileSystemScanner()
        result = scanner.scan_project_all_adapters(str(project_dir), "proj-1")
        claude_comps = [c for c in result if c.platform == "claude_code"]
        assert len(claude_comps) >= 1

    def test_scan_all_adapters_cursor_components_have_cursor_platform(self, tmp_path):
        """Cursor 컴포넌트의 platform은 'cursor'이다."""
        project_dir = tmp_path / "cursor-only"
        _setup_cursor_dir(project_dir, rules={"style.md": "---\ndescription: Style\n---\n\nContent"})
        scanner = FileSystemScanner()
        result = scanner.scan_project_all_adapters(str(project_dir), "proj-1")
        cursor_comps = [c for c in result if c.platform == "cursor"]
        assert len(cursor_comps) >= 1

    def test_scan_all_adapters_empty_project(self, tmp_path):
        """빈 프로젝트에서는 빈 리스트를 반환한다."""
        project_dir = tmp_path / "empty"
        project_dir.mkdir()
        scanner = FileSystemScanner()
        result = scanner.scan_project_all_adapters(str(project_dir), "proj-1")
        assert result == []


class TestScanDynamicDispatch:
    def test_scan_project_cursor_includes_skills(self, tmp_path):
        """CursorAdapter 사용 시 skills/rules 디렉토리를 모두 스캔한다."""
        from vibesmith_core.scanning.adapters.cursor import CursorAdapter

        project_dir = tmp_path / "project"
        cursor_dir = project_dir / ".cursor"
        # skills 디렉토리를 .cursor 안에 강제 생성
        skills_dir = cursor_dir / "skills" / "my-skill"
        skills_dir.mkdir(parents=True)
        (skills_dir / "SKILL.md").write_text("---\nname: my-skill\n---\n\nBody")
        # rules도 추가
        rules_dir = cursor_dir / "rules"
        rules_dir.mkdir(parents=True)
        (rules_dir / "style.md").write_text("---\ndescription: Style\n---\n\nContent")

        scanner = FileSystemScanner(adapter=CursorAdapter())
        result = scanner.scan_project(str(project_dir), "proj-1")
        skills = [c for c in result if c.type == ComponentType.SKILL]
        rules = [c for c in result if c.type == ComponentType.RULE]
        assert len(skills) == 1
        assert skills[0].name == "my-skill"
        assert len(rules) == 1

    def test_scan_cursorrules_via_adapter(self, tmp_path):
        """.cursorrules가 get_extra_rules()를 통해 스캔된다."""
        from vibesmith_core.scanning.adapters.cursor import CursorAdapter

        project_dir = tmp_path / "project"
        cursor_dir = project_dir / ".cursor"
        cursor_dir.mkdir(parents=True)
        (project_dir / ".cursorrules").write_text("# Cursor root rules")

        scanner = FileSystemScanner(adapter=CursorAdapter())
        result = scanner.scan_project(str(project_dir), "proj-1")
        rules = [c for c in result if c.type == ComponentType.RULE]
        assert len(rules) == 1
        assert rules[0].name == "cursorrules"
