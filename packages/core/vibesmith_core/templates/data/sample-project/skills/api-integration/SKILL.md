# API Integration with React Query

Integrate backend APIs using React Query for optimal data fetching and caching.

## Setup

```tsx
import { useQuery, useMutation } from '@tanstack/react-query';

// GET request
export const useProjects = () => {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/api/projects'),
  });
};

// POST request
export const useCreateProject = () => {
  return useMutation({
    mutationFn: (data: ProjectInput) => api.post('/api/projects', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};
```

## Best Practices

- Use query keys consistently
- Implement error handling
- Add loading states
- Cache invalidation strategy
