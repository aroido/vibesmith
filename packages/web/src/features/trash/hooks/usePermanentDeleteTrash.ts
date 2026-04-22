/**
 * Permanent delete trash item mutation hook
 * DELETE /api/trash/{id}
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { permanentDeleteTrashItem } from '@/common/api';
import { showSuccessToast, showErrorToast } from '@/common/utils';
import { useTranslation } from 'react-i18next';

export function usePermanentDeleteTrash() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('trash');

  return useMutation({
    mutationFn: (id: string) => permanentDeleteTrashItem(id),
    onSuccess: () => {
      showSuccessToast(t('permanentDeleteSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['trash'] });
    },
    onError: (error) => {
      showErrorToast(
        error instanceof Error ? error.message : t('permanentDeleteError')
      );
    },
  });
}
