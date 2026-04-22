/**
 * useCopyComponent hook
 * POST /api/components/{id}/copy mutation
 * 성공 시 Toast + 쿼리 무효화, 실패 시 에러 메시지 표시
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { copyComponent } from '../services/api';
import { showSuccessToast, showErrorToast } from '@/common/utils';
import type { CopyResponse } from '../types';
import { ApiError } from '@/common/api';

interface UseCopyComponentOptions {
  onSuccess?: (data: CopyResponse) => void;
  onError?: (error: ApiError) => void;
}

/**
 * 구성요소 복사 뮤테이션 훅
 * @param componentId - 복사할 구성요소 ID
 */
export function useCopyComponent(
  componentId: string,
  options: UseCopyComponentOptions = {}
) {
  const { t } = useTranslation('components');
  const { onSuccess, onError } = options;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      targetProjectId,
      includeDependencies,
    }: {
      targetProjectId: string;
      includeDependencies: boolean;
    }) =>
      copyComponent(componentId, targetProjectId, includeDependencies),
    onSuccess: (data) => {
      showSuccessToast(t('copy.successToast'));
      void queryClient.invalidateQueries({ queryKey: ['components'] });
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      onSuccess?.(data);
    },
    onError: (error: ApiError) => {
      const message =
        error.detail ?? error.message ?? t('copy.errorFallback');
      showErrorToast(message);
      onError?.(error);
    },
  });
}
