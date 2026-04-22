"""Config 관련 API 라우트"""

from pathlib import Path

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from vibesmith_core import VibeSmithCore
from vibesmith_core.infra.watcher import FileWatcher

from vibesmith_api.config import load_config, save_config
from vibesmith_api.deps import get_core, get_watcher

logger = structlog.get_logger("vibesmith.api.config")

router = APIRouter(prefix="/api", tags=["config"])


@router.get("/config")
def get_config():
    """
    현재 서버 설정을 반환한다.

    Returns:
        - `home_path`: 글로벌 프로젝트 경로 (설정된 경우)
        - `cursor_global_path`: Cursor 글로벌 경로
        - `root_paths`: 프로젝트 탐색 루트 경로 목록
    """
    config = load_config()
    return {
        "home_path": config.get("home_path"),
        "cursor_global_path": config.get("cursor_global_path"),
        "root_paths": config.get("root_paths", []),
    }


class RemoveRootPathRequest(BaseModel):
    path: str


def _find_projects_under_root(core: VibeSmithCore, root_path: str) -> list:
    """root_path 하위에 있는 프로젝트 목록을 반환한다."""
    root = Path(root_path).resolve()
    affected = []
    for project in core.projects.list_all(include_hidden=True):
        try:
            Path(project.path).resolve().relative_to(root)
            affected.append(project)
        except ValueError:
            continue
    return affected


@router.delete("/config/root-paths")
def remove_root_path(
    req: RemoveRootPathRequest,
    core: VibeSmithCore = Depends(get_core),
    watcher: FileWatcher = Depends(get_watcher),
    dry_run: bool = Query(False),
):
    """등록된 프로젝트 루트 경로를 제거하고, 하위 프로젝트를 삭제한다.

    dry_run=true면 영향 범위만 반환하고 실제 삭제하지 않는다.
    """
    config = load_config()
    root_paths: list[str] = config.get("root_paths", [])
    if req.path not in root_paths:
        raise HTTPException(status_code=404, detail="Path not found in root_paths")

    affected = _find_projects_under_root(core, req.path)

    if dry_run:
        return {
            "dry_run": True,
            "affected_projects": len(affected),
            "projects": [{"id": p.id, "name": p.name, "path": p.path} for p in affected],
        }

    # 실제 삭제 진행
    root_paths.remove(req.path)
    config["root_paths"] = root_paths
    save_config(config)

    conn = core.db.get_connection()
    for project in affected:
        if hasattr(watcher, "unwatch"):
            watcher.unwatch(project.id)
        # usage 데이터 수동 정리 (FK 없음)
        conn.execute("DELETE FROM usage_sessions WHERE project_path = ?", (project.path,))
        conn.execute("DELETE FROM usage_parse_state WHERE project_path = ?", (project.path,))
        # 프로젝트 삭제 (CASCADE로 components, dependencies, activities도 삭제)
        core.projects.remove_project(project.id)
        logger.info("root_path 하위 프로젝트 삭제", project_id=project.id, path=project.path)

    conn.commit()
    return {"removed_root": req.path, "deleted_projects": len(affected), "root_paths": root_paths}
