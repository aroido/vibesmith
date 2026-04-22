"""adapters 테스트 — AgentAdapter 및 ClaudeCodeAdapter 검증."""

import pytest

from vibesmith_core.scanning.adapters.base import AgentAdapter
from vibesmith_core.scanning.adapters.claude_code import ClaudeCodeAdapter
from vibesmith_core.scanning.adapters.cursor import CursorAdapter


class TestAgentAdapterIsABC:
    def test_cannot_instantiate_abc(self):
        with pytest.raises(TypeError):
            AgentAdapter()


class TestClaudeCodeAdapter:
    def test_get_global_path(self):
        adapter = ClaudeCodeAdapter()
        global_path = adapter.get_global_path()
        assert global_path.endswith(".claude")

    def test_claude_code_adapter_returns_str_global_path(self):
        adapter = ClaudeCodeAdapter()
        global_path = adapter.get_global_path()
        assert isinstance(global_path, str)

    def test_get_project_path(self, tmp_path):
        adapter = ClaudeCodeAdapter()
        project_path = adapter.get_project_path(str(tmp_path))
        assert project_path == str(tmp_path / ".claude")

    def test_get_component_paths(self, tmp_path):
        claude_dir = tmp_path / ".claude"
        claude_dir.mkdir()
        adapter = ClaudeCodeAdapter()
        paths = adapter.get_component_paths(str(claude_dir))
        assert "skills" in paths
        assert "agents" in paths
        assert "commands" in paths
        assert "rules" in paths
        assert "hooks" in paths

    def test_get_component_paths_skill_format(self, tmp_path):
        claude_dir = tmp_path / ".claude"
        claude_dir.mkdir()
        adapter = ClaudeCodeAdapter()
        paths = adapter.get_component_paths(str(claude_dir))
        assert paths["skills"] == str(claude_dir / "skills")
        assert paths["hooks"] == str(claude_dir / "settings.json")


class TestCursorAdapter:
    def test_cursor_adapter_returns_none_global_path(self):
        adapter = CursorAdapter()
        global_path = adapter.get_global_path()
        assert global_path is None

    def test_cursor_adapter_global_path_is_none(self):
        adapter = CursorAdapter()
        assert adapter.get_global_path() is None

    def test_cursor_adapter_project_path(self, tmp_path):
        adapter = CursorAdapter()
        project_path = adapter.get_project_path(str(tmp_path))
        assert project_path == str(tmp_path / ".cursor")

    def test_cursor_adapter_component_paths_supports_all_component_types(self, tmp_path):
        cursor_dir = tmp_path / ".cursor"
        cursor_dir.mkdir()
        adapter = CursorAdapter()
        paths = adapter.get_component_paths(str(cursor_dir))
        assert "skills" in paths
        assert "agents" in paths
        assert "commands" in paths
        assert "rules" in paths
        assert "hooks" in paths
        assert paths["skills"] == str(cursor_dir / "skills")
        assert paths["agents"] == str(cursor_dir / "agents")
        assert paths["commands"] == str(cursor_dir / "commands")
        assert paths["rules"] == str(cursor_dir / "rules")
        assert paths["hooks"] == str(cursor_dir / "settings.json")


class TestConfigDirAutoRegistration:
    def test_claude_code_registers_config_dir(self):
        """ClaudeCodeAdapter는 '.claude'를 config_dir로 등록한다."""
        config_dirs = AgentAdapter.all_config_dirs()
        assert ".claude" in config_dirs

    def test_cursor_registers_config_dir(self):
        """CursorAdapter는 '.cursor'를 config_dir로 등록한다."""
        config_dirs = AgentAdapter.all_config_dirs()
        assert ".cursor" in config_dirs

    def test_all_config_dirs_returns_frozenset(self):
        """all_config_dirs()는 frozenset을 반환한다."""
        config_dirs = AgentAdapter.all_config_dirs()
        assert isinstance(config_dirs, frozenset)
        assert len(config_dirs) >= 2


class TestAdapterType:
    def test_claude_code_adapter_type(self):
        """ClaudeCodeAdapter의 adapter_type은 'claude_code'이다."""
        adapter = ClaudeCodeAdapter()
        assert adapter.adapter_type == "claude_code"

    def test_cursor_adapter_type(self):
        """CursorAdapter의 adapter_type은 'cursor'이다."""
        adapter = CursorAdapter()
        assert adapter.adapter_type == "cursor"


class TestAllAdapters:
    def test_all_adapters_returns_list(self):
        """all_adapters()는 등록된 모든 adapter 인스턴스 리스트를 반환한다."""
        result = AgentAdapter.all_adapters()
        assert isinstance(result, list)
        assert len(result) >= 2

    def test_all_adapters_includes_claude_code(self):
        """all_adapters()에 ClaudeCodeAdapter가 포함된다."""
        result = AgentAdapter.all_adapters()
        types = {a.adapter_type for a in result}
        assert "claude_code" in types

    def test_all_adapters_includes_cursor(self):
        """all_adapters()에 CursorAdapter가 포함된다."""
        result = AgentAdapter.all_adapters()
        types = {a.adapter_type for a in result}
        assert "cursor" in types


class TestGetExtraRules:
    def test_claude_code_get_extra_rules_empty(self, tmp_path):
        """ClaudeCodeAdapter.get_extra_rules()는 빈 리스트를 반환한다."""
        adapter = ClaudeCodeAdapter()
        result = adapter.get_extra_rules(str(tmp_path))
        assert result == []

    def test_cursor_get_extra_rules_cursorrules_path(self, tmp_path):
        """CursorAdapter.get_extra_rules()는 .cursorrules 경로를 반환한다."""
        adapter = CursorAdapter()
        result = adapter.get_extra_rules(str(tmp_path))
        assert len(result) == 1
        assert result[0] == str(tmp_path / ".cursorrules")
