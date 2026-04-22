/**
 * Component toggle mutation hook
 * POST /api/components/{id}/toggle
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toggleComponent } from '../services/api';
import { showSuccessToast, showErrorToast } from '@/common/utils';

/**
 * 구성요소 활성화/비활성화 토글 훅
 */
export function useToggleComponent(componentId: string | undefined) {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => toggleComponent(componentId!),
    onSuccess: (response) => {
      const statusKey = response.enabled
        ? 'hooks.toggleStatusEnabled'
        : 'hooks.toggleStatusDisabled';
      showSuccessToast(t('hooks.componentToggled', { status: t(statusKey) }));
      void queryClient.invalidateQueries({ queryKey: ['components', componentId] });
      void queryClient.invalidateQueries({ queryKey: ['components'] });
    },
    onError: (error) => {
      showErrorToast(
        error instanceof Error ? error.message : t('hooks.toggleFailed')
      );
    },
  });
}
