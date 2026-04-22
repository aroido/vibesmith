import type { ReactElement } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { UsageInsightsWidget } from './UsageInsightsWidget';

interface MockUsageResponse {
  ranking: Array<{
    component_id: string | null;
    component_name: string;
    component_type: 'skill';
    use_count: number;
  }>;
  unused: Array<{
    component_name: string;
    component_type: 'skill';
    created_at: string;
  }>;
  total_sessions_parsed: number;
  last_parsed_at: string;
}

function createMockUsageResponse(count: number): MockUsageResponse {
  return {
    ranking: Array.from({ length: count }, (_, index) => ({
      component_id: null,
      component_name: `rank-${index + 1}`,
      component_type: 'skill',
      use_count: count - index,
    })),
    unused: Array.from({ length: count }, (_, index) => ({
      component_name: `unused-${index + 1}`,
      component_type: 'skill',
      created_at: '2026-02-01T00:00:00Z',
    })),
    total_sessions_parsed: 12,
    last_parsed_at: '2026-02-23T09:00:00Z',
  };
}

let mockUsageResponse = createMockUsageResponse(7);

const server = setupServer(
  http.get('*/api/usage', () => HttpResponse.json(mockUsageResponse)),
  http.post('*/api/usage/scan', () =>
    HttpResponse.json({ sessions_parsed: 0, stats_saved: 0 })
  ),
  http.post('*/api/usage/reset', () =>
    HttpResponse.json({
      deleted_sessions: 0,
      deleted_parse_states: 0,
      preserved_sessions: 0,
      preserved_parse_states: 0,
    })
  )
);

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

beforeAll(() => server.listen());
beforeEach(() => {
  mockUsageResponse = createMockUsageResponse(7);
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('UsageInsightsWidget', () => {
  it('shows top3 cards without duplicated detail section in summary mode', async () => {
    renderWithProviders(<UsageInsightsWidget />);

    const priorityRankingList = await screen.findByTestId('usage-priority-ranking-list');

    expect(screen.getByTestId('usage-kpi-top3')).toBeInTheDocument();
    expect(screen.getByTestId('usage-kpi-unused-ratio')).toBeInTheDocument();
    expect(screen.getByTestId('usage-kpi-cleanup')).toBeInTheDocument();
    expect(within(priorityRankingList).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByTestId('usage-summary-signals')).toBeInTheDocument();
    expect(within(priorityRankingList).getAllByRole('link')[0]).toHaveAttribute(
      'href',
      expect.stringContaining('/components?q=rank-1'),
    );
    expect(within(priorityRankingList).queryByText('rank-6')).not.toBeInTheDocument();
    expect(screen.queryByTestId('usage-details-toggle')).not.toBeInTheDocument();
    expect(screen.queryByTestId('usage-priority-unused-list')).not.toBeInTheDocument();
    expect(screen.queryByTestId('usage-priority-long-tail-list')).not.toBeInTheDocument();
    expect(screen.queryByTestId('usage-priority-ranking-more-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('usage-priority-unused-more-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('usage-priority-long-tail-more-button')).not.toBeInTheDocument();
  });

  it('expands each top card with load-more in full mode', async () => {
    const user = userEvent.setup();
    mockUsageResponse = createMockUsageResponse(12);
    renderWithProviders(<UsageInsightsWidget displayMode="full" />);

    const rankingList = await screen.findByTestId('usage-priority-ranking-list');
    const unusedList = await screen.findByTestId('usage-priority-unused-list');
    const longTailList = await screen.findByTestId('usage-priority-long-tail-list');

    expect(within(rankingList).getAllByRole('listitem')).toHaveLength(3);
    expect(within(unusedList).getAllByRole('listitem')).toHaveLength(3);
    expect(within(longTailList).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByTestId('usage-details-toggle')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('usage-priority-ranking-more-button'));
    expect(within(rankingList).getAllByRole('listitem')).toHaveLength(6);
    expect(within(rankingList).getByText('rank-6')).toBeInTheDocument();

    await user.click(screen.getByTestId('usage-priority-unused-more-button'));
    expect(within(unusedList).getAllByRole('listitem')).toHaveLength(6);
    expect(within(unusedList).getByText('unused-6')).toBeInTheDocument();

    await user.click(screen.getByTestId('usage-priority-long-tail-more-button'));
    expect(within(longTailList).getAllByRole('listitem')).toHaveLength(6);
    expect(within(longTailList).getByText('rank-7')).toBeInTheDocument();
  });
});
