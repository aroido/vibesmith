"""FastAPI app — manages core initialization/shutdown via lifespan."""

import os
import time
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from vibesmith_core import VibeSmithCore
from vibesmith_core.infra.scan_progress import ScanProgressRegistry
from vibesmith_core.infra.watcher import FileWatcher
from vibesmith_core.scanning.adapters.base import AgentAdapter
from vibesmith_core.usage.cursor_discovery import get_default_cursor_base_dir
from vibesmith_core.usage.scanner import UsageScanner

from vibesmith_api.config import load_config
from vibesmith_api.deps import enable_threadsafe_db, get_locale
from vibesmith_api.i18n import KEYS, translate
from vibesmith_api.i18n.exceptions import I18nHTTPException
from vibesmith_api.logging_config import get_logger, setup_logging
from vibesmith_api.routes import (
    auth,
    backup,
    components,
    conflicts,
    dashboard,
    dependencies,
    feedback,
    licenses,
    preset_collections,
    project_templates,
    projects,
    sample,
    scan,
    system,
    templates,
    trash,
    usage,
)
from vibesmith_api.routes import (
    config as config_route,
)
from vibesmith_api.security import (
    add_security_headers,
    get_cors_origins,
    limiter,
    log_suspicious_activity,
    rate_limit_middleware,
)

setup_logging()
logger = get_logger("vibesmith.api")
_DEFAULT_CORE_DB_PATH = "~/.vibesmith/vibesmith.db"


def _resolve_core_db_path() -> str:
    """Determine core DB path with environment variable taking precedence."""
    configured = os.getenv("VIBESMITH_DB_PATH", "").strip()
    if configured:
        return configured
    return _DEFAULT_CORE_DB_PATH


def _quarantine_core_db_files(db_path: str) -> list[tuple[str, str]]:
    """Quarantine (rename) potentially corrupted DB files and return move history."""
    base_path = Path(db_path).expanduser()
    timestamp = time.strftime("%Y%m%d%H%M%S", time.gmtime())
    moved: list[tuple[str, str]] = []

    for candidate in (
        base_path,
        Path(f"{base_path}-wal"),
        Path(f"{base_path}-shm"),
    ):
        if not candidate.exists():
            continue

        target = candidate.with_name(f"{candidate.name}.corrupt-{timestamp}")
        suffix = 1
        while target.exists():
            target = candidate.with_name(f"{candidate.name}.corrupt-{timestamp}-{suffix}")
            suffix += 1

        candidate.rename(target)
        moved.append((str(candidate), str(target)))

    return moved


def _resolve_cursor_base_dir(config: dict) -> str:
    """Determine the Cursor base directory for UsageScanner."""
    configured = config.get("cursor_base_dir")
    if isinstance(configured, str) and configured.strip():
        return configured.strip()
    return get_default_cursor_base_dir()


