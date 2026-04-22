"""Project template (preset) API routes."""

from __future__ import annotations

from fastapi import APIRouter, Body, Depends, Query, Request
from vibesmith_core import VibeSmithCore

from vibesmith_api.deps import get_core, get_locale
from vibesmith_api.i18n import translate
from vibesmith_api.i18n.exceptions import I18nHTTPException
from vibesmith_api.i18n.keys import KEYS
from vibesmith_api.project_templates_repo import (
    ProjectTemplateComponentSelectionError,
    ProjectTemplateComponentsRequiredError,
    ProjectTemplateError,
    ProjectTemplateImmutableError,
    ProjectTemplateNameConflictError,
    ProjectTemplateNotFoundError,
    ProjectTemplatePayloadTooLargeError,
    ProjectTemplateRepository,
    ProjectTemplateRevisionNotFoundError,
    ProjectTemplateSourceProjectNotFoundError,
    ProjectTemplateValidationError,
)
from vibesmith_api.schemas import (
    ProjectTemplateCreateRequest,
    ProjectTemplateFromProjectRequest,
    ProjectTemplateListResponse,
    ProjectTemplateResponse,
    ProjectTemplateRevisionListResponse,
    ProjectTemplateRevisionResponse,
    ProjectTemplateRevisionSummaryResponse,
    ProjectTemplateSummaryResponse,
    ProjectTemplateUpdateRequest,
)
from vibesmith_api.template_engine import render_component, validate_template_exists

router = APIRouter(prefix="/api/project-templates", tags=["project-templates"])


def _repo(core: VibeSmithCore) -> ProjectTemplateRepository:
    return ProjectTemplateRepository(core.db)


def _to_summary(item: dict) -> ProjectTemplateSummaryResponse:
    return ProjectTemplateSummaryResponse(
        id=item["id"],
        name=item["name"],
        description=item["description"],
        scope=item["scope"],
        preset_type=item["preset_type"],
        version=item["version"],
        latest_revision=item["latest_revision"],
        revisions_count=item["revisions_count"],
        component_count=item["component_count"],
        tags=item["tags"],
        created_at=item["created_at"],
        updated_at=item["updated_at"],
    )


def _to_detail(item: dict, revision_items: list[dict]) -> ProjectTemplateResponse:
    return ProjectTemplateResponse(
        id=item["id"],
        name=item["name"],
        description=item["description"],
        scope=item["scope"],
        preset_type=item["preset_type"],
        version=item["version"],
        latest_revision=item["latest_revision"],
        revisions_count=item["revisions_count"],
        component_count=item["component_count"],
        tags=item["tags"],
        components=revision_items,
        created_at=item["created_at"],
        updated_at=item["updated_at"],
    )


def _to_revision_summary(item: dict) -> ProjectTemplateRevisionSummaryResponse:
    return ProjectTemplateRevisionSummaryResponse(
        revision=item["revision"],
        preset_type=item["preset_type"],
        created_at=item["created_at"],
        created_by=item.get("created_by"),
        change_note=item.get("change_note") or "",
        item_count=item["item_count"],
    )


def _to_revision_detail(item: dict) -> ProjectTemplateRevisionResponse:
    return ProjectTemplateRevisionResponse(
        template_id=item["template_id"],
        revision=item["revision"],
        preset_type=item["preset_type"],
        created_at=item["created_at"],
        created_by=item.get("created_by"),
        change_note=item.get("change_note") or "",
        item_count=item["item_count"],
        items=item["items"],
    )


def _raise_repo_error(error: Exception) -> None:
    if isinstance(error, ProjectTemplateNotFoundError):
        raise I18nHTTPException(404, KEYS.PROJECT_TEMPLATE_NOT_FOUND)
    if isinstance(error, ProjectTemplateRevisionNotFoundError):
        raise I18nHTTPException(404, KEYS.PROJECT_TEMPLATE_REVISION_NOT_FOUND)
    if isinstance(error, ProjectTemplateSourceProjectNotFoundError):
        raise I18nHTTPException(404, KEYS.PROJECT_TEMPLATE_SOURCE_PROJECT_NOT_FOUND)
    if isinstance(error, ProjectTemplateNameConflictError):
        raise I18nHTTPException(400, KEYS.PROJECT_TEMPLATE_NAME_EXISTS)
    if isinstance(error, ProjectTemplateImmutableError):
        raise I18nHTTPException(403, KEYS.PROJECT_TEMPLATE_SYSTEM_IMMUTABLE)
    if isinstance(error, ProjectTemplateComponentsRequiredError):
        raise I18nHTTPException(400, KEYS.PROJECT_TEMPLATE_COMPONENTS_REQUIRED)
    if isinstance(error, ProjectTemplateComponentSelectionError):
        raise I18nHTTPException(400, KEYS.PROJECT_TEMPLATE_INVALID_COMPONENT_SELECTION, detail=str(error))
    if isinstance(error, ProjectTemplatePayloadTooLargeError):
        raise I18nHTTPException(422, KEYS.PROJECT_TEMPLATE_CONTENT_TOO_LARGE)
    if isinstance(error, ProjectTemplateValidationError):
        raise I18nHTTPException(422, KEYS.VALIDATION_ERROR, detail=str(error))
    if isinstance(error, ProjectTemplateError):
        raise I18nHTTPException(400, KEYS.VALIDATION_ERROR, detail=str(error))
    raise error


