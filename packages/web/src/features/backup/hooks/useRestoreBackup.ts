/**
 * Backup restore mutation hook
 * POST /api/backup/restore
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { trackFeatureUsed } from '@/common/analytics/desktopAnalyticsBridge';
import { showErrorToast, showSuccessToast } from '@/common/utils';
import { restoreBackup } from '../services/api';
import { BACKUP_LIST_QUERY_KEY } from './useBackupList';

export function useRestoreBackup() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('backup');

  return useMutation({
    mutationFn: (backupId: string) => restoreBackup(backupId),
    onSuccess: (data) => {
      trackFeatureUsed('backup', {
        action: 'restore',
        result: 'success',
        restored_projects: data.restored_projects,
        restored_components: data.restored_components,
      });
      showSuccessToast(
        t('restoredSummary', {
          projects: data.restored_projects,
          components: data.restored_components,
        })
      );
      void queryClient.invalidateQueries({ queryKey: BACKUP_LIST_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      void queryClient.invalidateQueries({ queryKey: ['components'] });
    },
    onError: (error) => {
      trackFeatureUsed('backup', {
        action: 'restore',
        result: 'failure',
      });
      showErrorToast(error instanceof Error ? error.message : t('restoreError'));
    },
  });
}
