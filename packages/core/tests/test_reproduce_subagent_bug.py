"""재현 테스트 — IntelliJ/vi atomic save 중 rescan으로 인한 subagent soft_delete 버그.

증상: 사용자가 IntelliJ 또는 vi로 .claude/agents/xxx.md 를 저장하면
- watchdog 이벤트: created → modified → deleted → created ... (atomic write 패턴)
- 이 중 "deleted" 이후 "created" 전 타이밍에 rescan이 실행되면
  스캐너 결과에 파일이 없음 → rescan step 4에서 soft_delete → 휴지통 이동
- 파일이 다시 나타나도 rescan은 "deleted_at IS NOT NULL" 브랜치를 타서
  trashed 상태를 유지함 → UI에서 영원히 안 보임.
"""

import time
from unittest.mock import MagicMock

import pytest

from vibesmith_core import VibeSmithCore
from vibesmith_core.infra.watcher import FileWatcher


@pytest.fixture
def watcher():
    w = FileWatcher(debounce_seconds=0.15)
    yield w
    w.stop()


@pytest.fixture
def core(tmp_path):
    db_path = tmp_path / "vibesmith.db"
    home_path = tmp_path / "home"
    home_path.mkdir()
    c = VibeSmithCore(db_path=str(db_path), global_path=str(home_path))
    c.initialize()
    yield c
    c.close()


class TestBaseline:
    """정상 동작 확인 — 순차적으로 파일 생성 시."""

    def test_simple_create_detected(self, watcher, tmp_path):
        project_dir = tmp_path / "proj"
        agents_dir = project_dir / ".claude" / "agents"
        agents_dir.mkdir(parents=True)

        callback = MagicMock()
        watcher.on_change(callback)
        watcher.watch("proj-1", str(project_dir / ".claude"))
        watcher.start()
        time.sleep(0.1)

        (agents_dir / "plain.md").write_text(
            "---\nname: plain\ndescription: t\n---\nbody\n"
        )
        time.sleep(0.5)

        callback.assert_called()


