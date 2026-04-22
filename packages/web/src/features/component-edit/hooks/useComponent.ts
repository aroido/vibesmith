/**
 * useComponent hook
 * GET /api/components/{id} - component-detail과 동일 queryKey로 캐시 공유
 */

import { useQuery } from '@tanstack/react-query';
import { getComponent } from '../services/api';

const STALE_TIME_MS = 60 * 1000; // 1분

/**
 * 구성요소 상세 조회 훅
 * @param id - 구성요소 ID (없으면 비활성화)
 */
export function useComponent(id: string | undefined) {
  return useQuery({
    queryKey: ['components', id],
    queryFn: () => getComponent(id!),
    enabled: !!id,
    staleTime: STALE_TIME_MS,
  });
}
