"""i18n 기반 API 예외 — message_key, message 표준 응답 포맷."""

from typing import Any

from fastapi import HTTPException


class I18nHTTPException(HTTPException):
    """i18n 키 기반 HTTP 예외.

    라우트에서 raise 시, 전역 exception handler가 locale에 맞게 번역하여
    {detail, message_key, message} 형식으로 응답한다.

    Example:
        raise I18nHTTPException(404, KEYS.PROJECT_NOT_FOUND)
        raise I18nHTTPException(400, KEYS.INVALID_YAML_FRONTMATTER, detail=str(e))
    """

    def __init__(
        self,
        status_code: int,
        message_key: str,
        *,
        detail: str | None = None,
        **kwargs: Any,
    ):
        """I18nHTTPException을 생성한다.

        Args:
            status_code: HTTP 상태 코드 (404, 400 등)
            message_key: i18n 키 (예: errors.project_not_found)
            detail: translate의 detail 파라미터 (키에 {{detail}} 등이 있을 때)
            **kwargs: translate에 전달할 추가 치환 변수 (path, project_id 등)
        """
        self.message_key = message_key
        self.i18n_params = kwargs if detail is None else {**kwargs, "detail": detail}
        super().__init__(status_code=status_code, detail=message_key)
