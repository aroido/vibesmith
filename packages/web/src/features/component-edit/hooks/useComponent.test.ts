/**
 * useComponent hook unit tests
 * Fetch behavior, loading, error states
 * Spec Appendix B
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useComponent } from './useComponent';

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

const mockComponent = {
  id: 'comp_001',
  type: 'skill',
  name: 'fastapi-route',
  description: 'FastAPI 라우트 스캐폴딩',
  enabled: true,
  tags: ['python', 'fastapi'],
  project_id: 'proj_001',
  project_name: 'vibesmith',
  path: '/path/to/skill',
  content: '# FastAPI Route\n\n## Usage\n...',
  frontmatter: { name: 'fastapi-route', description: 'FastAPI 라우트 스캐폴딩' },
  dependencies: { depends_on: [], depended_by: [] },
  created_at: '2026-02-09T10:00:00Z',
  updated_at: '2026-02-09T15:00:00Z',
};

const server = setupServer(
  http.get('*/api/components/:id', ({ params }) => {
    return HttpResponse.json({
      ...mockComponent,
      id: params.id,
    });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('useComponent', () => {
  it('should fetch component when componentId is provided', async () => {
    const { result } = renderHook(() => useComponent('comp_001'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.id).toBe('comp_001');
    expect(result.current.data?.name).toBe('fastapi-route');
    expect(result.current.data?.content).toContain('# FastAPI Route');
  });

  it('should return loading state initially', () => {
    const { result } = renderHook(() => useComponent('comp_001'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('should not fetch when componentId is undefined', async () => {
    const { result } = renderHook(() => useComponent(undefined), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isFetching).toBe(false));

    expect(result.current.data).toBeUndefined();
    expect(result.current.status).toBe('pending');
  });

  it('should handle API error', async () => {
    server.use(
      http.get('*/api/components/:id', () =>
        HttpResponse.json({ detail: 'Not found' }, { status: 404 })
      )
    );

    const { result } = renderHook(() => useComponent('comp_999'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
    expect(result.current.data).toBeUndefined();
  });
});
