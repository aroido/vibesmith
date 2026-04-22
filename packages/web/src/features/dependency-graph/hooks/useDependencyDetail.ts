import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export const useDependencyDetail = (componentId: string | null) => {
  return useQuery({
    queryKey: ['dependency-detail', componentId],
    queryFn: () => api.getDependencyDetail(componentId!),
    enabled: !!componentId,
  });
};
