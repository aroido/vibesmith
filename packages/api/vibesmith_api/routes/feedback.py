"""사용자 피드백 → GitHub Issues 자동 생성 API (Issue #85)."""

import os
from urllib.parse import quote

import httpx
from fastapi import APIRouter

from vibesmith_api.i18n.exceptions import I18nHTTPException
from vibesmith_api.i18n.keys import KEYS
from vibesmith_api.schemas import FeedbackCreate, FeedbackCreateResponse

router = APIRouter(prefix="/api/feedback", tags=["feedback"])

DEFAULT_GITHUB_REPOSITORY = "aroido/vibesmith"
DEFAULT_GITHUB_API_BASE_URL = "https://api.github.com"


def _resolve_feedback_token() -> str | None:
    """피드백 이슈 생성용 토큰을 우선순위로 조회."""
    for env_name in ("FEEDBACK_TOKEN", "GITHUB_TOKEN", "RELEASE_GITHUB_TOKEN"):
        token = os.getenv(env_name)
        if token:
            return token
    return None


def _get_github_issues_url(repository: str) -> str:
    """GitHub repository를 Issues API URL로 변환."""
    normalized_repository = repository.strip().strip("/")
    parts = normalized_repository.split("/", 1)
    if len(parts) != 2 or not parts[0] or not parts[1]:
        raise ValueError("repository must be in 'owner/repo' format")

    owner, repo = parts
    api_base_url = os.getenv("GITHUB_API_BASE_URL", DEFAULT_GITHUB_API_BASE_URL).rstrip("/")
    return f"{api_base_url}/repos/{quote(owner, safe='')}/{quote(repo, safe='')}/issues"


def _format_feedback(feedback: FeedbackCreate) -> str:
    """Issue 본문 포맷."""
    body = f"## Feedback Type\n{feedback.category}\n\n"
    body += f"## Description\n{feedback.description}\n\n"

    if feedback.system_info:
        body += "## System Info\n"
        for key, value in feedback.system_info.items():
            body += f"- {key}: {value}\n"
        body += "\n"

    if feedback.email:
        body += f"## Contact\n{feedback.email}\n\n"

    if feedback.screenshot_url:
        body += f"## Screenshot\n![screenshot]({feedback.screenshot_url})\n"

    return body


@router.post(
    "/",
    response_model=FeedbackCreateResponse,
    status_code=201,
    summary="피드백 제출 → GitHub issue 생성",
    response_description="생성된 GitHub issue URL 및 번호",
)
async def create_feedback(feedback: FeedbackCreate):
    """사용자 피드백을 GitHub issue로 자동 생성합니다.

    환경변수 FEEDBACK_TOKEN, GITHUB_TOKEN 또는 RELEASE_GITHUB_TOKEN이 필요합니다.
    """
    feedback_token = _resolve_feedback_token()
    if not feedback_token:
        raise I18nHTTPException(500, KEYS.FEEDBACK_TOKEN_NOT_CONFIGURED)

    github_repository = os.getenv(
        "GITHUB_FEEDBACK_REPOSITORY",
        DEFAULT_GITHUB_REPOSITORY,
    )
    issue_body = _format_feedback(feedback)
    labels = ["user-feedback", feedback.category]

    try:
        issues_url = _get_github_issues_url(github_repository)
    except ValueError as error:
        raise I18nHTTPException(
            500,
            KEYS.FEEDBACK_ISSUE_CREATE_FAILED,
            detail=str(error),
        ) from error

    async with httpx.AsyncClient() as client:
        response = await client.post(
            issues_url,
            headers={
                "Accept": "application/vnd.github+json",
                "Authorization": f"Bearer {feedback_token}",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            json={
                "title": feedback.title,
                "body": issue_body,
                "labels": labels,
            },
        )

    if response.status_code != 201:
        raise I18nHTTPException(
            500,
            KEYS.FEEDBACK_ISSUE_CREATE_FAILED,
            detail=response.text[:200] if response.text else str(response.status_code),
        )

    issue_data = response.json()
    return FeedbackCreateResponse(
        issue_url=issue_data["html_url"],
        issue_number=issue_data["number"],
    )
