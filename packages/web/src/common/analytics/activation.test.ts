import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('trackFirstValueOnce', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    delete window.__vibesmithAnalytics;
  });

  it('tracks first value exactly once per installation', async () => {
    const track = vi.fn();
    window.__vibesmithAnalytics = {
      track,
      isEnabled: () => true,
    };

    const { trackFirstValueOnce } = await import('./activation');

    expect(
      trackFirstValueOnce('component_create', {
        component_type: 'skill',
      })
    ).toBe(true);
    expect(
      trackFirstValueOnce('global_search_result_select', {
        result_source: 'component',
      })
    ).toBe(false);

    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith(
      'first_value_reached',
      expect.objectContaining({
        value_source: 'component_create',
        component_type: 'skill',
      })
    );
    expect(
      localStorage.getItem('vibesmith.analytics.first-value-reached.v1')
    ).toBe('true');
  });

  it('does not mark first value when analytics is disabled', async () => {
    const track = vi.fn();
    window.__vibesmithAnalytics = {
      track,
      isEnabled: () => false,
    };

    const { trackFirstValueOnce } = await import('./activation');

    expect(trackFirstValueOnce('project_sync_completed')).toBe(false);
    expect(track).not.toHaveBeenCalled();
    expect(
      localStorage.getItem('vibesmith.analytics.first-value-reached.v1')
    ).toBeNull();
  });
});
