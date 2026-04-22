"""구성요소 관련 엔드포인트."""

import sqlite3
import uuid
from datetime import UTC, datetime

import yaml
from fastapi import APIRouter, Depends, Query, Request
from vibesmith_core import VibeSmithCore
from vibesmith_core.components.models import ComponentBase, ComponentType

from vibesmith_api.activities import log_activity
from vibesmith_api.deps import get_core, get_locale
from vibesmith_api.i18n import KEYS, translate
from vibesmith_api.i18n.exceptions import I18nHTTPException
from vibesmith_api.schemas import (
    BulkToggleRequest,
    BulkToggleResponse,
    ComponentCopyItem,
    ComponentCopyRequest,
    ComponentCopyResponse,
    ComponentCreateRequest,
    ComponentDeleteResponse,
    ComponentDetailResponse,
    ComponentGenerateRequest,
    ComponentGenerateResponse,
    ComponentResponse,
    ComponentSaveRequest,
    ComponentSearchResponse,
    ComponentToggleRequest,
    ComponentToggleResponse,
    ComponentUpdateRequest,
    DependencyInfo,
    DependencyItem,
    PaginatedComponentsResponse,
    RollbackRequest,
    RollbackResponse,
    VersionHistoryItem,
)
from vibesmith_api.security import conditional_limiter
from vibesmith_api.template_engine import generate_preview, validate_template_exists

router = APIRouter(prefix="/api", tags=["components"])


def _guard_hidden_project(core: VibeSmithCore, project_id: str) -> None:
    """숨긴 프로젝트 소속이면 404를 발생시킨다."""
    project = core.projects.get(project_id)
    if project and project.hidden_at is not None:
        raise I18nHTTPException(404, KEYS.COMPONENT_NOT_FOUND)


_SORT_FIELDS = {"name", "type", "created_at", "updated_at", "last_used"}


@router.get(
    "/projects/{project_id}/components",
    response_model=PaginatedComponentsResponse,
    summary="프로젝트별 구성요소 목록 조회",
    response_description="페이지네이션된 구성요소 목록과 전체 개수",
)
def list_project_components(
    project_id: str,
    type: str | None = Query(None, description="구성요소 타입 필터 (skill, agent, command, hook, rule)"),
    q: str | None = Query(None, description="이름/설명 텍스트 검색어"),
    sort: str | None = Query(None, description="정렬 기준 필드 (name, type, created_at, updated_at)"),
    order: str | None = Query(None, description="정렬 방향 (asc 또는 desc, 기본: asc)"),
    limit: int | None = Query(None, ge=1, description="한 페이지에 반환할 최대 항목 수"),
    offset: int | None = Query(None, ge=0, description="건너뛸 항목 수 (페이지네이션 오프셋)"),
    core: VibeSmithCore = Depends(get_core),
):
    """특정 프로젝트에 속한 구성요소 목록을 반환합니다.

    타입 필터링, 텍스트 검색, 정렬, 페이지네이션을 지원합니다.

    - **project_id**: 프로젝트 고유 ID (UUID)
    - **type**: `skill`, `agent`, `command`, `hook`, `rule` 중 하나
    - **q**: 이름(`name`) 또는 설명(`description`)에서 부분 일치 검색
    - **sort** + **order**: 정렬 기준과 방향 조합 (예: `sort=name&order=asc`)
    - **limit** + **offset**: 페이지네이션 (예: `limit=20&offset=40` → 3페이지)

    응답의 `total`은 필터링 후 전체 개수이며, `items`는 페이지네이션 적용 결과입니다.
    """
    project = core.projects.get(project_id)
    if project is None or project.hidden_at is not None:
        raise I18nHTTPException(404, KEYS.PROJECT_NOT_FOUND)
    filters: dict = {"project_id": project_id}
    if type:
        filters["type"] = type
    components = core.operations.list_all(filters)

    # 텍스트 검색 (post-filter)
    if q:
        q_lower = q.lower()
        components = [
            c for c in components if q_lower in (c.name or "").lower() or q_lower in (c.description or "").lower()
        ]

    total = len(components)

    # 정렬
    if sort and sort in _SORT_FIELDS:
        reverse = order == "desc"
        components = sorted(
            components,
            key=lambda c: str(getattr(c, sort, None) or ""),
            reverse=reverse,
        )

    # 페이지네이션
    if offset:
        components = components[offset:]
    if limit:
        components = components[:limit]

    items = [
        ComponentResponse(
            id=c.id,
            type=str(c.type),
            name=c.name,
            description=c.description,
            enabled=c.enabled,
            tags=c.tags,
            project_id=c.project_id,
            path=c.path,
            created_at=c.created_at,
            updated_at=c.updated_at,
            platform=c.platform,
        )
        for c in components
    ]

    return PaginatedComponentsResponse(items=items, total=total)


