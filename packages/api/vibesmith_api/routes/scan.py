"""스캔 관련 엔드포인트."""

import os
import threading
from pathlib import Path

from fastapi import APIRouter, Depends
from vibesmith_core import VibeSmithCore
from vibesmith_core.infra.scan_progress import ScanProgressRegistry
from vibesmith_core.infra.watcher import FileWatcher
from vibesmith_core.scanning.adapters.base import AgentAdapter
from vibesmith_core.usage.scanner import UsageScanner

from vibesmith_api.config import load_config, save_config
from vibesmith_api.deps import get_core, get_scan_registry, get_usage_scanner, get_watcher
from vibesmith_api.i18n import KEYS
from vibesmith_api.i18n.exceptions import I18nHTTPException
from vibesmith_api.logging_config import get_logger
from vibesmith_api.schemas import ScanRequest, ScanResponse
from vibesmith_api.security import conditional_limiter

logger = get_logger("vibesmith.api.scan")

router = APIRouter(prefix="/api", tags=["scan"])


def _run_scan_in_background(
    req: ScanRequest,
    core: VibeSmithCore,
    watcher: FileWatcher,
    registry: ScanProgressRegistry,
    usage_scanner: UsageScanner,
) -> None:
    """백그라운드 스레드에서 실행되는 스캔 로직.

    모든 대상 프로젝트를 먼저 수집 → start_scan 1회 → 순차 스캔 → finish_scan.
    """
    try:
        # Phase 1: 프로젝트 준비 (발견, 등록)
        scan_targets: list[tuple[str, str, str]] = []  # (id, name, path)
        watch_targets: list[tuple[str, str]] = []  # (project_id, config_path)

        # 1. 글로벌 프로젝트 교체
        if req.home_path:
            for p in core.projects.list_all(include_hidden=True):
                if p.is_global:
                    watcher.unwatch(p.id)
                    core.projects.remove_project(p.id)
            global_proj = core.projects.ensure_global_project(req.home_path)
            scan_targets.append((global_proj.id, global_proj.name, global_proj.path))
            for config_dir in AgentAdapter.all_config_dirs():
                config_path = Path(req.home_path) / config_dir
                if config_path.is_dir():
                    watch_targets.append((global_proj.id, str(config_path)))

        # 2. 프로젝트 루트 탐색
        if req.root_path:
            config = load_config()
            root_paths = set(config.get("root_paths", []))
            root_paths.add(req.root_path)
            config["root_paths"] = sorted(root_paths)
            save_config(config)

            paths = core.projects.discover_projects(req.root_path, max_depth=4)
            existing = {p.path for p in core.projects.list_all(include_hidden=True)}
            for path in paths:
                if path not in existing:
                    core.projects.add_project(path)

            resolved_root = Path(req.root_path).resolve()
            for project in core.projects.list_all():
                if project.is_global:
                    continue
                try:
                    Path(project.path).resolve().relative_to(resolved_root)
                except ValueError:
                    continue
                scan_targets.append((project.id, project.name, project.path))
                for config_dir in AgentAdapter.all_config_dirs():
                    config_path = Path(project.path) / config_dir
                    if config_path.is_dir():
                        watch_targets.append((project.id, str(config_path)))

        # 3. 특정 프로젝트 재스캔
        elif req.project_id:
            project = core.projects.get(req.project_id)
            if project is not None:
                scan_targets.append((project.id, project.name, project.path))

        # 4. 전체 재스캔
        elif not req.home_path:
            for project in core.projects.list_all():
                scan_targets.append((project.id, project.name, project.path))

        if not scan_targets:
            return

        # Phase 2: 원자적 스캔 시작 (TOCTOU 방지)
        acquired = registry.try_start_scan(
            "filesystem",
            [t[0] for t in scan_targets],
            {t[0]: t[1] for t in scan_targets},
            {t[0]: t[2] for t in scan_targets},
        )
        if not acquired:
            logger.info("스캔 이미 진행 중 — 백그라운드 스레드 종료")
            return

        results = []
        for project_id, _name, _path in scan_targets:
            registry.mark_scanning(project_id)
            try:
                result = core.projects.rescan(project_id)
                results.append(result)
            except Exception as e:
                logger.warning("프로젝트 스캔 실패 (계속 진행)", project_id=project_id, error=str(e))
            registry.mark_done(project_id)

        # Phase 3: 와처 등록
        for project_id, config_path in watch_targets:
            try:
                watcher.watch(project_id, config_path)
            except Exception as e:
                logger.warning("와처 등록 실패", project_id=project_id, error=str(e))

        # Phase 4: 사용량 즉시 파싱 (filesystem 스캔 완료 후 바로 실행)
        try:
            usage_scanner.scan_once(update_registry=False)
        except Exception as e:
            logger.warning("사용량 파싱 실패 (계속 진행)", error=str(e))

        registry.finish_scan()
        logger.info("백그라운드 스캔 완료", scanned=len(results))
    except Exception as e:
        registry.finish_scan()
        logger.error("백그라운드 스캔 실패", error=str(e), exc_info=True)


@router.post(
    "/scan",
    response_model=ScanResponse,
    summary="파일시스템 스캔 실행 (비동기)",
    response_description="스캔 시작 확인. 진행률은 GET /api/system/scan-progress로 폴링",
)
@conditional_limiter("10/minute")
def scan(
    req: ScanRequest,
    core: VibeSmithCore = Depends(get_core),
    watcher: FileWatcher = Depends(get_watcher),
    registry: ScanProgressRegistry = Depends(get_scan_registry),
    usage_scanner: UsageScanner = Depends(get_usage_scanner),
):
    """파일시스템 스캔을 비동기로 시작합니다.

    스캔은 백그라운드에서 실행되며, 진행률은 GET /api/system/scan-progress로 확인합니다.

    4가지 스캔 모드를 지원하며, 요청 필드 조합에 따라 동작이 달라집니다:

    1. **`home_path` 지정**: 글로벌 프로젝트(홈 디렉토리 설정)를 교체하고 스캔
    2. **`root_path` 지정**: 해당 경로 하위에서 프로젝트를 자동 탐색 → 등록 → 전체 재스캔
    3. **`project_id` 지정**: 특정 프로젝트 하나만 재스캔
    4. **모두 생략**: 등록된 모든 프로젝트를 전체 재스캔
    """
    # 빠른 힌트: 이미 스캔 중이면 즉시 반환 (실제 보호는 try_start_scan에서 원자적으로 수행)
    progress = registry.get_progress()
    if progress["scanning"]:
        return ScanResponse(
            status="already_running",
            message="Scan is already in progress",
        )

    # project_id 유효성 검사 (백그라운드 전에 확인)
    if req.project_id and not req.root_path:
        project = core.projects.get(req.project_id)
        if project is None:
            raise I18nHTTPException(404, KEYS.PROJECT_NOT_FOUND_BY_ID, project_id=req.project_id)
        if project.hidden_at is not None:
            raise I18nHTTPException(409, KEYS.PROJECT_HIDDEN_CANNOT_RESCAN)

    if os.getenv("VIBESMITH_TEST_MODE") == "1":
        _run_scan_in_background(req, core, watcher, registry, usage_scanner)
    else:
        thread = threading.Thread(
            target=_run_scan_in_background,
            args=(req, core, watcher, registry, usage_scanner),
            daemon=True,
        )
        thread.start()

    return ScanResponse(
        status="started",
        message="Scan started in background",
    )
