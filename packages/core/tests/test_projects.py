"""projects.py 테스트 — 프로젝트 관리 검증."""

import pytest

from vibesmith_core.infra.db import DatabaseManager
from vibesmith_core.projects import ProjectManager


@pytest.fixture
def db(tmp_path):
    manager = DatabaseManager(str(tmp_path / "test.db"))
    manager.initialize_schema()
    yield manager
    manager.close()


@pytest.fixture
def pm(db):
    return ProjectManager(db)


class TestAddProject:
    def test_add_project(self, pm, tmp_path):
        claude_dir = tmp_path / "my-project" / ".claude"
        claude_dir.mkdir(parents=True)
        project = pm.add_project(str(tmp_path / "my-project"))
        assert project.name == "my-project"
        assert project.path == str(tmp_path / "my-project")
        assert project.id is not None

    def test_add_project_stores_in_db(self, pm, db, tmp_path):
        claude_dir = tmp_path / "my-project" / ".claude"
        claude_dir.mkdir(parents=True)
        project = pm.add_project(str(tmp_path / "my-project"))
        conn = db.get_connection()
        cursor = conn.execute("SELECT * FROM projects WHERE id = ?", (project.id,))
        assert cursor.fetchone() is not None

    def test_add_project_last_scanned_at_empty(self, pm, tmp_path):
        """Issue #336: add_project는 스캔을 수행하지 않으므로 last_scanned_at는 빈 문자열(미스캔)이다."""
        (tmp_path / "my-project" / ".claude").mkdir(parents=True)
        project = pm.add_project(str(tmp_path / "my-project"))
        assert project.last_scanned_at == ""

    def test_add_duplicate_path_raises(self, pm, tmp_path):
        claude_dir = tmp_path / "my-project" / ".claude"
        claude_dir.mkdir(parents=True)
        pm.add_project(str(tmp_path / "my-project"))
        with pytest.raises(ValueError):
            pm.add_project(str(tmp_path / "my-project"))


class TestListAll:
    def test_list_empty(self, pm):
        projects = pm.list_all()
        assert projects == []

    def test_list_after_add(self, pm, tmp_path):
        (tmp_path / "p1" / ".claude").mkdir(parents=True)
        (tmp_path / "p2" / ".claude").mkdir(parents=True)
        pm.add_project(str(tmp_path / "p1"))
        pm.add_project(str(tmp_path / "p2"))
        projects = pm.list_all()
        assert len(projects) == 2


class TestGet:
    def test_get_existing(self, pm, tmp_path):
        (tmp_path / "proj" / ".claude").mkdir(parents=True)
        project = pm.add_project(str(tmp_path / "proj"))
        result = pm.get(project.id)
        assert result is not None
        assert result.name == "proj"

    def test_get_nonexistent(self, pm):
        result = pm.get("nonexistent")
        assert result is None


class TestRemoveProject:
    def test_remove_project(self, pm, tmp_path):
        (tmp_path / "proj" / ".claude").mkdir(parents=True)
        project = pm.add_project(str(tmp_path / "proj"))
        pm.remove_project(project.id)
        assert pm.get(project.id) is None

    def test_remove_nonexistent_raises(self, pm):
        with pytest.raises(ValueError):
            pm.remove_project("nonexistent")


