/**
 * useContextStats - Context Optimizer data
 * GET /api/stats/context — 플랫폼별 계층 통계
 * Issue #501, #691, #749
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { statsApi } from '@/common/api/resources/stats';

const CONTEXT_STATS_QUERY_KEY = ['dashboard', 'context-stats'] as const;

export function useContextStats(projectId?: string) {
  return useQuery({
    queryKey: [...CONTEXT_STATS_QUERY_KEY, projectId ?? 'global'],
    queryFn: () => statsApi.getContextStats(projectId),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
}

/**
 * Bulk disable mutation
 * Issue #572: Workaround - 단일 토글 API를 반복 호출
 * TODO: 백엔드 PATCH /api/components/bulk-toggle 구현 후 교체
 */
export function useBulkDisableComponents() {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (componentIds: string[]) => {
      // Workaround: 단일 토글 API를 반복 호출
      const results = await Promise.allSettled(
        componentIds.map((id) =>
          fetch(`/api/components/${id}/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: false }),
          }).then((res) => {
            if (!res.ok) throw new Error(`Failed to toggle ${id}`);
            return res.json();
          })
        )
      );

      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      const successIds = componentIds.filter((_, i) => results[i].status === 'fulfilled');

      if (successCount === 0) {
        throw new Error(t('hooks.bulkDisableFailed'));
      }

      return { updated_count: successCount, updated_ids: successIds };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONTEXT_STATS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: Error) => {
      toast.error(error.message ?? t('hooks.bulkDisableFailed'));
    },
  });
}
