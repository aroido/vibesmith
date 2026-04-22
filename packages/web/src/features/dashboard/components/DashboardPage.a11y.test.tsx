/**
 * DashboardPage Accessibility Tests (axe-core)
 * WCAG 2.1 AA 준수 검증
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { axe } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import i18n from '../../../i18n';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { GlobalSearchProvider } from '@/features/global-search';
import { DashboardPage } from './DashboardPage';

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
    skills: { value: 3, percentage: 7.7, direction: 'up' as const },
    agents: { value: 1, percentage: 9.1, direction: 'up' as const },
    commands: { value: 0, percentage: 0, direction: 'neutral' as const },
    hooks: { value: -1, percentage: -16.7, direction: 'down' as const },
    rules: { value: 2, percentage: 9.5, direction: 'up' as const },
  },
};

const mockSystemStatus = {
  is_live: true,
  last_scan_at: '2026-02-12T10:00:00Z',
  active_workers: { watcher: true, usage_scanner: true },
  health_score: 98,
};

const server = setupServer(
  http.get('*/api/stats', () => HttpResponse.json(mockStats)),
  http.get('*/api/system/status', () => HttpResponse.json(mockSystemStatus)),
  http.get('*/api/components/recent', () => HttpResponse.json([])),
  http.get('*/api/components', () => HttpResponse.json([])),
  http.get('*/api/projects', () => HttpResponse.json([])),
  http.get('*/api/usage', () =>
    HttpResponse.json({
      ranking: [],
      unused: [],
      total_sessions_parsed: 0,
      last_parsed_at: null,
    })
  ),
  http.post('*/api/usage/scan', () =>
    HttpResponse.json({
      sessions_parsed: 0,
      stats_saved: 0,
    })
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

beforeAll(() => server.listen());
beforeEach(async () => {
  await i18n.changeLanguage('en');
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/']}>
          <GlobalSearchProvider>
            <DashboardPage />
          </GlobalSearchProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

describe('DashboardPage Accessibility', () => {
  it('should have no axe accessibility violations', async () => {
    const { container } = renderDashboard();
    await screen.findByRole('main');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have main landmark with id for skip link', async () => {
    renderDashboard();
    const main = await screen.findByRole('main', { name: undefined });
    expect(main).toHaveAttribute('id', 'main-content');
  });
});
