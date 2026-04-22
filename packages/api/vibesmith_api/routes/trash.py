"""휴지통 API 엔드포인트 (Issue #165)."""

from fastapi import APIRouter, Depends, Request
from vibesmith_core import VibeSmithCore

from vibesmith_api.deps import get_core, get_locale
from vibesmith_api.i18n import KEYS, translate
from vibesmith_api.i18n.exceptions import I18nHTTPException
from vibesmith_api.schemas import ComponentResponse, TrashItemResponse

router = APIRouter(prefix="/api", tags=["trash"])


def _to_trash_item(core: VibeSmithCore, comp, deleted_at: str) -> TrashItemResponse:
    """ComponentBase + deleted_at → TrashItemResponse 변환."""
    project = core.projects.get(comp.project_id)
    project_name = project.name if project else ""
    return TrashItemResponse(
        id=comp.id,
        type=str(comp.type),
        name=comp.name,
        description=comp.description,
        enabled=comp.enabled,
        tags=comp.tags,
        project_id=comp.project_id,
        project_name=project_name,
        path=comp.path,
        created_at=comp.created_at,
        updated_at=comp.updated_at,
        platform=comp.platform,
        deleted_at=deleted_at,
    )


@router.get(
    "/trash",
    response_model=list[TrashItemResponse],
    summary="휴지통 목록 조회",
)
def list_trash(core: VibeSmithCore = Depends(get_core)):
    """휴지통에 있는 구성요소 목록을 반환합니다."""
    items = core.operations.list_trash_with_deleted_at()
    return [_to_trash_item(core, comp, deleted_at) for comp, deleted_at in items]


@router.post(
    "/trash/{component_id}/restore",
    response_model=ComponentResponse,
    summary="휴지통에서 복원",
)
def restore_from_trash(
    component_id: str,
    core: VibeSmithCore = Depends(get_core),
):
    """휴지통에서 구성요소를 복원합니다."""
    try:
        restored = core.operations.restore(component_id)
    except ValueError:
        raise I18nHTTPException(404, KEYS.COMPONENT_NOT_FOUND)
    return ComponentResponse(
        id=restored.id,
        type=str(restored.type),
        name=restored.name,
        description=restored.description,
        enabled=restored.enabled,
        tags=restored.tags,
        project_id=restored.project_id,
        path=restored.path,
        created_at=restored.created_at,
        updated_at=restored.updated_at,
        platform=restored.platform,
    )


@router.delete(
    "/trash/{component_id}",
    summary="휴지통 항목 영구 삭제",
    response_model=dict,
)
def permanent_delete_trash_item(
    request: Request,
    component_id: str,
    core: VibeSmithCore = Depends(get_core),
):
    """휴지통에서 특정 항목을 영구 삭제합니다."""
    existing = core.operations.read(component_id, include_deleted=True)
    if existing is None:
        raise I18nHTTPException(404, KEYS.COMPONENT_NOT_FOUND)
    conn = core.db.get_connection()
    row = conn.execute(
        "SELECT deleted_at FROM components WHERE id = ?",
        (component_id,),
    ).fetchone()
    if not row or not row[0]:
        raise I18nHTTPException(404, KEYS.COMPONENT_NOT_FOUND)
    core.operations.delete(component_id)
    locale = get_locale(request)
    return {"message_key": KEYS.DELETED, "message": translate(KEYS.DELETED, locale=locale)}


@router.delete(
    "/trash",
    summary="휴지통 비우기",
    response_model=dict,
)
def empty_trash(request: Request, core: VibeSmithCore = Depends(get_core)):
    """휴지통의 모든 항목을 영구 삭제합니다."""
    items = core.operations.list_trash()
    for comp in items:
        core.operations.delete(comp.id)
    locale = get_locale(request)
    return {"message_key": KEYS.DELETED, "message": translate(KEYS.DELETED, locale=locale)}
