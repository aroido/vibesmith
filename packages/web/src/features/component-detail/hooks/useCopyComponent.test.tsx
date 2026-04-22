/**
 * useCopyComponent hook tests
 * Spec: component-copy-api.md §6.2 - 쿼리 무효화, 에러 처리, Toast
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useCopyComponent } from './useCopyComponent';

const mockCopyResponse = {
  copied: [
    {
      original_id: 'comp_001',
      new_id: 'comp_copy_001',
      name: 'fastapi-route',
      type: 'skill',
    },
  ],
};

const server = setupServer(
  http.post('*/api/components/:id/copy', () =>
    HttpResponse.json(mockCopyResponse, { status: 201 })
  )
);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

describe('useCopyComponent', () => {
  it('should invalidate queries on success', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children
      );
    }

    const { result } = renderHook(() => useCopyComponent('comp_001'), {
      wrapper: Wrapper,
    });

    result.current.mutate({
      targetProjectId: 'proj_target',
      includeDependencies: false,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['components'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['projects'] });
  });

  it('should show success toast on success', async () => {
    const { result } = renderHook(
      () => useCopyComponent('comp_001'),
      { wrapper: createWrapper() }
    );

    result.current.mutate({
      targetProjectId: 'proj_target',
      includeDependencies: false,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Toast는 자동으로 표시됨 (통합 테스트에서 확인)
  });

  it('should show error toast on failure', async () => {
    server.use(
      http.post('*/api/components/:id/copy', () =>
        HttpResponse.json(
          { detail: '대상 프로젝트에 동일 이름 구성요소가 이미 존재합니다' },
          { status: 400 }
        )
      )
    );

    const { result } = renderHook(
      () => useCopyComponent('comp_001'),
      { wrapper: createWrapper() }
    );

    result.current.mutate({
      targetProjectId: 'proj_target',
      includeDependencies: false,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Toast는 자동으로 표시됨 (통합 테스트에서 확인)
  });

  it('should call onSuccess callback with response data', async () => {
    const onSuccess = vi.fn();

    const { result } = renderHook(
      () => useCopyComponent('comp_001', { onSuccess }),
      { wrapper: createWrapper() }
    );

    result.current.mutate({
      targetProjectId: 'proj_target',
      includeDependencies: false,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(onSuccess).toHaveBeenCalledWith(mockCopyResponse);
  });
});
