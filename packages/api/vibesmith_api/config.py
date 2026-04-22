"""Server config save/load — ~/.vibesmith/config.json."""

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)
_config_path = Path("~/.vibesmith/config.json").expanduser()


def get_config_path() -> Path:
    return _config_path


def set_config_path(path: Path) -> None:
    global _config_path
    _config_path = path


def load_config() -> dict:
    """Read config.json. Returns an empty dict on parse failure and the server continues running."""
    p = get_config_path()
    if not p.is_file():
        return {}
    try:
        return json.loads(p.read_text())
    except json.JSONDecodeError as e:
        logger.warning(
            "config.json 파싱 실패 — using defaults. path=%s error=%s",
            p,
            e,
            exc_info=True,
        )
        return {}


def save_config(config: dict) -> None:
    """Save to config.json."""
    p = get_config_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(config, indent=2, ensure_ascii=False))
