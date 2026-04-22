"""충돌 API 엔드포인트 (Issue #164) — 글로벌 vs 프로젝트 동일 이름 구성요소."""

from fastapi import APIRouter, Depends
from vibesmith_core import VibeSmithCore
from vibesmith_core.components.conflicts import list_conflicts, resolve_conflict

from vibesmith_api.deps import get_core
from vibesmith_api.i18n import KEYS
from vibesmith_api.i18n.exceptions import I18nHTTPException
from vibesmith_api.schemas import (
    ConflictResolveRequest,
    ConflictResolveResponse,
    ConflictResponse,
)

router = APIRouter(prefix="/api", tags=["conflicts"])


def _to_response(rec: dict) -> ConflictResponse:
    """ConflictRecord → ConflictResponse 변환."""
    return ConflictResponse(
        id=rec["id"],
        name=rec["name"],
        type=rec["type"],
        global_component_id=rec["global_component_id"],
        project_component_id=rec["project_component_id"],
        project_name=rec["project_name"],
        priority=rec["priority"],
        is_intentional=rec["is_intentional"],
    )


@router.get(
    "/conflicts",
    response_model=list[ConflictResponse],
    summary="충돌 목록 조회",
)
def get_conflicts(
    project_id: str | None = None,
    core: VibeSmithCore = Depends(get_core),
):
    """글로벌과 프로젝트 간 동일 name+type 구성요소 충돌 목록을 반환합니다.

    project_id가 있으면 해당 프로젝트 충돌만, 없으면 전체 반환.
    """
    conflicts = list_conflicts(core._db, project_id=project_id)
    return [_to_response(c) for c in conflicts]


@router.post(
    "/conflicts/{conflict_id}/resolve",
    response_model=ConflictResolveResponse,
    summary="충돌 해결",
)
def resolve_conflict_endpoint(
    conflict_id: str,
    req: ConflictResolveRequest,
    core: VibeSmithCore = Depends(get_core),
):
    """충돌 해결 액션을 수행합니다.

    - disable_global: 글로벌 구성요소 비활성화
    - delete_project: 프로젝트 구성요소 휴지통으로 이동
    - rename: new_name, target(global|project)으로 이름 변경
    - ignore: 의도적 오버라이드로 표시 (is_intentional 저장)
    """
    try:
        success, updated = resolve_conflict(
            core._db,
            core.operations,
            conflict_id,
            action=req.action,
            new_name=req.new_name,
            target=req.target,
        )
        return ConflictResolveResponse(
            success=success,
            conflict_id=conflict_id,
            updated_component_ids=updated,
        )
    except ValueError as e:
        msg = str(e)
        if "Invalid conflict_id" in msg or "not found" in msg.lower():
            raise I18nHTTPException(404, KEYS.COMPONENT_NOT_FOUND)
        if "rename action requires" in msg or "requires new_name" in msg:
            raise I18nHTTPException(400, KEYS.VALIDATION_ERROR)
        raise I18nHTTPException(400, KEYS.VALIDATION_ERROR)
