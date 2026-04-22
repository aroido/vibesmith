/**
 * Empty trash mutation hook
 * DELETE /api/trash
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { emptyTrash } from '@/common/api';
import { showSuccessToast, showErrorToast } from '@/common/utils';
import { useTranslation } from 'react-i18next';

export function useEmptyTrash() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('trash');

  return useMutation({
    mutationFn: emptyTrash,
    onSuccess: () => {
      showSuccessToast(t('emptySuccess'));
      void queryClient.invalidateQueries({ queryKey: ['trash'] });
    },
    onError: (error) => {
      showErrorToast(
        error instanceof Error ? error.message : t('emptyError')
      );
    },
  });
}
