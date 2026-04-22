/**
 * settingsStorage utility tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as storage from '../utils/settingsStorage';

describe('settingsStorage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('fontSize', () => {
    it('returns default when not set', () => {
      expect(storage.getFontSize()).toBe('md');
    });
    it('gets and sets value', () => {
      storage.setFontSize('lg');
      expect(storage.getFontSize()).toBe('lg');
    });
  });

  describe('layout', () => {
    it('returns default when not set', () => {
      expect(storage.getLayout()).toBe('normal');
    });
    it('gets and sets value', () => {
      storage.setLayout('compact');
      expect(storage.getLayout()).toBe('compact');
    });
  });

  describe('notificationEnabled', () => {
    it('returns true by default', () => {
      expect(storage.getNotificationEnabled()).toBe(true);
    });
    it('gets and sets value', () => {
      storage.setNotificationEnabled(false);
      expect(storage.getNotificationEnabled()).toBe(false);
    });
  });

  describe('notificationTypes', () => {
    it('returns defaults when not set', () => {
      const t = storage.getNotificationTypes();
      expect(t.success).toBe(true);
      expect(t.error).toBe(true);
      expect(t.info).toBe(true);
      expect(t.warning).toBe(true);
    });
    it('gets and sets value', () => {
      storage.setNotificationTypes({ success: true, error: false, info: true, warning: false });
      const t = storage.getNotificationTypes();
      expect(t.error).toBe(false);
      expect(t.warning).toBe(false);
    });
  });

  describe('autoScan', () => {
    it('returns true by default', () => {
      expect(storage.getAutoScan()).toBe(true);
    });
    it('gets and sets value', () => {
      storage.setAutoScan(false);
      expect(storage.getAutoScan()).toBe(false);
    });
  });

  describe('experimental', () => {
    it('returns false by default', () => {
      expect(storage.getExperimental()).toBe(false);
    });
    it('gets and sets value', () => {
      storage.setExperimental(true);
      expect(storage.getExperimental()).toBe(true);
    });
  });

  describe('usageAnalytics', () => {
    it('dispatches analytics preference change event', () => {
      let captured: boolean | null = null;
      const listener = (event: Event) => {
        const customEvent = event as CustomEvent<{ enabled: boolean }>;
        captured = customEvent.detail.enabled;
      };

      window.addEventListener('vibesmith:usage-analytics-changed', listener);
      storage.setUsageAnalytics(true);
      window.removeEventListener('vibesmith:usage-analytics-changed', listener);

      expect(captured).toBe(true);
      expect(storage.getUsageAnalytics()).toBe(true);
    });

    it('fails closed when usage analytics cannot be persisted', () => {
      let captured: boolean | null = null;
      const listener = (event: Event) => {
        const customEvent = event as CustomEvent<{ enabled: boolean }>;
        captured = customEvent.detail.enabled;
      };

      vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
        throw new Error('quota');
      });

      window.addEventListener('vibesmith:usage-analytics-changed', listener);
      const actual = storage.setUsageAnalytics(true);
      window.removeEventListener('vibesmith:usage-analytics-changed', listener);

      expect(actual).toBe(false);
      expect(captured).toBe(false);
    });
  });

  describe('crashReporting', () => {
    it('dispatches crash reporting change event', () => {
      let captured: boolean | null = null;
      const listener = (event: Event) => {
        const customEvent = event as CustomEvent<{ enabled: boolean }>;
        captured = customEvent.detail.enabled;
      };

      window.addEventListener('vibesmith:crash-reporting-changed', listener);
      storage.setCrashReporting(false);
      window.removeEventListener('vibesmith:crash-reporting-changed', listener);

      expect(captured).toBe(false);
      expect(storage.getCrashReporting()).toBe(false);
    });
  });

  describe('performanceMonitoring', () => {
    it('dispatches performance monitoring change event', () => {
      let captured: boolean | null = null;
      const listener = (event: Event) => {
        const customEvent = event as CustomEvent<{ enabled: boolean }>;
        captured = customEvent.detail.enabled;
      };

      window.addEventListener('vibesmith:performance-monitoring-changed', listener);
      storage.setPerformanceMonitoring(false);
      window.removeEventListener('vibesmith:performance-monitoring-changed', listener);

      expect(captured).toBe(false);
      expect(storage.getPerformanceMonitoring()).toBe(false);
    });
  });

  describe('monitoring fallback', () => {
    it('returns false when monitoring preferences cannot be read', () => {
      vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
        throw new Error('storage_denied');
      });

      expect(storage.getUsageAnalytics()).toBe(false);
      expect(storage.getCrashReporting()).toBe(false);
      expect(storage.getPerformanceMonitoring()).toBe(false);
    });
  });
});
