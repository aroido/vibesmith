/**
 * useProjects hook
 * GET /api/projects for create form
 */

import { useQuery } from '@tanstack/react-query';
import { getProjects } from '../services/api';

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
    staleTime: 60_000,
  });
}
