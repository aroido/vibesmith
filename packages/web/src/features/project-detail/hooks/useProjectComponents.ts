/**
 * useProjectComponents Hook
 * v1.10.0 - 프로젝트별 구성요소 목록 조회 훅
 */

import { useQuery } from '@tanstack/react-query';
import { fetchProjectComponents } from '../services/api';
import type { Component } from '../../../common/types';
import type { ProjectComponentFilters } from '../types';

/**
 * 프로젝트별 구성요소 목록 조회 훅
 * 
 * @param projectId - 프로젝트 ID
 * @param filters - 필터 옵션
 * @returns React Query 결과
 */
export function useProjectComponents(
  projectId: string,
  filters?: ProjectComponentFilters
) {
  return useQuery<Component[], Error>({
    queryKey: ['project-components', projectId, filters],
    queryFn: () => fetchProjectComponents(projectId, filters),
    staleTime: 30_000, // 30초
    gcTime: 300_000, // 5분 (구 cacheTime)
    retry: 1,
  });
}