def _discover_and_register(core: VibeSmithCore) -> int:
    """Discover and register projects from configured root_paths or home folder."""
    config = load_config()
    root_paths = config.get("root_paths", [])

    if root_paths:
        # Discover from saved root_paths (1 level)
        discovered = []
        for rp in root_paths:
            discovered.extend(core.projects.discover_projects(rp, max_depth=4))
    else:
        # First run — recursive discovery from home folder
        logger.info("No saved root_path — discovering projects from home folder...")
        discovered = core.projects.discover_projects(str(Path.home()), max_depth=6)

    existing = {p.path for p in core.projects.list_all()}
    new_count = 0
    for path in discovered:
        if path not in existing:
            core.projects.add_project(path)
            new_count += 1
    return new_count


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    """Initialize core and FileWatcher on app start, clean up on shutdown.

    Issue #303: In test mode, auto-discovery/rescan/watching are skipped.
    """
    # Detect test mode
    is_test_mode = os.getenv("VIBESMITH_TEST_MODE") == "1"

    if is_test_mode:
        # In tests, use core/watcher injected via dependency_overrides
        logger.info("Test mode — skipping lifespan auto-initialization")
        yield
        return

    core_db_path = _resolve_core_db_path()
    logger.info("코어 초기화 중...", db_path=core_db_path)

    core = VibeSmithCore(db_path=core_db_path)
    try:
        core.initialize()
    except Exception as e:
        logger.error("코어 초기화 실패", db_path=core_db_path, error=str(e), exc_info=True)
        moved_files = _quarantine_core_db_files(core_db_path)
        if not moved_files:
            raise

        logger.warning(
            "코어 DB 격리 후 초기화 재시도",
            db_path=core_db_path,
            moved_files=moved_files,
        )
        core.close()
        core = VibeSmithCore(db_path=core_db_path)
        try:
            core.initialize()
        except Exception as retry_error:
            logger.error(
                "코어 초기화 재시도 실패",
                db_path=core_db_path,
                moved_files=moved_files,
                error=str(retry_error),
                exc_info=True,
            )
            raise
        logger.warning(
            "코어 DB 복구 완료 (새 DB 재생성)",
            db_path=core_db_path,
            moved_files=moved_files,
        )
    enable_threadsafe_db(core)

    # ScanProgressRegistry — rescan 루프 전에 생성
    scan_registry = ScanProgressRegistry()

    # 프로젝트 자동 발견 + 등록
    try:
        new_count = _discover_and_register(core)
        if new_count:
            logger.info("신규 프로젝트 발견 + 등록", new_count=new_count)
    except Exception as e:
        logger.warning("프로젝트 자동 발견 실패 (계속 진행)", error=str(e), exc_info=True)

    # 등록된 모든 프로젝트 rescan
    all_projects = core.projects.list_all()
    scan_registry.start_scan(
        "filesystem",
        [p.id for p in all_projects],
        {p.id: p.name for p in all_projects},
        {p.id: p.path for p in all_projects},
    )
    rescan_failed = 0
    for project in all_projects:
        try:
            scan_registry.mark_scanning(project.id)
            core.projects.rescan(project.id)
            scan_registry.mark_done(project.id)
        except Exception as e:
            scan_registry.mark_done(project.id)
            rescan_failed += 1
            logger.warning(
                "프로젝트 rescan 실패 (계속 진행)",
                project_id=project.id,
                project_path=project.path,
                error=str(e),
                exc_info=True,
            )
    scan_registry.finish_scan()
    logger.info("프로젝트 rescan 완료", count=len(all_projects), failed=rescan_failed)

    # Issue #165: 30일 경과 휴지통 항목 자동 영구 삭제
    try:
        cleaned = core.operations.cleanup_expired_trash(days=30)
        if cleaned:
            logger.info("휴지통 30일 경과 항목 정리 완료", count=cleaned)
    except Exception as e:
        logger.warning("휴지통 자동 정리 실패 (무시)", error=str(e))

    watcher = FileWatcher()
    for project in core.projects.list_all():
        for config_dir in AgentAdapter.all_config_dirs():
            config_path = Path(project.path) / config_dir
            if config_path.is_dir():
                try:
                    watcher.watch(project.id, str(config_path))
                except Exception as e:
                    logger.warning(
                        "파일 감시 등록 실패 (계속 진행)",
                        project_id=project.id,
                        config_path=str(config_path),
                        error=str(e),
                        exc_info=True,
                    )

    def _on_project_change(project_id: str) -> None:
        try:
            scan_registry.start_scan("filesystem", [project_id])
            scan_registry.mark_scanning(project_id)
            core.projects.rescan(project_id)
            scan_registry.mark_done(project_id)
            scan_registry.finish_scan()
        except Exception as e:
            scan_registry.finish_scan()
            logger.warning(
                "파일 변경 감지 후 rescan 실패 (계속 진행)",
                project_id=project_id,
                error=str(e),
                exc_info=True,
            )

    watcher.on_change(_on_project_change)
    watcher.start()

    # Usage Scanner (Issue #67): 1분 주기 백그라운드 스캔
    usage_scanner = UsageScanner(
        core.db.get_connection(),
        cursor_base_dir=_resolve_cursor_base_dir(load_config()),
        interval_seconds=60,
        registry=scan_registry,
    )
    usage_scanner.start()

    # WorkerSupervisor: 30초 주기 워커 헬스체크 + 자동 재시작
    from vibesmith_core.infra.worker_supervisor import WorkerSupervisor

    supervisor = WorkerSupervisor(workers=[watcher, usage_scanner], interval_seconds=30)
    supervisor.start()

    app.state.core = core
    app.state.watcher = watcher
    app.state.usage_scanner = usage_scanner
    app.state.supervisor = supervisor
    app.state.scan_registry = scan_registry
    project_count = len(core.projects.list_all())
    logger.info("코어 준비 완료", project_count=project_count)
    yield
    logger.info("서버 종료, 정리 중...")
    supervisor.stop()
    usage_scanner.stop()
    watcher.stop()
    core.close()
    logger.info("정리 완료")


