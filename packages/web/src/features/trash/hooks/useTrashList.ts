/**
 * Trash list query hook
 * GET /api/trash
 */

import { useQuery } from '@tanstack/react-query';
import { getTrashList } from '@/common/api';

const TRASH_QUERY_KEY = ['trash'] as const;

export function useTrashList() {
  return useQuery({
    queryKey: TRASH_QUERY_KEY,
    queryFn: getTrashList,
  });
}
