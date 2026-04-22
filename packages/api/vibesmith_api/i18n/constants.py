"""i18n 모듈 상수 — 지원 로케일, 기본 로케일, fallback 정책."""

# 지원 로케일 (ko, en)
SUPPORTED_LOCALES: tuple[str, ...] = ("ko", "en")

# 기본 로케일 (locale 미지정 또는 매칭 실패 시)
DEFAULT_LOCALE: str = "en"

# Fallback 순서: 요청 locale → DEFAULT_LOCALE → 키/기본값
# 1. Accept-Language/X-Locale에서 resolve된 locale 사용
# 2. 해당 locale에 키가 없으면 DEFAULT_LOCALE로 fallback
# 3. DEFAULT_LOCALE에도 없으면 key 또는 default 파라미터 반환
