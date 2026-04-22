/**
 * useContextStats hook unit tests
 * Issue #691, #749: Context Optimizer 위젯 연동
 *
 * @vitest-environment happy-dom
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ContextStatsResponse } from '../types';
import { useContextStats } from './useContextStats';

vi.mock('@/common/api/resources/stats', () => ({
  statsApi: {
    getContextStats: vi.fn(),
    createSampleProject: vi.fn(),
  },
}));

import { statsApi } from '@/common/api/resources/stats';

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

const mockResponse: ContextStatsResponse = {
  platforms: [
    {
      platform: 'claude_code',
      tiers: [
        {
          name: 'always',
          label: '상시 로드',
          description: '매 대화 시작 시 전문 주입',
          components: [
            {
              id: 'comp_1',
              name: 'python-style',
              type: 'rule',
              estimated_tokens: 800,
              file_size_bytes: 1200,
            },
          ],
          total_tokens: 800,
          count: 1,
          counts_toward_limit: true,
        },
        {
          name: 'catalog',
          label: '카탈로그',
          description: 'name+description 목록 노출',
          components: [],
          total_tokens: 0,
          count: 0,
          counts_toward_limit: true,
        },
        {
          name: 'on_demand',
          label: '호출 시 로드',
          description: '스킬/에이전트 호출 시 로드',
          components: [],
          total_tokens: 0,
          count: 0,
          counts_toward_limit: false,
        },
      ],
      recommended_max_tokens: 12000,
      effective_tokens: 800,
      status: 'ok',
    },
    {
      platform: 'cursor',
      tiers: [
        {
          name: 'always',
          label: '상시 로드',
          description: 'alwaysApply 규칙',
          components: [],
          total_tokens: 0,
          count: 0,
          counts_toward_limit: true,
        },
        {
          name: 'conditional',
          label: '조건부 로드',
          description: 'glob 패턴 매칭 시 로드',
          components: [],
          total_tokens: 0,
          count: 0,
          counts_toward_limit: false,
        },
        {
          name: 'manual',
          label: '수동 호출',
          description: '@멘션으로 수동 호출',
          components: [],
          total_tokens: 0,
          count: 0,
          counts_toward_limit: false,
        },
      ],
      recommended_max_tokens: 8000,
      effective_tokens: 0,
      status: 'ok',
    },
  ],
  suggestions: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useContextStats', () => {
  it('should fetch context stats with platforms', async () => {
    vi.mocked(statsApi.getContextStats).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useContextStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data;
    expect(data).toBeDefined();
    expect(data!.platforms).toHaveLength(2);
    expect(data!.platforms[0].platform).toBe('claude_code');
    expect(data!.platforms[1].platform).toBe('cursor');
  });

  it('should return tier data for each platform', async () => {
    vi.mocked(statsApi.getContextStats).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useContextStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const claudeCode = result.current.data!.platforms[0];
    expect(claudeCode.tiers).toHaveLength(3);
    expect(claudeCode.tiers[0].name).toBe('always');
    expect(claudeCode.tiers[0].counts_toward_limit).toBe(true);
    expect(claudeCode.tiers[2].name).toBe('on_demand');
    expect(claudeCode.tiers[2].counts_toward_limit).toBe(false);
  });

  it('should return effective_tokens and status per platform', async () => {
    vi.mocked(statsApi.getContextStats).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useContextStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const claudeCode = result.current.data!.platforms[0];
    expect(claudeCode.effective_tokens).toBe(800);
    expect(claudeCode.recommended_max_tokens).toBe(12000);
    expect(claudeCode.status).toBe('ok');
  });

  it('should pass project_id as query parameter', async () => {
    vi.mocked(statsApi.getContextStats).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useContextStats('proj_123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(statsApi.getContextStats).toHaveBeenCalledWith('proj_123');
  });

  it('should handle API error', async () => {
    vi.mocked(statsApi.getContextStats).mockRejectedValue(
      new Error('Server error')
    );

    const { result } = renderHook(() => useContextStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
