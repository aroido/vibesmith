import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  captureAnalyticsException,
  trackPageView,
  trackAnalyticsEvent,
} from './desktopAnalyticsBridge';

describe('desktopAnalyticsBridge', () => {
  beforeEach(() => {
    delete window.__vibesmithAnalytics;
  });

  it('forwards events to the desktop bridge even before analytics is enabled', () => {
    const track = vi.fn();
    window.__vibesmithAnalytics = {
      track,
      isEnabled: () => false,
    };

    trackAnalyticsEvent('$pageview', {
      route: '/',
    });

    expect(track).toHaveBeenCalledWith('$pageview', {
      route: '/',
    });
  });

  it('forwards exceptions to the desktop bridge even before analytics is enabled', () => {
    const captureException = vi.fn();
    window.__vibesmithAnalytics = {
      track: vi.fn(),
      isEnabled: () => false,
      captureException,
    };

    captureAnalyticsException(new Error('startup failure'), {
      handled_by: 'test',
    });

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(expect.any(Error), {
      handled_by: 'test',
    });
  });

  it('normalizes manual $pageview routes before forwarding', () => {
    const track = vi.fn();
    window.__vibesmithAnalytics = {
      track,
      isEnabled: () => true,
    };

    trackPageView('  /settings?tab=monitoring#privacy  ', 'hash_change');

    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('$pageview', {
      navigation_type: 'hash_change',
      route: '/settings?tab=monitoring#privacy',
    });
  });

  it('drops blank manual $pageview routes before forwarding', () => {
    const track = vi.fn();
    window.__vibesmithAnalytics = {
      track,
      isEnabled: () => true,
    };

    trackPageView('   ', 'hash_change');

    expect(track).not.toHaveBeenCalled();
  });
});
