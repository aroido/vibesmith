// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProjectOverviewPanel } from './ProjectOverviewPanel';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ko' },
  }),
}));

const defaultProps = {
  projectId: 'proj_123',
  path: '/Users/dev/my-project/.claude',
  lastScannedAt: '2026-01-01T12:00:00Z',
  dirExists: true,
  breakdown: { skill: 10, agent: 5, command: 3, hook: 2, rule: 1 },
  platformBreakdown: [
    { platform: 'claude_code', count: 15 },
    { platform: 'cursor', count: 6 },
  ],
  onTabChange: vi.fn(),
};

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProjectOverviewPanel {...defaultProps} />
    </QueryClientProvider>
  );
}

describe('ProjectOverviewPanel', () => {
  it('renders platform breakdown', () => {
    renderPanel();
    expect(screen.getByText('Claude Code')).toBeInTheDocument();
    expect(screen.getByText('Cursor')).toBeInTheDocument();
  });

  it('renders donut chart', () => {
    const { container } = renderPanel();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('shows abbreviated path', () => {
    renderPanel();
    expect(screen.getByText('.claude')).toBeInTheDocument();
  });
});
