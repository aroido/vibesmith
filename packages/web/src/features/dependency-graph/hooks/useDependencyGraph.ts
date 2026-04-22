import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { GraphFilters } from '../types';

const STALE_TIME_MS = 30 * 1000;
const REFETCH_INTERVAL_MS = 30 * 1000;

export const useDependencyGraph = (filters: GraphFilters) => {
  return useQuery({
    queryKey: ['dependencies', filters],
    queryFn: () => api.getDependencies(filters),
    staleTime: STALE_TIME_MS,
    refetchInterval: REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: true,
  });
};
