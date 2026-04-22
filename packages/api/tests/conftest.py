"""테스트 픽스처 — TestClient + 임시 DB로 코어를 격리한다."""

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from vibesmith_core import VibeSmithCore
from vibesmith_core.infra.scan_progress import ScanProgressRegistry
from vibesmith_core.infra.watcher import FileWatcher

from vibesmith_api.config import set_config_path
from vibesmith_api.deps import enable_threadsafe_db, get_core, get_scan_registry, get_usage_scanner, get_watcher
from vibesmith_api.main import app


@pytest.fixture(autouse=True)
def _isolate_config(tmp_path: Path):
    """테스트마다 config.json을 임시 경로로 격리한다."""
    original = Path("~/.vibesmith/config.json").expanduser()
    test_config = tmp_path / "config.json"
    set_config_path(test_config)
    yield
    set_config_path(original)


@pytest.fixture(autouse=True)
def _enable_test_mode():
    """Issue #303: 테스트 모드 환경 변수 설정으로 lifespan 자동 초기화 비활성화."""
    os.environ["VIBESMITH_TEST_MODE"] = "1"
    yield
    os.environ.pop("VIBESMITH_TEST_MODE", None)


@pytest.fixture()
def core(tmp_path: Path):
    """임시 DB와 fake home으로 격리된 코어 인스턴스."""
    db_path = str(tmp_path / "test.db")
    fake_home = tmp_path / "fake_home" / ".claude"
    fake_home.mkdir(parents=True)
    c = VibeSmithCore(db_path=db_path, global_path=str(fake_home))
    c.initialize()
    enable_threadsafe_db(c)
    yield c
    c.close()


@pytest.fixture()
def watcher():
    """시작하지 않은 FileWatcher 인스턴스."""
    return FileWatcher()


@pytest.fixture()
def usage_scanner():
    """테스트용 UsageScanner 스텁 — is_running만 제공."""

    class _Stub:
        is_running = False

        def scan_once(self, update_registry: bool = True):
            return {"sessions_parsed": 0, "stats_saved": 0, "update_registry": update_registry}

    return _Stub()


@pytest.fixture()
def client(core: VibeSmithCore, watcher: FileWatcher, usage_scanner):
    """dependency_overrides로 테스트용 코어, watcher, usage_scanner를 주입한 TestClient.

    Issue #303: raise_server_exceptions=False로 설정하여 lifespan 에러를 무시하고,
    실제 홈 디렉토리 스캔/파일 감시를 방지합니다.
    """
    scan_registry = ScanProgressRegistry()
    app.dependency_overrides[get_core] = lambda: core
    app.dependency_overrides[get_watcher] = lambda: watcher
    app.dependency_overrides[get_usage_scanner] = lambda: usage_scanner
    app.dependency_overrides[get_scan_registry] = lambda: scan_registry
    # raise_server_exceptions=False: lifespan 에러를 무시
    with TestClient(app, raise_server_exceptions=False) as tc:
        yield tc
    app.dependency_overrides.clear()


@pytest.fixture()
def sample_project(core: VibeSmithCore, tmp_path: Path):
    """테스트용 프로젝트 — .claude 디렉토리와 skill 1개 포함."""
    proj_dir = tmp_path / "sample-project"
    skill_dir = proj_dir / ".claude" / "skills" / "sample-skill"
    skill_dir.mkdir(parents=True)
    (skill_dir / "SKILL.md").write_text("---\nname: sample-skill\n---\n\nSample skill")
    project = core.projects.add_project(str(proj_dir))
    return {"id": project.id, "path": str(proj_dir)}
