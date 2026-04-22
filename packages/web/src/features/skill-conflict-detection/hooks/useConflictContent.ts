/**
 * useConflictContent - Load global & project component content for Side-by-Side
 * Issue #159
 */

import { useQuery } from '@tanstack/react-query';
import { getComponentContent } from '../services/api';
import type { Conflict } from '../types';

export function useConflictContent(conflict: Conflict | null) {
  const globalQuery = useQuery({
    queryKey: ['components', conflict?.globalComponentId, 'content'] as const,
    queryFn: () => getComponentContent(conflict!.globalComponentId),
    enabled: !!conflict,
  });

  const projectQuery = useQuery({
    queryKey: ['components', conflict?.projectComponentId, 'content'] as const,
    queryFn: () => getComponentContent(conflict!.projectComponentId),
    enabled: !!conflict,
  });

  return {
    globalContent: globalQuery.data ?? '',
    projectContent: projectQuery.data ?? '',
    isLoading: globalQuery.isLoading || projectQuery.isLoading,
    isError: globalQuery.isError || projectQuery.isError,
  };
}
