"""Issue #546: parser updated_at이 파일 mtime을 반영하는지 검증."""

import json
import os
from datetime import UTC, datetime

import pytest

from vibesmith_core.scanning.parser import ComponentParser


@pytest.fixture
def parser():
    return ComponentParser(platform="claude_code")


@pytest.fixture
def project_id():
    return "proj-test"


# 2025-01-15 10:30:00 UTC — 현재 시간과 충분히 떨어진 과거 시점
_KNOWN_DT = datetime(2025, 1, 15, 10, 30, 0, tzinfo=UTC)
_KNOWN_TS = _KNOWN_DT.timestamp()


def _set_mtime(path: str, ts: float = _KNOWN_TS) -> None:
    """파일의 mtime을 지정 타임스탬프로 설정한다."""
    os.utime(path, (ts, ts))


def _parse_iso(iso_str: str) -> datetime:
    """ISO 8601 문자열을 datetime으로 변환한다."""
    return datetime.fromisoformat(iso_str)


class TestParserUpdatedAtUsesMtime:
    """updated_at은 파일의 실제 수정 시간(mtime)을 반영해야 한다."""

    def test_skill_updated_at_matches_file_mtime(self, parser, project_id, tmp_path):
        skill_dir = tmp_path / "skills" / "my-skill"
        skill_dir.mkdir(parents=True)
        skill_file = skill_dir / "SKILL.md"
        skill_file.write_text("---\nname: my-skill\n---\n\nBody")
        _set_mtime(str(skill_file))

        skill = parser.parse_skill(str(skill_file), project_id)
        parsed_updated = _parse_iso(skill.updated_at)

        # updated_at이 파일 mtime(2025-01-15)과 동일해야 함
        assert parsed_updated.year == 2025
        assert parsed_updated.month == 1
        assert parsed_updated.day == 15

    def test_agent_updated_at_matches_file_mtime(self, parser, project_id, tmp_path):
        agents_dir = tmp_path / "agents"
        agents_dir.mkdir(parents=True)
        agent_file = agents_dir / "reviewer.md"
        agent_file.write_text("---\nname: reviewer\ntools: Read\n---\n\nPrompt")
        _set_mtime(str(agent_file))

        agent = parser.parse_agent(str(agent_file), project_id)
        parsed_updated = _parse_iso(agent.updated_at)

        assert parsed_updated.year == 2025
        assert parsed_updated.month == 1
        assert parsed_updated.day == 15

    def test_command_updated_at_matches_file_mtime(self, parser, project_id, tmp_path):
        cmd_dir = tmp_path / "commands"
        cmd_dir.mkdir(parents=True)
        cmd_file = cmd_dir / "check.md"
        cmd_file.write_text("Run checks.")
        _set_mtime(str(cmd_file))

        cmd = parser.parse_command(str(cmd_file), project_id)
        parsed_updated = _parse_iso(cmd.updated_at)

        assert parsed_updated.year == 2025
        assert parsed_updated.month == 1
        assert parsed_updated.day == 15

    def test_rule_updated_at_matches_file_mtime(self, parser, project_id, tmp_path):
        rules_dir = tmp_path / "rules"
        rules_dir.mkdir(parents=True)
        rule_file = rules_dir / "style.md"
        rule_file.write_text("---\ndescription: Style\n---\n\nUse ruff.")
        _set_mtime(str(rule_file))

        rule = parser.parse_rule(str(rule_file), project_id)
        parsed_updated = _parse_iso(rule.updated_at)

        assert parsed_updated.year == 2025
        assert parsed_updated.month == 1
        assert parsed_updated.day == 15

    def test_hooks_updated_at_matches_settings_mtime(self, parser, project_id, tmp_path):
        settings_file = tmp_path / "settings.json"
        data = {"hooks": {"PostToolUse": [{"matcher": "Write", "hooks": [{"type": "command", "command": "fmt"}]}]}}
        settings_file.write_text(json.dumps(data))
        _set_mtime(str(settings_file))

        hooks = parser.parse_hooks(str(settings_file), project_id)
        assert len(hooks) == 1
        parsed_updated = _parse_iso(hooks[0].updated_at)

        assert parsed_updated.year == 2025
        assert parsed_updated.month == 1
        assert parsed_updated.day == 15

    def test_created_at_is_current_time_not_mtime(self, parser, project_id, tmp_path):
        """created_at은 현재 시간이어야 한다 (파일 mtime이 아님)."""
        skill_dir = tmp_path / "skills" / "test"
        skill_dir.mkdir(parents=True)
        skill_file = skill_dir / "SKILL.md"
        skill_file.write_text("---\nname: test\n---\n\nBody")
        _set_mtime(str(skill_file))  # 2025-01-15로 설정

        skill = parser.parse_skill(str(skill_file), project_id)
        parsed_created = _parse_iso(skill.created_at)

        # created_at은 현재 시간(2026)이어야 함, mtime(2025)이 아님
        assert parsed_created.year >= 2026

    def test_different_files_have_different_updated_at(self, parser, project_id, tmp_path):
        """서로 다른 mtime을 가진 파일은 서로 다른 updated_at을 가진다."""
        cmd_dir = tmp_path / "commands"
        cmd_dir.mkdir(parents=True)

        file_a = cmd_dir / "cmd-a.md"
        file_a.write_text("Command A")
        ts_a = datetime(2025, 3, 1, 12, 0, 0, tzinfo=UTC).timestamp()
        _set_mtime(str(file_a), ts_a)

        file_b = cmd_dir / "cmd-b.md"
        file_b.write_text("Command B")
        ts_b = datetime(2025, 6, 15, 18, 0, 0, tzinfo=UTC).timestamp()
        _set_mtime(str(file_b), ts_b)

        cmd_a = parser.parse_command(str(file_a), project_id)
        cmd_b = parser.parse_command(str(file_b), project_id)

        assert cmd_a.updated_at != cmd_b.updated_at
        assert _parse_iso(cmd_a.updated_at).month == 3
        assert _parse_iso(cmd_b.updated_at).month == 6