@router.get(
    "/components",
    response_model=list[ComponentSearchResponse],
    summary="구성요소 전체 검색",
    response_description="필터 조건에 맞는 구성요소 목록 (프로젝트명 포함)",
)
def list_components(
    type: str | None = Query(None, description="구성요소 타입 필터 (skill, agent, command, hook, rule)"),
    tag: str | None = Query(None, description="태그 필터 — 쉼표 구분 여러 태그 가능 (OR 조건, 예: 'auth,security')"),
    project_id: str | None = Query(None, description="특정 프로젝트로 필터링 (UUID)"),
    q: str | None = Query(None, description="이름/설명 텍스트 검색어"),
    enabled: bool | None = Query(None, description="활성화 상태 필터 (true: 활성만, false: 비활성만)"),
    platform: str | None = Query(None, description="AI 플랫폼 필터 (claude_code, cursor 등)"),
    core: VibeSmithCore = Depends(get_core),
):
    """모든 프로젝트에서 구성요소를 검색/필터링합니다.

    프로젝트를 넘어 전역으로 구성요소를 검색할 때 사용합니다.
    각 결과에 소속 프로젝트 이름(`project_name`)이 포함됩니다.

    **필터 조합 예시:**
    - 모든 활성 Skill: `?type=skill&enabled=true`
    - Claude Code의 Hook: `?type=hook&platform=claude_code`
    - "auth" 태그가 달린 구성요소: `?tag=auth`
    - "login" 키워드 검색: `?q=login`
    """
    filters: dict = {}
    if type:
        filters["type"] = type
    if project_id:
        filters["project_id"] = project_id
    if enabled is not None:
        filters["enabled"] = enabled
    if platform:
        filters["platform"] = platform

    # N+1 쿼리 최적화: list_all_with_project() 사용 (Issue #40)
    components_with_project = core.operations.list_all_with_project(filters, exclude_hidden_projects=True)

    # 태그 필터 (post-filter)
    if tag:
        tag_set = {t.strip() for t in tag.split(",")}
        components_with_project = [(c, pn) for c, pn in components_with_project if tag_set & set(c.tags)]

    # 텍스트 검색 (post-filter)
    if q:
        q_lower = q.lower()
        components_with_project = [
            (c, pn)
            for c, pn in components_with_project
            if q_lower in (c.name or "").lower() or q_lower in (c.description or "").lower()
        ]

    return [
        ComponentSearchResponse(
            id=c.id,
            type=str(c.type),
            name=c.name,
            description=c.description,
            enabled=c.enabled,
            tags=c.tags,
            project_id=c.project_id,
            project_name=project_name,
            path=c.path,
            created_at=c.created_at,
            updated_at=c.updated_at,
            platform=c.platform,
        )
        for c, project_name in components_with_project
    ]


@router.get(
    "/components/recent",
    response_model=list[ComponentResponse],
    summary="최근 업데이트된 구성요소 조회",
    response_description="updated_at 기준 내림차순 정렬된 구성요소 목록",
)
def get_recent_components(
    limit: int = Query(10, description="반환할 구성요소 개수 (기본: 10, 최대: 100)"),
    core: VibeSmithCore = Depends(get_core),
):
    """최근 업데이트된 구성요소를 반환합니다.

    **Query Parameters:**
    - `limit`: 반환할 구성요소 개수 (기본: 10, 최대: 100)
    """
    if limit > 100:
        limit = 100

    all_components = core.operations.list_all({}, exclude_hidden_projects=True)

    sorted_components = sorted(
        all_components,
        key=lambda c: c.updated_at or "",
        reverse=True,
    )

    return [
        ComponentResponse(
            id=c.id,
            type=str(c.type),
            name=c.name,
            description=c.description,
            enabled=c.enabled,
            tags=c.tags,
            project_id=c.project_id,
            path=c.path,
            created_at=c.created_at,
            updated_at=c.updated_at,
            platform=c.platform,
        )
        for c in sorted_components[:limit]
    ]