class TestEnsureGlobalProject:
    def test_creates_global_project(self, pm, tmp_path):
        """글로벌 .claude/ 디렉토리가 있으면 is_global=True 프로젝트를 등록한다."""
        global_home = tmp_path / "fake-home"
        claude_dir = global_home / ".claude"
        claude_dir.mkdir(parents=True)
        project = pm.ensure_global_project(str(global_home))
        assert project.is_global is True
        assert project.name == "global"

    def test_idempotent(self, pm, tmp_path):
        """두 번 호출해도 동일한 프로젝트를 반환한다."""
        global_home = tmp_path / "fake-home"
        (global_home / ".claude").mkdir(parents=True)
        p1 = pm.ensure_global_project(str(global_home))
        p2 = pm.ensure_global_project(str(global_home))
        assert p1.id == p2.id

    def test_scans_global_components(self, pm, db, tmp_path):
        """글로벌 프로젝트 등록 시 구성요소도 스캔한다."""
        global_home = tmp_path / "fake-home"
        skills_dir = global_home / ".claude" / "skills" / "global-skill"
        skills_dir.mkdir(parents=True)
        (skills_dir / "SKILL.md").write_text("---\nname: global-skill\n---\n\nGlobal body")
        project = pm.ensure_global_project(str(global_home))
        assert project.component_count >= 1

    def test_no_claude_dir_still_registers(self, pm, tmp_path):
        """~/.claude/가 없어도 글로벌 프로젝트는 등록된다 (구성요소 0개)."""
        global_home = tmp_path / "fake-home"
        global_home.mkdir(parents=True)
        project = pm.ensure_global_project(str(global_home))
        assert project.is_global is True
        assert project.component_count == 0


class TestHideProject:
    """프로젝트 숨기기 검증."""

    def test_hide_project_sets_hidden_at(self, pm, db, tmp_path):
        """hide 후 hidden_at이 ISO 타임스탬프로 설정된다."""
        (tmp_path / "proj" / ".claude").mkdir(parents=True)
        project = pm.add_project(str(tmp_path / "proj"))
        result = pm.hide_project(project.id)
        assert result.hidden_at is not None

    def test_hide_project_not_found_raises(self, pm):
        """없는 프로젝트 ID에 ValueError."""
        with pytest.raises(ValueError):
            pm.hide_project("nonexistent")

    def test_hide_global_project_raises(self, pm, tmp_path):
        """글로벌 프로젝트는 숨기기 금지."""
        (tmp_path / "home" / ".claude").mkdir(parents=True)
        global_proj = pm.ensure_global_project(str(tmp_path / "home"))
        with pytest.raises(ValueError, match="global"):
            pm.hide_project(global_proj.id)


class TestUnhideProject:
    """프로젝트 숨김 해제 검증."""

    def test_unhide_project_clears_hidden_at(self, pm, tmp_path):
        """unhide 후 hidden_at이 None."""
        (tmp_path / "proj" / ".claude").mkdir(parents=True)
        project = pm.add_project(str(tmp_path / "proj"))
        pm.hide_project(project.id)
        result = pm.unhide_project(project.id)
        assert result.hidden_at is None

    def test_unhide_nonexistent_raises(self, pm):
        """없는 프로젝트 ID에 ValueError."""
        with pytest.raises(ValueError):
            pm.unhide_project("nonexistent")


class TestListAllFilter:
    """list_all의 include_hidden 필터 검증."""

    def test_list_all_excludes_hidden_by_default(self, pm, tmp_path):
        """숨긴 프로젝트는 기본 목록에 미포함."""
        (tmp_path / "p1" / ".claude").mkdir(parents=True)
        (tmp_path / "p2" / ".claude").mkdir(parents=True)
        pm.add_project(str(tmp_path / "p1"))
        p2 = pm.add_project(str(tmp_path / "p2"))
        pm.hide_project(p2.id)
        projects = pm.list_all()
        assert len(projects) == 1
        assert projects[0].name == "p1"

    def test_list_all_include_hidden_returns_all(self, pm, tmp_path):
        """include_hidden=True면 숨긴 프로젝트도 포함."""
        (tmp_path / "p1" / ".claude").mkdir(parents=True)
        (tmp_path / "p2" / ".claude").mkdir(parents=True)
        pm.add_project(str(tmp_path / "p1"))
        p2 = pm.add_project(str(tmp_path / "p2"))
        pm.hide_project(p2.id)
        projects = pm.list_all(include_hidden=True)
        assert len(projects) == 2


class TestRescanHiddenGuard:
    """숨긴 프로젝트 rescan 차단 검증."""

    def test_rescan_hidden_project_raises(self, pm, tmp_path):
        """숨긴 프로젝트에 rescan 시 ValueError."""
        (tmp_path / "proj" / ".claude").mkdir(parents=True)
        project = pm.add_project(str(tmp_path / "proj"))
        pm.hide_project(project.id)
        with pytest.raises(ValueError, match="hidden"):
            pm.rescan(project.id)


