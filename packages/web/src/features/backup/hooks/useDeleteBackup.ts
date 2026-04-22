/**
 * Backup delete mutation hook
 * DELETE /api/backup/{backup_id}
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { showErrorToast, showSuccessToast } from '@/common/utils';
import { deleteBackup } from '../services/api';
import { BACKUP_LIST_QUERY_KEY } from './useBackupList';

export function useDeleteBackup() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('backup');

  return useMutation({
    mutationFn: (backupId: string) => deleteBackup(backupId),
    onSuccess: () => {
      showSuccessToast(t('deleteSuccess'));
      void queryClient.invalidateQueries({ queryKey: BACKUP_LIST_QUERY_KEY });
    },
    onError: (error) => {
      showErrorToast(error instanceof Error ? error.message : t('deleteError'));
    },
  });
}
