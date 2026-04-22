"""번역 메시지 로더 — ko/en JSON 기반."""

import json
from pathlib import Path

from vibesmith_api.i18n.constants import DEFAULT_LOCALE, SUPPORTED_LOCALES

# 패키지 내 locales 디렉토리
_LOCALES_DIR = Path(__file__).resolve().parent / "locales"

# 로드된 메시지 캐시 {locale: {key: message}}
_cache: dict[str, dict[str, str]] = {}


def _load_locale(locale: str) -> dict[str, str]:
    """지정 locale의 JSON 파일을 로드한다. 없으면 빈 dict."""
    if locale in _cache:
        return _cache[locale]
    path = _LOCALES_DIR / f"{locale}.json"
    if not path.exists():
        _cache[locale] = {}
        return _cache[locale]
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        # 중첩 키를 점 표기법으로 평탄화: {"errors": {"not_found": "..."}} -> "errors.not_found"
        flat: dict[str, str] = {}

        def _flatten(obj: dict, prefix: str = "") -> None:
            for k, v in obj.items():
                key = f"{prefix}.{k}" if prefix else k
                if isinstance(v, dict):
                    _flatten(v, key)
                else:
                    flat[key] = str(v)

        _flatten(data)
        _cache[locale] = flat
        return flat
    except (json.JSONDecodeError, OSError):
        _cache[locale] = {}
        return _cache[locale]


def get_messages(locale: str) -> dict[str, str]:
    """지정 locale의 전체 메시지 dict를 반환한다."""
    return _load_locale(locale).copy()


def translate(
    key: str,
    locale: str | None = None,
    *,
    default: str | None = None,
    **kwargs: str | int | float,
) -> str:
    """번역 키를 locale에 맞는 메시지로 변환한다.

    Args:
        key: 점 표기법 키 (예: "errors.project_not_found")
        locale: 대상 locale. None이면 _DEFAULT_LOCALE 사용
        default: 키가 없을 때 반환할 기본값. None이면 키 자체 반환
        **kwargs: 메시지 내 치환 변수 ({{name}} 등)

    Returns:
        번역된 메시지. fallback: locale → default locale → key
    """
    loc = (locale or DEFAULT_LOCALE).lower()
    if loc not in SUPPORTED_LOCALES:
        loc = DEFAULT_LOCALE

    messages = _load_locale(loc)
    text = messages.get(key)

    if text is None and loc != DEFAULT_LOCALE:
        messages = _load_locale(DEFAULT_LOCALE)
        text = messages.get(key)

    if text is None:
        text = default if default is not None else key

    # 단순 치환: {{name}} -> kwargs["name"]
    for k, v in kwargs.items():
        text = text.replace("{{" + k + "}}", str(v))
    return text
