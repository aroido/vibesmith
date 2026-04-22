/**
 * useConflicts - Conflict list (Spec §13.5)
 * GET /api/conflicts (Mock until Backend #164)
 * Issue #159
 */

import { useQuery } from '@tanstack/react-query';
import { getConflicts } from '../services/api';
import type { Conflict } from '../types';

const CONFLICTS_QUERY_KEY = ['conflicts'] as const;

export function useConflicts(projectId?: string) {
  return useQuery<Conflict[]>({
    queryKey: projectId ? [...CONFLICTS_QUERY_KEY, projectId] : CONFLICTS_QUERY_KEY,
    queryFn: () => getConflicts(projectId),
    staleTime: 60 * 1000,
  });
}

export { CONFLICTS_QUERY_KEY };
