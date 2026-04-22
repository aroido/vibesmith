/**
 * useTagStats Hook
 * 태그 통계 조회 (컴포넌트 목록에서 집계)
 */

import { useQuery } from '@tanstack/react-query';
import { getAvailableTags } from '@/common/api';
import type { TagStats } from '../types';

function toTagStats(
  infos: Array<{ name: string; count: number }>
): TagStats[] {
  return infos.map(({ name, count }) => ({ tag: name, count }));
}

/**
 * 태그 통계 조회 훅
 */
export function useTagStats() {
  return useQuery<TagStats[]>({
    queryKey: ['tags'],
    queryFn: async (): Promise<TagStats[]> => {
      const infos = await getAvailableTags();
      return toTagStats(infos);
    },
    staleTime: 60_000,
  });
}