class TestAtomicSaveRace:
    """IntelliJ/vi atomic save 중 rescan 레이스 재현."""

    def test_scan_miss_but_file_still_on_disk_skips_soft_delete(self, core, tmp_path):
        """scanner가 파일을 놓쳤지만(race) 실제 디스크엔 파일이 있을 때 soft_delete 되면 안 됨.

        IntelliJ/vi atomic save 도중 scanner가 순간적으로 파일을 못 본 상황을 모사하기 위해
        scan_project_all_adapters를 빈 결과로 mock한다. 디스크엔 파일이 그대로 있다.
        """
        from unittest.mock import patch

        project_dir = tmp_path / "proj"
        agents_dir = project_dir / ".claude" / "agents"
        agents_dir.mkdir(parents=True)

        agent_file = agents_dir / "asd.md"
        agent_file.write_text("---\nname: asd\ndescription: first\n---\nhello\n")

        project = core.projects.add_project(str(project_dir))
        core.projects.rescan(project.id)

        initial = core.operations.list_all({"project_id": project.id, "type": "agent"})
        assert len(initial) == 1, f"초기 스캔은 성공해야 함: {initial}"

        # atomic save 도중의 race: scanner는 빈 결과 반환. 파일은 디스크에 여전히 존재.
        with patch.object(core.projects._scanner, "scan_project_all_adapters", return_value=[]):
            core.projects.rescan(project.id)

        agents = core.operations.list_all({"project_id": project.id, "type": "agent"})
        assert len(agents) == 1, (
            f"race 방어 실패: scanner가 파일을 놓쳤지만 디스크엔 존재하므로 soft_delete 하지 "
            f"말아야 함. agents={agents}"
        )
        assert agents[0].name == "asd"

    def test_real_deletion_still_triggers_soft_delete(self, core, tmp_path):
        """회귀 방지: 파일이 실제로 사라졌으면 soft_delete는 그대로 수행되어야 함."""
        project_dir = tmp_path / "proj"
        agents_dir = project_dir / ".claude" / "agents"
        agents_dir.mkdir(parents=True)

        agent_file = agents_dir / "bye.md"
        agent_file.write_text("---\nname: bye\n---\nbody\n")

        project = core.projects.add_project(str(project_dir))
        core.projects.rescan(project.id)
        assert len(core.operations.list_all({"project_id": project.id, "type": "agent"})) == 1

        # 사용자가 실제로 파일 삭제
        agent_file.unlink()
        core.projects.rescan(project.id)

        agents = core.operations.list_all({"project_id": project.id, "type": "agent"})
        assert agents == [], f"실제 삭제 시 soft_delete 가 동작해야 함: {agents}"

    def test_live_editor_pattern_with_watcher(self, core, watcher, tmp_path):
        """live 상황: watcher 콜백으로 rescan이 debounce되어 실행.
        atomic save 시 unlink + write가 debounce 윈도우 내에 들어오면 정상 처리되는지 확인.
        """
        project_dir = tmp_path / "proj"
        agents_dir = project_dir / ".claude" / "agents"
        agents_dir.mkdir(parents=True)

        def _on_change(project_id: str):
            core.projects.rescan(project_id)

        project = core.projects.add_project(str(project_dir))
        watcher.on_change(_on_change)
        watcher.watch(project.id, str(project_dir / ".claude"))
        watcher.start()
        time.sleep(0.1)

        # IntelliJ safe-write 모사 (tmp + rename)
        target = agents_dir / "asd.md"
        tmp = agents_dir / "asd.md___jb_tmp___"
        tmp.write_text("---\nname: asd\ndescription: fresh\n---\nhello\n")
        tmp.rename(target)

        # 콜백 debounce 완료까지 대기
        time.sleep(1.0)

        agents = core.operations.list_all({"project_id": project.id, "type": "agent"})
        assert len(agents) == 1, f"atomic rename 후 에이전트가 보이지 않음: {agents}"
        assert agents[0].name == "asd"

    def test_vim_swap_file_cycle(self, core, watcher, tmp_path):
        """vim save 사이클 모사: .swp 생성 → .md 작성 → .swp 삭제."""
        project_dir = tmp_path / "proj"
        agents_dir = project_dir / ".claude" / "agents"
        agents_dir.mkdir(parents=True)

        def _on_change(project_id: str):
            core.projects.rescan(project_id)

        project = core.projects.add_project(str(project_dir))
        watcher.on_change(_on_change)
        watcher.watch(project.id, str(project_dir / ".claude"))
        watcher.start()
        time.sleep(0.1)

        # 1. vim 시작: .zxc.md.swp (hidden swap) 생성
        swap = agents_dir / ".zxc.md.swp"
        swap.write_bytes(b"vim swap content")
        time.sleep(0.05)

        # 2. 사용자 저장: zxc.md 작성
        target = agents_dir / "zxc.md"
        target.write_text("---\nname: zxc\ndescription: via vim\n---\nbody\n")
        time.sleep(0.05)

        # 3. vim 종료: swap 삭제
        swap.unlink()

        # debounce + rescan 완료 대기
        time.sleep(1.0)

        agents = core.operations.list_all({"project_id": project.id, "type": "agent"})
        assert len(agents) == 1, f"vim 저장 후 zxc 에이전트가 보이지 않음: {agents}"
        assert agents[0].name == "zxc"

    def test_rapid_create_delete_recreate_during_debounce(self, core, watcher, tmp_path):
        """빠른 create → delete → create 사이클 (IntelliJ가 swap 파일로 자주 발생)."""
        project_dir = tmp_path / "proj"
        agents_dir = project_dir / ".claude" / "agents"
        agents_dir.mkdir(parents=True)

        def _on_change(project_id: str):
            core.projects.rescan(project_id)

        project = core.projects.add_project(str(project_dir))
        watcher.on_change(_on_change)
        watcher.watch(project.id, str(project_dir / ".claude"))
        watcher.start()
        time.sleep(0.1)

        target = agents_dir / "asd.md"

        # 첫 번째 저장
        target.write_text("---\nname: asd\ndescription: v1\n---\nhello\n")
        time.sleep(0.25)  # 첫 번째 debounce rescan 완료

        # IntelliJ 두 번째 저장: 원본 delete → tmp rename (타이밍 레이스)
        target.unlink()
        # 이 순간 debounce 타이머가 리셋되지만 다음 rescan은 unlink 후 write 전에 실행될 수도
        time.sleep(0.16)  # debounce_seconds(0.15) 직후 → rescan 실행 (파일 없음!)
        target.write_text("---\nname: asd\ndescription: v2\n---\nhello v2\n")

        # 최종 rescan 완료까지 대기
        time.sleep(1.0)

        agents = core.operations.list_all({"project_id": project.id, "type": "agent"})
        assert len(agents) == 1, (
            f"BUG 재현 (live): atomic delete/recreate 중 debounce window 깨짐 → 휴지통 이동. "
            f"agents={agents}"
        )
