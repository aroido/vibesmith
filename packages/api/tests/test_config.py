"""config.json 로딩/저장 테스트."""

from pathlib import Path

from vibesmith_api.config import get_config_path, load_config, save_config, set_config_path


class TestLoadConfig:
    """load_config() 테스트."""

    def test_no_file_returns_empty_dict(self, tmp_path: Path):
        """config.json이 없으면 빈 dict를 반환한다."""
        set_config_path(tmp_path / "config.json")
        assert load_config() == {}

    def test_valid_json_returns_parsed_config(self, tmp_path: Path):
        """유효한 JSON은 파싱된 dict를 반환한다."""
        config_path = tmp_path / "config.json"
        config_path.write_text('{"root_paths": ["/a", "/b"]}', encoding="utf-8")
        set_config_path(config_path)
        assert load_config() == {"root_paths": ["/a", "/b"]}

    def test_corrupted_json_returns_empty_dict_and_does_not_raise(self, tmp_path: Path, caplog):
        """손상된 JSON은 예외 대신 빈 dict를 반환하고 경고 로그를 남긴다."""
        config_path = tmp_path / "config.json"
        config_path.write_text('{"root_paths": ["/a", }', encoding="utf-8")
        set_config_path(config_path)

        result = load_config()

        assert result == {}
        assert "config.json 파싱 실패" in caplog.text or "파싱 실패" in caplog.text

    def test_empty_file_returns_empty_dict(self, tmp_path: Path):
        """빈 파일은 JSONDecodeError이므로 빈 dict를 반환한다."""
        config_path = tmp_path / "config.json"
        config_path.write_text("", encoding="utf-8")
        set_config_path(config_path)
        assert load_config() == {}

    def test_invalid_json_syntax_returns_empty_dict(self, tmp_path: Path):
        """유효하지 않은 JSON 문법(따옴표 누락 등)은 빈 dict를 반환한다."""
        config_path = tmp_path / "config.json"
        config_path.write_text("{invalid}", encoding="utf-8")
        set_config_path(config_path)
        assert load_config() == {}


class TestSaveConfig:
    """save_config() 테스트."""

    def test_save_creates_file_and_load_roundtrip(self, tmp_path: Path):
        """저장 후 로드 시 동일한 내용을 반환한다."""
        config_path = tmp_path / "config.json"
        set_config_path(config_path)
        save_config({"root_paths": ["/x", "/y"]})
        assert load_config() == {"root_paths": ["/x", "/y"]}


class TestGetConfigPath:
    """get_config_path() 테스트."""

    def test_returns_configured_path(self, tmp_path: Path):
        """set_config_path로 설정한 경로를 반환한다."""
        p = tmp_path / "custom_config.json"
        set_config_path(p)
        assert get_config_path() == p
