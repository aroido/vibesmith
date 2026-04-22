/**
 * StatsCard unit tests
 * Rendering, trend display, progress bar
 */

import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { axe } from 'jest-axe';
import { Sparkles } from 'lucide-react';
import { StatsCard } from './StatsCard';

function renderStatsCard(overrides: Record<string, unknown> = {}) {
  const props = {
    title: 'SKILLS',
    value: 42,
    trend: { value: 3, percentage: 7.7, direction: 'up' as const },
    icon: <Sparkles className="h-5 w-5" />,
    color: 'cyan' as const,
    progress: 42,
    ...overrides,
  };
  return render(<StatsCard {...props} />);
}

describe('StatsCard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render title and value', () => {
    renderStatsCard();
    expect(screen.getByText('SKILLS')).toBeInTheDocument();
  });

  it('should display value', () => {
    renderStatsCard({ value: 42 });
    act(() => {
      vi.advanceTimersByTime(1100); // count-up 1초 경과
    });
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('should display trend when provided', () => {
    renderStatsCard({
      trend: { value: 3, percentage: 7.7, direction: 'up' },
    });
    vi.advanceTimersByTime(1100);
    expect(screen.getByText(/\+3/)).toBeInTheDocument();
    expect(screen.getByText(/7\.7%|%7\.7/)).toBeInTheDocument();
  });

  it('should not display trend section when trend is undefined', () => {
    renderStatsCard({ trend: undefined });
    expect(screen.queryByText(/\+3/)).not.toBeInTheDocument();
  });

  it('should render with progress bar when progress provided', () => {
    const { container } = renderStatsCard({ progress: 50 });
    const progressBar = container.querySelector('[role="progressbar"]');
    expect(progressBar).toBeInTheDocument();
  });

  it(
    'should have no accessibility violations',
    async () => {
      const { container } = renderStatsCard();
      act(() => {
        vi.advanceTimersByTime(1100); // count-up 완료
      });
      vi.useRealTimers(); // axe uses async timers
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    },
    10000
  );
});
