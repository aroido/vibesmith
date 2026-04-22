"""operations.py 테스트 — CRUD + 토글 + 복사 검증."""

import json
from unittest.mock import Mock

import pytest

from vibesmith_core.components.models import Command, ComponentType, Skill
from vibesmith_core.components.operations import ComponentOperations
from vibesmith_core.infra.db import DatabaseManager
from vibesmith_core.projects import ProjectManager


@pytest.fixture
def db(tmp_path):
    manager = DatabaseManager(str(tmp_path / "test.db"))
    manager.initialize_schema()
    yield manager
    manager.close()


@pytest.fixture
def ops(db):
    return ComponentOperations(db)


def _make_skill(**overrides):
    defaults = {
        "id": "skill-1",
        "name": "test-skill",
        "project_id": "proj-1",
        "path": "/path/to/skill",
        "created_at": "2026-02-10T00:00:00",
        "updated_at": "2026-02-10T00:00:00",
        "platform": "claude_code",
    }
    defaults.update(overrides)
    return Skill(**defaults)


@pytest.fixture
def setup_project(db, tmp_path):
    """DB에 프로젝트를 등록한다. proj-2 경로는 실제 디렉토리로 복사 시 파일 쓰기가 가능하도록 한다."""
    path1 = tmp_path / "proj1"
    path2 = tmp_path / "proj2"
    path1.mkdir()
    path2.mkdir()
    conn = db.get_connection()
    conn.execute(
        "INSERT INTO projects (id, name, path, is_global, component_count, last_scanned_at) VALUES (?, ?, ?, ?, ?, ?)",
        ("proj-1", "test", str(path1), 0, 0, "2026-02-10"),
    )
    conn.execute(
        "INSERT INTO projects (id, name, path, is_global, component_count, last_scanned_at) VALUES (?, ?, ?, ?, ?, ?)",
        ("proj-2", "test2", str(path2), 0, 0, "2026-02-10"),
    )
    conn.commit()


class TestCreate:
    def test_create_component(self, ops, setup_project):
        skill = _make_skill()
        result = ops.create(skill)
        assert result.id == "skill-1"
        assert result.name == "test-skill"

    def test_create_stores_in_db(self, ops, db, setup_project):
        skill = _make_skill()
        ops.create(skill)
        conn = db.get_connection()
        cursor = conn.execute("SELECT * FROM components WHERE id = ?", ("skill-1",))
        assert cursor.fetchone() is not None

    def test_create_stores_frontmatter_as_json(self, ops, db, setup_project):
        skill = _make_skill(frontmatter={"key": "value"})
        ops.create(skill)
        conn = db.get_connection()
        cursor = conn.execute("SELECT frontmatter FROM components WHERE id = ?", ("skill-1",))
        row = cursor.fetchone()
        assert json.loads(row[0]) == {"key": "value"}

    def test_create_stores_tags(self, ops, db, setup_project):
        skill = _make_skill(tags=["python", "review"])
        ops.create(skill)
        conn = db.get_connection()
        cursor = conn.execute("SELECT tag FROM tags WHERE component_id = ? ORDER BY tag", ("skill-1",))
        tags = [r[0] for r in cursor.fetchall()]
        assert tags == ["python", "review"]


class TestRead:
    def test_read_existing(self, ops, setup_project):
        ops.create(_make_skill())
        result = ops.read("skill-1")
        assert result is not None
        assert result.name == "test-skill"
        assert result.type == ComponentType.SKILL

    def test_read_nonexistent(self, ops, setup_project):
        result = ops.read("nonexistent")
        assert result is None

    def test_read_includes_tags(self, ops, setup_project):
        ops.create(_make_skill(tags=["python"]))
        result = ops.read("skill-1")
        assert result.tags == ["python"]


