"""ComponentGenerator 단위 테스트."""

import pytest

from vibesmith_core.templates.generator import ComponentGenerator


@pytest.fixture
def generator():
    """ComponentGenerator 인스턴스 생성."""
    return ComponentGenerator()


def test_generate_component(generator):
    """컴포넌트 생성 테스트."""
    result = generator.generate(
        component_type="skill",
        template_id="python-dev",
        name="test-skill",
        description="Test skill for pytest automation",
        config={
            "tools": ["read", "write"],
            "context": ["project_structure"],
        },
    )

    assert "content" in result
    assert "preview_id" in result
    assert "expires_at" in result
    assert "component_type" in result
    assert "file_name" in result

    assert result["component_type"] == "skill"
    assert result["file_name"] == "SKILL.md"
    assert "test-skill" in result["content"]


def test_generate_component_type_mismatch(generator):
    """템플릿 타입과 요청 타입 불일치 시 에러."""
    with pytest.raises(ValueError, match="Template type mismatch"):
        generator.generate(
            component_type="agent",  # agent 요청
            template_id="python-dev",  # skill 템플릿
            name="test",
            description="Test",
            config={},
        )


def test_generate_missing_required_field(generator):
    """필수 필드 누락 시 에러."""
    # description은 필수이지만 길이가 너무 짧으면 검증 실패
    with pytest.raises(ValueError, match="must be at least"):
        generator.generate(
            component_type="skill",
            template_id="python-dev",
            name="test-skill",
            description="Test",  # 너무 짧음 (10자 이상 필요)
            config={},
        )


def test_generate_preview_caching(generator):
    """미리보기 캐싱 테스트."""
    result = generator.generate(
        component_type="skill",
        template_id="python-dev",
        name="test-skill",
        description="Test skill description",
        config={"tools": ["read"]},
    )

    preview_id = result["preview_id"]

    # 미리보기 조회
    preview = generator.get_preview(preview_id)
    assert preview["content"] == result["content"]
    assert preview["component_type"] == "skill"


def test_get_preview_not_found(generator):
    """존재하지 않는 미리보기 조회 시 에러."""
    with pytest.raises(ValueError, match="Preview not found"):
        generator.get_preview("non-existent")


def test_file_name_by_type(generator):
    """구성요소 타입별 파일명 테스트."""
    test_cases = [
        ("skill", "SKILL.md"),
        ("agent", "AGENT.md"),
        ("command", "COMMAND.md"),
        ("hook", "HOOK.md"),
        ("rule", "RULE.md"),
    ]

    for component_type, expected_file_name in test_cases:
        assert generator._get_file_name(component_type) == expected_file_name


def test_validate_field_text_length(generator):
    """텍스트 필드 길이 검증 테스트."""
    field = {
        "name": "test_field",
        "type": "text",
        "validation": {
            "min_length": 3,
            "max_length": 10,
        },
    }

    # 너무 짧음
    with pytest.raises(ValueError, match="at least 3 characters"):
        generator._validate_field_value(field, "ab")

    # 너무 김
    with pytest.raises(ValueError, match="at most 10 characters"):
        generator._validate_field_value(field, "a" * 11)

    # 정상
    generator._validate_field_value(field, "valid")


def test_validate_field_multiselect(generator):
    """Multiselect 필드 검증 테스트."""
    field = {
        "name": "tools",
        "type": "multiselect",
        "options": ["read", "write", "shell"],
    }

    # 정상
    generator._validate_field_value(field, ["read", "write"])

    # 잘못된 옵션
    with pytest.raises(ValueError, match="Invalid option"):
        generator._validate_field_value(field, ["read", "invalid"])

    # 리스트가 아님
    with pytest.raises(ValueError, match="must be a list"):
        generator._validate_field_value(field, "read")