@router.get(
    "/components/{component_id}",
    response_model=ComponentDetailResponse,
    summary="구성요소 상세 조회",
    response_description="구성요소의 전체 정보 (본문, frontmatter, 종속성 포함)",
)
def get_component(
    component_id: str,
    core: VibeSmithCore = Depends(get_core),
):
    """특정 구성요소의 상세 정보를 반환합니다.

    목록 API에서는 제공되지 않는 추가 정보를 포함합니다:
    - **content**: 구성요소의 전체 본문 텍스트
    - **frontmatter**: YAML frontmatter를 파싱한 dict (Skill 등에서 사용)
    - **dependencies**: 이 구성요소가 의존하는 것(`depends_on`)과 이것에 의존하는 것(`depended_by`)

    - **component_id**: 구성요소 고유 ID (UUID)
    """
    comp = core.operations.read(component_id)
    if comp is None:
        raise I18nHTTPException(404, KEYS.COMPONENT_NOT_FOUND)

    _guard_hidden_project(core, comp.project_id)
    project = core.projects.get(comp.project_id)
    project_name = project.name if project else ""

    # 종속성 조회 (삭제된 구성요소 제외)
    conn = core.db.get_connection()
    depends_on_rows = conn.execute(
        "SELECT d.target_id, c.name, c.type FROM dependencies d"
        " JOIN components c ON d.target_id = c.id AND c.deleted_at IS NULL"
        " WHERE d.source_id = ?",
        (component_id,),
    ).fetchall()
    depended_by_rows = conn.execute(
        "SELECT d.source_id, c.name, c.type FROM dependencies d"
        " JOIN components c ON d.source_id = c.id AND c.deleted_at IS NULL"
        " WHERE d.target_id = ?",
        (component_id,),
    ).fetchall()

    return ComponentDetailResponse(
        id=comp.id,
        type=str(comp.type),
        name=comp.name,
        description=comp.description,
        enabled=comp.enabled,
        tags=comp.tags,
        project_id=comp.project_id,
        project_name=project_name,
        path=comp.path,
        content=comp.content,
        frontmatter=comp.frontmatter,
        dependencies=DependencyInfo(
            depends_on=[DependencyItem(id=r[0], name=r[1], type=r[2]) for r in depends_on_rows],
            depended_by=[DependencyItem(id=r[0], name=r[1], type=r[2]) for r in depended_by_rows],
        ),
        created_at=comp.created_at,
        updated_at=comp.updated_at,
        platform=comp.platform,
    )


def _to_component_response(comp: ComponentBase) -> ComponentResponse:
    """ComponentBase → ComponentResponse 변환 헬퍼."""
    return ComponentResponse(
        id=comp.id,
        type=str(comp.type),
        name=comp.name,
        description=comp.description,
        enabled=comp.enabled,
        tags=comp.tags,
        project_id=comp.project_id,
        path=comp.path,
        created_at=comp.created_at,
        updated_at=comp.updated_at,
        platform=comp.platform,
    )


def _parse_frontmatter(content: str) -> dict:
    """YAML frontmatter를 파싱하여 dict로 반환한다."""
    if not content.startswith("---"):
        return {}
    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}
    fm_raw = parts[1].strip()
    if not fm_raw:
        return {}
    try:
        fm = yaml.safe_load(fm_raw)
    except yaml.YAMLError as e:
        # Issue #319: malformed YAML 입력 시 400 에러 반환
        raise I18nHTTPException(400, KEYS.INVALID_YAML_FRONTMATTER, detail=str(e)) from e
    return fm if isinstance(fm, dict) else {}


def _get_affected_dependencies(core: VibeSmithCore, component_id: str) -> list[DependencyItem]:
    """이 구성요소에 의존하는 것들을 DB에서 조회한다 (삭제된 구성요소 제외)."""
    conn = core.db.get_connection()
    rows = conn.execute(
        "SELECT d.source_id, c.name, c.type FROM dependencies d"
        " JOIN components c ON d.source_id = c.id AND c.deleted_at IS NULL"
        " WHERE d.target_id = ?",
        (component_id,),
    ).fetchall()
    return [DependencyItem(id=r[0], name=r[1], type=r[2]) for r in rows]