class TestRescan:
    def test_rescan_project(self, pm, tmp_path):
        project_dir = tmp_path / "proj"
        claude_dir = project_dir / ".claude"
        skills_dir = claude_dir / "skills" / "my-skill"
        skills_dir.mkdir(parents=True)
        (skills_dir / "SKILL.md").write_text("---\nname: my-skill\n---\n\nBody")
        project = pm.add_project(str(project_dir))
        result = pm.rescan(project.id)
        assert result["component_count"] > 0

    def test_rescan_updates_component_count(self, pm, db, tmp_path):
        project_dir = tmp_path / "proj"
        claude_dir = project_dir / ".claude"
        skills_dir = claude_dir / "skills" / "s1"
        skills_dir.mkdir(parents=True)
        (skills_dir / "SKILL.md").write_text("---\nname: s1\n---\n\nBody")
        project = pm.add_project(str(project_dir))
        pm.rescan(project.id)
        updated = pm.get(project.id)
        assert updated.component_count >= 1


class TestRescanPreserve:
    """rescan() 컴포넌트 보존 방식 검증 (#188)."""

    def _setup_project_with_skill(self, pm, tmp_path, skill_name="my-skill", body="Body"):
        """프로젝트와 스킬 1개를 생성하고 초기 스캔한다."""
        project_dir = tmp_path / "proj"
        claude_dir = project_dir / ".claude"
        skills_dir = claude_dir / "skills" / skill_name
        skills_dir.mkdir(parents=True)
        (skills_dir / "SKILL.md").write_text(f"---\nname: {skill_name}\n---\n\n{body}")
        project = pm.add_project(str(project_dir))
        pm.rescan(project.id)
        return project, project_dir

    def test_rescan_preserves_component_id(self, pm, db, tmp_path):
        """재스캔 시 기존 컴포넌트의 ID가 유지된다."""
        project, project_dir = self._setup_project_with_skill(pm, tmp_path)
        conn = db.get_connection()
        old_id = conn.execute("SELECT id FROM components WHERE project_id = ?", (project.id,)).fetchone()[0]

        # 재스캔
        pm.rescan(project.id)

        new_id = conn.execute("SELECT id FROM components WHERE project_id = ?", (project.id,)).fetchone()[0]
        assert old_id == new_id

    def test_rescan_updates_changed_content(self, pm, db, tmp_path):
        """파일 내용이 변경되면 content가 UPDATE된다."""
        project, project_dir = self._setup_project_with_skill(pm, tmp_path)
        conn = db.get_connection()
        old_row = conn.execute("SELECT id, content FROM components WHERE project_id = ?", (project.id,)).fetchone()
        old_id, old_content = old_row

        # 파일 내용 변경
        skill_file = project_dir / ".claude" / "skills" / "my-skill" / "SKILL.md"
        skill_file.write_text("---\nname: my-skill\n---\n\nUpdated Body")

        pm.rescan(project.id)

        new_row = conn.execute("SELECT id, content FROM components WHERE project_id = ?", (project.id,)).fetchone()
        assert new_row[0] == old_id  # ID 유지
        assert "Updated Body" in new_row[1]  # 내용 갱신

    def test_rescan_inserts_new_components(self, pm, db, tmp_path):
        """새로 발견된 컴포넌트가 INSERT된다."""
        project, project_dir = self._setup_project_with_skill(pm, tmp_path)
        conn = db.get_connection()
        count_before = conn.execute("SELECT COUNT(*) FROM components WHERE project_id = ?", (project.id,)).fetchone()[0]

        # 새 스킬 추가
        new_skill_dir = project_dir / ".claude" / "skills" / "new-skill"
        new_skill_dir.mkdir(parents=True)
        (new_skill_dir / "SKILL.md").write_text("---\nname: new-skill\n---\n\nNew")

        pm.rescan(project.id)

        count_after = conn.execute("SELECT COUNT(*) FROM components WHERE project_id = ?", (project.id,)).fetchone()[0]
        assert count_after == count_before + 1

    def test_rescan_softdeletes_missing_active_components(self, pm, db, tmp_path):
        """파일이 사라진 활성 컴포넌트는 soft delete(숨김 전환)된다."""
        project, project_dir = self._setup_project_with_skill(pm, tmp_path)
        conn = db.get_connection()
        comp_id = conn.execute("SELECT id FROM components WHERE project_id = ?", (project.id,)).fetchone()[0]

        # 스킬 파일 삭제
        import shutil

        shutil.rmtree(project_dir / ".claude" / "skills" / "my-skill")

        pm.rescan(project.id)

        row = conn.execute("SELECT id, deleted_at FROM components WHERE id = ?", (comp_id,)).fetchone()
        assert row is not None, "soft delete여야 하므로 DB에 남아있어야 한다"
        assert row[1] is not None, "deleted_at이 설정되어야 한다"

    def test_rescan_softdeletes_missing_disabled_components(self, pm, db, tmp_path):
        """enabled=false 컴포넌트도 파일이 사라지면 soft delete된다."""
        project, project_dir = self._setup_project_with_skill(pm, tmp_path)
        conn = db.get_connection()
        comp_id = conn.execute("SELECT id FROM components WHERE project_id = ?", (project.id,)).fetchone()[0]

        # 토글 OFF
        conn.execute("UPDATE components SET enabled = 0 WHERE project_id = ?", (project.id,))
        conn.commit()

        # 스킬 파일 삭제
        import shutil

        shutil.rmtree(project_dir / ".claude" / "skills" / "my-skill")

        pm.rescan(project.id)

        row = conn.execute("SELECT id, deleted_at FROM components WHERE id = ?", (comp_id,)).fetchone()
        assert row is not None, "soft delete여야 하므로 DB에 남아있어야 한다"
        assert row[1] is not None, "deleted_at이 설정되어야 한다"

    def test_rescan_preserves_enabled_state(self, pm, db, tmp_path):
        """재스캔 시 기존 enabled 상태가 보존된다."""
        project, project_dir = self._setup_project_with_skill(pm, tmp_path)
        conn = db.get_connection()

        # 토글 OFF
        conn.execute("UPDATE components SET enabled = 0 WHERE project_id = ?", (project.id,))
        conn.commit()

        # 재스캔 (파일은 여전히 존재)
        pm.rescan(project.id)

        enabled = conn.execute("SELECT enabled FROM components WHERE project_id = ?", (project.id,)).fetchone()[0]
        assert enabled == 0  # enabled=false 상태 유지

    def test_rescan_preserves_trashed_missing_components(self, pm, db, tmp_path):
        """파일이 없고 이미 숨김(deleted_at) 상태인 컴포넌트는 rescan에서 건드리지 않는다."""
        project, project_dir = self._setup_project_with_skill(pm, tmp_path)
        conn = db.get_connection()
        comp_id = conn.execute("SELECT id FROM components WHERE project_id = ?", (project.id,)).fetchone()[0]

        # soft delete 처리 (숨김 상태로 전환)
        from vibesmith_core.components.operations import ComponentOperations

        ops = ComponentOperations(db)
        ops.soft_delete(comp_id)

        # 스킬 파일은 이미 _trash로 이동됨 — 원본 위치에 파일 없음
        # rescan 시 "파일 없음 + 숨김" → 건드리지 않음 (휴지통 보존)
        pm.rescan(project.id)

        row = conn.execute("SELECT id, deleted_at FROM components WHERE id = ?", (comp_id,)).fetchone()
        assert row is not None, "휴지통 항목은 rescan에서 보존되어야 한다"
        assert row[1] is not None, "deleted_at이 유지되어야 한다"

    def test_rescan_updates_hidden_component_metadata(self, pm, db, tmp_path):
        """파일이 다시 생성된 숨김 컴포넌트는 메타데이터만 업데이트하고 숨김 상태를 유지한다."""
        project, project_dir = self._setup_project_with_skill(pm, tmp_path)
        conn = db.get_connection()
        comp_id = conn.execute("SELECT id FROM components WHERE project_id = ?", (project.id,)).fetchone()[0]

        # soft delete 처리
        from vibesmith_core.components.operations import ComponentOperations

        ops = ComponentOperations(db)
        ops.soft_delete(comp_id)

        # 같은 이름으로 파일 다시 생성 (디스크에 파일 있음 + DB에 숨김)
        skill_dir = project_dir / ".claude" / "skills" / "my-skill"
        skill_dir.mkdir(parents=True, exist_ok=True)
        (skill_dir / "SKILL.md").write_text("---\nname: my-skill\n---\n\nUpdated content after recreation")

        pm.rescan(project.id)

        row = conn.execute("SELECT id, deleted_at, content FROM components WHERE id = ?", (comp_id,)).fetchone()
        assert row is not None, "숨김 컴포넌트가 DB에 남아있어야 한다"
        assert row[1] is not None, "deleted_at이 유지되어야 한다 (숨김 상태 유지)"
        assert "Updated content after recreation" in row[2], "메타데이터가 업데이트되어야 한다"

    def test_rescan_hidden_component_updates_content_but_preserves_trash_path(self, pm, db, tmp_path):
        """숨김 컴포넌트의 content는 업데이트하되 path(_trash 경로)는 유지된다."""
        project, project_dir = self._setup_project_with_skill(pm, tmp_path)
        conn = db.get_connection()
        comp_id = conn.execute("SELECT id FROM components WHERE project_id = ?", (project.id,)).fetchone()[0]

        # soft delete 처리
        from vibesmith_core.components.operations import ComponentOperations

        ops = ComponentOperations(db)
        ops.soft_delete(comp_id)

        # trash path 기록
        trash_path = conn.execute("SELECT path FROM components WHERE id = ?", (comp_id,)).fetchone()[0]
        assert "_trash" in trash_path

        # 같은 이름으로 파일 다시 생성
        skill_dir = project_dir / ".claude" / "skills" / "my-skill"
        skill_dir.mkdir(parents=True, exist_ok=True)
        (skill_dir / "SKILL.md").write_text("---\nname: my-skill\n---\n\nRecreated content")

        pm.rescan(project.id)

        row = conn.execute("SELECT path, content FROM components WHERE id = ?", (comp_id,)).fetchone()
        assert "_trash" in row[0], "trash path가 유지되어야 한다"
        assert "Recreated content" in row[1], "content는 업데이트되어야 한다"

    def _setup_project_with_agent(self, pm, tmp_path, file_stem="1", name_field=None):
        """프로젝트와 에이전트 1개를 생성하고 초기 스캔한다."""
        project_dir = tmp_path / "proj"
        agents_dir = project_dir / ".claude" / "agents"
        agents_dir.mkdir(parents=True)
        agent_file = agents_dir / f"{file_stem}.md"
        if name_field is None:
            agent_file.write_text("# Body\n")
        else:
            agent_file.write_text(f"---\nname: {name_field}\n---\n\n# Body\n")
        project = pm.add_project(str(project_dir))
        pm.rescan(project.id)
        return project, project_dir, agent_file

    def test_rescan_frontmatter_name_change_keeps_file_at_original_path(self, pm, db, tmp_path):
        """파일명은 그대로이고 frontmatter의 name만 바뀔 때 파일이 _trash로 이동하지 않는다."""
        project, project_dir, agent_file = self._setup_project_with_agent(pm, tmp_path, file_stem="1")

        # 파일 내용만 교체 — 파일명은 그대로, frontmatter name은 "zxc"로 다름
        agent_file.write_text("---\nname: zxc\ndescription: desc\n---\n\n# Body\n")

        pm.rescan(project.id)

        assert agent_file.exists(), "파일명을 유지했는데 원본 위치에서 파일이 사라지면 안 된다"
        trash_dir = project_dir / ".claude" / "_trash"
        if trash_dir.exists():
            assert not any(trash_dir.rglob("1.md")), "원본 파일이 _trash로 이동되면 안 된다"

    def test_rescan_frontmatter_name_change_updates_component_not_trashes(self, pm, db, tmp_path):
        """파일명 유지 + frontmatter name 변경 시 기존 컴포넌트가 UPDATE되고 trash 항목이 생기지 않는다."""
        project, project_dir, agent_file = self._setup_project_with_agent(pm, tmp_path, file_stem="1")
        conn = db.get_connection()
        old_id = conn.execute(
            "SELECT id FROM components WHERE project_id = ? AND type = 'agent'",
            (project.id,),
        ).fetchone()[0]

        agent_file.write_text("---\nname: zxc\ndescription: desc\n---\n\n# Body\n")

        pm.rescan(project.id)

        rows = conn.execute(
            "SELECT id, name, deleted_at FROM components WHERE project_id = ? AND type = 'agent'",
            (project.id,),
        ).fetchall()
        active = [r for r in rows if r[2] is None]
        trashed = [r for r in rows if r[2] is not None]

        assert len(active) == 1, f"활성 컴포넌트는 하나여야 한다. got: {rows}"
        assert len(trashed) == 0, f"trash 항목이 생기면 안 된다. got: {trashed}"
        assert active[0][0] == old_id, "기존 컴포넌트 ID가 유지되어야 한다 (UPDATE 처리)"
        assert active[0][1] == "zxc", "name이 새 값으로 업데이트되어야 한다"

    def test_rescan_preserves_tags(self, pm, db, tmp_path):
        """재스캔 시 기존 태그가 유실되지 않는다."""
        project, project_dir = self._setup_project_with_skill(pm, tmp_path)
        conn = db.get_connection()
        comp_id = conn.execute("SELECT id FROM components WHERE project_id = ?", (project.id,)).fetchone()[0]

        # 태그 추가
        conn.execute("INSERT INTO tags (component_id, tag) VALUES (?, ?)", (comp_id, "custom-tag"))
        conn.commit()

        pm.rescan(project.id)

        tags = conn.execute("SELECT tag FROM tags WHERE component_id = ?", (comp_id,)).fetchall()
        tag_names = [t[0] for t in tags]
        assert "custom-tag" in tag_names

    def test_rescan_only_updates_changed_component_timestamp(self, pm, db, tmp_path):
        """변경된 룰만 updated_at이 갱신되고, 나머지는 유지된다."""
        project_dir = tmp_path / "proj"
        rules_dir = project_dir / ".claude" / "rules"
        rules_dir.mkdir(parents=True)
        (rules_dir / "rule-a.md").write_text("# Rule A original")
        (rules_dir / "rule-b.md").write_text("# Rule B original")
        project = pm.add_project(str(project_dir))
        pm.rescan(project.id)

        conn = db.get_connection()
        rows = conn.execute(
            "SELECT name, updated_at FROM components WHERE project_id = ? ORDER BY name",
            (project.id,),
        ).fetchall()
        ts = {row[0]: row[1] for row in rows}
        assert "rule-a" in ts
        assert "rule-b" in ts

        # rule-a만 변경
        (rules_dir / "rule-a.md").write_text("# Rule A modified")

        pm.rescan(project.id)

        rows_after = conn.execute(
            "SELECT name, updated_at FROM components WHERE project_id = ? ORDER BY name",
            (project.id,),
        ).fetchall()
        ts_after = {row[0]: row[1] for row in rows_after}

        assert ts_after["rule-a"] != ts["rule-a"]  # 변경됨 → 시간 갱신
        assert ts_after["rule-b"] == ts["rule-b"]  # 미변경 → 시간 유지