class TestRowToComponent:
    def test_row_to_component_skips_malformed_tag_rows(self, ops):
        """태그 row에 빈 tuple/None이 있어도 IndexError 없이 무시한다."""
        row = (
            "skill-1",
            "skill",
            "test-skill",
            "",
            1,
            "proj-1",
            "/tmp/SKILL.md",
            "body",
            None,
            "2026-02-10T00:00:00Z",
            "2026-02-10T00:00:00Z",
            "claude_code",
            None,
            None,
            "2026-02-10T00:00:00Z",
        )
        tag_cursor = Mock()
        tag_cursor.fetchall.return_value = [(), None, ("python",), ("",)]
        conn = Mock()
        conn.execute.return_value = tag_cursor

        component = ops._row_to_component(row, conn)

        assert component.tags == ["python"]

    def test_row_to_component_short_row_raises_value_error(self, ops):
        """필수 컬럼이 누락된 row는 ValueError로 처리한다."""
        conn = Mock()
        short_row = ("skill-1", "skill")

        with pytest.raises(ValueError, match="missing required component columns"):
            ops._row_to_component(short_row, conn)


class TestUpdate:
    def test_update_fields(self, ops, setup_project):
        ops.create(_make_skill())
        result = ops.update("skill-1", {"description": "Updated desc", "content": "New content"})
        assert result.description == "Updated desc"

    def test_update_persists(self, ops, setup_project):
        ops.create(_make_skill())
        ops.update("skill-1", {"description": "Updated"})
        result = ops.read("skill-1")
        assert result.description == "Updated"

    def test_update_nonexistent_raises(self, ops, setup_project):
        with pytest.raises(ValueError):
            ops.update("nonexistent", {"description": "x"})


class TestDelete:
    def test_delete_component(self, ops, setup_project):
        ops.create(_make_skill())
        ops.delete("skill-1")
        assert ops.read("skill-1") is None
        assert ops.read("skill-1", include_deleted=True) is None

    def test_delete_nonexistent_raises(self, ops, setup_project):
        with pytest.raises(ValueError):
            ops.delete("nonexistent")

    def test_delete_cascades_tags(self, ops, db, setup_project):
        ops.create(_make_skill(tags=["python"]))
        ops.delete("skill-1")
        conn = db.get_connection()
        cursor = conn.execute("SELECT * FROM tags WHERE component_id = ?", ("skill-1",))
        assert cursor.fetchone() is None


class TestSoftDelete:
    """Issue #165: Soft delete, restore, list_trash, cleanup_expired."""

    def test_soft_delete_excludes_from_read(self, ops, setup_project):
        ops.create(_make_skill())
        ops.soft_delete("skill-1")
        assert ops.read("skill-1") is None
        assert ops.read("skill-1", include_deleted=True) is not None

    def test_soft_delete_appears_in_list_trash(self, ops, setup_project):
        ops.create(_make_skill())
        ops.soft_delete("skill-1")
        trash = ops.list_trash()
        assert len(trash) == 1
        assert trash[0].id == "skill-1"

    def test_restore_clears_deleted_at(self, ops, setup_project):
        ops.create(_make_skill())
        ops.soft_delete("skill-1")
        ops.restore("skill-1")
        assert ops.read("skill-1") is not None
        assert ops.list_trash() == []

    def test_list_all_excludes_deleted(self, ops, setup_project):
        ops.create(_make_skill())
        assert len(ops.list_all({})) == 1
        ops.soft_delete("skill-1")
        assert len(ops.list_all({})) == 0

    def test_cleanup_expired_trash_removes_old_items(self, ops, db, setup_project):
        ops.create(_make_skill())
        ops.soft_delete("skill-1")
        conn = db.get_connection()
        # deleted_at을 31일 전으로 설정
        old_date = "2025-01-01T00:00:00Z"
        conn.execute("UPDATE components SET deleted_at = ? WHERE id = ?", (old_date, "skill-1"))
        conn.commit()
        n = ops.cleanup_expired_trash(days=30)
        assert n == 1
        assert ops.read("skill-1", include_deleted=True) is None

    def test_cleanup_expired_trash_keeps_recent(self, ops, db, setup_project):
        ops.create(_make_skill())
        ops.soft_delete("skill-1")
        n = ops.cleanup_expired_trash(days=30)
        assert n == 0
        assert ops.read("skill-1", include_deleted=True) is not None


