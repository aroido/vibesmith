"""템플릿 관리 API 라우트."""

from fastapi import APIRouter
from vibesmith_core import ComponentGenerator, TemplateManager

from ..i18n.exceptions import I18nHTTPException
from ..i18n.keys import KEYS
from ..schemas import (
    ComponentGenerateRequest,
    ComponentGenerateResponse,
    TemplateResponse,
    TemplatesListResponse,
)

router = APIRouter(prefix="/api/templates", tags=["templates"])

# 전역 인스턴스 (싱글톤 패턴)
_template_manager: TemplateManager | None = None
_component_generator: ComponentGenerator | None = None


def get_template_manager() -> TemplateManager:
    """TemplateManager 싱글톤 인스턴스 반환."""
    global _template_manager
    if _template_manager is None:
        _template_manager = TemplateManager()
    return _template_manager


def get_component_generator() -> ComponentGenerator:
    """ComponentGenerator 싱글톤 인스턴스 반환."""
    global _component_generator
    if _component_generator is None:
        _component_generator = ComponentGenerator(get_template_manager())
    return _component_generator


@router.get("", response_model=TemplatesListResponse)
async def list_templates(
    component_type: str | None = None,
    category: str | None = None,
) -> TemplatesListResponse:
    """템플릿 목록 조회.

    Args:
        component_type: 구성요소 타입 필터 (skill, agent, command, hook, rule)
        category: 카테고리 필터 (development, testing, etc)

    Returns:
        템플릿 목록 및 전체 개수
    """
    try:
        manager = get_template_manager()
        templates_data = manager.get_templates(
            component_type=component_type,
            category=category,
        )

        # 메타데이터를 TemplateResponse 스키마로 변환
        templates = [
            TemplateResponse(
                id=t["id"],
                name=t["name"],
                description=t["description"],
                component_type=t["component_type"],
                category=t["category"],
                icon=t["icon"],
                difficulty=t["difficulty"],
                estimated_time=t["estimated_time"],
                fields=manager.get_template_fields(t["id"]),
                tags=t.get("tags", []),
            )
            for t in templates_data
        ]

        return TemplatesListResponse(templates=templates, total=len(templates))

    except Exception as e:
        raise I18nHTTPException(500, KEYS.TEMPLATES_LOAD_FAILED, detail=str(e))


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: str) -> TemplateResponse:
    """특정 템플릿 상세 조회.

    Args:
        template_id: 템플릿 ID

    Returns:
        템플릿 상세 정보
    """
    try:
        manager = get_template_manager()
        template = manager.get_template(template_id)
        fields = manager.get_template_fields(template_id)

        return TemplateResponse(
            id=template["id"],
            name=template["name"],
            description=template["description"],
            component_type=template["component_type"],
            category=template["category"],
            icon=template["icon"],
            difficulty=template["difficulty"],
            estimated_time=template["estimated_time"],
            fields=fields,
            tags=template.get("tags", []),
        )

    except ValueError:
        raise I18nHTTPException(404, KEYS.TEMPLATE_NOT_FOUND)
    except Exception as e:
        raise I18nHTTPException(500, KEYS.TEMPLATE_LOAD_FAILED, detail=str(e))


@router.post("/generate", response_model=ComponentGenerateResponse)
async def generate_component(
    request: ComponentGenerateRequest,
) -> ComponentGenerateResponse:
    """템플릿 기반 컴포넌트 생성 (미리보기).

    Args:
        request: 컴포넌트 생성 요청

    Returns:
        생성된 컴포넌트 본문 및 미리보기 ID
    """
    try:
        generator = get_component_generator()
        result = generator.generate(
            component_type=request.component_type,
            template_id=request.template_id,
            name=request.name,
            description=request.description,
            config=request.config,
        )

        return ComponentGenerateResponse(**result)

    except ValueError as e:
        raise I18nHTTPException(400, KEYS.TEMPLATE_GENERATE_FAILED, detail=str(e))
    except Exception as e:
        raise I18nHTTPException(500, KEYS.TEMPLATE_GENERATE_FAILED, detail=str(e))
