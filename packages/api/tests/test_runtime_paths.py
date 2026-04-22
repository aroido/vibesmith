"""런타임 경로 해석 테스트."""

from pathlib import Path

from vibesmith_api.main import _quarantine_core_db_files, _resolve_core_db_path


def test_resolve_core_db_path_uses_env(monkeypatch, tmp_path: Path):
    """VIBESMITH_DB_PATH가 설정되면 해당 경로를 우선 사용한다."""
    custom_db = tmp_path / "desktop.db"
    monkeypatch.setenv("VIBESMITH_DB_PATH", str(custom_db))

    assert _resolve_core_db_path() == str(custom_db)


def test_resolve_core_db_path_falls_back_to_default(monkeypatch):
    """VIBESMITH_DB_PATH가 없으면 기본 경로를 사용한다."""
    monkeypatch.delenv("VIBESMITH_DB_PATH", raising=False)

    assert _resolve_core_db_path() == "~/.vibesmith/vibesmith.db"


def test_quarantine_core_db_files_moves_db_wal_and_shm(tmp_path: Path):
    """DB 관련 파일이 있으면 .corrupt-* 이름으로 격리한다."""
    db_file = tmp_path / "vibesmith.db"
    wal_file = tmp_path / "vibesmith.db-wal"
    shm_file = tmp_path / "vibesmith.db-shm"
    db_file.write_text("db")
    wal_file.write_text("wal")
    shm_file.write_text("shm")

    moved = _quarantine_core_db_files(str(db_file))

    assert len(moved) == 3
    assert not db_file.exists()
    assert not wal_file.exists()
    assert not shm_file.exists()
    moved_targets = [to_path for _, to_path in moved]
    assert all(".corrupt-" in path for path in moved_targets)
    assert all(Path(path).exists() for path in moved_targets)


def test_quarantine_core_db_files_returns_empty_when_files_missing(tmp_path: Path):
    """격리할 DB 파일이 없으면 빈 목록을 반환한다."""
    db_file = tmp_path / "vibesmith.db"
    moved = _quarantine_core_db_files(str(db_file))

    assert moved == []
