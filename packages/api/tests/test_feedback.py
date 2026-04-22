"""POST /api/feedback 엔드포인트 테스트 (Issue #85)."""

import os
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from httpx import Response

from vibesmith_api.routes.feedback import _format_feedback
from vibesmith_api.schemas import FeedbackCreate


class TestFormatFeedback:
    """Issue 본문 포맷 검증."""

    def test_minimal(self):
        """필수 필드만 있는 경우."""
        f = FeedbackCreate(title="T", description="D", category="bug")
        body = _format_feedback(f)
        assert "## Feedback Type\nbug" in body
        assert "## Description\nD" in body
        assert "Contact" not in body
        assert "System Info" not in body
        assert "Screenshot" not in body

    def test_with_email(self):
        """이메일 포함."""
        f = FeedbackCreate(
            title="T",
            description="D",
            category="feature",
            email="user@example.com",
        )
        body = _format_feedback(f)
        assert "## Contact\nuser@example.com" in body

    def test_with_system_info(self):
        """시스템 정보 포함."""
        f = FeedbackCreate(
            title="T",
            description="D",
            category="question",
            system_info={"os": "macOS", "version": "1.0"},
        )
        body = _format_feedback(f)
        assert "## System Info" in body
        assert "- os: macOS" in body
        assert "- version: 1.0" in body

    def test_with_screenshot_url(self):
        """스크린샷 URL 포함."""
        f = FeedbackCreate(
            title="T",
            description="D",
            category="bug",
            screenshot_url="https://example.com/screenshot.png",
        )
        body = _format_feedback(f)
        assert "## Screenshot" in body
        assert "![screenshot](https://example.com/screenshot.png)" in body

    def test_full(self):
        """모든 필드 포함."""
        f = FeedbackCreate(
            title="Bug report",
            description="Steps to reproduce...",
            category="bug",
            email="user@example.com",
            system_info={"browser": "Chrome"},
            screenshot_url="https://img.example.com/ss.png",
        )
        body = _format_feedback(f)
        assert "bug" in body
        assert "Steps to reproduce" in body
        assert "user@example.com" in body
        assert "browser: Chrome" in body
        assert "ss.png" in body


class TestCreateFeedbackApi:
    """POST /api/feedback API 테스트."""

    @pytest.fixture(autouse=True)
    def _clear_feedback_env(self):
        """테스트 전 feedback 관련 환경변수 제거."""
        old_values = {
            "FEEDBACK_TOKEN": os.environ.pop("FEEDBACK_TOKEN", None),
            "GITHUB_TOKEN": os.environ.pop("GITHUB_TOKEN", None),
            "RELEASE_GITHUB_TOKEN": os.environ.pop("RELEASE_GITHUB_TOKEN", None),
            "GITHUB_FEEDBACK_REPOSITORY": os.environ.pop("GITHUB_FEEDBACK_REPOSITORY", None),
            "GITHUB_API_BASE_URL": os.environ.pop("GITHUB_API_BASE_URL", None),
        }
        yield
        for key, value in old_values.items():
            if value is not None:
                os.environ[key] = value

    def test_missing_feedback_token_returns_500(self, client: TestClient):
        """피드백 토큰이 없을 때 500 에러."""
        resp = client.post(
            "/api/feedback/",
            json={
                "title": "Bug",
                "description": "Desc",
                "category": "bug",
            },
        )
        assert resp.status_code == 500
        data = resp.json()
        assert "feedback_token" in data.get("message_key", "").lower() or "token" in data.get("detail", "").lower()

    def test_success_creates_issue(self, client: TestClient):
        """성공 시 Issue URL과 번호 반환."""
        os.environ["FEEDBACK_TOKEN"] = "test-token"
        mock_response = Response(
            201,
            json={"html_url": "https://github.com/aroido/vibesmith/issues/1", "number": 1},
        )
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response) as post_mock:
            resp = client.post(
                "/api/feedback/",
                json={
                    "title": "Feature request",
                    "description": "Add dark mode",
                    "category": "feature",
                },
            )
        assert resp.status_code == 201
        post_mock.assert_awaited_once()
        assert post_mock.await_args.args[0] == "https://api.github.com/repos/aroido/vibesmith/issues"
        assert post_mock.await_args.kwargs["headers"]["Authorization"] == "Bearer test-token"
        assert post_mock.await_args.kwargs["json"]["labels"] == ["user-feedback", "feature"]
        data = resp.json()
        assert data["issue_url"] == "https://github.com/aroido/vibesmith/issues/1"
        assert data["issue_number"] == 1

    def test_success_creates_issue_with_release_github_token(self, client: TestClient):
        """FEEDBACK_TOKEN 없이 RELEASE_GITHUB_TOKEN으로도 이슈 생성."""
        os.environ["RELEASE_GITHUB_TOKEN"] = "release-token"
        mock_response = Response(
            201,
            json={"html_url": "https://github.com/aroido/vibesmith/issues/2", "number": 2},
        )
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response) as post_mock:
            resp = client.post(
                "/api/feedback/",
                json={
                    "title": "Feature request",
                    "description": "Add release token fallback",
                    "category": "feature",
                },
            )

        assert resp.status_code == 201
        post_mock.assert_awaited_once()
        assert post_mock.await_args.kwargs["headers"]["Authorization"] == "Bearer release-token"
        data = resp.json()
        assert data["issue_url"] == "https://github.com/aroido/vibesmith/issues/2"
        assert data["issue_number"] == 2

    def test_github_api_failure_returns_500(self, client: TestClient):
        """GitHub API 실패 시 500 에러."""
        os.environ["GITHUB_TOKEN"] = "test-token"
        mock_response = Response(401, text="Bad credentials")
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
            resp = client.post(
                "/api/feedback/",
                json={"title": "T", "description": "D", "category": "bug"},
            )
        assert resp.status_code == 500
        data = resp.json()
        assert "message_key" in data

    def test_invalid_category_returns_422(self, client: TestClient):
        """유효하지 않은 category 시 422."""
        resp = client.post(
            "/api/feedback/",
            json={
                "title": "T",
                "description": "D",
                "category": "invalid",
            },
        )
        assert resp.status_code == 422
