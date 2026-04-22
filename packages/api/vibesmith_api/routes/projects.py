"""프로젝트 관련 엔드포인트."""

from __future__ import annotations

import os
import sqlite3
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from vibesmith_core import VibeSmithCore
from vibesmith_core.components.models import ComponentBase, ComponentType
from vibesmith_core.infra.watcher import FileWatcher
from vibesmith_core.scanning.adapters.base import AgentAdapter

from vibesmith_api.activities import log_activity
from vibesmith_api.deps import get_core, get_locale, get_watcher
from vibesmith_api.i18n import KEYS, translate
from vibesmith_api.i18n.exceptions import I18nHTTPException
from vibesmith_api.project_templates_repo import (
    ConflictPolicy,
    ProjectTemplateNotFoundError,
    ProjectTemplateRepository,
    ProjectTemplateRevisionNotFoundError,
    ProjectTemplateValidationError,
)
from vibesmith_api.routes.sample import (
    CreateSampleProjectRequest,
    CreateSampleProjectResponse,
)
from vibesmith_api.routes.sample import (
    create_sample_project as _create_sample_project,
)
from vibesmith_api.schemas import (
    ActivityResponse,
    AppliedPresetResponse,
    PresetApplyRequest,
    PresetApplyResponse,
    PresetApplySummary,
    PresetPreviewItem,
    PresetPreviewRequest,
    PresetPreviewResponse,
    PresetPreviewSummary,
    ProjectCreateRequest,
    ProjectCreateResponse,
    ProjectDetailResponse,
    ProjectResponse,
)
from vibesmith_api.template_engine import render_component, validate_template_exists

router = APIRouter(prefix="/api/projects", tags=["projects"])

_COMPONENT_PATH_PREFIX: dict[str, str] = {
    "skill": "/skills",
    "agent": "/agents",
    "command": "/commands",
    "hook": "/hooks",
    "rule": "/rules",
}


def _resolve_project_response(core: VibeSmithCore, project_id: str) -> ProjectResponse:
    project = core.projects.get(project_id)
    if project is None:
        raise I18nHTTPException(404, KEYS.PROJECT_NOT_FOUND)

    pp = Path(project.path)
    adapters = AgentAdapter.all_adapters()
    platforms = sorted(a.adapter_type for a in adapters if Path(a.get_project_path(str(pp))).is_dir())
    return ProjectResponse(
        **project.model_dump(),
        dir_exists=pp.is_dir(),
        platforms=platforms,
    )


def _validate_project_path(path: str, core: VibeSmithCore) -> Path:
    expanded = Path(path).expanduser()
    if not expanded.is_absolute():
        raise I18nHTTPException(400, KEYS.PROJECT_PATH_NOT_ABSOLUTE)

    if ".." in expanded.parts:
        raise I18nHTTPException(400, KEYS.PROJECT_PATH_NOT_ABSOLUTE)

    target = expanded.resolve()
    for project in core.projects.list_all(include_hidden=True):
        if Path(project.path).resolve() == target:
            raise I18nHTTPException(409, KEYS.PROJECT_ALREADY_EXISTS)

    target_parent = target.parent
    if not target_parent.exists() or not os.access(target_parent, os.W_OK):
        raise I18nHTTPException(400, KEYS.PROJECT_PATH_NOT_WRITABLE)

    if target.exists():
        if not target.is_dir():
            raise I18nHTTPException(409, KEYS.PROJECT_PATH_NOT_EMPTY)
        if any(target.iterdir()):
            raise I18nHTTPException(409, KEYS.PROJECT_PATH_NOT_EMPTY)

    return target


def _fetch_existing_component_map(core: VibeSmithCore, project_id: str) -> dict[tuple[str, str, str], dict[str, Any]]:
    conn = core.db.get_connection()
    rows = conn.execute(
        """
        SELECT id, type, name, platform, description, content, frontmatter
        FROM components
        WHERE project_id = ? AND deleted_at IS NULL
        """,
        (project_id,),
    ).fetchall()
    return {
        (row[2].lower(), row[1], row[3]): {
            "id": row[0],
            "type": row[1],
            "name": row[2],
            "platform": row[3],
            "description": row[4],
            "content": row[5],
            "frontmatter": row[6],
        }
        for row in rows
    }


