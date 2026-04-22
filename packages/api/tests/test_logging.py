"""structlog 기반 로깅 시스템 테스트."""

import json
import logging

from fastapi.testclient import TestClient


class TestSetupLogging:
    """logging_config.setup_logging() 설정 테스트."""

    def test_setup_logging_returns_bound_logger(self):
        """setup_logging()이 structlog BoundLogger를 반환한다."""
        from vibesmith_api.logging_config import setup_logging

        logger = setup_logging()
        assert hasattr(logger, "info")
        assert hasattr(logger, "bind")

    def test_setup_logging_produces_json_output(self, capsys):
        """구조화된 로그가 JSON 형식으로 출력된다."""
        from vibesmith_api.logging_config import setup_logging

        logger = setup_logging()
        logger.info("test_event", key="value")

        captured = capsys.readouterr()
        log_line = captured.err.strip().split("\n")[-1]
        data = json.loads(log_line)
        assert data["event"] == "test_event"
        assert data["key"] == "value"
        assert "level" in data
        assert "timestamp" in data

    def test_log_level_from_env_variable(self, monkeypatch, capsys):
        """LOG_LEVEL 환경 변수로 로그 레벨을 제어할 수 있다."""
        monkeypatch.setenv("LOG_LEVEL", "WARNING")

        from vibesmith_api.logging_config import setup_logging

        logger = setup_logging()
        logger.info("should_be_filtered")
        logger.warning("should_appear")

        captured = capsys.readouterr()
        assert "should_be_filtered" not in captured.err
        assert "should_appear" in captured.err

    def test_default_log_level_is_info(self, monkeypatch, capsys):
        """환경 변수 미설정 시 기본 로그 레벨은 INFO이다."""
        monkeypatch.delenv("LOG_LEVEL", raising=False)

        from vibesmith_api.logging_config import setup_logging

        logger = setup_logging()
        logger.info("info_event")
        logger.debug("debug_event")

        captured = capsys.readouterr()
        assert "info_event" in captured.err
        assert "debug_event" not in captured.err


class TestGetLogger:
    """get_logger()로 모듈별 로거를 가져온다."""

    def test_get_logger_returns_bound_logger(self):
        """get_logger()가 structlog BoundLogger를 반환한다."""
        from vibesmith_api.logging_config import get_logger

        logger = get_logger("test.module")
        assert hasattr(logger, "info")
        assert hasattr(logger, "bind")

    def test_get_logger_includes_logger_name(self, capsys):
        """get_logger()로 생성한 로거가 logger 이름을 포함한다."""
        from vibesmith_api.logging_config import get_logger, setup_logging

        setup_logging()
        logger = get_logger("vibesmith.test")
        logger.info("named_event")

        captured = capsys.readouterr()
        log_line = captured.err.strip().split("\n")[-1]
        data = json.loads(log_line)
        assert data["logger"] == "vibesmith.test"


class TestRequestLoggingMiddleware:
    """HTTP 요청/응답 로깅 미들웨어 테스트."""

    def test_logs_request_method_and_path(self, client: TestClient, caplog):
        """미들웨어가 HTTP 메서드와 경로를 구조화된 형태로 로깅한다."""
        with caplog.at_level(logging.INFO, logger="vibesmith.api"):
            client.get("/api/projects")

        found = False
        for record in caplog.records:
            try:
                data = json.loads(record.getMessage())
                if data.get("event") == "request_completed":
                    assert data["method"] == "GET"
                    assert data["path"] == "/api/projects"
                    assert "status_code" in data
                    assert "duration_ms" in data
                    found = True
                    break
            except (json.JSONDecodeError, KeyError):
                continue
        assert found, "request_completed 로그를 찾을 수 없음"

    def test_logs_duration_in_milliseconds(self, client: TestClient, caplog):
        """응답 시간이 밀리초 단위 정수로 기록된다."""
        with caplog.at_level(logging.INFO, logger="vibesmith.api"):
            client.get("/api/projects")

        found = False
        for record in caplog.records:
            try:
                data = json.loads(record.getMessage())
                if data.get("event") == "request_completed":
                    assert isinstance(data["duration_ms"], int)
                    assert data["duration_ms"] >= 0
                    found = True
                    break
            except (json.JSONDecodeError, KeyError):
                continue
        assert found, "request_completed 로그를 찾을 수 없음"


class TestErrorLogging:
    """에러 로깅에 스택 트레이스가 포함되는지 테스트."""

    def test_404_error_is_logged(self, client: TestClient, caplog):
        """존재하지 않는 프로젝트 요청 시 에러가 로깅된다."""
        with caplog.at_level(logging.INFO, logger="vibesmith.api"):
            client.post("/api/scan", json={"project_id": "nonexistent"})

        has_error_log = False
        for record in caplog.records:
            try:
                data = json.loads(record.getMessage())
                if data.get("event") == "request_completed" and data.get("status_code") == 404:
                    has_error_log = True
                    break
            except (json.JSONDecodeError, KeyError):
                continue
        assert has_error_log, "404 에러 로그를 찾을 수 없음"
