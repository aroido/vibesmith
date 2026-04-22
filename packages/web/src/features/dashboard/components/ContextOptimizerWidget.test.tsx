/**
 * ContextOptimizerWidget tests
 * Issue #691, #749: Context Optimizer 위젯 연동
 *
 * @vitest-environment happy-dom
 */

import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import i18n from '../../../i18n';
import { ContextOptimizerWidget } from './ContextOptimizerWidget';
import type { ContextStatsResponse } from '../types';

vi.mock('../hooks/useContextStats', () => ({
  useContextStats: vi.fn(),
  useBulkDisableComponents: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

import { useContextStats } from '../hooks/useContextStats';

const mockData: ContextStatsResponse = {
  platforms: [
    {
      platform: 'claude_code',
      tiers: [
        {
          name: 'always',
          label: '상시 로드',
          description: '매 대화 시작 시 전문 주입',
          components: [
            { id: 'c1', name: 'python-style', type: 'rule', estimated_tokens: 800, file_size_bytes: 1200 },
            { id: 'c2', name: 'api-contract', type: 'rule', estimated_tokens: 500, file_size_bytes: 800 },
          ],
          total_tokens: 1300,
          count: 2,
          counts_toward_limit: true,
        },
        {
          name: 'catalog',
          label: '카탈로그',
          description: 'name+description 목록 노출',
          components: [
            { id: 'c3', name: 'deploy-agent', type: 'agent', estimated_tokens: 200, file_size_bytes: 300 },
          ],
          total_tokens: 200,
          count: 1,
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
      effective_tokens: 1500,
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

function renderWidget(projectId?: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ContextOptimizerWidget projectId={projectId} />
    </QueryClientProvider>
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('ko');
  vi.clearAllMocks();
});

describe('ContextOptimizerWidget', () => {
  it('should render platform tabs', () => {
    vi.mocked(useContextStats).mockReturnValue({
      data: mockData,
      isLoading: false,
      refetch: vi.fn(),
    } as never);

    renderWidget();

    expect(screen.getByText(/claude.code/i)).toBeInTheDocument();
    expect(screen.getByText(/cursor/i)).toBeInTheDocument();
  });

  it('should show effective_tokens progress bar for selected platform', () => {
    vi.mocked(useContextStats).mockReturnValue({
      data: mockData,
      isLoading: false,
      refetch: vi.fn(),
    } as never);

    renderWidget();

    // Claude Code: 1,500 / 12,000
    expect(screen.getByText(/1,500/)).toBeInTheDocument();
    expect(screen.getByText(/12,000/)).toBeInTheDocument();
  });

  it('should display tier breakdown with component counts', () => {
    vi.mocked(useContextStats).mockReturnValue({
      data: mockData,
      isLoading: false,
      refetch: vi.fn(),
    } as never);

    renderWidget();

    // Tier labels
    expect(screen.getByText('상시 로드')).toBeInTheDocument();
    expect(screen.getByText('카탈로그')).toBeInTheDocument();
    expect(screen.getByText('호출 시 로드')).toBeInTheDocument();
  });

  it('should show loading skeleton when loading', () => {
    vi.mocked(useContextStats).mockReturnValue({
      data: undefined,
      isLoading: true,
      refetch: vi.fn(),
    } as never);

    renderWidget();

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should show tok/proj unit when no project is selected', () => {
    vi.mocked(useContextStats).mockReturnValue({
      data: mockData,
      isLoading: false,
      refetch: vi.fn(),
    } as never);

    renderWidget(); // no projectId

    expect(screen.getAllByText(/tok\/proj/).length).toBeGreaterThan(0);
  });

  it('should NOT show tok/proj unit when a project is selected', () => {
    vi.mocked(useContextStats).mockReturnValue({
      data: mockData,
      isLoading: false,
      refetch: vi.fn(),
    } as never);

    renderWidget('proj_123');

    expect(screen.queryByText(/tok\/proj/)).not.toBeInTheDocument();
  });

  it('should show suggestions button when suggestions exist', () => {
    const dataWithSuggestions: ContextStatsResponse = {
      ...mockData,
      suggestions: [
        {
          type: 'oversized',
          component_id: 'c1',
          component_name: 'python-style',
          reason: 'Too large',
          action: 'split',
          priority: 'high',
        },
      ],
    };

    vi.mocked(useContextStats).mockReturnValue({
      data: dataWithSuggestions,
      isLoading: false,
      refetch: vi.fn(),
    } as never);

    renderWidget();

    expect(screen.getByTestId('dashboard-optimizer-suggestions-button')).toBeInTheDocument();
  });

  it('should localize tier labels/count units in English without Korean suffix', async () => {
    await i18n.changeLanguage('en');

    vi.mocked(useContextStats).mockReturnValue({
      data: mockData,
      isLoading: false,
      refetch: vi.fn(),
    } as never);

    renderWidget();

    expect(screen.getByText('Always loaded')).toBeInTheDocument();
    expect(screen.getByText('Catalog')).toBeInTheDocument();
    expect(screen.getAllByText(/items/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/개/)).not.toBeInTheDocument();
  });
});