class TestToggle:
    def test_toggle_disable(self, ops, setup_project):
        ops.create(_make_skill())
        result = ops.toggle("skill-1", enabled=False)
        assert result.enabled is False

    def test_toggle_enable(self, ops, setup_project):
        ops.create(_make_skill(enabled=False))
        result = ops.toggle("skill-1", enabled=True)
        assert result.enabled is True

    def test_toggle_flip(self, ops, setup_project):
        ops.create(_make_skill())
        result = ops.toggle("skill-1")
        assert result.enabled is False
        result = ops.toggle("skill-1")
        assert result.enabled is True

    def test_toggle_disable_renames_file_skill(self, ops, setup_project, tmp_path):
        """비활성화 시 .md → .md.disabled 파일명 변경 (skill)."""
        skill_dir = tmp_path / "proj1" / ".claude" / "skills" / "test-skill"
        skill_dir.mkdir(parents=True)
        skill_file = skill_dir / "SKILL.md"
        skill_file.write_text("---\nname: test-skill\n---\n\nBody")
        path_str = str(skill_file)
        ops.create(_make_skill(path=path_str))
        ops.toggle("skill-1", enabled=False)
        assert not skill_file.exists()
        assert (skill_dir / "SKILL.md.disabled").exists()
        comp = ops.read("skill-1")
        assert comp.path.endswith("SKILL.md.disabled")
        assert comp.enabled is False

    def test_toggle_enable_restores_file_skill(self, ops, setup_project, tmp_path):
        """활성화 시 .md.disabled → .md 파일명 복원 (skill)."""
        skill_dir = tmp_path / "proj1" / ".claude" / "skills" / "test-skill"
        skill_dir.mkdir(parents=True)
        disabled_file = skill_dir / "SKILL.md.disabled"
        disabled_file.write_text("---\nname: test-skill\n---\n\nBody")
        ops.create(_make_skill(path=str(disabled_file), enabled=False))
        ops.toggle("skill-1", enabled=True)
        assert not disabled_file.exists()
        assert (skill_dir / "SKILL.md").exists()
        comp = ops.read("skill-1")
        assert comp.path.endswith("SKILL.md")
        assert comp.enabled is True

    def test_toggle_disable_renames_file_agent(self, ops, setup_project, tmp_path):
        """비활성화 시 파일명 변경 (agent)."""
        from vibesmith_core.components.models import Subagent

        agents_dir = tmp_path / "proj1" / ".claude" / "agents"
        agents_dir.mkdir(parents=True)
        agent_file = agents_dir / "my-agent.md"
        agent_file.write_text("---\nname: my-agent\ntools: Read\n---\n\nPrompt")
        ops.create(
            Subagent(
                id="agent-1",
                name="my-agent",
                project_id="proj-1",
                path=str(agent_file),
                enabled=True,
                created_at="2026-02-10T00:00:00",
                updated_at="2026-02-10T00:00:00",
                platform="claude_code",
            )
        )
        ops.toggle("agent-1", enabled=False)
        assert not agent_file.exists()
        assert (agents_dir / "my-agent.md.disabled").exists()

    def test_toggle_disable_renames_file_command(self, ops, setup_project, tmp_path):
        """비활성화 시 파일명 변경 (command)."""
        from vibesmith_core.components.models import Command

        cmd_dir = tmp_path / "proj1" / ".claude" / "commands"
        cmd_dir.mkdir(parents=True)
        cmd_file = cmd_dir / "check.md"
        cmd_file.write_text("Run checks.")
        ops.create(
            Command(
                id="cmd-1",
                name="check",
                project_id="proj-1",
                path=str(cmd_file),
                content="Run checks.",
                enabled=True,
                created_at="2026-02-10T00:00:00",
                updated_at="2026-02-10T00:00:00",
                platform="claude_code",
            )
        )
        ops.toggle("cmd-1", enabled=False)
        assert not cmd_file.exists()
        assert (cmd_dir / "check.md.disabled").exists()

    def test_toggle_disable_renames_file_rule(self, ops, setup_project, tmp_path):
        """비활성화 시 파일명 변경 (rule)."""
        from vibesmith_core.components.models import Rule

        rules_dir = tmp_path / "proj1" / ".claude" / "rules"
        rules_dir.mkdir(parents=True)
        rule_file = rules_dir / "style.md"
        rule_file.write_text("---\ndescription: Style\n---\n\nUse ruff.")
        ops.create(
            Rule(
                id="rule-1",
                name="style",
                project_id="proj-1",
                path=str(rule_file),
                enabled=True,
                created_at="2026-02-10T00:00:00",
                updated_at="2026-02-10T00:00:00",
                platform="claude_code",
            )
        )
        ops.toggle("rule-1", enabled=False)
        assert not rule_file.exists()
        assert (rules_dir / "style.md.disabled").exists()

    def test_toggle_hook_db_only(self, ops, setup_project, tmp_path):
        """hook은 settings.json에 있어 DB만 변경한다."""
        from vibesmith_core.components.models import Hook

        settings_path = tmp_path / "proj1" / ".claude" / "settings.json"
        settings_path.parent.mkdir(parents=True, exist_ok=True)
        settings_path.write_text("{}")
        ops.create(
            Hook(
                id="hook-1",
                name="PostToolUse",
                project_id="proj-1",
                path=str(settings_path),
                enabled=True,
                created_at="2026-02-10T00:00:00",
                updated_at="2026-02-10T00:00:00",
                platform="claude_code",
            )
        )
        result = ops.toggle("hook-1", enabled=False)
        assert result.enabled is False
        # path는 변경되지 않음, settings.json 파일 그대로
        assert settings_path.exists()
        assert "settings.json" in result.path

    def test_toggle_file_missing_db_only(self, ops, setup_project):
        """파일이 없으면 DB만 업데이트 (하위 호환)."""
        ops.create(_make_skill(path="/nonexistent/path/SKILL.md"))
        result = ops.toggle("skill-1", enabled=False)
        assert result.enabled is False
        assert result.path == "/nonexistent/path/SKILL.md"


