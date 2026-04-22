/**
 * useTags Hook
 * 태그 목록 조회 (컴포넌트에서 집계)
 */

import { useQuery } from '@tanstack/react-query';
import { getAvailableTags } from '@/common/api';

/**
 * 태그 목록 조회 훅 (자동완성용)
 */
export function useTags() {
  return useQuery<string[]>({
    queryKey: ['tags'],
    queryFn: async (): Promise<string[]> => {
      const infos = await getAvailableTags();
      return infos.map((t) => t.name);
    },
    staleTime: 60_000,
  });
}