# ---------------------------------------------------------------------------
# POST /api/components
# ---------------------------------------------------------------------------


@router.post(
    "/components",
    response_model=ComponentResponse,
    status_code=201,
    summary="구성요소 생성",
    response_description="생성된 구성요소 정보",
)
@conditional_limiter("30/minute")
def create_component(
    req: ComponentCreateRequest,
    core: VibeSmithCore = Depends(get_core),
):
    """새 구성요소를 생성합니다.

    `content`에 YAML frontmatter가 포함되어 있으면 자동으로 파싱하여
    `description` 등의 메타데이터를 추출합니다.

    **주의사항:**
    - 같은 프로젝트 내에서 동일한 `name` + `type` + `platform` 조합은 중복 생성할 수 없습니다 (409 Conflict)
    - 이름 비교 시 대소문자를 구분하지 않습니다 ("MySkill"과 "myskill"은 중복)
    - `project_id`에 해당하는 프로젝트가 존재해야 합니다 (404 에러)
    """
    project = core.projects.get(req.project_id)
    if project is None or project.hidden_at is not None:
        raise I18nHTTPException(404, KEYS.PROJECT_NOT_FOUND)

    fm = _parse_frontmatter(req.content)
    now = datetime.now(UTC).isoformat()
    comp = ComponentBase(
        id=str(uuid.uuid4()),
        type=ComponentType(req.type),
        name=req.name,
        description=fm.get("description"),
        enabled=True,
        tags=req.tags or [],
        project_id=req.project_id,
        path=f"/{req.type}s/{req.name}",
        content=req.content,
        frontmatter=fm or None,
        created_at=now,
        updated_at=now,
        platform=req.platform,
    )
    try:
        created = core.operations.create(comp)
    except ValueError as e:
        # Issue #33: 대소문자 무시 중복 검사
        if "already exists" in str(e):
            raise I18nHTTPException(409, KEYS.DUPLICATE_COMPONENT_NAME, detail=str(e))
        raise
    except sqlite3.IntegrityError:
        # Fallback: DB UNIQUE 제약조건 위반
        raise I18nHTTPException(409, KEYS.DUPLICATE_COMPONENT_NAME)
    log_activity(
        core,
        req.project_id,
        "component_created",
        component_id=created.id,
        component_name=created.name,
        component_type=str(created.type),
    )
    return _to_component_response(created)


# ---------------------------------------------------------------------------
# POST /api/components/generate (Component Wizard)
# ---------------------------------------------------------------------------


@router.post(
    "/components/generate",
    response_model=ComponentGenerateResponse,
    summary="컴포넌트 생성 (미리보기)",
    response_description="템플릿으로 생성된 본문 (저장 전 미리보기용)",
)
def generate_component(req: ComponentGenerateRequest):
    """템플릿과 사용자 입력으로 컴포넌트 본문을 생성합니다."""
    try:
        validate_template_exists(req.template_id)
    except ValueError:
        raise I18nHTTPException(404, KEYS.TEMPLATE_NOT_FOUND)
    try:
        result = generate_preview(
            template_id=req.template_id,
            name=req.name,
            description=req.description or "",
            config=req.config,
            component_type=str(req.component_type),
        )
        return ComponentGenerateResponse(**result)
    except Exception as e:
        raise I18nHTTPException(500, KEYS.TEMPLATE_RENDER_FAILED, detail=str(e)) from e


# ---------------------------------------------------------------------------
# POST /api/components/save (Component Wizard)
# ---------------------------------------------------------------------------


@router.post(
    "/components/save",
    response_model=ComponentResponse,
    status_code=201,
    summary="컴포넌트 저장",
    response_description="저장된 구성요소 정보",
)
def save_component(
    req: ComponentSaveRequest,
    core: VibeSmithCore = Depends(get_core),
):
    """Component Wizard에서 생성·편집한 본문을 프로젝트에 저장합니다."""
    project = core.projects.get(req.project_id)
    if project is None:
        raise I18nHTTPException(404, KEYS.PROJECT_NOT_FOUND)

    create_req = ComponentCreateRequest(
        type=req.type,
        name=req.name,
        project_id=req.project_id,
        content=req.content,
        tags=req.tags,
        platform=req.platform,
    )
    return create_component(create_req, core)


