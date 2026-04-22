/**
 * Backup feature domain types
 */

export interface BackupItem {
  id: string;
  version: string;
  size_bytes: number;
  checksum: string;
  created_at: string;
}

export interface BackupDetail extends BackupItem {
  payload: Record<string, unknown>;
}

export interface BackupRestoreResponse {
  restored_projects: number;
  restored_components: number;
  restored_tags: number;
  restored_dependencies: number;
  restored_versions: number;
}

export interface DeleteBackupResponse {
  message: string;
  message_key: string;
}
