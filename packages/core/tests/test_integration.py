"""통합 테스트 — VibeSmithCore Facade 검증."""

import json

from vibesmith_core import VibeSmithCore
from vibesmith_core.scanning.adapters.cursor import CursorAdapter


def _setup_project(tmp_path):
    """테스트용 프로젝트 구조 생성."""
    project_dir = tmp_path / "my-project"
    claude_dir = project_dir / ".claude"

    # Skill
    skill_dir = claude_dir / "skills" / "tdd"
    skill_dir.mkdir(parents=True)
    (skill_dir / "SKILL.md").write_text("---\nname: tdd\ndescription: TDD skill\n---\n\n# TDD Workflow")

    # Agent
    agents_dir = claude_dir / "agents"
    agents_dir.mkdir(parents=True)
    (agents_dir / "reviewer.md").write_text("---\nname: reviewer\ntools: Read, Glob\n---\n\n# Review Agent")

    # Command
    cmd_dir = claude_dir / "commands"
    cmd_dir.mkdir(parents=True)
    (cmd_dir / "check.md").write_text("Run ruff check and report.")

    # Rule
    rules_dir = claude_dir / "rules"
    rules_dir.mkdir(parents=True)
    (rules_dir / "style.md").write_text("---\ndescription: Style guide\n---\n\nUse ruff.")

    # Hooks
    (claude_dir / "settings.json").write_text(
        json.dumps(
            {"hooks": {"PostToolUse": [{"matcher": "Write", "hooks": [{"type": "command", "command": "ruff format"}]}]}}
        )
    )

    return str(project_dir)


class TestVibeSmithCoreInit:
    def test_initialize(self, tmp_path):
        core = VibeSmithCore(db_path=str(tmp_path / "test.db"))
        core.initialize()
        assert core.db is not None

    def test_close(self, tmp_path):
        core = VibeSmithCore(db_path=str(tmp_path / "test.db"))
        core.initialize()
        core.close()


class TestGlobalProject:
    def test_initialize_registers_global(self, tmp_path):
        """initialize 시 글로벌 프로젝트가 자동 등록된다."""
        global_home = tmp_path / "fake-home"
        (global_home / ".claude" / "skills" / "g1").mkdir(parents=True)
        (global_home / ".claude" / "skills" / "g1" / "SKILL.md").write_text("---\nname: g1\n---\n\nGlobal")
        core = VibeSmithCore(db_path=str(tmp_path / "test.db"), global_path=str(global_home))
        core.initialize()
        projects = core.projects.list_all()
        global_projects = [p for p in projects if p.is_global]
        assert len(global_projects) == 1
        assert global_projects[0].component_count >= 1


class TestScanAndQuery:
    def test_add_project_and_scan(self, tmp_path):
        project_path = _setup_project(tmp_path)
        core = VibeSmithCore(db_path=str(tmp_path / "test.db"))
        core.initialize()
        project = core.projects.add_project(project_path)
        result = core.projects.rescan(project.id)
        assert result["component_count"] == 5  # skill, agent, command, rule, hook

    def test_list_components_by_type(self, tmp_path):
        project_path = _setup_project(tmp_path)
        core = VibeSmithCore(db_path=str(tmp_path / "test.db"))
        core.initialize()
        project = core.projects.add_project(project_path)
        core.projects.rescan(project.id)
        skills = core.operations.list_all(filters={"type": "skill"})
        assert len(skills) == 1
        assert skills[0].name == "tdd"

    def test_toggle_component(self, tmp_path):
        project_path = _setup_project(tmp_path)
        core = VibeSmithCore(db_path=str(tmp_path / "test.db"))
        core.initialize()
        project = core.projects.add_project(project_path)
        core.projects.rescan(project.id)
        components = core.operations.list_all()
        comp = components[0]
        toggled = core.operations.toggle(comp.id, enabled=False)
        assert toggled.enabled is False

    def test_tag_and_search(self, tmp_path):
        project_path = _setup_project(tmp_path)
        core = VibeSmithCore(db_path=str(tmp_path / "test.db"))
        core.initialize()
        project = core.projects.add_project(project_path)
        core.projects.rescan(project.id)
        skills = core.operations.list_all(filters={"type": "skill"})
        core.tags.add_tag(skills[0].id, "python")
        found = core.tags.search_by_tags(["python"])
        assert skills[0].id in found

    def test_version_and_rollback(self, tmp_path):
        project_path = _setup_project(tmp_path)
        core = VibeSmithCore(db_path=str(tmp_path / "test.db"))
        core.initialize()
        project = core.projects.add_project(project_path)
        core.projects.rescan(project.id)
        skills = core.operations.list_all(filters={"type": "skill"})
        skill_id = skills[0].id
        core.versions.save_version(skill_id, skills[0].content)
        core.operations.update(skill_id, {"content": "# Modified"})
        core.versions.rollback(skill_id, 1)
        restored = core.operations.read(skill_id)
        assert "TDD Workflow" in restored.content

    def test_dependency_analysis_stub(self, tmp_path):
        """종속성 분석은 현재 stub — 빈 결과를 반환한다."""
        project_dir = tmp_path / "dep-test"
        claude_dir = project_dir / ".claude"
        skills_dir = claude_dir / "skills"

        s1_dir = skills_dir / "base"
        s1_dir.mkdir(parents=True)
        (s1_dir / "SKILL.md").write_text("---\nname: base\n---\n\n# Base")

        s2_dir = skills_dir / "advanced"
        s2_dir.mkdir(parents=True)
        (s2_dir / "SKILL.md").write_text("---\nname: advanced\ncontext: skills/base/SKILL.md\n---\n\n# Advanced")

        core = VibeSmithCore(db_path=str(tmp_path / "test.db"))
        core.initialize()
        project = core.projects.add_project(str(project_dir))
        core.projects.rescan(project.id)
        components = core.operations.list_all()
        deps = core.analyze_dependencies(components)

        # advanced 스킬이 base 스킬을 context로 참조
        assert len(deps) == 1
        assert deps[0].dep_type.value == "context"