# ---------------------------------------------------------------------------
# PUT /api/components/{id}
# ---------------------------------------------------------------------------


@router.put(
    "/components/{component_id}",
    response_model=ComponentResponse,
    summary="구성요소 수정",
    response_description="수정된 구성요소 정보",
)
@conditional_limiter("30/minute")
def update_component(
    component_id: str,
    req: ComponentUpdateRequest,
    core: VibeSmithCore = Depends(get_core),
):
    """구성요소의 이름, 설명, 본문, 태그를 수정합니다.

    부분 업데이트(PATCH 스타일)를 지원합니다 — `null`인 필드는 변경하지 않습니다.

    - `name` 변경 시: DB의 name 필드만 변경 (파일명은 유지)
    - `description` 변경 시: DB의 description 필드 변경
    - `content` 변경 시: frontmatter를 재파싱하여 `description` 등 메타데이터도 자동 갱신
    - `tags` 변경 시: 기존 태그를 모두 교체 (merge가 아닌 replace)
    - `content`와 `description` 동시 전송 시 content의 frontmatter description이 우선
    - **component_id**: 수정할 구성요소의 고유 ID (UUID)
    """
    existing = core.operations.read(component_id)
    if existing is None:
        raise I18nHTTPException(404, KEYS.COMPONENT_NOT_FOUND)
    _guard_hidden_project(core, existing.project_id)

    updates: dict = {"updated_at": datetime.now(UTC).isoformat()}

    # name, description은 content보다 먼저 처리
    # (content의 frontmatter가 description을 덮어쓸 수 있으므로)
    if req.name is not None:
        updates["name"] = req.name
    if req.description is not None:
        updates["description"] = req.description

    if req.content is not None:
        # PUT 시 자동 버전 백업: content가 실제로 변경될 때만 이전 버전 저장
        prev_content = existing.content or ""
        if prev_content and prev_content != req.content:
            core.versions.save_version(component_id, prev_content)
        fm = _parse_frontmatter(req.content)
        updates["content"] = req.content
        updates["frontmatter"] = fm or None
        # frontmatter가 있으면 description 동기화 (없으면 None)
        # Issue #321: description 제거 시 DB에서도 제거되도록 수정
        if fm is not None:
            updates["description"] = fm.get("description")

    updated = core.operations.update(component_id, updates)

    # tags 직접 처리 (operations.update가 tags 미지원)
    if req.tags is not None:
        conn = core.db.get_connection()
        conn.execute("DELETE FROM tags WHERE component_id = ?", (component_id,))
        for tag in req.tags:
            conn.execute(
                "INSERT INTO tags (component_id, tag) VALUES (?, ?)",
                (component_id, tag),
            )
        conn.commit()
        updated = core.operations.read(component_id)

    log_activity(
        core,
        updated.project_id,
        "component_updated",
        component_id=updated.id,
        component_name=updated.name,
        component_type=str(updated.type),
    )
    return _to_component_response(updated)


# ---------------------------------------------------------------------------
# DELETE /api/components/{id}
# ---------------------------------------------------------------------------


@router.delete(
    "/components/{component_id}",
    response_model=ComponentDeleteResponse,
    summary="구성요소 삭제",
    response_description="삭제 확인 메시지와 영향받는 종속성 목록",
)
@conditional_limiter("30/minute")
def delete_component(
    request: Request,
    component_id: str,
    permanent: bool = Query(False, description="true면 영구 삭제, 기본값 false면 휴지통으로 이동"),
    core: VibeSmithCore = Depends(get_core),
):
    """구성요소를 삭제합니다.

    기본적으로 휴지통으로 이동(soft delete). `?permanent=true`로 영구 삭제 가능.

    삭제 시 이 구성요소에 의존하고 있던 다른 구성요소 목록(`affected_dependencies`)을
    함께 반환합니다.
    """
    existing = core.operations.read(component_id)
    if existing is None:
        raise I18nHTTPException(404, KEYS.COMPONENT_NOT_FOUND)

    log_activity(
        core,
        existing.project_id,
        "component_deleted",
        component_id=existing.id,
        component_name=existing.name,
        component_type=str(existing.type),
    )
    affected = _get_affected_dependencies(core, component_id)
    if permanent:
        core.operations.delete(component_id)
    else:
        core.operations.soft_delete(component_id)

    locale = get_locale(request)
    return ComponentDeleteResponse(
        message=translate(KEYS.DELETED, locale=locale),
        message_key=KEYS.DELETED,
        affected_dependencies=affected,
    )


