/**
 * useSampleProject Hook
 * 샘플 프로젝트 생성 및 관리
 * Issue #501: Mock API -> 실제 API 교체 완료
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { notify } from '@/common/utils/notify';
import { statsApi } from '@/common/api/resources/stats';

export function useSampleProject() {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: () => statsApi.createSampleProject(),
    onSuccess: (data) => {
      notify.success(t('hooks.sampleProjectSuccess', { count: data.components_count }));
      
      // 대시보드 데이터 새로고침
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (error: Error) => {
      notify.error(t('hooks.sampleProjectFailed', { message: error.message }));
    },
  });

  return {
    createSampleProject: createMutation.mutate,
    isCreating: createMutation.isPending,
    error: createMutation.error,
  };
}
