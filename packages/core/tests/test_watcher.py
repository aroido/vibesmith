"""watcher.py 테스트 — 파일 변경 감지 검증."""

import time
from unittest.mock import MagicMock

import pytest

from vibesmith_core.infra.watcher import FileWatcher


@pytest.fixture
def watcher():
    """짧은 디바운스 시간의 FileWatcher."""
    w = FileWatcher(debounce_seconds=0.15)
    yield w
    w.stop()


@pytest.fixture
def project_dir(tmp_path):
    """감시 대상 프로젝트 디렉토리 (.claude/ 및 컴포넌트 하위 디렉토리 포함)."""
    claude_dir = tmp_path / "project-a" / ".claude"
    claude_dir.mkdir(parents=True)
    (claude_dir / "skills").mkdir()
    (claude_dir / "rules").mkdir()
    return tmp_path / "project-a"


class TestStartStop:
    def test_start_and_stop(self, watcher, project_dir):
        """FileWatcher를 시작하고 정지할 수 있다."""
        watcher.watch("proj-1", str(project_dir / ".claude"))
        watcher.start()
        assert watcher.is_running
        watcher.stop()
        assert not watcher.is_running

    def test_stop_without_start(self, watcher):
        """시작하지 않은 상태에서 stop 호출해도 에러 없다."""
        watcher.stop()
        assert not watcher.is_running

    def test_double_start(self, watcher, project_dir):
        """이미 실행 중일 때 start를 다시 호출해도 에러 없다."""
        watcher.watch("proj-1", str(project_dir / ".claude"))
        watcher.start()
        watcher.start()
        assert watcher.is_running


class TestFileDetection:
    def test_callback_on_file_created(self, watcher, project_dir):
        """컴포넌트 파일 생성 시 콜백이 호출된다."""
        callback = MagicMock()
        watcher.on_change(callback)
        watcher.watch("proj-1", str(project_dir / ".claude"))
        watcher.start()
        time.sleep(0.1)

        (project_dir / ".claude" / "skills" / "new-skill").mkdir()
        (project_dir / ".claude" / "skills" / "new-skill" / "SKILL.md").write_text("test")
        time.sleep(0.5)

        callback.assert_called()
        args = callback.call_args[0]
        assert args[0] == "proj-1"

    def test_callback_on_file_modified(self, watcher, project_dir):
        """컴포넌트 파일 수정 시 콜백이 호출된다."""
        target = project_dir / ".claude" / "rules" / "test-rule.md"
        target.write_text("original")

        callback = MagicMock()
        watcher.on_change(callback)
        watcher.watch("proj-1", str(project_dir / ".claude"))
        watcher.start()
        time.sleep(0.1)

        target.write_text("modified")
        time.sleep(0.5)

        callback.assert_called()

    def test_callback_on_file_deleted(self, watcher, project_dir):
        """컴포넌트 파일 삭제 시 콜백이 호출된다."""
        target = project_dir / ".claude" / "rules" / "to-delete.md"
        target.write_text("will be deleted")

        callback = MagicMock()
        watcher.on_change(callback)
        watcher.watch("proj-1", str(project_dir / ".claude"))
        watcher.start()
        time.sleep(0.1)

        target.unlink()
        time.sleep(0.5)

        callback.assert_called()

    def test_ignores_non_component_files(self, watcher, project_dir):
        """컴포넌트와 무관한 파일 변경은 무시한다."""
        callback = MagicMock()
        watcher.on_change(callback)
        watcher.watch("proj-1", str(project_dir / ".claude"))
        watcher.start()
        time.sleep(0.1)

        # debug, history 등 비컴포넌트 파일
        (project_dir / ".claude" / "history.jsonl").write_text("log")
        (project_dir / ".claude" / "debug").mkdir(exist_ok=True)
        (project_dir / ".claude" / "debug" / "session.txt").write_text("debug")
        time.sleep(0.5)

        callback.assert_not_called()

    def test_settings_json_triggers_callback(self, watcher, project_dir):
        """settings.json 변경 시 콜백이 호출된다 (hooks 감지)."""
        target = project_dir / ".claude" / "settings.json"
        target.write_text("{}")

        callback = MagicMock()
        watcher.on_change(callback)
        watcher.watch("proj-1", str(project_dir / ".claude"))
        watcher.start()
        time.sleep(0.1)

        target.write_text('{"hooks": {}}')
        time.sleep(0.5)

        callback.assert_called()


class TestDebounce:
    def test_debounce_aggregates_events(self, watcher, project_dir):
        """디바운스 윈도우 내 다수 이벤트는 한 번만 콜백된다."""
        callback = MagicMock()
        watcher.on_change(callback)
        watcher.watch("proj-1", str(project_dir / ".claude"))
        watcher.start()
        time.sleep(0.1)

        # 빠르게 여러 파일 생성
        for i in range(5):
            (project_dir / ".claude" / "rules" / f"rule_{i}.md").write_text(f"content {i}")
            time.sleep(0.02)

        # 디바운스 완료 대기
        time.sleep(0.5)

        # 디바운스로 인해 5회가 아닌 1~2회만 호출되어야 함
        assert callback.call_count <= 2


class TestMultiProject:
    def test_watches_multiple_projects(self, watcher, tmp_path):
        """여러 프로젝트를 동시에 감시할 수 있다."""
        proj_a = tmp_path / "proj-a" / ".claude"
        proj_b = tmp_path / "proj-b" / ".claude"
        (proj_a / "rules").mkdir(parents=True)
        (proj_b / "rules").mkdir(parents=True)

        callback = MagicMock()
        watcher.on_change(callback)
        watcher.watch("id-a", str(proj_a))
        watcher.watch("id-b", str(proj_b))
        watcher.start()
        time.sleep(0.1)

        (proj_a / "rules" / "test.md").write_text("a")
        time.sleep(0.5)
        (proj_b / "rules" / "test.md").write_text("b")
        time.sleep(0.5)

        project_ids = {call[0][0] for call in callback.call_args_list}
        assert "id-a" in project_ids
        assert "id-b" in project_ids

    def test_callback_receives_correct_project_id(self, watcher, tmp_path):
        """콜백에 올바른 project_id가 전달된다."""
        proj_dir = tmp_path / "my-proj" / ".claude"
        (proj_dir / "commands").mkdir(parents=True)

        callback = MagicMock()
        watcher.on_change(callback)
        watcher.watch("my-proj-id", str(proj_dir))
        watcher.start()
        time.sleep(0.1)

        (proj_dir / "commands" / "new.md").write_text("hello")
        time.sleep(0.5)

        callback.assert_called()
        assert callback.call_args[0][0] == "my-proj-id"


class TestUnwatch:
    def test_unwatch_stops_monitoring(self, watcher, project_dir):
        """unwatch 후 해당 경로의 이벤트가 무시된다."""
        callback = MagicMock()
        watcher.on_change(callback)
        watcher.watch("proj-1", str(project_dir / ".claude"))
        watcher.start()
        time.sleep(0.1)

        watcher.unwatch("proj-1")
        time.sleep(0.1)

        (project_dir / ".claude" / "rules" / "after-unwatch.md").write_text("ignored")
        time.sleep(0.5)

        callback.assert_not_called()

    def test_unwatch_nonexistent_is_noop(self, watcher):
        """존재하지 않는 project_id를 unwatch해도 에러 없다."""
        watcher.unwatch("nonexistent")
