/**
 * Component detail data fetching hook
 * Uses React Query for GET /api/components/{id}
 */

import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/common/api';
import { getComponent, getComponentByName } from '../services/api';

const STALE_TIME_MS = 30 * 1000; // 30초

/**
 * 구성요소 상세 조회 훅
 * @param id - 구성요소 ID 또는 name (없으면 비활성화)
 *
 * #484: name 기반 조회 지원
 * - 기본은 ID로 직접 조회
 * - ID 조회가 404일 때만 name 조회로 fallback
 */
export function useComponentDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['components', id],
    queryFn: async () => {
      if (!id) throw new Error('ID is required');

      try {
        return await getComponent(id);
      } catch (error) {
        if (!(error instanceof ApiError) || error.statusCode !== 404) {
          throw error;
        }

        // 현재 컴포넌트 ID 규칙(comp_*)은 name fallback 대상이 아님
        if (/^comp_[\w-]+$/i.test(id)) {
          throw error;
        }

        try {
          return await getComponentByName(id);
        } catch (fallbackError) {
          // fallback에서도 찾지 못하면 원래 404를 유지해 UI 분기를 보장
          if (
            fallbackError instanceof ApiError &&
            fallbackError.statusCode === 404
          ) {
            throw error;
          }
          throw fallbackError;
        }
      }
    },
    enabled: !!id,
    staleTime: STALE_TIME_MS,
  });
}
