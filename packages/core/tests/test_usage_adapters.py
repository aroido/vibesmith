"""Usage 어댑터 단위 테스트 — ClaudeCodeUsageAdapter, CursorUsageAdapter (#630)."""

from pathlib import Path

from vibesmith_core.usage.adapters import (
    CURSOR_GLOBAL_PROJECT_PATH,
    CURSOR_SESSION_FILE_ID,
    ClaudeCodeUsageAdapter,
    CursorUsageAdapter,
)


class TestClaudeCodeUsageAdapter:
    """ClaudeCodeUsageAdapter — 세션 파일 접근 가능 여부 판단."""

    def test_is_accessible_returns_true_when_file_exists(self, tmp_path: Path):
        """세션 디렉토리와 파일 모두 존재하면 True."""
        project_path = str(tmp_path / "my-project")
        encoded = project_path.replace("/", "-")
        session_dir = tmp_path / "claude_projects" / encoded
        session_dir.mkdir(parents=True)
        (session_dir / "session1.jsonl").write_text("{}")

        adapter = ClaudeCodeUsageAdapter(str(tmp_path / "claude_projects"))
        assert adapter.is_session_file_accessible(project_path, "session1.jsonl") is True

    def test_is_accessible_returns_false_when_file_missing(self, tmp_path: Path):
        """디렉토리 존재, 파일 없으면 False."""
        project_path = str(tmp_path / "my-project")
        encoded = project_path.replace("/", "-")
        session_dir = tmp_path / "claude_projects" / encoded
        session_dir.mkdir(parents=True)

        adapter = ClaudeCodeUsageAdapter(str(tmp_path / "claude_projects"))
        assert adapter.is_session_file_accessible(project_path, "nonexistent.jsonl") is False

    def test_is_accessible_returns_false_when_dir_missing(self, tmp_path: Path):
        """디렉토리 자체가 없으면 False."""
        adapter = ClaudeCodeUsageAdapter(str(tmp_path / "claude_projects"))
        assert adapter.is_session_file_accessible("/no/such/path", "session.jsonl") is False

    def test_session_dir_for_normalized_encoding(self, tmp_path: Path):
        """_ → - 치환된 최신 인코딩 경로를 탐색한다."""
        project_path = str(tmp_path / "my_project")
        # 최신 규칙: / → -, _ → -
        normalized = project_path.replace("/", "-").replace("_", "-")
        session_dir = tmp_path / "claude_projects" / normalized
        session_dir.mkdir(parents=True)

        adapter = ClaudeCodeUsageAdapter(str(tmp_path / "claude_projects"))
        result = adapter.session_dir_for(project_path)
        assert result is not None
        assert result == session_dir

    def test_session_dir_for_legacy_slash_encoding(self, tmp_path: Path):
        """/ → - 만 치환된 레거시 경로를 탐색한다."""
        project_path = str(tmp_path / "my_project")
        # 레거시 규칙: / → - 만
        legacy = project_path.replace("/", "-")
        session_dir = tmp_path / "claude_projects" / legacy
        session_dir.mkdir(parents=True)

        adapter = ClaudeCodeUsageAdapter(str(tmp_path / "claude_projects"))
        result = adapter.session_dir_for(project_path)
        assert result is not None
        assert result == session_dir

    def test_session_dir_for_returns_none_when_missing(self, tmp_path: Path):
        """매칭 경로가 없으면 None."""
        adapter = ClaudeCodeUsageAdapter(str(tmp_path / "claude_projects"))
        result = adapter.session_dir_for("/no/such/path")
        assert result is None


class TestCursorUsageAdapter:
    """CursorUsageAdapter — Cursor DB 접근 가능 여부 판단."""

    def test_cursor_is_accessible_returns_true_when_db_exists(self, tmp_path: Path):
        """cursor_base_dir 주입, DB 파일 존재, 올바른 키 조합 → True."""
        cursor_storage = tmp_path / "Cursor" / "User" / "globalStorage"
        cursor_storage.mkdir(parents=True)
        # 실제 sqlite DB 생성 (discover_cursor_db_path가 is_file() 확인)
        import sqlite3

        conn = sqlite3.connect(str(cursor_storage / "state.vscdb"))
        conn.close()

        adapter = CursorUsageAdapter(str(tmp_path))
        assert adapter.is_session_file_accessible(CURSOR_GLOBAL_PROJECT_PATH, CURSOR_SESSION_FILE_ID) is True

    def test_cursor_is_accessible_returns_false_when_db_missing(self, tmp_path: Path):
        """cursor_base_dir 주입, DB 파일 없음 → False."""
        adapter = CursorUsageAdapter(str(tmp_path))
        assert adapter.is_session_file_accessible(CURSOR_GLOBAL_PROJECT_PATH, CURSOR_SESSION_FILE_ID) is False

    def test_cursor_is_accessible_returns_false_when_base_dir_none(self):
        """cursor_base_dir=None → False."""
        adapter = CursorUsageAdapter(None)
        assert adapter.is_session_file_accessible(CURSOR_GLOBAL_PROJECT_PATH, CURSOR_SESSION_FILE_ID) is False

    def test_cursor_is_accessible_returns_false_for_unknown_project_path(self, tmp_path: Path):
        """cursor:global이 아닌 project_path → False."""
        cursor_storage = tmp_path / "Cursor" / "User" / "globalStorage"
        cursor_storage.mkdir(parents=True)
        import sqlite3

        conn = sqlite3.connect(str(cursor_storage / "state.vscdb"))
        conn.close()

        adapter = CursorUsageAdapter(str(tmp_path))
        # project_path가 다르면 항상 False
        assert adapter.is_session_file_accessible("/some/project", CURSOR_SESSION_FILE_ID) is False

    def test_cursor_is_accessible_returns_true_for_any_session_file(self, tmp_path: Path):
        """cursor:global이면 session_file에 관계없이 DB 존재 여부로 판단."""
        cursor_storage = tmp_path / "Cursor" / "User" / "globalStorage"
        cursor_storage.mkdir(parents=True)
        import sqlite3

        conn = sqlite3.connect(str(cursor_storage / "state.vscdb"))
        conn.close()

        adapter = CursorUsageAdapter(str(tmp_path))
        # composerData:* 형태의 session_file도 True
        assert adapter.is_session_file_accessible(CURSOR_GLOBAL_PROJECT_PATH, "composerData:sess1") is True
        assert adapter.is_session_file_accessible(CURSOR_GLOBAL_PROJECT_PATH, CURSOR_SESSION_FILE_ID) is True
