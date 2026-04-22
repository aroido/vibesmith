"""TemplateManager 단위 테스트."""

import pytest

from vibesmith_core.templates.manager import TemplateManager


@pytest.fixture
def template_manager():
    """TemplateManager 인스턴스 생성."""
    return TemplateManager()


def test_load_metadata(template_manager):
    """템플릿 메타데이터 로드 테스트."""
    templates = template_manager.get_templates()
    assert len(templates) > 0
    assert all("id" in t for t in templates)
    assert all("name" in t for t in templates)


def test_get_template_by_id(template_manager):
    """ID로 템플릿 조회 테스트."""
    template = template_manager.get_template("python-dev")
    assert template["id"] == "python-dev"
    assert template["name"] == "Python Development Skill"
    assert template["component_type"] == "skill"


def test_get_template_not_found(template_manager):
    """존재하지 않는 템플릿 조회 시 에러 발생."""
    with pytest.raises(ValueError, match="Template not found"):
        template_manager.get_template("non-existent")


def test_filter_by_component_type(template_manager):
    """구성요소 타입별 필터링 테스트."""
    skills = template_manager.get_templates(component_type="skill")
    assert all(t["component_type"] == "skill" for t in skills)

    agents = template_manager.get_templates(component_type="agent")
    assert all(t["component_type"] == "agent" for t in agents)


def test_get_template_fields(template_manager):
    """템플릿 필드 정의 조회 테스트."""
    fields = template_manager.get_template_fields("python-dev")
    assert len(fields) > 0

    # 필수 필드 확인
    field_names = [f["name"] for f in fields]
    assert "skill_name" in field_names
    assert "description" in field_names
    assert "tools" in field_names


def test_render_template(template_manager):
    """템플릿 렌더링 테스트."""
    variables = {
        "skill_name": "test-skill",
        "description": "Test skill for pytest",
        "tools": ["read", "write"],
        "context": ["project_structure"],
    }

    content = template_manager.render_template("python-dev", variables)

    # 렌더링 결과 검증
    assert "test-skill" in content
    assert "Test skill for pytest" in content
    assert "- read" in content
    assert "- write" in content
    assert "- project_structure" in content


def test_validate_template_success(template_manager):
    """템플릿 검증 성공 테스트."""
    result = template_manager.validate_template("python-dev")
    assert result["valid"] is True
    assert len(result["errors"]) == 0


def test_validate_template_not_found(template_manager):
    """존재하지 않는 템플릿 검증 시 실패."""
    result = template_manager.validate_template("non-existent")
    assert result["valid"] is False
    assert len(result["errors"]) > 0
