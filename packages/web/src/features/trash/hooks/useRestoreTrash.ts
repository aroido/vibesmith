/**
 * Restore trash item mutation hook
 * POST /api/trash/{id}/restore
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { restoreTrashItem } from '@/common/api';
import { showSuccessToast, showErrorToast } from '@/common/utils';
import { useTranslation } from 'react-i18next';

export function useRestoreTrash() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('trash');

  return useMutation({
    mutationFn: (id: string) => restoreTrashItem(id),
    onSuccess: () => {
      showSuccessToast(t('restoreSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['trash'] });
      void queryClient.invalidateQueries({ queryKey: ['components'] });
    },
    onError: (error) => {
      showErrorToast(
        error instanceof Error ? error.message : t('restoreError')
      );
    },
  });
}
