/**
 * useResolveConflict - Conflict resolution mutation (Spec §7)
 * POST /api/conflicts/:id/resolve (Mock until Backend #164)
 * Issue #159
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { resolveConflict as resolveConflictApi } from '../services/api';
import type { ConflictResolveRequest } from '../types';
import { CONFLICTS_QUERY_KEY } from './useConflicts';

export function useResolveConflict() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      conflictId,
      request,
    }: {
      conflictId: string;
      request: ConflictResolveRequest;
    }) => resolveConflictApi(conflictId, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONFLICTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['components'] });
    },
  });
}
