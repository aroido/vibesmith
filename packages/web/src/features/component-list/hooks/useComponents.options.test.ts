import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ComponentListFilters } from '../types';

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: useQueryMock,
}));

import { useComponents } from './useComponents';

describe('useComponents query options', () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    useQueryMock.mockReturnValue({
      data: [],
      isLoading: false,
      isSuccess: true,
      isError: false,
      isFetching: false,
    });
  });

  it('enables periodic refresh and focus refetch', () => {
    const filters: ComponentListFilters = { type: 'skill' };
    useComponents(filters);

    expect(useQueryMock).toHaveBeenCalledTimes(1);
    expect(useQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['components', filters],
        staleTime: 30 * 1000,
        refetchInterval: 30 * 1000,
        refetchOnWindowFocus: 'always',
        refetchOnReconnect: true,
      }),
    );
  });
});
