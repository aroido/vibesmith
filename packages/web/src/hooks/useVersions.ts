/**
 * Version History hooks
 * useComponentVersions, useRollbackComponent for component version history UI
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getComponentVersions, rollbackComponent } from '@/common/api';

/**
 * 구성요소 버전 목록 조회
 * GET /api/components/{id}/versions
 */
export function useComponentVersions(componentId: string | undefined) {
  return useQuery({
    queryKey: ['components', componentId, 'versions'],
    queryFn: () => getComponentVersions(componentId!),
    enabled: !!componentId,
  });
}

/**
 * 구성요소 롤백 뮤테이션
 * POST /api/components/{id}/rollback
 * 성공 시 component 상세 및 versions 쿼리 무효화
 */
export function useRollbackComponent(componentId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ version }: { version: number }) =>
      rollbackComponent(componentId!, version),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['components', componentId] });
      void queryClient.invalidateQueries({
        queryKey: ['components', componentId, 'versions'],
      });
      void queryClient.invalidateQueries({ queryKey: ['components'] });
    },
  });
}
