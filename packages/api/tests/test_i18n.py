"""i18n 모듈 테스트 — locale resolver, 로더, fallback, 의존성."""

from unittest.mock import patch

from fastapi import Request
from fastapi.testclient import TestClient

from vibesmith_api.deps import get_locale
from vibesmith_api.i18n import (
    DEFAULT_LOCALE,
    KEYS,
    SUPPORTED_LOCALES,
    get_messages,
    resolve_locale,
    resolve_locale_from_request,
    translate,
)


class TestResolveLocale:
    """resolve_locale 테스트."""

    def test_ko_kr_returns_ko(self):
        """ko-KR, ko 우선 시 ko 반환."""
        assert resolve_locale("ko-KR,ko;q=0.9,en;q=0.8") == "ko"

    def test_en_us_returns_en(self):
        """en-US 시 en 반환."""
        assert resolve_locale("en-US,en;q=0.9") == "en"

    def test_unsupported_returns_default(self):
        """지원하지 않는 locale 시 default(en) 반환."""
        assert resolve_locale("fr,de;q=0.8") == "en"

    def test_none_or_empty_returns_default(self):
        """None/빈 문자열 시 default 반환."""
        assert resolve_locale(None) == "en"
        assert resolve_locale("") == "en"
        assert resolve_locale("   ") == "en"

    def test_quality_order_respected(self):
        """quality 값에 따른 우선순위 적용."""
        # en;q=0.9 > ko;q=0.8 이면 en
        assert resolve_locale("ko;q=0.8,en;q=0.9") == "en"
        assert resolve_locale("en;q=0.8,ko;q=0.9") == "ko"

    def test_custom_supported_and_default(self):
        """커스텀 supported, default 적용."""
        assert resolve_locale("ja", supported=["ja", "ko"], default="ko") == "ja"
        assert resolve_locale("fr", supported=["ja", "ko"], default="ko") == "ko"


class TestResolveLocaleFromRequest:
    """resolve_locale_from_request 테스트."""

    def test_x_locale_overrides_accept_language(self):
        """X-Locale이 Accept-Language보다 우선."""
        assert resolve_locale_from_request("en-US,en;q=0.9", "ko") == "ko"
        assert resolve_locale_from_request("ko-KR,ko;q=0.9", "en") == "en"

    def test_x_locale_ko_kr_normalized_to_ko(self):
        """X-Locale ko-KR -> ko."""
        assert resolve_locale_from_request(None, "ko-KR") == "ko"

    def test_x_locale_unsupported_falls_back_to_accept_language(self):
        """X-Locale 미지원 시 Accept-Language 파싱."""
        assert resolve_locale_from_request("ko-KR,ko;q=0.9", "fr") == "ko"

    def test_both_empty_returns_default(self):
        """둘 다 없으면 default."""
        assert resolve_locale_from_request(None, None) == "en"
        assert resolve_locale_from_request("", "") == "en"


class TestLoader:
    """get_messages, translate 테스트."""

    def test_get_messages_returns_dict(self):
        """get_messages는 dict 반환."""
        ko = get_messages("ko")
        en = get_messages("en")
        assert isinstance(ko, dict)
        assert isinstance(en, dict)
        assert "errors.project_not_found" in ko
        assert "errors.project_not_found" in en

    def test_translate_ko(self):
        """translate(locale=ko) 한국어 반환."""
        msg = translate(KEYS.PROJECT_NOT_FOUND, locale="ko")
        assert msg == "프로젝트를 찾을 수 없습니다"

    def test_translate_en(self):
        """translate(locale=en) 영어 반환."""
        msg = translate(KEYS.PROJECT_NOT_FOUND, locale="en")
        assert msg == "Project not found"

    def test_translate_default_locale_when_none(self):
        """locale=None 시 default(en) 사용."""
        msg = translate(KEYS.PROJECT_NOT_FOUND)
        assert msg == "Project not found"

    def test_translate_fallback_to_en_when_key_missing_in_ko(self):
        """ko에 키 없으면 en으로 fallback."""
        from vibesmith_api.i18n import loader

        def mock_load(loc: str):
            return {"errors.en_only_key": "En message"} if loc == "en" else {}

        with patch.object(loader, "_load_locale", side_effect=mock_load):
            msg = translate("errors.en_only_key", locale="ko")
            assert msg == "En message"

    def test_translate_unsupported_locale_falls_back_to_default(self):
        """지원하지 않는 locale(ja 등) 요청 시 DEFAULT_LOCALE(en) 사용."""
        msg = translate(KEYS.PROJECT_NOT_FOUND, locale="ja")
        assert msg == "Project not found"

    def test_translate_with_params(self):
        """치환 변수 {{detail}} 적용."""
        msg = translate(
            KEYS.INVALID_YAML_FRONTMATTER,
            locale="en",
            detail="unexpected indent",
        )
        assert "unexpected indent" in msg
        assert "Invalid YAML" in msg

    def test_translate_unknown_key_returns_default_or_key(self):
        """알 수 없는 키 시 default 또는 키 자체."""
        msg = translate("unknown.key", locale="en", default="Fallback")
        assert msg == "Fallback"
        msg2 = translate("unknown.key", locale="en")
        assert msg2 == "unknown.key"


