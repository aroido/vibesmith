"""Cursor Discovery 테스트 — Cursor state.vscdb 경로 탐색 (Issue #566)."""

from pathlib import Path

from vibesmith_core.usage.cursor_discovery import discover_cursor_db_path


class TestDiscoverCursorDbPath:
    """Cursor state.vscdb 경로 탐색 테스트."""

    def test_returns_path_when_db_exists(self, tmp_path: Path):
        """DB 파일이 존재하면 경로를 반환한다."""
        db_dir = tmp_path / "Cursor" / "User" / "globalStorage"
        db_dir.mkdir(parents=True)
        db_file = db_dir / "state.vscdb"
        db_file.write_text("")

        result = discover_cursor_db_path(base_dir=str(tmp_path))
        assert result == str(db_file)

    def test_returns_none_when_db_missing(self, tmp_path: Path):
        """DB 파일이 없으면 None을 반환한다."""
        result = discover_cursor_db_path(base_dir=str(tmp_path))
        assert result is None

    def test_returns_none_for_nonexistent_base(self):
        """base_dir이 존재하지 않으면 None."""
        result = discover_cursor_db_path(base_dir="/nonexistent/path")
        assert result is None

    def test_finds_db_in_partial_structure(self, tmp_path: Path):
        """Cursor 디렉토리는 있지만 globalStorage 없으면 None."""
        cursor_dir = tmp_path / "Cursor" / "User"
        cursor_dir.mkdir(parents=True)

        result = discover_cursor_db_path(base_dir=str(tmp_path))
        assert result is None
