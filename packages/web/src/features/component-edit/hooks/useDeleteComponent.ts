/**
 * Component delete mutation hook
 * DELETE /api/components/{id}
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { deleteComponent } from '../services/api';
import { showSuccessToast, showErrorToast } from '@/common/utils';

/**
 * 구성요소 삭제 훅
 */
export function useDeleteComponent(componentId: string | undefined) {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteComponent(componentId!, { permanent: false }), // Soft Delete → 휴지통
    onSuccess: () => {
      showSuccessToast(t('hooks.movedToTrash'));
      queryClient.removeQueries({ queryKey: ['components', componentId] });
      void queryClient.invalidateQueries({ queryKey: ['components'] });
      void queryClient.invalidateQueries({ queryKey: ['trash'] });
    },
    onError: (error) => {
      showErrorToast(
        error instanceof Error ? error.message : t('hooks.componentDeleteFailed')
      );
    },
  });
}
