"""Usage adapters — platform-specific session file access logic (#630)."""

from abc import ABC, abstractmethod
from pathlib import Path

CURSOR_GLOBAL_PROJECT_PATH = "cursor:global"
CURSOR_SESSION_FILE_ID = "state.vscdb"


class UsageAdapterBase(ABC):
    """Base class for usage adapters — determines session file accessibility."""

    @abstractmethod
    def is_session_file_accessible(self, project_path: str, session_file: str) -> bool:
        """Return whether the (project_path, session_file) combination is accessible on disk."""


class ClaudeCodeUsageAdapter(UsageAdapterBase):
    """Claude Code JSONL session file access adapter."""

    def __init__(self, claude_base_dir: str) -> None:
        self._claude_base_dir = claude_base_dir

    def session_dir_for(self, project_path: str) -> Path | None:
        """Return the Claude session directory corresponding to the project path.

        Searches latest encoding (/, _ -> -) and legacy (/ -> -) in order.
        """
        slash_encoded = project_path.replace("/", "-")
        normalized_encoded = slash_encoded.replace("_", "-")

        for encoded in dict.fromkeys((normalized_encoded, slash_encoded)):
            session_dir = Path(self._claude_base_dir) / encoded
            if session_dir.is_dir():
                return session_dir
        return None

    def is_session_file_accessible(self, project_path: str, session_file: str) -> bool:
        session_dir = self.session_dir_for(project_path)
        if session_dir is None:
            return False
        return (session_dir / session_file).is_file()


class CursorUsageAdapter(UsageAdapterBase):
    """Cursor state.vscdb access adapter."""

    def __init__(self, cursor_base_dir: str | None) -> None:
        self._cursor_base_dir = cursor_base_dir

    def is_session_file_accessible(self, project_path: str, session_file: str) -> bool:
        """Return whether a Cursor session file is accessible.

        - cursor_base_dir is None -> False (Cursor not active)
        - project_path == cursor:global -> determined by state.vscdb DB existence
          (session_file can be state.vscdb or composerData:* etc.)
        - Other project_path -> False
        """
        if self._cursor_base_dir is None:
            return False
        if project_path != CURSOR_GLOBAL_PROJECT_PATH:
            return False

        from vibesmith_core.usage.cursor_discovery import discover_cursor_db_path

        db_path = discover_cursor_db_path(base_dir=self._cursor_base_dir)
        return Path(db_path).is_file() if db_path else False