class TestCopy:
    def test_copy_to_another_project(self, ops, setup_project):
        ops.create(_make_skill())
        new_ids = ops.copy("skill-1", "proj-2")
        assert len(new_ids) == 1
        copied = ops.read(new_ids[0])
        assert copied is not None
        assert copied.project_id == "proj-2"
        assert copied.name == "test-skill"

    def test_copy_preserves_tags(self, ops, setup_project):
        ops.create(_make_skill(tags=["python", "review"]))
        new_ids = ops.copy("skill-1", "proj-2")
        copied = ops.read(new_ids[0])
        assert set(copied.tags) == {"python", "review"}

    def test_copy_creates_file_on_disk(self, ops, setup_project, tmp_path):
        """복사 시 대상 프로젝트 .claude/{type}s/{name}/ 경로에 파일이 생성되는지 검증."""
        ops.create(_make_skill(content="# Test", frontmatter={"name": "test-skill"}))
        new_ids = ops.copy("skill-1", "proj-2")
        assert len(new_ids) == 1
        # proj-2 경로는 setup_project에서 tmp_path/proj2
        skill_file = tmp_path / "proj2" / ".claude" / "skills" / "test-skill" / "SKILL.md"
        assert skill_file.exists()
        assert "Test" in skill_file.read_text()

    def test_copy_nonexistent_component_raises(self, ops, setup_project):
        with pytest.raises(ValueError, match="Component .* not found"):
            ops.copy("nonexistent", "proj-2")

    def test_copy_nonexistent_target_raises(self, ops, setup_project):
        ops.create(_make_skill())
        with pytest.raises(ValueError, match="Target project .* not found"):
            ops.copy("skill-1", "proj-nonexistent")

    def test_copy_invalid_name_raises(self, ops, setup_project):
        ops.create(_make_skill(name="../../../etc/passwd"))
        with pytest.raises(ValueError, match="Invalid component name"):
            ops.copy("skill-1", "proj-2")

    def test_copy_cursor_component_uses_cursor_path(self, ops, setup_project, tmp_path):
        """Issue #309: cursor 컴포넌트 복사 시 .cursor 경로로 생성."""
        # Cursor skill 생성
        skill = _make_skill(name="cursor-skill", platform="cursor")
        ops.create(skill)

        # proj-2로 복사 (setup_project에서 이미 생성됨)
        new_ids = ops.copy("skill-1", "proj-2")
        copied = ops.read(new_ids[0])

        # .cursor 경로로 생성되었는지 확인
        assert ".cursor" in copied.path or copied.path.startswith("/skills/")
        assert ".claude" not in copied.path

        # 실제 파일이 .cursor 디렉토리에 생성되었는지 확인
        expected_file = tmp_path / "proj2" / ".cursor" / "skills" / "cursor-skill" / "SKILL.md"
        assert expected_file.exists()

    def test_copy_cursor_rule_uses_mdc_extension(self, ops, setup_project, tmp_path):
        """Issue #309: cursor rule 복사 시 .mdc 확장자 사용."""
        from vibesmith_core.components.models import Rule

        # Cursor rule 생성
        rule = Rule(
            id="rule-1",
            name="cursor-rule",
            description="Test",
            enabled=True,
            tags=[],
            project_id="proj-1",
            path="/rules/cursor-rule.mdc",
            content="# Rule content",
            frontmatter=None,
            created_at="2026-01-01T00:00:00Z",
            updated_at="2026-01-01T00:00:00Z",
            platform="cursor",
        )
        ops.create(rule)

        # proj-2로 복사
        new_ids = ops.copy("rule-1", "proj-2")
        copied = ops.read(new_ids[0])

        # .mdc 확장자로 생성되었는지 확인
        assert copied.path.endswith(".mdc")

        # 실제 파일이 .mdc로 생성되었는지 확인
        expected_file = tmp_path / "proj2" / ".cursor" / "rules" / "cursor-rule.mdc"
        assert expected_file.exists()


