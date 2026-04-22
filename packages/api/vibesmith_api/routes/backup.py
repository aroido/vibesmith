"""로컬 백업/복원 API (Issue #84)."""

from fastapi import APIRouter, Depends, HTTPException, Request
from vibesmith_core import VibeSmithCore
from vibesmith_core.backup import LocalBackupManager

from vibesmith_api.deps import get_core, get_locale
from vibesmith_api.i18n import KEYS, translate
from vibesmith_api.schemas import (
    BackupDetailResponse,
    BackupItemResponse,
    BackupRestoreRequest,
    BackupRestoreResponse,
)

router = APIRouter(prefix="/api/backup", tags=["backup"])


def _get_backup_manager(request: Request, core: VibeSmithCore) -> LocalBackupManager:
    backup_dir = getattr(request.app.state, "backup_dir", None)
    return LocalBackupManager(core.db.get_connection(), backup_dir=backup_dir)


@router.post(
    "/create",
    response_model=BackupItemResponse,
    status_code=201,
    summary="로컬 백업 생성",
    response_description="생성된 백업 메타데이터",
)
def create_backup(request: Request, core: VibeSmithCore = Depends(get_core)):
    manager = _get_backup_manager(request, core)
    return BackupItemResponse(**manager.create_backup())


@router.get(
    "/list",
    response_model=list[BackupItemResponse],
    summary="백업 목록 조회",
    response_description="저장된 백업 메타데이터 목록 (최신순)",
)
def list_backups(request: Request, core: VibeSmithCore = Depends(get_core)):
    manager = _get_backup_manager(request, core)
    return [BackupItemResponse(**item) for item in manager.list_backups()]


@router.get(
    "/{backup_id}",
    response_model=BackupDetailResponse,
    summary="백업 상세 조회",
    response_description="선택한 백업의 payload 및 메타데이터",
)
def get_backup(backup_id: str, request: Request, core: VibeSmithCore = Depends(get_core)):
    manager = _get_backup_manager(request, core)
    backup = manager.get_backup(backup_id)
    if backup is None:
        raise HTTPException(status_code=404, detail="백업을 찾을 수 없습니다")
    return BackupDetailResponse(**backup)


@router.post(
    "/restore",
    response_model=BackupRestoreResponse,
    summary="백업 복원",
    response_description="복원된 레코드 수 요약",
)
def restore_backup(req: BackupRestoreRequest, request: Request, core: VibeSmithCore = Depends(get_core)):
    manager = _get_backup_manager(request, core)
    try:
        result = manager.restore_backup(req.backup_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="백업을 찾을 수 없습니다") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="백업 파일 무결성 검증 실패") from exc
    return BackupRestoreResponse(**result)


@router.delete(
    "/{backup_id}",
    status_code=200,
    summary="백업 삭제",
    response_description="삭제 결과",
)
def delete_backup(backup_id: str, request: Request, core: VibeSmithCore = Depends(get_core)):
    manager = _get_backup_manager(request, core)
    if not manager.delete_backup(backup_id):
        raise HTTPException(status_code=404, detail="백업을 찾을 수 없습니다")
    locale = get_locale(request)
    return {
        "message": translate(KEYS.DELETED, locale=locale),
        "message_key": KEYS.DELETED,
    }
