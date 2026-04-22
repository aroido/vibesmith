/**
 * useUpdateComponent hook
 * PUT /api/components/{id}, 캐시 무효화, 상세 페이지 이동
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { updateComponent } from '../services/api';
import { showSuccessToast, showErrorToast } from '@/common/utils';
import type { UpdateComponentDto } from '../types';

interface UseUpdateComponentOptions {
  id: string;
  onSuccess?: () => void;
}

export function useUpdateComponent({ id, onSuccess }: UseUpdateComponentOptions) {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: UpdateComponentDto) => updateComponent(id, data),
    onSuccess: () => {
      showSuccessToast(t('hooks.componentUpdated'));
      onSuccess?.();
      void queryClient.invalidateQueries({ queryKey: ['components', id] });
      void queryClient.invalidateQueries({ queryKey: ['components'] });
      void navigate(`/components/${id}`);
    },
    onError: (error) => {
      showErrorToast(
        error instanceof Error ? error.message : t('hooks.componentUpdateFailed')
      );
    },
  });
}