app = FastAPI(
    title="VibeSmith API",
    version="0.1.0",
    summary="AI 코딩 에이전트 구성요소 통합 관리 API",
    description="""
## VibeSmith API

Claude Code, Cursor 등 AI 코딩 에이전트의 **Skills, Agents, Commands, Hooks, Rules**를
통합 관리하는 로컬 웹 GUI 도구의 백엔드 API입니다.

### 주요 기능

- **프로젝트 관리**: 로컬 프로젝트 자동 탐색, 등록, 삭제
- **구성요소 CRUD**: Skill, Agent, Command, Hook, Rule 생성/조회/수정/삭제
- **검색 & 필터링**: 타입별, 태그별, 플랫폼별 구성요소 검색
- **파일시스템 스캔**: 프로젝트 디렉토리를 스캔하여 구성요소 자동 발견
- **대시보드 통계**: 전체 구성요소 현황, 트렌드, 시스템 상태 조회

### 아키텍처

```
[Web SPA] ──HTTP──▶ [FastAPI Server] ──▶ [Core Engine] ──▶ [SQLite DB]
                                                       ──▶ [File System]
```
""",
    openapi_tags=[
        {
            "name": "projects",
            "description": "프로젝트 관리 — 로컬 프로젝트 목록 조회, 상세 정보, 삭제 등",
        },
        {
            "name": "project-templates",
            "description": "프로젝트 프리셋 관리 — 목록/상세/생성/수정/삭제",
        },
        {
            "name": "presets",
            "description": "Preset V1 — 단일 컴포넌트 프리셋 CRUD/Revision 관리",
        },
        {
            "name": "collections",
            "description": "Collection V1 — Preset 조합, Preview/Apply, Revision 관리",
        },
        {
            "name": "components",
            "description": "구성요소(Skill, Agent, Command, Hook, Rule) CRUD — 생성, 조회, 수정, 삭제, 토글, 복사",
        },
        {
            "name": "scan",
            "description": "파일시스템 스캔 — 프로젝트 디렉토리를 스캔하여 구성요소를 자동 발견/갱신",
        },
        {
            "name": "dashboard",
            "description": "대시보드 & 시스템 상태 — 전체 통계, 트렌드, 시스템 건강도 조회",
        },
        {
            "name": "dependencies",
            "description": "종속성 그래프 — 노드/엣지 조회, 컴포넌트별 종속성 상세",
        },
        {
            "name": "backup",
            "description": "로컬 백업/복원 — 백업 생성, 목록, 상세 조회, 복원, 삭제",
        },
        {
            "name": "health",
            "description": "서버 상태 확인 — 데스크톱 readiness 체크",
        },
    ],
    lifespan=lifespan,
)

# Rate Limiter 등록
app.state.limiter = limiter

# CORS 미들웨어 (환경별 설정)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate Limiting 미들웨어 (먼저 적용)
app.middleware("http")(rate_limit_middleware)

# 보안 헤더 미들웨어
app.middleware("http")(add_security_headers)

# 의심스러운 활동 로깅 미들웨어
app.middleware("http")(log_suspicious_activity)


@app.get(
    "/api/health",
    tags=["health"],
    summary="API readiness 확인",
    response_description="VibeSmith API readiness 정보",
)
def get_api_health():
    """Electron에서 사용하는 readiness 체크 엔드포인트.

    포트 충돌 시 타 프로세스와 구분 가능하도록 고유 service 식별자를 반환합니다.
    """
    return {
        "status": "ok",
        "service": "vibesmith-api",
        "version": app.version,
    }


@app.exception_handler(I18nHTTPException)
async def i18n_http_exception_handler(request: Request, exc: I18nHTTPException) -> JSONResponse:
    """I18nHTTPException → message_key, message 포맷 응답.

    하위 호환: detail 필드 유지 (번역된 메시지).
    """
    locale = get_locale(request)
    message = translate(exc.message_key, locale=locale, **exc.i18n_params)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": message,
            "message_key": exc.message_key,
            "message": message,
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """422 검증 에러 — message_key, message 추가, 기존 detail 구조 유지."""
    locale = get_locale(request)
    msg = translate(KEYS.VALIDATION_ERROR, locale=locale)
    return JSONResponse(
        status_code=422,
        content=jsonable_encoder(
            {
                "detail": exc.errors(),
                "message_key": KEYS.VALIDATION_ERROR,
                "message": msg,
            }
        ),
    )


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """429 Rate Limit 초과 에러 핸들러."""
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Rate limit exceeded. Please try again later.",
            "message_key": "rate_limit_exceeded",
            "message": "요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.",
        },
        headers={"Retry-After": str(60)},
    )


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = int((time.perf_counter() - start) * 1000)
    logger.info(
        "request_completed",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration_ms=elapsed_ms,
    )
    return response


app.include_router(projects.router)
app.include_router(auth.router)
app.include_router(project_templates.router)
app.include_router(preset_collections.presets_router)
app.include_router(preset_collections.collections_router)
app.include_router(components.router)
app.include_router(conflicts.router)
app.include_router(dependencies.router)
app.include_router(trash.router)
app.include_router(scan.router)
app.include_router(dashboard.router)
app.include_router(templates.router)
app.include_router(sample.router)  # Issue #267: Quick Start 샘플 프로젝트
app.include_router(licenses.router)  # Issue #79: 라이선스 시스템
app.include_router(feedback.router)  # Issue #85: 피드백 → GitHub issue
app.include_router(usage.router)  # Issue #67: Usage Tracking
app.include_router(backup.router)  # Issue #84: 로컬 백업/복원
app.include_router(config_route.router)
app.include_router(system.router)  # factory-reset 등 시스템 관리
