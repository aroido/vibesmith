"""Cursor DB location discovery — finds state.vscdb path per OS (Issue #566)."""

import sys
from pathlib import Path

# Per-OS Cursor globalStorage relative path
_CURSOR_RELATIVE_PATHS: dict[str, str] = {
    "darwin": "Cursor/User/globalStorage",
    "win32": "Cursor/User/globalStorage",
    "linux": "Cursor/User/globalStorage",
}


def _get_default_base_dir() -> str:
    """Return the default base directory per OS."""
    if sys.platform == "darwin":
        return str(Path.home() / "Library" / "Application Support")
    elif sys.platform == "win32":
        return str(Path.home() / "AppData" / "Roaming")
    else:
        return str(Path.home() / ".config")


def get_default_cursor_base_dir() -> str:
    """Return the default Cursor base directory per OS."""
    return _get_default_base_dir()


def discover_cursor_db_path(base_dir: str | None = None) -> str | None:
    """Discover the Cursor state.vscdb path.

    Args:
        base_dir: Base directory override (for testing).
                  If None, uses the OS-specific default path.

    Returns:
        state.vscdb path or None
    """
    base = base_dir or _get_default_base_dir()
    relative = _CURSOR_RELATIVE_PATHS.get(sys.platform, "Cursor/User/globalStorage")
    db_path = Path(base) / relative / "state.vscdb"

    if db_path.is_file():
        return str(db_path)
    return None