class TestCopyWithDeps:
    """copy(include_deps=True) 테스트 — 종속 컴포넌트 함께 복사."""

    def test_copy_with_include_deps_copies_dependencies(self, ops, db, setup_project):
        """include_deps=True 시 소스의 종속 대상도 함께 복사된다."""
        # 컴포넌트 2개 생성
        ops.create(_make_skill(id="skill-1", name="parent-skill"))
        ops.create(_make_skill(id="skill-2", name="child-skill"))

        # skill-1 → skill-2 종속성 등록
        conn = db.get_connection()
        conn.execute(
            "INSERT INTO dependencies (source_id, target_id, dep_type) VALUES (?, ?, ?)",
            ("skill-1", "skill-2", "context"),
        )
        conn.commit()

        # include_deps=True로 복사
        new_ids = ops.copy("skill-1", "proj-2", include_deps=True)

        # parent + child 총 2개 복사되어야 함
        assert len(new_ids) >= 2
        copied_names = {ops.read(nid).name for nid in new_ids}
        assert "parent-skill" in copied_names
        assert "child-skill" in copied_names
        # 모두 proj-2에 속해야 함
        for nid in new_ids:
            assert ops.read(nid).project_id == "proj-2"

    def test_copy_with_include_deps_skips_already_existing(self, ops, db, setup_project):
        """대상 프로젝트에 이미 같은 이름의 컴포넌트가 있으면 스킵한다."""
        ops.create(_make_skill(id="skill-1", name="parent-skill"))
        ops.create(_make_skill(id="skill-2", name="child-skill"))
        # child-skill을 proj-2에 미리 복사해 둠
        ops.copy("skill-2", "proj-2")

        # 종속성 등록
        conn = db.get_connection()
        conn.execute(
            "INSERT INTO dependencies (source_id, target_id, dep_type) VALUES (?, ?, ?)",
            ("skill-1", "skill-2", "context"),
        )
        conn.commit()

        # include_deps=True로 복사 → child-skill 중복은 스킵
        new_ids = ops.copy("skill-1", "proj-2", include_deps=True)
        # parent만 새로 복사 (child는 이미 있으므로 스킵)
        assert len(new_ids) == 1
        assert ops.read(new_ids[0]).name == "parent-skill"

    def test_copy_with_include_deps_no_deps(self, ops, setup_project):
        """종속성이 없는 컴포넌트를 include_deps=True로 복사해도 정상 동작."""
        ops.create(_make_skill())
        new_ids = ops.copy("skill-1", "proj-2", include_deps=True)
        assert len(new_ids) == 1


