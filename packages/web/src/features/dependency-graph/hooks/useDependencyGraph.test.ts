import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { GraphFilters } from '../types';

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: useQueryMock,
}));

vi.mock('../services/api', () => ({
  api: {
    getDependencies: vi.fn(),
  },
}));

import { useDependencyGraph } from './useDependencyGraph';

describe('useDependencyGraph query options', () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    useQueryMock.mockReturnValue({
      data: null,
      isLoading: false,
      isSuccess: true,
      isError: false,
      isFetching: false,
    });
  });

  it('uses 30s polling with focus refresh', () => {
    const filters: GraphFilters = {
      project_id: 'proj_001',
      types: ['skill', 'agent', 'command', 'hook', 'rule'],
      includeGlobal: false,
    };

    useDependencyGraph(filters);

    expect(useQueryMock).toHaveBeenCalledTimes(1);
    expect(useQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['dependencies', filters],
        staleTime: 30 * 1000,
        refetchInterval: 30 * 1000,
        refetchOnWindowFocus: 'always',
        refetchOnReconnect: true,
      }),
    );
  });
});
