"""Preset/Collection V1 API routes."""

from __future__ import annotations

import sqlite3
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Body, Depends, Query, Request
from vibesmith_core import VibeSmithCore
from vibesmith_core.components.models import ComponentBase, ComponentType

from vibesmith_api.activities import log_activity
from vibesmith_api.deps import get_core, get_locale
from vibesmith_api.i18n import translate
from vibesmith_api.i18n.exceptions import I18nHTTPException
from vibesmith_api.i18n.keys import KEYS
from vibesmith_api.preset_collection_schemas import (
    CollectionApplyRequest,
    CollectionApplyResponse,
    CollectionApplySummary,
    CollectionCreateRequest,
    CollectionListResponse,
    CollectionPreviewItem,
    CollectionPreviewRequest,
    CollectionPreviewResponse,
    CollectionPreviewSummary,
    CollectionResponse,
    CollectionRevisionListResponse,
    CollectionRevisionResponse,
    CollectionRevisionSummaryResponse,
    CollectionSummaryResponse,
    CollectionUpdateRequest,
    PresetCreateRequest,
    PresetFromProjectRequest,
    PresetListResponse,
    PresetResponse,
    PresetRevisionListResponse,
    PresetRevisionResponse,
    PresetRevisionSummaryResponse,
    PresetSummaryResponse,
    PresetUpdateRequest,
)
from vibesmith_api.preset_collections_repo import (
    CollectionImmutableError,
    CollectionNameConflictError,
    CollectionNotFoundError,
    CollectionRevisionNotFoundError,
    ConflictPolicy,
    PresetCollectionError,
    PresetCollectionRepository,
    PresetCollectionValidationError,
    PresetImmutableError,
    PresetNameConflictError,
    PresetNotFoundError,
    PresetRevisionNotFoundError,
    PresetSourceComponentNotFoundError,
    PresetSourceProjectNotFoundError,
)

presets_router = APIRouter(prefix="/api/presets", tags=["presets"])
collections_router = APIRouter(prefix="/api/collections", tags=["collections"])

_COMPONENT_PATH_PREFIX: dict[str, str] = {
    "skill": "/skills",
    "agent": "/agents",
    "command": "/commands",
    "hook": "/hooks",
    "rule": "/rules",
}


def _repo(core: VibeSmithCore) -> PresetCollectionRepository:
    return PresetCollectionRepository(core.db)


def _raise_repo_error(error: Exception) -> None:
    if isinstance(error, (PresetNotFoundError, CollectionNotFoundError)):
        raise I18nHTTPException(404, KEYS.PROJECT_TEMPLATE_NOT_FOUND)
    if isinstance(error, (PresetRevisionNotFoundError, CollectionRevisionNotFoundError)):
        raise I18nHTTPException(404, KEYS.PROJECT_TEMPLATE_REVISION_NOT_FOUND)
    if isinstance(error, PresetSourceProjectNotFoundError):
        raise I18nHTTPException(404, KEYS.PROJECT_TEMPLATE_SOURCE_PROJECT_NOT_FOUND)
    if isinstance(error, PresetSourceComponentNotFoundError):
        raise I18nHTTPException(404, KEYS.COMPONENT_NOT_FOUND)
    if isinstance(error, (PresetNameConflictError, CollectionNameConflictError)):
        raise I18nHTTPException(409, KEYS.PROJECT_TEMPLATE_NAME_EXISTS)
    if isinstance(error, (PresetImmutableError, CollectionImmutableError)):
        raise I18nHTTPException(403, KEYS.PROJECT_TEMPLATE_SYSTEM_IMMUTABLE)
    if isinstance(error, PresetCollectionValidationError):
        raise I18nHTTPException(422, KEYS.VALIDATION_ERROR, detail=str(error))
    if isinstance(error, PresetCollectionError):
        raise I18nHTTPException(400, KEYS.VALIDATION_ERROR, detail=str(error))
    raise error


def _to_preset_summary(item: dict[str, Any]) -> PresetSummaryResponse:
    return PresetSummaryResponse(
        id=item["id"],
        name=item["name"],
        component_type=item["component_type"],
        platform=item["platform"],
        description=item.get("description") or "",
        scope=item["scope"],
        tags=item.get("tags") or [],
        latest_revision=int(item.get("latest_revision") or 0),
        revisions_count=int(item.get("revisions_count") or 0),
        created_at=item["created_at"],
        updated_at=item["updated_at"],
    )