class TestPlatformCRUD:
    def test_create_stores_platform(self, ops, db, setup_project):
        """create()가 platform을 DB에 저장한다."""
        skill = _make_skill(platform="cursor")
        ops.create(skill)
        conn = db.get_connection()
        cursor = conn.execute("SELECT platform FROM components WHERE id = ?", ("skill-1",))
        assert cursor.fetchone()[0] == "cursor"

    def test_create_explicit_platform(self, ops, db, setup_project):
        """명시적 platform 값이 DB에 저장된다."""
        skill = _make_skill(platform="claude_code")
        ops.create(skill)
        conn = db.get_connection()
        cursor = conn.execute("SELECT platform FROM components WHERE id = ?", ("skill-1",))
        assert cursor.fetchone()[0] == "claude_code"

    def test_read_includes_platform(self, ops, setup_project):
        """read()가 platform 필드를 포함한다."""
        ops.create(_make_skill(platform="cursor"))
        result = ops.read("skill-1")
        assert result.platform == "cursor"

    def test_list_filter_by_platform(self, ops, setup_project):
        """list_all(filters={"platform": "cursor"})가 해당 platform만 반환한다."""
        ops.create(_make_skill(id="s1", name="skill-a", platform="claude_code"))
        ops.create(_make_skill(id="s2", name="skill-b", platform="cursor"))
        result = ops.list_all(filters={"platform": "cursor"})
        assert len(result) == 1
        assert result[0].platform == "cursor"


class TestListAll:
    def test_list_all(self, ops, setup_project):
        ops.create(_make_skill(id="s1", name="skill-a"))
        ops.create(_make_skill(id="s2", name="skill-b"))
        result = ops.list_all()
        assert len(result) == 2

    def test_list_filter_by_type(self, ops, setup_project):
        ops.create(_make_skill(id="s1", name="skill-a"))
        result = ops.list_all(filters={"type": "skill"})
        assert len(result) == 1

    def test_list_filter_by_project(self, ops, setup_project):
        ops.create(_make_skill(id="s1", name="skill-a", project_id="proj-1"))
        ops.create(_make_skill(id="s2", name="skill-b", project_id="proj-2"))
        result = ops.list_all(filters={"project_id": "proj-1"})
        assert len(result) == 1
        assert result[0].project_id == "proj-1"

    def test_list_filter_by_enabled(self, ops, setup_project):
        ops.create(_make_skill(id="s1", name="skill-a", enabled=True))
        ops.create(_make_skill(id="s2", name="skill-b", enabled=False))
        result = ops.list_all(filters={"enabled": True})
        assert len(result) == 1
        assert result[0].id == "s1"

    def test_list_empty(self, ops, setup_project):
        result = ops.list_all()
        assert result == []

    def test_list_all_skips_invalid_rows(self, ops, setup_project, monkeypatch):
        """비정상 row가 있어도 전체 목록 조회는 실패하지 않고 유효 row만 반환한다."""
        ops.create(_make_skill(id="s1", name="skill-a"))
        ops.create(_make_skill(id="s2", name="skill-b"))

        original = ops._row_to_component

        def flaky_row_parser(row, conn):
            if row[0] == "s1":
                raise ValueError("missing required component columns")
            return original(row, conn)

        monkeypatch.setattr(ops, "_row_to_component", flaky_row_parser)

        result = ops.list_all()

        assert len(result) == 1
        assert result[0].id == "s2"


