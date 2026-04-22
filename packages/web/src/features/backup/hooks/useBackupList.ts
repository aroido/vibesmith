/**
 * Backup list query hook
 * GET /api/backup/list
 */

import { useQuery } from '@tanstack/react-query';
import { listBackups } from '../services/api';

export const BACKUP_LIST_QUERY_KEY = ['backup', 'list'] as const;

export function useBackupList() {
  return useQuery({
    queryKey: BACKUP_LIST_QUERY_KEY,
    queryFn: listBackups,
  });
}
