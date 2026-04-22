"""Locale resolver — Accept-Language 파싱 및 fallback 정책."""

from vibesmith_api.i18n.constants import DEFAULT_LOCALE, SUPPORTED_LOCALES

# RFC 7231 §5.3.5: Accept-Language: da, en-gb;q=0.8, en;q=0.7
# 형식: language-range [ ; q=quality ]
# quality 생략 시 1.0


def resolve_locale(
    accept_language: str | None,
    *,
    supported: list[str] | None = None,
    default: str = DEFAULT_LOCALE,
) -> str:
    """Accept-Language 헤더를 파싱하여 지원하는 첫 번째 locale을 반환한다.

    Args:
        accept_language: HTTP Accept-Language 헤더 값 (예: "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7")
        supported: 지원 locale 목록. None이면 ("ko", "en") 사용
        default: 매칭 실패 시 반환할 기본 locale

    Returns:
        지원되는 locale 코드 (예: "ko", "en")

    Examples:
        >>> resolve_locale("ko-KR,ko;q=0.9,en;q=0.8")
        'ko'
        >>> resolve_locale("en-US,en;q=0.9")
        'en'
        >>> resolve_locale("fr,de;q=0.8")  # ko, en 미지원
        'en'
        >>> resolve_locale(None)
        'en'
    """
    supported_list = supported or list(SUPPORTED_LOCALES)
    supported_set = {loc.lower() for loc in supported_list}
    default_lower = default.lower()

    if not accept_language or not accept_language.strip():
        return default_lower if default_lower in supported_set else supported_list[0].lower()

    # 파싱: "ko-KR;q=0.9" -> ("ko", 0.9), "en" -> ("en", 1.0)
    pairs: list[tuple[str, float]] = []
    for part in accept_language.split(","):
        part = part.strip()
        if not part:
            continue
        if ";q=" in part:
            lang_range, _, q_str = part.partition(";q=")
            try:
                q = float(q_str.strip())
            except ValueError:
                q = 1.0
        else:
            lang_range = part
            q = 1.0
        lang_range = lang_range.strip().lower()
        if not lang_range:
            continue
        # "ko-kr" -> "ko", "en-us" -> "en" (primary language tag)
        primary = lang_range.split("-")[0] if "-" in lang_range else lang_range
        pairs.append((primary, q))

    # quality 내림차순 정렬 (동점 시 원본 순서 유지)
    pairs.sort(key=lambda x: -x[1])

    for primary, _ in pairs:
        if primary in supported_set:
            return primary

    return default_lower if default_lower in supported_set else supported_list[0].lower()


def resolve_locale_from_request(
    accept_language: str | None,
    x_locale: str | None,
    *,
    supported: list[str] | None = None,
    default: str = DEFAULT_LOCALE,
) -> str:
    """요청 헤더에서 locale을 결정한다.

    X-Locale 헤더가 있으면 우선 사용, 없으면 Accept-Language 파싱.
    """
    supported_list = supported or list(SUPPORTED_LOCALES)
    supported_set = {loc.lower() for loc in supported_list}

    if x_locale and x_locale.strip():
        primary = x_locale.strip().lower().split("-")[0]
        if primary in supported_set:
            return primary

    return resolve_locale(accept_language, supported=supported_list, default=default)