def _to_preset_revision_summary(item: dict[str, Any]) -> PresetRevisionSummaryResponse:
    return PresetRevisionSummaryResponse(
        revision=item["revision"],
        created_at=item["created_at"],
        created_by=item.get("created_by"),
        change_note=item.get("change_note") or "",
        content_hash=item["content_hash"],
    )


def _to_preset_revision_detail(item: dict[str, Any]) -> PresetRevisionResponse:
    return PresetRevisionResponse(
        preset_id=item["preset_id"],
        revision=item["revision"],
        created_at=item["created_at"],
        created_by=item.get("created_by"),
        change_note=item.get("change_note") or "",
        content_hash=item["content_hash"],
        content=item.get("content") or "",
        frontmatter=item.get("frontmatter") or {},
        tags=item.get("tags") or [],
    )


def _to_collection_summary(item: dict[str, Any]) -> CollectionSummaryResponse:
    return CollectionSummaryResponse(
        id=item["id"],
        name=item["name"],
        description=item.get("description") or "",
        scope=item["scope"],
        tags=item.get("tags") or [],
        latest_revision=int(item.get("latest_revision") or 0),
        revisions_count=int(item.get("revisions_count") or 0),
        items_count=int(item.get("items_count") or 0),
        created_at=item["created_at"],
        updated_at=item["updated_at"],
    )


def _to_collection_revision_summary(item: dict[str, Any]) -> CollectionRevisionSummaryResponse:
    return CollectionRevisionSummaryResponse(
        revision=item["revision"],
        created_at=item["created_at"],
        created_by=item.get("created_by"),
        change_note=item.get("change_note") or "",
        item_count=item["item_count"],
    )


def _to_collection_revision_detail(item: dict[str, Any]) -> CollectionRevisionResponse:
    return CollectionRevisionResponse(
        collection_id=item["collection_id"],
        revision_id=item["revision_id"],
        revision=item["revision"],
        created_at=item["created_at"],
        created_by=item.get("created_by"),
        change_note=item.get("change_note") or "",
        item_count=item["item_count"],
        items=item.get("items") or [],
    )