def _validate_blueprints(components: list[dict]) -> None:
    for component in components:
        template_id = component.get("template_id")
        if not template_id:
            continue
        try:
            validate_template_exists(template_id)
            _, rendered_type, _ = render_component(
                template_id=template_id,
                name=component["name"],
                description=component.get("description") or "",
                config=component.get("config") or {},
            )
        except ValueError:
            raise I18nHTTPException(404, KEYS.TEMPLATE_NOT_FOUND)

        if rendered_type != component["component_type"]:
            raise I18nHTTPException(400, KEYS.VALIDATION_ERROR)


@router.get("", response_model=ProjectTemplateListResponse)
def list_project_templates(
    q: str | None = Query(None, description="이름/설명 검색"),
    scope: str = Query("all", pattern="^(all|system|user)$", description="프리셋 범위"),
    limit: int = Query(20, ge=1, le=100, description="한 페이지 최대 개수"),
    offset: int = Query(0, ge=0, description="오프셋"),
    core: VibeSmithCore = Depends(get_core),
):
    repo = _repo(core)
    items, total = repo.list_templates(q=q, scope=scope, limit=limit, offset=offset)
    return ProjectTemplateListResponse(items=[_to_summary(item) for item in items], total=total)


@router.get("/{template_id}", response_model=ProjectTemplateResponse)
def get_project_template(template_id: str, core: VibeSmithCore = Depends(get_core)):
    repo = _repo(core)
    try:
        template = repo.get_template(template_id)
        latest = repo.get_revision(template_id, template["latest_revision"])
        return _to_detail(template, latest["items"])
    except Exception as error:
        _raise_repo_error(error)
        raise error


@router.post("", response_model=ProjectTemplateResponse, status_code=201)
def create_project_template(req: ProjectTemplateCreateRequest, core: VibeSmithCore = Depends(get_core)):
    repo = _repo(core)
    try:
        components = [component.model_dump(exclude_none=True) for component in req.components]
        _validate_blueprints(components)
        created = repo.create_template(
            name=req.name,
            description=req.description,
            tags=req.tags,
            components=components,
            preset_type=req.preset_type,
            change_note=req.change_note,
            created_by=None,
        )
        latest = repo.get_revision(created["id"], created["latest_revision"])
        return _to_detail(created, latest["items"])
    except Exception as error:
        _raise_repo_error(error)
        raise error


@router.post("/from-project", response_model=ProjectTemplateResponse, status_code=201)
def create_project_template_from_project(
    req: ProjectTemplateFromProjectRequest,
    core: VibeSmithCore = Depends(get_core),
):
    repo = _repo(core)
    try:
        created = repo.create_template_from_project(
            source_project_id=req.source_project_id,
            name=req.name,
            description=req.description,
            tags=req.tags,
            component_ids=req.component_ids,
            include_disabled=req.include_disabled,
            conflict_if_name_exists=req.conflict_if_name_exists,
            created_by=None,
        )
        latest = repo.get_revision(created["id"], created["latest_revision"])
        return _to_detail(created, latest["items"])
    except Exception as error:
        _raise_repo_error(error)
        raise error


@router.put("/{template_id}", response_model=ProjectTemplateResponse)
def update_project_template(
    template_id: str,
    req: ProjectTemplateUpdateRequest,
    core: VibeSmithCore = Depends(get_core),
):
    repo = _repo(core)
    try:
        components = [component.model_dump(exclude_none=True) for component in req.components]
        _validate_blueprints(components)
        updated = repo.update_template(
            template_id,
            name=req.name,
            description=req.description,
            tags=req.tags,
            components=components,
            change_note=req.change_note,
            created_by=None,
        )
        latest = repo.get_revision(updated["id"], updated["latest_revision"])
        return _to_detail(updated, latest["items"])
    except Exception as error:
        _raise_repo_error(error)
        raise error


@router.get("/{template_id}/revisions", response_model=ProjectTemplateRevisionListResponse)
def list_project_template_revisions(
    template_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    core: VibeSmithCore = Depends(get_core),
):
    repo = _repo(core)
    try:
        items, total = repo.list_revisions(template_id, limit=limit, offset=offset)
        return ProjectTemplateRevisionListResponse(
            items=[_to_revision_summary(item) for item in items],
            total=total,
        )
    except Exception as error:
        _raise_repo_error(error)
        raise error


@router.get("/{template_id}/revisions/{revision}", response_model=ProjectTemplateRevisionResponse)
def get_project_template_revision(
    template_id: str,
    revision: int,
    core: VibeSmithCore = Depends(get_core),
):
    repo = _repo(core)
    try:
        item = repo.get_revision(template_id, revision)
        return _to_revision_detail(item)
    except Exception as error:
        _raise_repo_error(error)
        raise error


@router.post("/{template_id}/revisions/{revision}/restore", response_model=ProjectTemplateRevisionResponse)
def restore_project_template_revision(
    template_id: str,
    revision: int,
    change_note: str | None = Body(default=None, embed=True),
    core: VibeSmithCore = Depends(get_core),
):
    repo = _repo(core)
    try:
        restored = repo.restore_revision(
            template_id=template_id,
            revision=revision,
            change_note=change_note,
            created_by=None,
        )
        return _to_revision_detail(restored)
    except Exception as error:
        _raise_repo_error(error)
        raise error


@router.delete("/{template_id}", status_code=200)
def delete_project_template(
    request: Request,
    template_id: str,
    core: VibeSmithCore = Depends(get_core),
):
    repo = _repo(core)
    try:
        repo.delete_template(template_id)
        locale = get_locale(request)
        return {"message": translate(KEYS.DELETED, locale=locale), "message_key": KEYS.DELETED}
    except Exception as error:
        _raise_repo_error(error)
        raise error
