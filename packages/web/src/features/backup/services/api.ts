/**
 * Backup feature API client
 * docs/api/spec.md §7.5 (Issue #84)
 */

import { apiClient } from '@/common/api';
import type {
  BackupDetail,
  BackupItem,
  BackupRestoreResponse,
  DeleteBackupResponse,
} from '../types';

/**
 * 백업 생성
 * POST /api/backup/create
 */
export async function createBackup(): Promise<BackupItem> {
  return apiClient<BackupItem>('/api/backup/create', {
    method: 'POST',
  });
}

/**
 * 백업 목록 조회
 * GET /api/backup/list
 */
export async function listBackups(): Promise<BackupItem[]> {
  return apiClient<BackupItem[]>('/api/backup/list');
}

/**
 * 백업 상세 조회
 * GET /api/backup/{backup_id}
 */
export async function getBackup(backupId: string): Promise<BackupDetail> {
  return apiClient<BackupDetail>(`/api/backup/${backupId}`);
}

/**
 * 백업 복원
 * POST /api/backup/restore
 */
export async function restoreBackup(backupId: string): Promise<BackupRestoreResponse> {
  return apiClient<BackupRestoreResponse>('/api/backup/restore', {
    method: 'POST',
    body: JSON.stringify({ backup_id: backupId }),
  });
}

/**
 * 백업 삭제
 * DELETE /api/backup/{backup_id}
 */
export async function deleteBackup(backupId: string): Promise<DeleteBackupResponse> {
  return apiClient<DeleteBackupResponse>(`/api/backup/${backupId}`, {
    method: 'DELETE',
  });
}
