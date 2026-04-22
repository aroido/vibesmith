/**
 * Component inline-edit mutation hook
 * PUT /api/components/{id} — name, description, tags, content
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { showSuccessToast, showErrorToast } from '@/common/utils';
import { updateComponent } from '../services/api';
import type { ComponentDetail } from '../types';

/** 인라인 편집 업데이트 페이로드 */
export interface ComponentUpdatePayload {
  name?: string;
  description?: string;
  tags?: string[];
  content?: string;
}

/**
 * 구성요소 인라인 편집 뮤테이션 훅
 * 성공 시 상세/목록 쿼리를 무효화하여 UI를 갱신한다.
 */
export function useComponentUpdate(id: string | undefined) {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: (payload: ComponentUpdatePayload) => {
      if (!id) throw new Error('Component ID is required');
      return updateComponent(id, payload);
    },
    onSuccess: (data) => {
      queryClient.setQueryData<ComponentDetail>(['components', id], (old) =>
        old ? { ...old, ...data } : data
      );
      void queryClient.invalidateQueries({ queryKey: ['components', id] });
      void queryClient.invalidateQueries({ queryKey: ['components'] });
      showSuccessToast(t('hooks.updateSuccess', '수정되었습니다'));
    },
    onError: (error) => {
      showErrorToast(
        error instanceof Error
          ? error.message
          : t('hooks.updateFailed', '수정에 실패했습니다')
      );
    },
  });
}