class TestListAllWithProject:
    """list_all_with_project() N+1 쿼리 최적화 테스트 (Issue #40)."""

    def test_returns_components_with_project_names(self, ops, setup_project, tmp_path):
        """컴포넌트와 프로젝트 이름을 함께 반환한다."""
        # 2개 프로젝트 생성
        from vibesmith_core.projects import ProjectManager

        pm = ProjectManager(ops._db)
        p1 = pm.add_project(str(tmp_path / "project-one"))
        p2 = pm.add_project(str(tmp_path / "project-two"))

        # 각 프로젝트에 컴포넌트 생성
        ops.create(_make_skill(id="s1", name="skill-a", project_id=p1.id))
        ops.create(_make_skill(id="s2", name="skill-b", project_id=p2.id))

        result = ops.list_all_with_project()

        assert len(result) == 2
        # (ComponentBase, project_name) 튜플
        assert all(isinstance(r, tuple) and len(r) == 2 for r in result)
        assert all(isinstance(r[1], str) for r in result)

        # project_name 매칭 확인
        names_by_id = {r[0].id: r[1] for r in result}
        assert names_by_id["s1"] == p1.name
        assert names_by_id["s2"] == p2.name

    def test_filters_by_type(self, ops, setup_project, tmp_path):
        """type 필터가 정상 작동한다."""
        pm = ProjectManager(ops._db)
        p1 = pm.add_project(str(tmp_path / "proj"))

        ops.create(_make_skill(id="s1", project_id=p1.id))
        ops.create(
            Command(
                id="c1",
                type=ComponentType.COMMAND,
                name="cmd",
                description="",
                command="echo",
                enabled=True,
                project_id=p1.id,
                path="/tmp/cmd",
                created_at="2026-01-01T00:00:00Z",
                updated_at="2026-01-01T00:00:00Z",
                platform="claude_code",
            )
        )

        result = ops.list_all_with_project(filters={"type": "skill"})
        assert len(result) == 1
        assert result[0][0].id == "s1"

    def test_filters_by_project_id(self, ops, setup_project, tmp_path):
        """project_id 필터가 정상 작동한다."""
        pm = ProjectManager(ops._db)
        proj1_path = tmp_path / "test-proj1"
        proj2_path = tmp_path / "test-proj2"
        proj1_path.mkdir()
        proj2_path.mkdir()
        p1 = pm.add_project(str(proj1_path))
        p2 = pm.add_project(str(proj2_path))

        ops.create(_make_skill(id="s1", project_id=p1.id))
        ops.create(_make_skill(id="s2", project_id=p2.id))

        result = ops.list_all_with_project(filters={"project_id": p1.id})
        assert len(result) == 1
        assert result[0][0].project_id == p1.id

    def test_empty_result(self, ops, setup_project):
        """컴포넌트가 없으면 빈 리스트를 반환한다."""
        result = ops.list_all_with_project()
        assert result == []

    def test_logs_query_time(self, ops, setup_project, tmp_path, capsys):
        """쿼리 실행 시간을 로깅한다."""
        pm = ProjectManager(ops._db)
        test_proj = tmp_path / "test-log-proj"
        test_proj.mkdir()
        p1 = pm.add_project(str(test_proj))
        ops.create(_make_skill(id="s1", project_id=p1.id))

        ops.list_all_with_project()

        # structlog 로그는 stdout에 출력됨
        captured = capsys.readouterr()
        assert "list_all_with_project" in captured.out or "db_query" in captured.out