class TestCursorIntegration:
    """Cursor IDE 지원 통합 테스트."""

    def test_cursor_e2e(self, tmp_path):
        """CursorAdapter로 .cursor 프로젝트를 스캔하고 DB에 저장한다."""
        project_dir = tmp_path / "cursor-project"
        cursor_dir = project_dir / ".cursor"
        rules_dir = cursor_dir / "rules"
        rules_dir.mkdir(parents=True)
        (rules_dir / "style.mdc").write_text("---\ndescription: Style guide\nalwaysApply: true\n---\n\nUse prettier.")
        (rules_dir / "frontend.mdc").write_text(
            '---\ndescription: Frontend rules\nglobs: "*.tsx,*.ts"\n---\n\nReact best practices.'
        )

        core = VibeSmithCore(db_path=str(tmp_path / "test.db"), adapter=CursorAdapter())
        core.initialize()
        project = core.projects.add_project(str(project_dir))
        result = core.projects.rescan(project.id)
        assert result["component_count"] == 2

        rules = core.operations.list_all(filters={"type": "rule"})
        assert len(rules) == 2
        names = {r.name for r in rules}
        assert names == {"style", "frontend"}

    def test_adapter_injection(self, tmp_path):
        """VibeSmithCore(adapter=CursorAdapter())로 adapter가 올바르게 주입된다."""
        project_dir = tmp_path / "inject-test"
        cursor_dir = project_dir / ".cursor" / "rules"
        cursor_dir.mkdir(parents=True)
        (cursor_dir / "rule.md").write_text("---\ndescription: Test\n---\n\nBody")

        core = VibeSmithCore(db_path=str(tmp_path / "test.db"), adapter=CursorAdapter())
        core.initialize()
        project = core.projects.add_project(str(project_dir))
        result = core.projects.rescan(project.id)
        assert result["component_count"] == 1

    def test_cursor_global_none(self, tmp_path):
        """CursorAdapter 사용 시 글로벌 프로젝트가 생성되지 않는다."""
        core = VibeSmithCore(db_path=str(tmp_path / "test.db"), adapter=CursorAdapter())
        core.initialize()
        projects = core.projects.list_all()
        global_projects = [p for p in projects if p.is_global]
        assert len(global_projects) == 0

    def test_cursorrules_and_mdc_coexist(self, tmp_path):
        """프로젝트 루트의 .cursorrules와 .cursor/rules/*.mdc가 함께 스캔된다."""
        project_dir = tmp_path / "mixed-project"
        cursor_dir = project_dir / ".cursor" / "rules"
        cursor_dir.mkdir(parents=True)
        (cursor_dir / "always.mdc").write_text("---\nname: always-rule\nalwaysApply: true\n---\n\nAlways apply this.")
        (project_dir / ".cursorrules").write_text("# Legacy cursor rules\n\nUse consistent style.")

        core = VibeSmithCore(db_path=str(tmp_path / "test.db"), adapter=CursorAdapter())
        core.initialize()
        project = core.projects.add_project(str(project_dir))
        result = core.projects.rescan(project.id)
        assert result["component_count"] == 2

        rules = core.operations.list_all(filters={"type": "rule"})
        names = {r.name for r in rules}
        assert "always-rule" in names
        assert "cursorrules" in names
