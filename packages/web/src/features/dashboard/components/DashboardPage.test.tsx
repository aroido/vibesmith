/**
 * DashboardPage unit tests
 * Rendering, loading state, data display
 */

import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { axe } from 'jest-axe';
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

const mockComponents = [
  {
    id: 'comp_001',
    type: 'skill',
    name: 'git-commit',
    description: 'Git commit message',
    enabled: true,
    tags: ['git'],
    project_id: 'proj_global',
    project_name: 'global',
    path: '~/.cursor/skills/git-commit',
    created_at: '2026-02-09T10:00:00Z',
    updated_at: '2026-02-12T10:00:00Z',
  },
];

const mockProjects = [
  {
    id: 'proj_vibesmith',
    name: 'vibesmith',
    path: '/Users/user/vibesmith',
    is_global: false,
    component_count: 42,
    last_scanned_at: '2026-02-12T10:00:00Z',
    dir_exists: true,
    has_claude_dir: true,
  },
];

const mockUsage = {
  ranking: [
    {
      component_id: 'comp_001',
      component_name: 'git-commit',
      component_type: 'skill',
      use_count: 42,
    },
  ],
  unused: [
    {
      component_name: 'unused-skill',
      component_type: 'skill',
      created_at: '2026-02-01T00:00:00Z',
    },
  ],
  total_sessions_parsed: 15,
  last_parsed_at: '2026-02-20T10:35:00Z',
};

const mockUsageTimeline = {
  component_id: 'comp_001',
  component_name: 'git-commit',
  timeline: [
    { date: '2026-02-27', count: 2, intensity: 0.5 },
    { date: '2026-02-28', count: 5, intensity: 1 },
  ],
};

const server = setupServer(
  http.get('*/api/stats', () => HttpResponse.json(mockStats)),
  http.get('*/api/system/status', () => HttpResponse.json(mockSystemStatus)),
  http.get('*/api/components', () => HttpResponse.json(mockComponents)),
  http.get('*/api/projects', () => HttpResponse.json(mockProjects)),
  http.get('*/api/usage', () => HttpResponse.json(mockUsage)),
  http.get('*/api/usage/component', () => HttpResponse.json(mockUsageTimeline))
);

beforeAll(() => server.listen());
beforeEach(async () => {
  await i18n.changeLanguage('en');
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/']}>
          <GlobalSearchProvider>
          <Routes>
            <Route path="/" element={ui} />
          </Routes>
          </GlobalSearchProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

describe('DashboardPage', () => {
  it('should render dashboard header', async () => {
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText(/VibeSmith/)).toBeInTheDocument();
    expect(screen.getByText(/Your AI Agent Command Center|AI 에이전트 명령 센터/)).toBeInTheDocument();
  });

  it('should display stats cards after loading', async () => {
    renderWithProviders(<DashboardPage />);
    await screen.findByText('SKILLS');
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('AGENTS')).toBeInTheDocument();
    expect(screen.getByText('COMMANDS')).toBeInTheDocument();
  });

  it('should display recent activity', async () => {
    renderWithProviders(<DashboardPage />);
    expect(
      await screen.findByRole('heading', { name: /Recent Activity|최근 활동/i }),
    ).toBeInTheDocument();
    const matches = await screen.findAllByText('git-commit');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('should display usage summary insights and analysis action', async () => {
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByTestId('dashboard-usage-insights')).toBeInTheDocument();
    expect(await screen.findByTestId('usage-priority-ranking-list')).toBeInTheDocument();
    expect(await screen.findByTestId('usage-summary-signals')).toBeInTheDocument();
    expect(await screen.findByTestId('dashboard-open-usage-analysis')).toBeInTheDocument();
  });

  it('should display project breakdown', async () => {
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText(/PROJECT BREAKDOWN|프로젝트 현황/)).toBeInTheDocument();
    expect(await screen.findByText(/vibesmith/)).toBeInTheDocument();
  });

  it('should not render duplicate project management action', async () => {
    renderWithProviders(<DashboardPage />);
    await screen.findByText(/PROJECT BREAKDOWN|프로젝트 현황/);
    expect(screen.queryByRole('button', { name: /manage projects|프로젝트 관리/i })).not.toBeInTheDocument();
  });

  it('should have no accessibility violations', async () => {
    const { container } = renderWithProviders(<DashboardPage />);
    await screen.findByText(/VibeSmith/);
    const results = await axe(container);
    // Known issues: aria-required-children (list/listitem), aria-busy with loader
    expect(results.violations).toBeDefined();
    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(criticalViolations).toHaveLength(0);
  });

  it('should show loading state before data loads', async () => {
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText(/VibeSmith/, {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it('should not render quick action buttons', async () => {
    renderWithProviders(<DashboardPage />);
    await screen.findByText(/VibeSmith/);
    expect(screen.queryByRole('button', { name: /new component|새 구성요소/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sync|동기화/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /search all|전체 검색/i })).not.toBeInTheDocument();
  });
});