def _resolve_item_content(item: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    content = str(item.get("content") or "")
    frontmatter = item.get("frontmatter")
    if not isinstance(frontmatter, dict):
        frontmatter = {}

    if content:
        return content, frontmatter

    template_id = item.get("template_id")
    if not template_id:
        return content, frontmatter

    try:
        validate_template_exists(str(template_id))
        rendered, rendered_type, _ = render_component(
            template_id=str(template_id),
            name=item["name"],
            description=item.get("description") or "",
            config=item.get("config") or {},
        )
    except ValueError as error:
        raise I18nHTTPException(404, KEYS.TEMPLATE_NOT_FOUND, detail=str(error))

    if rendered_type != item["component_type"]:
        raise I18nHTTPException(400, KEYS.VALIDATION_ERROR)
    return rendered, frontmatter


def _replace_component_tags(core: VibeSmithCore, component_id: str, tags: list[str]) -> None:
    conn = core.db.get_connection()
    conn.execute("DELETE FROM tags WHERE component_id = ?", (component_id,))
    for tag in tags:
        conn.execute("INSERT OR IGNORE INTO tags (component_id, tag) VALUES (?, ?)", (component_id, tag))
    conn.commit()


def _next_renamed_name(
    *,
    base_name: str,
    component_type: str,
    platform: str,
    reserved_keys: set[tuple[str, str, str]],
) -> str:
    suffix = 1
    while True:
        candidate = f"{base_name}-preset-{suffix}"
        key = (candidate.lower(), component_type, platform)
        if key not in reserved_keys:
            reserved_keys.add(key)
            return candidate
        suffix += 1


def _build_preview(
    *,
    revision_items: list[dict[str, Any]],
    existing_map: dict[tuple[str, str, str], dict[str, Any]],
    policy: ConflictPolicy,
) -> tuple[dict[str, int], list[dict[str, Any]]]:
    summary = {
        "to_create": 0,
        "to_update": 0,
        "to_skip": 0,
        "to_rename": 0,
        "conflicts": 0,
    }
    reserved_keys = set(existing_map.keys())
    result_items: list[dict[str, Any]] = []

    for item in revision_items:
        component_type = item["component_type"]
        platform = item["platform"]
        key = (item["name"].lower(), component_type, platform)
        existing = existing_map.get(key)

        response: dict[str, Any] = {
            "name": item["name"],
            "type": component_type,
            "platform": platform,
            "target_component_id": existing["id"] if existing else None,
            "renamed_to": None,
            "_source": item,
        }

        if existing is None:
            response["action"] = "create"
            response["reason"] = "new_component"
            summary["to_create"] += 1
            reserved_keys.add(key)
        else:
            summary["conflicts"] += 1
            if policy == "fail":
                response["action"] = "conflict"
                response["reason"] = "name_type_platform_conflict"
            elif policy == "skip":
                response["action"] = "skip"
                response["reason"] = "policy_skip_conflict"
                summary["to_skip"] += 1
            elif policy == "overwrite":
                response["action"] = "update"
                response["reason"] = "policy_overwrite_conflict"
                summary["to_update"] += 1
            else:
                renamed = _next_renamed_name(
                    base_name=item["name"],
                    component_type=component_type,
                    platform=platform,
                    reserved_keys=reserved_keys,
                )
                response["action"] = "rename"
                response["reason"] = "policy_rename_conflict"
                response["renamed_to"] = renamed
                summary["to_rename"] += 1

        result_items.append(response)

    return summary, result_items


def _apply_preview_items(
    *,
    core: VibeSmithCore,
    project_id: str,
    preview_items: list[dict[str, Any]],
) -> tuple[dict[str, int], list[dict[str, Any]]]:
    summary = {"created": 0, "updated": 0, "skipped": 0, "renamed": 0, "failed": 0}
    applied_items: list[dict[str, Any]] = []

    for preview_item in preview_items:
        action = preview_item["action"]
        source = preview_item["_source"]

        if action in {"conflict", "skip"}:
            summary["skipped"] += 1
            applied_items.append({k: v for k, v in preview_item.items() if not k.startswith("_")})
            continue

        target_name = preview_item.get("renamed_to") or source["name"]
        try:
            content, frontmatter = _resolve_item_content(source)
            tags = source.get("tags") or []
            description = source.get("description") or ""
            now = datetime.now(UTC).isoformat()

            if action in {"create", "rename"}:
                component_type = source["component_type"]
                path_prefix = _COMPONENT_PATH_PREFIX.get(component_type, f"/{component_type}s")
                component = ComponentBase(
                    id=str(uuid.uuid4()),
                    type=ComponentType(component_type),
                    name=target_name,
                    description=description,
                    enabled=True,
                    tags=list(tags),
                    project_id=project_id,
                    path=f"{path_prefix}/{target_name}",
                    content=content,
                    frontmatter=frontmatter,
                    created_at=now,
                    updated_at=now,
                    platform=source["platform"],
                )
                created = core.operations.create(component)
                _replace_component_tags(core, created.id, list(tags))
                log_activity(
                    core,
                    project_id,
                    "preset_applied",
                    component_id=created.id,
                    component_name=target_name,
                    component_type=component_type,
                )
                if action == "rename":
                    summary["renamed"] += 1
                else:
                    summary["created"] += 1
            elif action == "update":
                target_id = preview_item.get("target_component_id")
                if not target_id:
                    raise ValueError("target_component_id is required for update action")
                core.operations.update(
                    target_id,
                    {
                        "description": description,
                        "content": content,
                        "frontmatter": frontmatter,
                        "updated_at": now,
                    },
                )
                _replace_component_tags(core, target_id, list(tags))
                log_activity(
                    core,
                    project_id,
                    "preset_applied",
                    component_id=target_id,
                    component_name=target_name,
                    component_type=source["component_type"],
                )
                summary["updated"] += 1

            applied_items.append({k: v for k, v in preview_item.items() if not k.startswith("_")})
        except (ValueError, sqlite3.IntegrityError) as error:
            summary["failed"] += 1
            failed_item = {k: v for k, v in preview_item.items() if not k.startswith("_")}
            failed_item["reason"] = f"apply_failed:{error}"
            applied_items.append(failed_item)

    return summary, applied_items


def _raise_template_repo_error(error: Exception) -> None:
    if isinstance(error, ProjectTemplateNotFoundError):
        raise I18nHTTPException(404, KEYS.PROJECT_TEMPLATE_NOT_FOUND)
    if isinstance(error, ProjectTemplateRevisionNotFoundError):
        raise I18nHTTPException(404, KEYS.PROJECT_TEMPLATE_REVISION_NOT_FOUND)
    if isinstance(error, ProjectTemplateValidationError):
        raise I18nHTTPException(422, KEYS.VALIDATION_ERROR, detail=str(error))
    raise error


@router.post(
    "/sample",
    response_model=CreateSampleProjectResponse,
    status_code=201,
    summary="Quick Start 샘플 프로젝트 생성",
    response_description="생성된 샘플 프로젝트 정보",
)
def create_sample_project(
    req: CreateSampleProjectRequest,
    core: VibeSmithCore = Depends(get_core),
):
    """Quick Start용 샘플 프로젝트를 생성합니다. Issue #504."""
    return _create_sample_project(req, core)


@router.post(
    "",
    response_model=ProjectCreateResponse,
    status_code=201,
    summary="프리셋 기반 프로젝트 생성",
    response_description="생성된 프로젝트 정보와 적용된 프리셋 정보",
)
def create_project(
    req: ProjectCreateRequest,
    core: VibeSmithCore = Depends(get_core),
    watcher: FileWatcher = Depends(get_watcher),
):
    """프리셋을 적용해 신규 프로젝트를 생성한다."""
    target = _validate_project_path(req.path, core)
    repo = ProjectTemplateRepository(core.db)

    try:
        preset = repo.get_template(req.preset_id)
        revision = repo.get_revision(req.preset_id, req.revision)
    except Exception as error:
        _raise_template_repo_error(error)
        raise error

    target.mkdir(parents=True, exist_ok=True)
    project = core.projects.add_project(str(target))

    existing_map = _fetch_existing_component_map(core, project.id)
    preview_summary, preview_items = _build_preview(
        revision_items=revision["items"],
        existing_map=existing_map,
        policy=req.conflict_policy,
    )

    if req.conflict_policy == "fail" and preview_summary["conflicts"] > 0:
        repo.log_apply_result(
            project_id=project.id,
            preset_id=req.preset_id,
            revision=revision["revision"],
            policy=req.conflict_policy,
            status="failed",
            summary=preview_summary,
        )
        raise I18nHTTPException(409, KEYS.PROJECT_TEMPLATE_APPLY_CONFLICT)

    apply_summary, _ = _apply_preview_items(
        core=core,
        project_id=project.id,
        preview_items=preview_items,
    )
    repo.log_apply_result(
        project_id=project.id,
        preset_id=req.preset_id,
        revision=revision["revision"],
        policy=req.conflict_policy,
        status="applied",
        summary=apply_summary,
    )

    for config_dir in AgentAdapter.all_config_dirs():
        config_path = target / config_dir
        if config_path.is_dir():
            watcher.watch(project.id, str(config_path))

    created_components = apply_summary["created"] + apply_summary["renamed"]
    scanned_components = created_components
    if req.scan_after_create:
        scanned = core.projects.rescan(project.id)
        scanned_components = scanned["component_count"]

    project_response = _resolve_project_response(core, project.id)

    return ProjectCreateResponse(
        project=project_response,
        applied_preset=AppliedPresetResponse(
            id=preset["id"],
            name=preset["name"],
            version=preset["version"],
            revision=revision["revision"],
        ),
        created_components=created_components,
        scanned_components=scanned_components,
    )


@router.post(
    "/{project_id}/preset-preview",
    response_model=PresetPreviewResponse,
    summary="프리셋 적용 preview",
    response_description="충돌 정책별 적용 전 영향 분석 결과",
)
def preview_project_preset(
    project_id: str,
    req: PresetPreviewRequest,
    core: VibeSmithCore = Depends(get_core),
):
    project = core.projects.get(project_id)
    if project is None or project.hidden_at is not None:
        raise I18nHTTPException(404, KEYS.PROJECT_NOT_FOUND)

    repo = ProjectTemplateRepository(core.db)
    try:
        revision = repo.get_revision(req.preset_id, req.revision)
    except Exception as error:
        _raise_template_repo_error(error)
        raise error

    existing_map = _fetch_existing_component_map(core, project_id)
    summary, preview_items = _build_preview(
        revision_items=revision["items"],
        existing_map=existing_map,
        policy=req.conflict_policy,
    )
    last_policy = repo.get_last_policy_for_project(project_id)
    repo.log_apply_result(
        project_id=project_id,
        preset_id=req.preset_id,
        revision=revision["revision"],
        policy=req.conflict_policy,
        status="preview",
        summary=summary,
    )

    return PresetPreviewResponse(
        project_id=project_id,
        preset_id=req.preset_id,
        revision=revision["revision"],
        policy=req.conflict_policy,
        summary=PresetPreviewSummary(**summary),
        items=[PresetPreviewItem(**{k: v for k, v in item.items() if not k.startswith("_")}) for item in preview_items],
        last_policy=last_policy,
    )


@router.post(
    "/{project_id}/apply-preset",
    response_model=PresetApplyResponse,
    summary="프리셋 실제 적용",
    response_description="충돌 정책 기준 프리셋 적용 결과",
)
def apply_project_preset(
    project_id: str,
    req: PresetApplyRequest,
    core: VibeSmithCore = Depends(get_core),
):
    project = core.projects.get(project_id)
    if project is None or project.hidden_at is not None:
        raise I18nHTTPException(404, KEYS.PROJECT_NOT_FOUND)

    repo = ProjectTemplateRepository(core.db)
    try:
        revision = repo.get_revision(req.preset_id, req.revision)
    except Exception as error:
        _raise_template_repo_error(error)
        raise error

    existing_map = _fetch_existing_component_map(core, project_id)
    preview_summary, preview_items = _build_preview(
        revision_items=revision["items"],
        existing_map=existing_map,
        policy=req.conflict_policy,
    )

    if req.conflict_policy == "fail" and preview_summary["conflicts"] > 0:
        repo.log_apply_result(
            project_id=project_id,
            preset_id=req.preset_id,
            revision=revision["revision"],
            policy=req.conflict_policy,
            status="failed",
            summary=preview_summary,
        )
        raise I18nHTTPException(409, KEYS.PROJECT_TEMPLATE_APPLY_CONFLICT)

    apply_summary, applied_items = _apply_preview_items(
        core=core,
        project_id=project_id,
        preview_items=preview_items,
    )
    status = "applied" if apply_summary["failed"] == 0 else "failed"
    repo.log_apply_result(
        project_id=project_id,
        preset_id=req.preset_id,
        revision=revision["revision"],
        policy=req.conflict_policy,
        status=status,
        summary=apply_summary,
    )

    return PresetApplyResponse(
        project_id=project_id,
        preset_id=req.preset_id,
        revision=revision["revision"],
        policy=req.conflict_policy,
        summary=PresetApplySummary(**apply_summary),
        items=[PresetPreviewItem(**item) for item in applied_items],
    )


@router.get(
    "",
    response_model=list[ProjectResponse],
    summary="프로젝트 목록 조회",
    response_description="등록된 전체 프로젝트 목록",
)
def list_projects(
    core: VibeSmithCore = Depends(get_core),
    include_hidden: bool = Query(False, description="숨긴 프로젝트 포함 여부"),
):
    """등록된 프로젝트 목록을 반환한다."""
    projects = core.projects.list_all(include_hidden=include_hidden)
    result = []
    adapters = AgentAdapter.all_adapters()
    for project in projects:
        pp = Path(project.path)
        platforms = sorted(a.adapter_type for a in adapters if Path(a.get_project_path(str(pp))).is_dir())
        result.append(
            ProjectResponse(
                **project.model_dump(),
                dir_exists=pp.is_dir(),
                platforms=platforms,
            )
        )
    return result


@router.get(
    "/{project_id}",
    response_model=ProjectDetailResponse,
    summary="프로젝트 상세 조회",
    response_description="프로젝트 상세 정보 (타입별 구성요소 수 포함)",
)
def get_project(
    project_id: str,
    core: VibeSmithCore = Depends(get_core),
):
    """특정 프로젝트의 상세 정보를 반환한다."""
    project = core.projects.get(project_id)
    if project is None:
        raise I18nHTTPException(404, KEYS.PROJECT_NOT_FOUND)

    pp = Path(project.path)
    adapters = AgentAdapter.all_adapters()
    platforms = sorted(a.adapter_type for a in adapters if Path(a.get_project_path(str(pp))).is_dir())

    conn = core.db.get_connection()
    rows = conn.execute(
        "SELECT type, COUNT(*) FROM components WHERE project_id = ? AND deleted_at IS NULL GROUP BY type",
        (project_id,),
    ).fetchall()
    breakdown = {row[0]: row[1] for row in rows}

    return ProjectDetailResponse(
        **project.model_dump(),
        dir_exists=pp.is_dir(),
        platforms=platforms,
        breakdown=breakdown,
    )


@router.get(
    "/{project_id}/activities",
    response_model=list[ActivityResponse],
    summary="프로젝트별 활동 로그 조회",
    response_description="활동 로그 목록 (최신순)",
)
def list_project_activities(
    project_id: str,
    limit: int = Query(20, ge=1, le=100, description="반환할 최대 항목 수"),
    offset: int = Query(0, ge=0, description="건너뛸 항목 수"),
    core: VibeSmithCore = Depends(get_core),
):
    project = core.projects.get(project_id)
    if project is None:
        raise I18nHTTPException(404, KEYS.PROJECT_NOT_FOUND)

    conn = core.db.get_connection()
    rows = conn.execute(
        """SELECT id, activity_type, component_id, component_name, component_type, created_at
           FROM activities
           WHERE project_id = ?
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?""",
        (project_id, limit, offset),
    ).fetchall()

    return [
        ActivityResponse(
            id=row[0],
            activity_type=row[1],
            component_id=row[2],
            component_name=row[3] or "",
            component_type=row[4] or "",
            created_at=row[5],
        )
        for row in rows
    ]


@router.delete(
    "/{project_id}",
    status_code=200,
    summary="프로젝트 숨기기 (soft delete)",
    response_description="숨기기 확인 메시지",
)
def delete_project(
    request: Request,
    project_id: str,
    core: VibeSmithCore = Depends(get_core),
    watcher: FileWatcher = Depends(get_watcher),
):
    """프로젝트를 숨긴다 (soft delete)."""
    project = core.projects.get(project_id)
    if project is None:
        raise I18nHTTPException(404, KEYS.PROJECT_NOT_FOUND)
    if project.is_global:
        raise I18nHTTPException(400, KEYS.GLOBAL_PROJECT_CANNOT_DELETE)
    watcher.unwatch(project_id)
    core.projects.hide_project(project_id)
    locale = get_locale(request)
    return {
        "message": translate(KEYS.PROJECT_HIDDEN, locale=locale),
        "message_key": KEYS.PROJECT_HIDDEN,
    }


@router.patch(
    "/{project_id}/hide",
    status_code=200,
    summary="프로젝트 숨기기",
    response_description="숨기기 확인 메시지",
)
def hide_project(
    request: Request,
    project_id: str,
    core: VibeSmithCore = Depends(get_core),
    watcher: FileWatcher = Depends(get_watcher),
):
    """프로젝트를 숨긴다."""
    project = core.projects.get(project_id)
    if project is None:
        raise I18nHTTPException(404, KEYS.PROJECT_NOT_FOUND)
    if project.is_global:
        raise I18nHTTPException(400, KEYS.GLOBAL_PROJECT_CANNOT_HIDE)
    watcher.unwatch(project_id)
    core.projects.hide_project(project_id)
    locale = get_locale(request)
    return {
        "message": translate(KEYS.PROJECT_HIDDEN, locale=locale),
        "message_key": KEYS.PROJECT_HIDDEN,
    }


@router.patch(
    "/{project_id}/unhide",
    status_code=200,
    summary="프로젝트 숨김 해제",
    response_description="숨김 해제 확인 메시지",
)
def unhide_project(
    request: Request,
    project_id: str,
    core: VibeSmithCore = Depends(get_core),
    watcher: FileWatcher = Depends(get_watcher),
):
    """숨긴 프로젝트를 복원하고 FileWatcher를 재등록한다."""
    project = core.projects.get(project_id)
    if project is None:
        raise I18nHTTPException(404, KEYS.PROJECT_NOT_FOUND)
    core.projects.unhide_project(project_id)

    # FileWatcher 재등록 (hide 시 unwatch한 것의 역연산)
    for config_dir in AgentAdapter.all_config_dirs():
        config_path = Path(project.path) / config_dir
        if config_path.is_dir():
            watcher.watch(project_id, str(config_path))

    locale = get_locale(request)
    return {
        "message": translate(KEYS.PROJECT_UNHIDDEN, locale=locale),
        "message_key": KEYS.PROJECT_UNHIDDEN,
    }