class TestRescanMtimeUpdate:
    """Issue #494: rescan시 파일 mtime이 변경되면 updated_at을 갱신한다."""

    def _setup_project_with_rule(self, pm, tmp_path, name="test-rule", content="# Rule"):
        """프로젝트와 룰 1개를 생성하고 초기 스캔한다."""
        project_dir = tmp_path / "proj"
        rules_dir = project_dir / ".claude" / "rules"
        rules_dir.mkdir(parents=True)
        rule_file = rules_dir / f"{name}.md"
        rule_file.write_text(content)
        project = pm.add_project(str(project_dir))
        pm.rescan(project.id)
        return project, project_dir, rule_file

    def test_rescan_updates_updated_at_when_mtime_changes(self, pm, db, tmp_path):
        """파일 내용은 동일하지만 mtime이 변경되면 updated_at이 갱신된다."""
        import os
        from datetime import UTC, datetime

        project, project_dir, rule_file = self._setup_project_with_rule(pm, tmp_path)
        conn = db.get_connection()

        old_updated_at = conn.execute(
            "SELECT updated_at FROM components WHERE project_id = ?",
            (project.id,),
        ).fetchone()[0]

        # mtime만 변경 (내용은 동일)
        new_ts = datetime(2026, 6, 15, 12, 0, 0, tzinfo=UTC).timestamp()
        os.utime(str(rule_file), (new_ts, new_ts))

        pm.rescan(project.id)

        new_updated_at = conn.execute(
            "SELECT updated_at FROM components WHERE project_id = ?",
            (project.id,),
        ).fetchone()[0]

        assert new_updated_at != old_updated_at, "mtime 변경 시 updated_at도 갱신되어야 함"
        parsed = datetime.fromisoformat(new_updated_at)
        assert parsed.year == 2026
        assert parsed.month == 6

    def test_rescan_no_update_when_mtime_and_content_unchanged(self, pm, db, tmp_path):
        """파일 mtime과 내용이 모두 동일하면 updated_at이 변경되지 않는다."""
        project, project_dir, rule_file = self._setup_project_with_rule(pm, tmp_path)
        conn = db.get_connection()

        old_updated_at = conn.execute(
            "SELECT updated_at FROM components WHERE project_id = ?",
            (project.id,),
        ).fetchone()[0]

        # 아무것도 변경하지 않고 재스캔
        pm.rescan(project.id)

        new_updated_at = conn.execute(
            "SELECT updated_at FROM components WHERE project_id = ?",
            (project.id,),
        ).fetchone()[0]

        assert new_updated_at == old_updated_at, "변경 없으면 updated_at 유지"

    def test_rescan_mtime_update_with_multiple_components(self, pm, db, tmp_path):
        """여러 컴포넌트 중 mtime이 변경된 것만 updated_at이 갱신된다."""
        import os
        from datetime import UTC, datetime

        project_dir = tmp_path / "proj"
        rules_dir = project_dir / ".claude" / "rules"
        rules_dir.mkdir(parents=True)

        file_a = rules_dir / "rule-a.md"
        file_b = rules_dir / "rule-b.md"
        file_a.write_text("# Rule A")
        file_b.write_text("# Rule B")

        project = pm.add_project(str(project_dir))
        pm.rescan(project.id)

        conn = db.get_connection()
        rows = conn.execute(
            "SELECT name, updated_at FROM components WHERE project_id = ? ORDER BY name",
            (project.id,),
        ).fetchall()
        ts = {row[0]: row[1] for row in rows}

        # rule-a만 mtime 변경 (내용 동일)
        new_ts = datetime(2026, 12, 25, 0, 0, 0, tzinfo=UTC).timestamp()
        os.utime(str(file_a), (new_ts, new_ts))

        pm.rescan(project.id)

        rows_after = conn.execute(
            "SELECT name, updated_at FROM components WHERE project_id = ? ORDER BY name",
            (project.id,),
        ).fetchall()
        ts_after = {row[0]: row[1] for row in rows_after}

        assert ts_after["rule-a"] != ts["rule-a"], "mtime 변경된 rule-a는 갱신"
        assert ts_after["rule-b"] == ts["rule-b"], "mtime 미변경 rule-b는 유지"
