/**
 * useProjectDetail Hook
 * v1.10.0 - 프로젝트 상세 정보 조회 훅
 */

import { useQuery } from '@tanstack/react-query';
import { fetchProjectDetail } from '../services/api';
import type { ProjectDetail } from '../types';

/**
 * 프로젝트 상세 정보 조회 훅
 * 
 * @param projectId - 프로젝트 ID
 * @returns React Query 결과
 */
export function useProjectDetail(projectId: string) {
  return useQuery<ProjectDetail, Error>({
    queryKey: ['project', projectId],
    queryFn: () => fetchProjectDetail(projectId),
    staleTime: 60_000, // 1분
    gcTime: 300_000, // 5분 (구 cacheTime)
    retry: 1,
  });
}
