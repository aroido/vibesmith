import { useQuery } from '@tanstack/react-query';
import type { UsageTimelineDays } from '../types';
import { getComponentUsageTimeline } from '../services/api';

const STALE_TIME_MS = 30 * 1000;

export function useComponentUsageTimeline(componentId: string | undefined, days: UsageTimelineDays) {
  const limit = days === 1 ? 84 : 12;

  return useQuery({
    queryKey: ['components', 'usage', componentId, days, limit],
    queryFn: () => {
      if (!componentId) throw new Error('componentId is required');
      return getComponentUsageTimeline(componentId, { days, limit });
    },
    enabled: !!componentId,
    staleTime: STALE_TIME_MS,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 1,
    retryDelay: 1000,
  });
}
