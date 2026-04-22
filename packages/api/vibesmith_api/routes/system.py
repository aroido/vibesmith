"""시스템 관리 API — factory-reset, scan-progress 등."""

import structlog
from fastapi import APIRouter, Depends
from vibesmith_core import VibeSmithCore
from vibesmith_core.infra.scan_progress import ScanProgressRegistry
from vibesmith_core.infra.watcher import FileWatcher
from vibesmith_core.usage.scanner import UsageScanner

from vibesmith_api.config import load_config
from vibesmith_api.deps import get_core, get_scan_registry, get_usage_scanner, get_watcher
from vibesmith_api.security import conditional_limiter

logger = structlog.get_logger("vibesmith.api.system")

router = APIRouter(prefix="/api", tags=["system"])


@router.post("/system/factory-reset")
def factory_reset(
    core: VibeSmithCore = Depends(get_core),
    watcher: FileWatcher = Depends(get_watcher),
    usage_scanner: UsageScanner = Depends(get_usage_scanner),
):
    """전체 초기화 + 재스캔. Danger Zone 기능."""
    # 1. 워커 중지 (scan_lock 대기)
    if hasattr(usage_scanner, "wait_for_idle"):
        usage_scanner.wait_for_idle(timeout=30.0)
    if hasattr(usage_scanner, "stop"):
        usage_scanner.stop()
    if hasattr(watcher, "stop"):
        watcher.stop()
    logger.info("factory_reset: 워커 중지 완료")

    # 2. DB 초기화 (rescannable 데이터만)
    core.db.clear_rescannable_data()
    logger.info("factory_reset: DB 초기화 완료")

    # 3. root_paths에서 프로젝트 재탐색 + 등록
    config = load_config()
    root_paths = config.get("root_paths", [])
    for rp in root_paths:
        discovered = core.projects.discover_projects(rp, max_depth=4)
        existing = {p.path for p in core.projects.list_all()}
        for path in discovered:
            if path not in existing:
                core.projects.add_project(path)

    # 4. 전체 재스캔
    total_components = 0
    all_projects = core.projects.list_all()
    for project in all_projects:
        try:
            result = core.projects.rescan(project.id)
            total_components += result.get("component_count", 0)
        except Exception:
            logger.warning("factory_reset: 프로젝트 rescan 실패", project_id=project.id, exc_info=True)

    # 5. 워커 재시작
    if hasattr(watcher, "start"):
        watcher.start()
    if hasattr(usage_scanner, "start"):
        usage_scanner.start()
    logger.info("factory_reset: 워커 재시작 완료")

    return {
        "scanned_projects": len(all_projects),
        "total_components": total_components,
        "usage_reset": True,
    }


@router.get("/system/scan-progress")
@conditional_limiter("150/minute")
def get_scan_progress(
    registry: ScanProgressRegistry = Depends(get_scan_registry),
    core: VibeSmithCore = Depends(get_core),
):
    """현재 스캔 진행률을 반환한다. 프론트엔드 폴링용."""
    progress = registry.get_progress()
    # 숨긴 프로젝트를 진행률 목록에서 제외
    hidden_ids = {p.id for p in core.projects.list_all(include_hidden=True) if p.hidden_at is not None}
    if hidden_ids:
        progress["projects"] = [p for p in progress["projects"] if p["id"] not in hidden_ids]
    return progress
