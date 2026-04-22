"""Usage Tracking 엔드포인트 (Issue #67)."""

from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from vibesmith_core import VibeSmithCore
from vibesmith_core.usage.repo import (
    get_component_timeline,
    get_last_parsed_at,
    get_total_sessions,
    get_unused_components,
    get_usage_ranking,
)

from vibesmith_api.deps import get_core
from vibesmith_api.i18n import KEYS
from vibesmith_api.i18n.exceptions import I18nHTTPException
from vibesmith_api.schemas import (
    UsageComponentTimelineResponse,
    UsageRankingItem,
    UsageResetResponse,
    UsageResponse,
    UsageScanResponse,
    UsageTimelineEntry,
    UsageUnusedItem,
)

router = APIRouter(prefix="/api", tags=["usage"])


@router.get(
    "/usage",
    response_model=UsageResponse,
    summary="사용 현황 조회 (Issue #67)",
    response_description="구성요소 사용 랭킹, 미사용 목록, 세션 파싱 현황",
)
def get_usage(
    project_id: str | None = None,
    component_type: str | None = None,
    days: int | None = None,
    platform: str | None = None,
    aggregation_mode: Literal["strict", "expanded"] = Query(
        "strict",
        description="집계 모드 — strict=고신뢰 신호만, expanded=fallback 포함",
    ),
    dedupe_by_session: str = Query(
        "auto",
        description="집계 모드 — auto=플랫폼/타입별 자동, true=전체 dedupe, false=전체 SUM",
    ),
    core: VibeSmithCore = Depends(get_core),
):
    """세션 로그에서 파싱된 구성요소 사용 현황을 반환합니다.

    **Query Parameters:**
    - `project_id`: 특정 프로젝트만 필터 (선택)
    - `component_type`: 구성요소 타입 필터 — `skill`, `agent`, `hook`, `rule` (선택)
    - `days`: 최근 N일 이내 데이터만 집계 (선택, 미지정 시 전체)
    - `platform`: 플랫폼 필터 — `claude_code`, `cursor` (선택, 미지정 시 전체)
    - `aggregation_mode`: `strict`(기본) 또는 `expanded`
    - `dedupe_by_session`: 동일 세션 내 중복 집계 제거 여부 (기본: true)
    """
    conn = core.db.get_connection()

    matched_only = True

    ranking_data = get_usage_ranking(
        conn,
        component_type=component_type,
        days=days,
        platform=platform,
        project_id=project_id,
        matched_only=matched_only,
        aggregation_mode=aggregation_mode,
        dedupe_by_session=dedupe_by_session,
    )
    unused_data = get_unused_components(conn, component_type=component_type, project_id=project_id)
    total_sessions = get_total_sessions(conn, project_id=project_id)
    last_parsed = get_last_parsed_at(conn)

    ranking = [
        UsageRankingItem(
            component_id=r["component_id"],
            component_name=r["component_name"],
            component_type=r["component_type"],
            use_count=r["use_count"],
            time_qualified_count=r.get("time_qualified_count", 0),
            count_only_count=r.get("count_only_count", 0),
        )
        for r in ranking_data
    ]

    unused = [
        UsageUnusedItem(
            component_name=u["component_name"],
            component_type=u["component_type"],
            created_at=u["created_at"],
        )
        for u in unused_data
    ]

    return UsageResponse(
        ranking=ranking,
        unused=unused,
        total_sessions_parsed=total_sessions,
        last_parsed_at=last_parsed,
        aggregation_mode=aggregation_mode,
        dedupe_by_session=dedupe_by_session,
        matched_only=matched_only,
    )


@router.get(
    "/usage/component",
    response_model=UsageComponentTimelineResponse,
    summary="컴포넌트별 사용 추이 조회 (Issue #67)",
    response_description="시간대별 사용 횟수와 intensity",
)
def get_usage_component_timeline(
    component_id: str = Query(..., description="조회할 컴포넌트 ID (UUID)"),
    days: int = Query(1, ge=0, description="집계 간격 (0=세션별, 1=일별, 7=주별)"),
    limit: int = Query(10, ge=1, le=365, description="반환할 항목 수"),
    aggregation_mode: Literal["strict", "expanded"] = Query(
        "strict",
        description="집계 모드 — strict=고신뢰 신호만, expanded=fallback 포함",
    ),
    core: VibeSmithCore = Depends(get_core),
):
    """특정 컴포넌트의 시간대별 사용 추이를 반환합니다.

    **Query Parameters:**
    - `component_id`: 조회할 컴포넌트 ID (필수)
    - `days`: 집계 간격 — `0`=세션별, `1`=일별, `7`=주별 (기본: 1)
    - `limit`: 반환할 항목 수 (기본: 10)
    - `aggregation_mode`: `strict`(기본) 또는 `expanded`
    """
    conn = core.db.get_connection()

    # ID → name 변환
    row = conn.execute(
        "SELECT name FROM components WHERE id = ? AND deleted_at IS NULL",
        (component_id,),
    ).fetchone()
    if not row:
        raise I18nHTTPException(status_code=404, message_key=KEYS.COMPONENT_NOT_FOUND)
    component_name = row[0]

    data = get_component_timeline(
        conn,
        component_name=component_name,
        component_id=component_id,
        days=days,
        limit=limit,
        aggregation_mode=aggregation_mode,
    )
    timeline = [UsageTimelineEntry(date=d["date"], count=d["count"], intensity=d["intensity"]) for d in data]
    return UsageComponentTimelineResponse(
        component_id=component_id,
        component_name=component_name,
        timeline=timeline,
    )


@router.post(
    "/usage/scan",
    response_model=UsageScanResponse,
    summary="수동 Usage 스캔 트리거 (Issue #67)",
    response_description="스캔 결과 (파싱 세션 수, 저장 통계 수)",
)
def post_usage_scan(request: Request):
    """등록된 모든 프로젝트의 JSONL 세션 로그를 즉시 스캔합니다."""
    scanner = getattr(request.app.state, "usage_scanner", None)
    if scanner is None:
        return UsageScanResponse(sessions_parsed=0, stats_saved=0)
    result = scanner.scan_once()
    return UsageScanResponse(
        sessions_parsed=result["sessions_parsed"],
        stats_saved=result["stats_saved"],
    )


@router.post(
    "/usage/reset",
    response_model=UsageResetResponse,
    summary="Usage 데이터 선별적 초기화 (Issue #67)",
    response_description="삭제/보존된 세션 수 (삭제된 파일의 데이터는 보존)",
)
def post_usage_reset(request: Request):
    """파일이 존재하는 세션 데이터만 초기화합니다.

    디스크에서 이미 삭제된 세션 파일의 데이터는 보존하여
    재스캔 불가능한 데이터의 영구 유실을 방지합니다.
    """
    scanner = getattr(request.app.state, "usage_scanner", None)
    if scanner is None:
        return UsageResetResponse(
            deleted_sessions=0,
            deleted_parse_states=0,
            preserved_sessions=0,
            preserved_parse_states=0,
        )
    result = scanner.reset()
    return UsageResetResponse(
        deleted_sessions=result["deleted_sessions"],
        deleted_parse_states=result["deleted_parse_states"],
        preserved_sessions=result["preserved_sessions"],
        preserved_parse_states=result["preserved_parse_states"],
    )