# ---------------------------------------------------------------------------
# POST /api/components/{id}/toggle
# ---------------------------------------------------------------------------


@router.post(
    "/components/{component_id}/toggle",
    response_model=ComponentToggleResponse,
    summary="구성요소 활성화/비활성화 토글",
    response_description="변경된 활성화 상태와 영향받는 종속성 목록",
)
@conditional_limiter("50/minute")
def toggle_component(
    component_id: str,
    req: ComponentToggleRequest | None = None,
    core: VibeSmithCore = Depends(get_core),
):
    """구성요소의 활성화/비활성화 상태를 변경합니다.

    - `enabled`를 지정하면 해당 값으로 설정
    - `enabled`를 생략(또는 body 없이 호출)하면 현재 상태를 반전(토글)

    비활성화된 구성요소는 AI 에이전트에서 사용되지 않습니다.
    이 구성요소에 의존하는 다른 구성요소 목록도 함께 반환됩니다.

    - **component_id**: 토글할 구성요소의 고유 ID (UUID)
    """
    existing = core.operations.read(component_id)
    if existing is None:
        raise I18nHTTPException(404, KEYS.COMPONENT_NOT_FOUND)
    _guard_hidden_project(core, existing.project_id)

    enabled = req.enabled if req and req.enabled is not None else None
    updated = core.operations.toggle(component_id, enabled)
    affected = _get_affected_dependencies(core, component_id)

    return ComponentToggleResponse(
        id=updated.id,
        enabled=updated.enabled,
        affected_dependencies=affected,
    )


# ---------------------------------------------------------------------------
# PATCH /api/components/bulk-toggle
# ---------------------------------------------------------------------------


@router.patch(
    "/components/bulk-toggle",
    response_model=BulkToggleResponse,
    summary="구성요소 일괄 활성화/비활성화",
    response_description="변경된 구성요소 수와 ID 목록",
)
@conditional_limiter("30/minute")
def bulk_toggle_components(
    req: BulkToggleRequest,
    core: VibeSmithCore = Depends(get_core),
):
    """여러 구성요소의 활성/비활성 상태를 한번에 변경합니다.

    - 존재하지 않는 ID는 무시됩니다
    - 이미 요청한 상태와 동일한 구성요소는 건너뜁니다
    """
    updated_ids: list[str] = []

    for cid in req.component_ids:
        existing = core.operations.read(cid)
        if existing is None:
            continue
        if existing.enabled == req.enabled:
            continue
        core.operations.toggle(cid, req.enabled)
        updated_ids.append(cid)

    return BulkToggleResponse(
        updated_count=len(updated_ids),
        updated_ids=updated_ids,
    )


# ---------------------------------------------------------------------------
# POST /api/components/{id}/copy
# ---------------------------------------------------------------------------


