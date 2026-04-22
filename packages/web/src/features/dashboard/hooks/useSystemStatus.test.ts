/**
 * useSystemStatus hook unit tests
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useSystemStatus } from './useDashboardData';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, {
      client: queryClient,
      children,
    });
  };
};

const mockSystemStatus = {
  is_live: true,
  last_scan_at: '2026-02-12T10:00:00Z',
  active_workers: { watcher: true, usage_scanner: true },
  health_score: 98,
};

const server = setupServer(
  http.get('*/api/system/status', () =>
    HttpResponse.json(mockSystemStatus)
  )
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('useSystemStatus', () => {
  it('should fetch and transform system status', async () => {
    const { result } = renderHook(() => useSystemStatus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.isLive).toBe(true);
    expect(result.current.data?.healthScore).toBe(98);
    expect(result.current.data?.lastScanAt).toBeInstanceOf(Date);
    expect(result.current.data?.activeWorkers.watcher).toBe(true);
    expect(result.current.data?.activeWorkers.usageScanner).toBe(true);
  });

  it('should return loading state initially', () => {
    const { result } = renderHook(() => useSystemStatus(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('should handle API error', async () => {
    server.use(
      http.get('*/api/system/status', () =>
        HttpResponse.json({ detail: 'Server error' }, { status: 500 })
      )
    );

    const { result } = renderHook(() => useSystemStatus(), {
      wrapper: createWrapper(),
    });

    await waitFor(
      () => expect(result.current.isError).toBe(true),
      { timeout: 3000 }
    );

    expect(result.current.error).toBeDefined();
    expect(result.current.data).toBeUndefined();
  });
});