class TestGetLocaleDependency:
    """get_locale 의존성 테스트."""

    def test_get_locale_from_accept_language(self):
        """Accept-Language 헤더에서 locale 추출."""
        req = Request(
            scope={
                "type": "http",
                "headers": [(b"accept-language", b"ko-KR,ko;q=0.9")],
            }
        )
        assert get_locale(req) == "ko"

    def test_get_locale_from_x_locale(self):
        """X-Locale 헤더 우선."""
        req = Request(
            scope={
                "type": "http",
                "headers": [
                    (b"accept-language", b"en-US,en;q=0.9"),
                    (b"x-locale", b"ko"),
                ],
            }
        )
        assert get_locale(req) == "ko"

    def test_get_locale_no_headers_returns_en(self):
        """헤더 없으면 en."""
        req = Request(scope={"type": "http", "headers": []})
        assert get_locale(req) == "en"


class TestConstants:
    """i18n 상수 테스트."""

    def test_supported_locales(self):
        """SUPPORTED_LOCALES에 ko, en 포함."""
        assert "ko" in SUPPORTED_LOCALES
        assert "en" in SUPPORTED_LOCALES
        assert len(SUPPORTED_LOCALES) == 2

    def test_default_locale(self):
        """DEFAULT_LOCALE은 en."""
        assert DEFAULT_LOCALE == "en"


class TestKeys:
    """KEYS 상수 테스트."""

    def test_keys_exist(self):
        """표준 키 상수 존재."""
        assert KEYS.PROJECT_NOT_FOUND == "errors.project_not_found"
        assert KEYS.COMPONENT_NOT_FOUND == "errors.component_not_found"
        assert KEYS.TEMPLATE_NOT_FOUND == "errors.template_not_found"
        assert KEYS.DUPLICATE_COMPONENT_NAME.startswith("errors.")
        assert KEYS.DELETED == "common.deleted"
        assert KEYS.VALIDATION_ERROR == "errors.validation_error"  # Issue #223


# ---------------------------------------------------------------------------
# Issue #223: API 응답 message_key, message 포맷 회귀 테스트
# ---------------------------------------------------------------------------