@router.post(
    "/components/{component_id}/copy",
    response_model=ComponentCopyResponse,
    status_code=201,
    summary="구성요소 복사 (다른 프로젝트로)",
    response_description="복사된 구성요소 목록 (원본 ID → 새 ID 매핑)",
)
def copy_component(
    component_id: str,
    req: ComponentCopyRequest,
    core: VibeSmithCore = Depends(get_core),
):
    """구성요소를 다른 프로젝트로 복사합니다.

    `include_dependencies`를 `true`로 설정하면 이 구성요소가 의존하는
    다른 구성요소들도 함께 복사됩니다.

    **주의사항:**
    - 대상 프로젝트에 동일 이름의 구성요소가 이미 존재하면 400 에러
    - 대상 프로젝트가 존재하지 않으면 404 에러

    - **component_id**: 복사할 원본 구성요소의 고유 ID (UUID)
    """
    existing = core.operations.read(component_id)
    if existing is None:
        raise I18nHTTPException(404, KEYS.COMPONENT_NOT_FOUND)
    _guard_hidden_project(core, existing.project_id)

    target_project = core.projects.get(req.target_project_id)
    if target_project is None or target_project.hidden_at is not None:
        raise I18nHTTPException(404, KEYS.TARGET_PROJECT_NOT_FOUND)

    try:
        new_ids = core.operations.copy(
            component_id,
            req.target_project_id,
            include_deps=req.include_dependencies,
        )
    except ValueError as e:
        # Issue #33: 중복 검사 (대소문자 무시)
        if "already exists" in str(e):
            raise I18nHTTPException(409, KEYS.COPY_FAILED, detail=str(e))
        # Issue #335: 유효하지 않은 name(경로 탐색 등)으로 생성된 컴포넌트 복사 시 400 반환
        raise I18nHTTPException(400, KEYS.COPY_FAILED, detail=str(e))
    except NotImplementedError as e:
        # Issue #308: include_dependencies 미구현
        raise I18nHTTPException(501, KEYS.NOT_IMPLEMENTED, detail=str(e))
    except sqlite3.IntegrityError:
        raise I18nHTTPException(400, KEYS.DUPLICATE_NAME_IN_TARGET)

    copied_items = []
    for new_id in new_ids:
        comp = core.operations.read(new_id)
        if comp:
            copied_items.append(
                ComponentCopyItem(
                    original_id=component_id,
                    new_id=new_id,
                    name=comp.name,
                    type=str(comp.type),
                )
            )

    return ComponentCopyResponse(copied=copied_items)


# ---------------------------------------------------------------------------
# GET /api/components/{id}/versions
# ---------------------------------------------------------------------------


@router.get(
    "/components/{component_id}/versions",
    response_model=list[VersionHistoryItem],
    summary="버전 히스토리 조회",
    response_description="구성요소의 수정 이력 (최신 버전 먼저)",
)
def list_component_versions(
    component_id: str,
    core: VibeSmithCore = Depends(get_core),
):
    """구성요소의 버전 히스토리를 반환합니다. 최신 버전이 목록 앞에 옵니다."""
    comp = core.operations.read(component_id)
    if comp is None:
        raise I18nHTTPException(404, KEYS.COMPONENT_NOT_FOUND)

    versions = core.versions.list_versions(component_id)
    # spec §3.1: 최신 버전이 먼저 (version 내림차순)
    versions_desc = sorted(versions, key=lambda v: v.version, reverse=True)
    return [VersionHistoryItem(version=v.version, content=v.content, created_at=v.created_at) for v in versions_desc]


# ---------------------------------------------------------------------------
# POST /api/components/{id}/rollback
# ---------------------------------------------------------------------------


@router.post(
    "/components/{component_id}/rollback",
    response_model=RollbackResponse,
    summary="버전 롤백",
    response_description="롤백된 구성요소 정보 및 백업된 새 버전 번호",
)
def rollback_component(
    request: Request,
    component_id: str,
    req: RollbackRequest,
    core: VibeSmithCore = Depends(get_core),
):
    """구성요소를 지정된 버전으로 되돌립니다. 현재 내용은 새 버전으로 백업된 후 롤백됩니다."""
    comp = core.operations.read(component_id)
    if comp is None:
        raise I18nHTTPException(404, KEYS.COMPONENT_NOT_FOUND)

    try:
        # 1. 현재 내용을 새 버전으로 백업
        current_content = comp.content or ""
        new_version = core.versions.save_version(component_id, current_content)
        # 2. 지정된 버전으로 롤백
        core.versions.rollback(component_id, req.version)
        # 3. updated_at 갱신
        core.operations.update(
            component_id,
            {"updated_at": datetime.now(UTC).isoformat()},
        )
    except ValueError:
        raise I18nHTTPException(404, KEYS.VERSION_NOT_FOUND, version=req.version)

    locale = get_locale(request)
    message = translate(KEYS.ROLLED_BACK, locale=locale, version=req.version)
    return RollbackResponse(
        id=component_id,
        restored_version=req.version,
        new_version=new_version,
        message=message,
    )
