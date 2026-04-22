import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RouteAnalyticsTracker } from './RouteAnalyticsTracker';
import { trackPageView } from '@/common/analytics/desktopAnalyticsBridge';

vi.mock('@/common/analytics/desktopAnalyticsBridge', () => ({
  trackPageView: vi.fn(),
}));

function NavigationHarness() {
  const navigate = useNavigate();

  return (
    <>
      <RouteAnalyticsTracker />
      <button
        type="button"
        onClick={() => {
          void navigate('/settings?tab=monitoring#privacy');
        }}
      >
        Go
      </button>
    </>
  );
}

describe('RouteAnalyticsTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('captures native $pageview on initial load and route changes', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/']}>
        <NavigationHarness />
      </MemoryRouter>
    );

    expect(trackPageView).toHaveBeenCalledTimes(1);
    expect(trackPageView).toHaveBeenNthCalledWith(1, '/', 'initial_load');

    await user.click(screen.getByRole('button', { name: 'Go' }));

    expect(trackPageView).toHaveBeenCalledTimes(2);
    expect(trackPageView).toHaveBeenNthCalledWith(
      2,
      '/settings?tab=monitoring#privacy',
      'hash_change'
    );
  });
});