class TestI18nApiResponseFormat:
    """API 에러/성공 응답의 message_key, message 표준 포맷 검증."""

    def test_404_response_includes_message_key_and_message(self, client: TestClient):
        """404 에러 응답에 detail, message_key, message 포함."""
        resp = client.get("/api/projects/nonexistent-id")
        assert resp.status_code == 404
        data = resp.json()
        assert "detail" in data
        assert data["message_key"] == "errors.project_not_found"
        assert data["message"] == data["detail"]

    def test_404_response_respects_accept_language_ko(self, client: TestClient):
        """Accept-Language: ko 시 한국어 메시지."""
        resp = client.get(
            "/api/projects/nonexistent-id",
            headers={"Accept-Language": "ko-KR,ko;q=0.9"},
        )
        assert resp.status_code == 404
        data = resp.json()
        assert data["message"] == "프로젝트를 찾을 수 없습니다"
        assert data["message_key"] == "errors.project_not_found"

    def test_404_response_respects_x_locale_ko(self, client: TestClient):
        """X-Locale: ko 시 한국어 메시지."""
        resp = client.get(
            "/api/projects/nonexistent-id",
            headers={"X-Locale": "ko"},
        )
        assert resp.status_code == 404
        assert resp.json()["message"] == "프로젝트를 찾을 수 없습니다"

    def test_422_validation_includes_message_key(self, client: TestClient):
        """422 검증 에러에 message_key, message 포함."""
        resp = client.post(
            "/api/components",
            json={"type": "skill"},  # missing required fields
        )
        assert resp.status_code == 422
        data = resp.json()
        assert "detail" in data
        assert isinstance(data["detail"], list)
        assert data["message_key"] == "errors.validation_error"
        assert "message" in data

    def test_delete_success_includes_message_key(self, client: TestClient, core):
        """삭제 성공 응답에 message, message_key 포함."""
        core.projects.add_project("/tmp/i18n-delete-test")
        projs = client.get("/api/projects").json()
        proj = next(p for p in projs if p["path"] == "/tmp/i18n-delete-test")

        resp = client.delete(f"/api/projects/{proj['id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["message"] == "Project has been hidden"
        assert data["message_key"] == "common.project_hidden"

    def test_component_404_includes_message_key(self, client: TestClient):
        """컴포넌트 404 에러에 message_key, message 포함."""
        resp = client.get("/api/components/nonexistent-component-id")
        assert resp.status_code == 404
        data = resp.json()
        assert data["message_key"] == "errors.component_not_found"
        assert data["message"] == data["detail"]

    def test_template_404_includes_message_key(self, client: TestClient):
        """템플릿 404 에러에 message_key, message 포함."""
        resp = client.get("/api/templates/nonexistent-template")
        assert resp.status_code == 404
        data = resp.json()
        assert data["message_key"] == "errors.template_not_found"
        assert data["message"] == data["detail"]

    def test_409_duplicate_component_includes_message_key(self, client: TestClient, core):
        """409 중복 컴포넌트 에러에 message_key 포함."""
        proj = core.projects.list_all()[0]
        from vibesmith_core.components.models import Skill

        skill = Skill(
            id="dup-test-1",
            type="skill",
            name="dup-skill",
            description="dup",
            project_id=proj.id,
            path="/tmp/x/skills/dup-skill/SKILL.md",
            created_at="2026-01-01T00:00:00Z",
            updated_at="2026-01-01T00:00:00Z",
            platform="claude_code",
        )
        core.operations.create(skill)

        resp = client.post(
            "/api/components",
            json={
                "type": "skill",
                "name": "dup-skill",
                "project_id": proj.id,
                "content": "---\nname: dup-skill\n---\n",
                "platform": "claude_code",
            },
        )
        assert resp.status_code == 409
        data = resp.json()
        assert data["message_key"] == "errors.duplicate_component_name"
        assert "message" in data

    def test_copy_include_deps_success_response(self, client: TestClient, core, tmp_path):
        """copy include_dependencies=true 요청은 성공 응답을 반환한다."""
        from test_components import _make_skill

        proj = core.projects.list_all()[0]
        target_dir = tmp_path / "copy-target"
        target_dir.mkdir()
        target = core.projects.add_project(str(target_dir))
        skill = _make_skill(core, proj.id, "copy-501-test")

        resp = client.post(
            f"/api/components/{skill.id}/copy",
            json={"target_project_id": target.id, "include_dependencies": True},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "copied" in data
        assert len(data["copied"]) >= 1

    def test_delete_project_success_ko_locale(self, client: TestClient, core):
        """DELETE project 성공 시 X-Locale: ko 로 한국어 메시지."""
        core.projects.add_project("/tmp/i18n-delete-ko-test")
        projs = client.get("/api/projects").json()
        proj = next(p for p in projs if p["path"] == "/tmp/i18n-delete-ko-test")

        resp = client.delete(
            f"/api/projects/{proj['id']}",
            headers={"X-Locale": "ko"},
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "프로젝트가 숨겨졌습니다"
        assert resp.json()["message_key"] == "common.project_hidden"

    def test_422_message_respects_locale(self, client: TestClient):
        """422 검증 에러 message가 locale에 따라 번역됨."""
        resp = client.post(
            "/api/components",
            json={"type": "skill"},
            headers={"X-Locale": "ko"},
        )
        assert resp.status_code == 422
        data = resp.json()
        assert data["message_key"] == "errors.validation_error"
        assert "입력값" in data["message"] or "필드" in data["message"]

    def test_template_keys_exist(self):
        """템플릿 관련 i18n 키가 존재하는지 확인."""
        from vibesmith_api.i18n.keys import KEYS

        assert hasattr(KEYS, "TEMPLATES_LOAD_FAILED")
        assert hasattr(KEYS, "TEMPLATE_LOAD_FAILED")
        assert hasattr(KEYS, "TEMPLATE_GENERATE_FAILED")

        assert KEYS.TEMPLATES_LOAD_FAILED == "errors.templates_load_failed"
        assert KEYS.TEMPLATE_LOAD_FAILED == "errors.template_load_failed"
        assert KEYS.TEMPLATE_GENERATE_FAILED == "errors.template_generate_failed"
