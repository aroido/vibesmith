"""rescan 자동 복원 테스트 — 휴지통과 동일 이름의 파일이 디스크에 재생성되면 자동 undelete."""

import pytest

from vibesmith_core import VibeSmithCore


@pytest.fixture
def core(tmp_path):
    db_path = tmp_path / "vibesmith.db"
    home_path = tmp_path / "home"
    home_path.mkdir()
    c = VibeSmithCore(db_path=str(db_path), global_path=str(home_path))
    c.initialize()
    yield c
    c.close()


@pytest.fixture
def project_with_trashed_agent(core, tmp_path):
    """휴지통에 asd 에이전트가 들어 있는 프로젝트 셋업."""
    project_dir = tmp_path / "proj"
    agents_dir = project_dir / ".claude" / "agents"
    agents_dir.mkdir(parents=True)

    agent_file = agents_dir / "asd.md"
    agent_file.write_text("---\nname: asd\ndescription: original\n---\nfirst\n")

    project = core.projects.add_project(str(project_dir))
    core.projects.rescan(project.id)

    agents = core.operations.list_all({"project_id": project.id, "type": "agent"})
    assert len(agents) == 1
    trashed_id = agents[0].id

    core.operations.soft_delete(trashed_id)

    trashed = core.operations.list_trash()
    assert any(c.id == trashed_id for c in trashed), "초기 조건: asd가 휴지통에 있어야 함"

    return project, agents_dir, trashed_id


class TestAutoRestoreOnRescan:
    def test_recreating_file_with_same_name_restores_from_trash(self, core, project_with_trashed_agent):
        """휴지통에 있던 이름으로 파일을 다시 만들면 자동 복원되어 UI에 나타난다."""
        project, agents_dir, trashed_id = project_with_trashed_agent

        # 사용자가 같은 경로/이름에 다시 파일 생성 (내용은 다를 수 있음)
        (agents_dir / "asd.md").write_text(
            "---\nname: asd\ndescription: brand new\n---\nsecond\n"
        )
        core.projects.rescan(project.id)

        active = core.operations.list_all({"project_id": project.id, "type": "agent"})
        assert len(active) == 1, f"자동 복원 실패: {active}"
        assert active[0].name == "asd"
        assert active[0].description == "brand new"
        assert active[0].id == trashed_id, "원본 레코드가 복원되어야 함 (새 INSERT 아님)"

        trash = [c for c in core.operations.list_trash() if c.id == trashed_id]
        assert trash == [], "복원 후 휴지통에서 사라져야 함"

    def test_restored_component_path_reflects_new_location(self, core, project_with_trashed_agent):
        """복원된 컴포넌트의 path는 디스크의 현재 경로를 반영해야 한다 (original_path NULL)."""
        project, agents_dir, trashed_id = project_with_trashed_agent

        new_path = agents_dir / "asd.md"
        new_path.write_text("---\nname: asd\n---\nrevived\n")
        core.projects.rescan(project.id)

        restored = core.operations.read(trashed_id)
        assert restored is not None
        assert restored.path == str(new_path)

        conn = core.db.get_connection()
        row = conn.execute(
            "SELECT deleted_at, original_path FROM components WHERE id = ?", (trashed_id,)
        ).fetchone()
        assert row[0] is None, f"deleted_at must be NULL after restore: {row[0]}"
        assert row[1] is None, f"original_path must be NULL after restore: {row[1]}"

    def test_trashed_item_without_matching_file_stays_trashed(self, core, project_with_trashed_agent):
        """디스크에 해당 파일이 없으면 휴지통 상태 그대로 유지."""
        project, agents_dir, trashed_id = project_with_trashed_agent

        # 다른 이름의 파일을 만들어도 asd는 여전히 휴지통에 있어야 함
        (agents_dir / "unrelated.md").write_text("---\nname: unrelated\n---\nbody\n")
        core.projects.rescan(project.id)

        trash = core.operations.list_trash()
        assert any(c.id == trashed_id for c in trash), (
            "unrelated 파일 추가는 asd의 휴지통 상태에 영향 주지 말아야 함"
        )
