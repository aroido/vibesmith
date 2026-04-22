/**
 * useComponentDetail hook unit tests
 * Loading, success, 404, network error, id 없을 때 비활성화
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useComponentDetail } from './useComponentDetail';

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

const mockComponentDetail = {
  id: 'comp_001',
  type: 'skill',
  name: 'fastapi-route',
  description: 'FastAPI 라우트 스캐폴딩',
  enabled: true,
  tags: ['python', 'fastapi'],
  project_id: 'proj_abc123',
  project_name: 'vibesmith',
  path: '/path/to/skill',
  content: '본문 내용',
  frontmatter: {},
  dependencies: { depends_on: [], depended_by: [] },
  created_at: '2026-02-09T10:00:00Z',
  updated_at: '2026-02-09T15:00:00Z',
};

const server = setupServer(
  http.get('*/api/components/:id', ({ params }) => {
    const id = params.id as string;
    if (id === 'comp_001') {
      return HttpResponse.json(mockComponentDetail);
    }
    return HttpResponse.json({ detail: 'Not found' }, { status: 404 });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('useComponentDetail', () => {
  it('should return loading state initially', () => {
    const { result } = renderHook(() => useComponentDetail('comp_001'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  it('should return data on success', async () => {
    const { result } = renderHook(() => useComponentDetail('comp_001'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockComponentDetail);
    expect(result.current.data?.name).toBe('fastapi-route');
    expect(result.current.error).toBeNull();
  });

  it('should return error on 404', async () => {
    const { result } = renderHook(() => useComponentDetail('comp_notfound'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
    expect(result.current.data).toBeUndefined();
  });

  it('should return error on network/500', async () => {
    server.use(
      http.get('*/api/components/:id', () =>
        HttpResponse.json({ detail: 'Server error' }, { status: 500 })
      )
    );

    const { result } = renderHook(() => useComponentDetail('comp_001'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
    expect(result.current.data).toBeUndefined();
  });

  it('should be disabled when id is undefined', () => {
    const { result } = renderHook(() => useComponentDetail(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('should be disabled when id is empty string', () => {
    const { result } = renderHook(() => useComponentDetail(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});
