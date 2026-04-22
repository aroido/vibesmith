/**
 * Backup create mutation hook
 * POST /api/backup/create
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { trackFeatureUsed } from '@/common/analytics/desktopAnalyticsBridge';
import { showErrorToast, showSuccessToast } from '@/common/utils';
import { createBackup } from '../services/api';
import { BACKUP_LIST_QUERY_KEY } from './useBackupList';

export function useCreateBackup() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('backup');

  return useMutation({
    mutationFn: createBackup,
    onSuccess: () => {
      trackFeatureUsed('backup', {
        action: 'create',
        result: 'success',
      });
      showSuccessToast(t('createSuccess'));
      void queryClient.invalidateQueries({ queryKey: BACKUP_LIST_QUERY_KEY });
    },
    onError: (error) => {
      trackFeatureUsed('backup', {
        action: 'create',
        result: 'failure',
      });
      showErrorToast(error instanceof Error ? error.message : t('createError'));
    },
  });
}