@presets_router.get("", response_model=PresetListResponse)
def list_presets(
    q: str | None = Query(None, description="이름/설명 검색"),
    scope: str = Query("all", pattern="^(all|system|user)$", description="preset 범위"),
    component_type: str | None = Query(None, description="component type filter"),
    platform: str | None = Query(None, description="platform filter"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    core: VibeSmithCore = Depends(get_core),
):
    repo = _repo(core)
    try:
        items, total = repo.list_presets(
            q=q,
            scope=scope,
            component_type=component_type,
            platform=platform,
            limit=limit,
            offset=offset,
        )
        return PresetListResponse(items=[_to_preset_summary(item) for item in items], total=total)
    except Exception as error:
        _raise_repo_error(error)
        raise error


@presets_router.get("/{preset_id}", response_model=PresetResponse)
def get_preset(preset_id: str, core: VibeSmithCore = Depends(get_core)):
    repo = _repo(core)
    try:
        return PresetResponse(**repo.get_preset(preset_id))
    except Exception as error:
        _raise_repo_error(error)
        raise error


@presets_router.post("", response_model=PresetResponse, status_code=201)
def create_preset(req: PresetCreateRequest, core: VibeSmithCore = Depends(get_core)):
    repo = _repo(core)
    try:
        created = repo.create_preset(
            name=req.name,
            component_type=req.component_type,
            platform=req.platform,
            description=req.description,
            scope=req.scope,
            tags=req.tags,
            content=req.content,
            frontmatter=req.frontmatter,
            change_note=req.change_note,
            created_by=None,
        )
        return PresetResponse(**created)
    except Exception as error:
        _raise_repo_error(error)
        raise error


@presets_router.post("/from-project", response_model=PresetResponse, status_code=201)
def create_preset_from_project(req: PresetFromProjectRequest, core: VibeSmithCore = Depends(get_core)):
    repo = _repo(core)
    try:
        created = repo.create_preset_from_project(
            source_project_id=req.source_project_id,
            source_component_id=req.component_id,
            name=req.name,
            description=req.description,
            tags=req.tags,
            include_disabled=req.include_disabled,
            conflict_if_name_exists=req.conflict_if_name_exists,
            scope=req.scope,
            created_by=None,
        )
        return PresetResponse(**created)
    except Exception as error:
        _raise_repo_error(error)
        raise error


@presets_router.put("/{preset_id}", response_model=PresetResponse)
def update_preset(
    preset_id: str,
    req: PresetUpdateRequest,
    core: VibeSmithCore = Depends(get_core),
):
    repo = _repo(core)
    try:
        updated = repo.update_preset(
            preset_id,
            name=req.name,
            component_type=req.component_type,
            platform=req.platform,
            description=req.description,
            scope=req.scope,
            tags=req.tags,
            content=req.content,
            frontmatter=req.frontmatter,
            change_note=req.change_note,
            created_by=None,
        )
        return PresetResponse(**updated)
    except Exception as error:
        _raise_repo_error(error)
        raise error


@presets_router.get("/{preset_id}/revisions", response_model=PresetRevisionListResponse)
def list_preset_revisions(
    preset_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    core: VibeSmithCore = Depends(get_core),
):
    repo = _repo(core)
    try:
        items, total = repo.list_preset_revisions(preset_id, limit=limit, offset=offset)
        return PresetRevisionListResponse(items=[_to_preset_revision_summary(item) for item in items], total=total)
    except Exception as error:
        _raise_repo_error(error)
        raise error


@presets_router.get("/{preset_id}/revisions/{revision}", response_model=PresetRevisionResponse)
def get_preset_revision(
    preset_id: str,
    revision: int,
    core: VibeSmithCore = Depends(get_core),
):
    repo = _repo(core)
    try:
        item = repo.get_preset_revision(preset_id, revision)
        return _to_preset_revision_detail(item)
    except Exception as error:
        _raise_repo_error(error)
        raise error


@presets_router.post("/{preset_id}/revisions/{revision}/restore", response_model=PresetRevisionResponse)
def restore_preset_revision(
    preset_id: str,
    revision: int,
    change_note: str | None = Body(default=None, embed=True),
    core: VibeSmithCore = Depends(get_core),
):
    repo = _repo(core)
    try:
        restored = repo.restore_preset_revision(
            preset_id,
            revision=revision,
            change_note=change_note,
            created_by=None,
        )
        return _to_preset_revision_detail(restored)
    except Exception as error:
        _raise_repo_error(error)
        raise error


@presets_router.delete("/{preset_id}", status_code=200)
def delete_preset(
    request: Request,
    preset_id: str,
    core: VibeSmithCore = Depends(get_core),
):
    repo = _repo(core)
    try:
        repo.delete_preset(preset_id)
        locale = get_locale(request)
        return {"message": translate(KEYS.DELETED, locale=locale), "message_key": KEYS.DELETED}
    except Exception as error:
        _raise_repo_error(error)
        raise error


@collections_router.get("", response_model=CollectionListResponse)
def list_collections(
    q: str | None = Query(None, description="이름/설명 검색"),
    scope: str = Query("all", pattern="^(all|system|user)$", description="collection 범위"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    core: VibeSmithCore = Depends(get_core),
):
    repo = _repo(core)
    try:
        items, total = repo.list_collections(q=q, scope=scope, limit=limit, offset=offset)
        return CollectionListResponse(items=[_to_collection_summary(item) for item in items], total=total)
    except Exception as error:
        _raise_repo_error(error)
        raise error


@collections_router.get("/{collection_id}", response_model=CollectionResponse)
def get_collection(collection_id: str, core: VibeSmithCore = Depends(get_core)):
    repo = _repo(core)
    try:
        summary = repo.get_collection(collection_id)
        revision = repo.get_collection_revision(collection_id, summary["latest_revision"])
        return CollectionResponse(**summary, items=revision["items"])
    except Exception as error:
        _raise_repo_error(error)
        raise error


@collections_router.post("", response_model=CollectionResponse, status_code=201)
def create_collection(req: CollectionCreateRequest, core: VibeSmithCore = Depends(get_core)):
    repo = _repo(core)
    try:
        created = repo.create_collection(
            name=req.name,
            description=req.description,
            scope=req.scope,
            tags=req.tags,
            items=[item.model_dump(exclude_none=True) for item in req.items],
            change_note=req.change_note,
            created_by=None,
        )
        revision = repo.get_collection_revision(created["id"], created["latest_revision"])
        return CollectionResponse(**created, items=revision["items"])
    except Exception as error:
        _raise_repo_error(error)
        raise error


@collections_router.put("/{collection_id}", response_model=CollectionResponse)
def update_collection(
    collection_id: str,
    req: CollectionUpdateRequest,
    core: VibeSmithCore = Depends(get_core),
):
    repo = _repo(core)
    try:
        updated = repo.update_collection(
            collection_id,
            name=req.name,
            description=req.description,
            scope=req.scope,
            tags=req.tags,
            items=[item.model_dump(exclude_none=True) for item in req.items],
            change_note=req.change_note,
            created_by=None,
        )
        revision = repo.get_collection_revision(updated["id"], updated["latest_revision"])
        return CollectionResponse(**updated, items=revision["items"])
    except Exception as error:
        _raise_repo_error(error)
        raise error


@collections_router.delete("/{collection_id}", status_code=200)
def delete_collection(
    request: Request,
    collection_id: str,
    core: VibeSmithCore = Depends(get_core),
):
    repo = _repo(core)
    try:
        repo.delete_collection(collection_id)
        locale = get_locale(request)
        return {"message": translate(KEYS.DELETED, locale=locale), "message_key": KEYS.DELETED}
    except Exception as error:
        _raise_repo_error(error)
        raise error


@collections_router.get("/{collection_id}/revisions", response_model=CollectionRevisionListResponse)
def list_collection_revisions(
    collection_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    core: VibeSmithCore = Depends(get_core),
):
    repo = _repo(core)
    try:
        items, total = repo.list_collection_revisions(collection_id, limit=limit, offset=offset)
        return CollectionRevisionListResponse(
            items=[_to_collection_revision_summary(item) for item in items],
            total=total,
        )
    except Exception as error:
        _raise_repo_error(error)
        raise error


@collections_router.get("/{collection_id}/revisions/{revision}", response_model=CollectionRevisionResponse)
def get_collection_revision(
    collection_id: str,
    revision: int,
    core: VibeSmithCore = Depends(get_core),
):
    repo = _repo(core)
    try:
        item = repo.get_collection_revision(collection_id, revision)
        return _to_collection_revision_detail(item)
    except Exception as error:
        _raise_repo_error(error)
        raise error


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
    resolved_items: list[dict[str, Any]],
    existing_map: dict[tuple[str, str, str], dict[str, Any]],
    policy: ConflictPolicy,
    item_overrides: dict[str, ConflictPolicy] | None = None,
) -> tuple[dict[str, int], list[dict[str, Any]]]:
    summary = {
        "to_create": 0,
        "to_update": 0,
        "to_skip": 0,
        "to_rename": 0,
        "conflicts": 0,
    }
    overrides = item_overrides or {}
    reserved_keys = set(existing_map.keys())
    preview_items: list[dict[str, Any]] = []

    for item in resolved_items:
        component_type = item["component_type"]
        platform = item["platform"]
        key = (item["name"].lower(), component_type, platform)
        existing = existing_map.get(key)

        response: dict[str, Any] = {
            "preset_id": item["preset_id"],
            "preset_revision": item["preset_revision"],
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
            response["new_content"] = item.get("content")
            summary["to_create"] += 1
            reserved_keys.add(key)
        else:
            response["existing_content"] = existing.get("content")
            response["new_content"] = item.get("content")
            summary["conflicts"] += 1
            effective_policy = overrides.get(item["preset_id"], policy)
            if effective_policy == "fail":
                response["action"] = "conflict"
                response["reason"] = "name_type_platform_conflict"
            elif effective_policy == "skip":
                response["action"] = "skip"
                response["reason"] = "policy_skip_conflict"
                summary["to_skip"] += 1
            elif effective_policy == "overwrite":
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

        preview_items.append(response)

    return summary, preview_items


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
            tags = source.get("tags") or []
            description = source.get("description") or ""
            content = source.get("content") or ""
            frontmatter = source.get("frontmatter") if isinstance(source.get("frontmatter"), dict) else {}
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


@collections_router.post("/{collection_id}/preview", response_model=CollectionPreviewResponse)
def preview_collection_apply(
    collection_id: str,
    req: CollectionPreviewRequest,
    core: VibeSmithCore = Depends(get_core),
):
    project = core.projects.get(req.project_id)
    if project is None:
        raise I18nHTTPException(404, KEYS.PROJECT_NOT_FOUND)

    repo = _repo(core)
    try:
        resolved = repo.resolve_collection_components(collection_id, revision=req.revision)
        collection_revision = resolved["revision"]

        existing_map = _fetch_existing_component_map(core, req.project_id)
        summary, preview_items = _build_preview(
            resolved_items=resolved["items"],
            existing_map=existing_map,
            policy=req.conflict_policy,
            item_overrides=req.item_overrides,
        )

        last_policy = repo.get_last_policy_for_project(req.project_id)
        repo.log_apply_result(
            collection_id=collection_id,
            collection_revision_id=collection_revision["revision_id"],
            project_id=req.project_id,
            policy=req.conflict_policy,
            status="preview",
            summary=summary,
            created_by=None,
        )

        return CollectionPreviewResponse(
            project_id=req.project_id,
            collection_id=collection_id,
            collection_revision_id=collection_revision["revision_id"],
            revision=collection_revision["revision"],
            policy=req.conflict_policy,
            summary=CollectionPreviewSummary(**summary),
            items=[
                CollectionPreviewItem(**{k: v for k, v in item.items() if not k.startswith("_")})
                for item in preview_items
            ],
            last_policy=last_policy,
        )
    except Exception as error:
        _raise_repo_error(error)
        raise error


@collections_router.post("/{collection_id}/apply", response_model=CollectionApplyResponse)
def apply_collection(
    collection_id: str,
    req: CollectionApplyRequest,
    core: VibeSmithCore = Depends(get_core),
):
    project = core.projects.get(req.project_id)
    if project is None:
        raise I18nHTTPException(404, KEYS.PROJECT_NOT_FOUND)

    repo = _repo(core)
    try:
        resolved = repo.resolve_collection_components(collection_id, revision=req.revision)
        collection_revision = resolved["revision"]

        existing_map = _fetch_existing_component_map(core, req.project_id)
        preview_summary, preview_items = _build_preview(
            resolved_items=resolved["items"],
            existing_map=existing_map,
            policy=req.conflict_policy,
            item_overrides=req.item_overrides,
        )

        if req.conflict_policy == "fail" and preview_summary["conflicts"] > 0:
            repo.log_apply_result(
                collection_id=collection_id,
                collection_revision_id=collection_revision["revision_id"],
                project_id=req.project_id,
                policy=req.conflict_policy,
                status="failed",
                summary=preview_summary,
                created_by=None,
            )
            raise I18nHTTPException(409, KEYS.PROJECT_TEMPLATE_APPLY_CONFLICT)

        apply_summary, applied_items = _apply_preview_items(
            core=core,
            project_id=req.project_id,
            preview_items=preview_items,
        )

        status = "applied" if apply_summary["failed"] == 0 else "failed"
        repo.log_apply_result(
            collection_id=collection_id,
            collection_revision_id=collection_revision["revision_id"],
            project_id=req.project_id,
            policy=req.conflict_policy,
            status=status,
            summary=apply_summary,
            created_by=None,
        )

        return CollectionApplyResponse(
            project_id=req.project_id,
            collection_id=collection_id,
            collection_revision_id=collection_revision["revision_id"],
            revision=collection_revision["revision"],
            policy=req.conflict_policy,
            summary=CollectionApplySummary(**apply_summary),
            items=[CollectionPreviewItem(**item) for item in applied_items],
        )
    except I18nHTTPException:
        raise
    except Exception as error:
        _raise_repo_error(error)
        raise error


@collections_router.post("/{collection_id}/revisions/{revision}/restore", response_model=CollectionRevisionResponse)
def restore_collection_revision(
    collection_id: str,
    revision: int,
    change_note: str | None = Body(default=None, embed=True),
    core: VibeSmithCore = Depends(get_core),
):
    repo = _repo(core)
    try:
        source = repo.get_collection_revision(collection_id, revision)
        collection = repo.get_collection(collection_id)
        updated = repo.update_collection(
            collection_id,
            name=collection["name"],
            description=collection["description"],
            scope=collection["scope"],
            tags=collection["tags"],
            items=[
                {
                    "preset_id": item["preset_id"],
                    "order_index": item["order_index"],
                    "pin_mode": item["pin_mode"],
                    "pinned_revision": item.get("pinned_revision"),
                    "alias_name": item.get("alias_name"),
                }
                for item in source["items"]
            ],
            change_note=change_note or f"restore revision {revision}",
            created_by=None,
        )
        restored = repo.get_collection_revision(collection_id, updated["latest_revision"])
        return _to_collection_revision_detail(restored)
    except Exception as error:
        _raise_repo_error(error)
        raise error
