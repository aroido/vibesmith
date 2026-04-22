/**
 * useDashboardStats hook unit tests
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useDashboardStats } from './useDashboardData';

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

const mockStats = {
  total_skills: 42,
  total_agents: 12,
  total_commands: 18,
  total_hooks: 5,
  total_rules: 23,
  active_count: 89,
  inactive_count: 11,
  total_count: 100,
  trends: {
    skills: { value: 3, percentage: 7.7, direction: 'up' },
    agents: { value: 1, percentage: 9.1, direction: 'up' },
    commands: { value: 0, percentage: 0, direction: 'neutral' },
    hooks: { value: -1, percentage: -16.7, direction: 'down' },
    rules: { value: 2, percentage: 9.5, direction: 'up' },
  },
};

const server = setupServer(
  http.get('*/api/stats', () => HttpResponse.json(mockStats))
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('useDashboardStats', () => {
  it('should fetch and transform stats', async () => {
    const { result } = renderHook(() => useDashboardStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.totalSkills).toBe(42);
    expect(result.current.data?.totalAgents).toBe(12);
    expect(result.current.data?.activeCount).toBe(89);
    expect(result.current.data?.trends.skills.direction).toBe('up');
    expect(result.current.data?.trends.skills.value).toBe(3);
  });

  it('should return loading state initially', () => {
    const { result } = renderHook(() => useDashboardStats(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('should handle API error', async () => {
    server.use(
      http.get('*/api/stats', () =>
        HttpResponse.json({ detail: 'Server error' }, { status: 500 })
      )
    );

    const { result } = renderHook(() => useDashboardStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
    expect(result.current.data).toBeUndefined();
  });
});
