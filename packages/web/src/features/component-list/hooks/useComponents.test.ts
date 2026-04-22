/**
 * useComponents hook unit tests
 * Hook behavior, filter reflection
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useComponents } from './useComponents';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
};

const mockComponents = [
  {
    id: 'comp_001',
    type: 'skill',
    name: 'fastapi-route',
    description: 'FastAPI 스캐폴딩',
    enabled: true,
    tags: ['python'],
    project_id: 'proj_001',
    project_name: 'vibesmith',
    path: '/path/to/skill',
    created_at: '2026-02-09T10:00:00Z',
    updated_at: '2026-02-09T15:00:00Z',
  },
];

const server = setupServer(
  http.get('*/api/components', ({ request }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    if (type) {
      return HttpResponse.json(
        mockComponents.filter((c) => c.type === type)
      );
    }
    return HttpResponse.json(mockComponents);
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('useComponents', () => {
  it('should fetch components with empty filters', async () => {
    const { result } = renderHook(() => useComponents({}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockComponents);
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].name).toBe('fastapi-route');
  });

  it('should fetch filtered by type when type filter provided', async () => {
    const { result } = renderHook(
      () => useComponents({ type: 'skill' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockComponents);
    // Verify the request was made with type=skill (server filters by type)
    expect(result.current.data?.[0].type).toBe('skill');
  });

  it('should return loading state initially', () => {
    const { result } = renderHook(() => useComponents({}), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('should use different queryKey when filters change', async () => {
    const { result, rerender } = renderHook(
      ({ filters }) => useComponents(filters),
      {
        wrapper: createWrapper(),
        initialProps: { filters: {} as Record<string, unknown> },
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const firstData = result.current.data;

    rerender({ filters: { type: 'agent' } });
    await waitFor(() => expect(result.current.isFetching).toBe(false));

    // With type=agent, server returns empty (no agent in mock)
    expect(result.current.data).toEqual([]);
    expect(result.current.data).not.toEqual(firstData);
  });

  it('should handle API error', async () => {
    server.use(
      http.get('*/api/components', () => HttpResponse.json({ error: 'Server error' }, { status: 500 }))
    );

    const { result } = renderHook(() => useComponents({}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
    expect(result.current.data).toBeUndefined();
  });
});
