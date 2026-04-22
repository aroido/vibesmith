/**
 * Components data fetching hook
 * Uses React Query for caching and error handling
 */

import { useQuery } from '@tanstack/react-query';
import { getComponents } from '../services/api';
import type { ComponentListFilters } from '../types';

const STALE_TIME_MS = 30 * 1000; // 30초
const REFETCH_INTERVAL_MS = 30 * 1000; // 30초

/**
 * 구성요소 목록 조회 훅
 * @param filters - 필터 조건 (type, project_id, tag, q, enabled)
 */
export function useComponents(filters: ComponentListFilters = {}) {
  return useQuery({
    queryKey: ['components', filters],
    queryFn: () => getComponents(filters),
    staleTime: STALE_TIME_MS,
    refetchInterval: REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: true,
  });
}
