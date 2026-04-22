/**
 * Settings localStorage utilities
 * Safe get/set with fallback for private mode
 */

import type { FontSize, Layout, NotificationTypes, EnabledAgents } from '../types';
import {
  STORAGE_KEYS,
  DEFAULT_FONT_SIZE,
  DEFAULT_LAYOUT,
  DEFAULT_NOTIFICATION_ENABLED,
  DEFAULT_NOTIFICATION_TYPES,
  DEFAULT_AUTO_SCAN,
  DEFAULT_EXPERIMENTAL,
  DEFAULT_ENABLED_AGENTS,
  DEFAULT_CRASH_REPORTING,
  DEFAULT_PERFORMANCE_MONITORING,
  DEFAULT_USAGE_ANALYTICS,
} from '../types';

function safeGet<T>(key: string, parse: (v: string) => T, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    return parse(stored);
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // private mode or quota exceeded - ignore
  }
}

function dispatchMonitoringPreferenceChanged(
  eventName:
    | 'vibesmith:usage-analytics-changed'
    | 'vibesmith:crash-reporting-changed'
    | 'vibesmith:performance-monitoring-changed',
  enabled: boolean
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(eventName, {
      detail: { enabled },
    })
  );
}

function readMonitoringPreference(storageKey: string, defaultValue: boolean): boolean {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored === 'true') return true;
    if (stored === 'false') return false;

    localStorage.setItem(storageKey, String(defaultValue));
    return defaultValue;
  } catch {
    return false;
  }
}

function writeMonitoringPreference(storageKey: string, value: boolean): boolean {
  try {
    localStorage.setItem(storageKey, String(value));
    return value;
  } catch {
    return false;
  }
}

export function getFontSize(): FontSize {
  return safeGet(
    STORAGE_KEYS.fontSize,
    (v) => (v === 'sm' || v === 'md' || v === 'lg' ? v : DEFAULT_FONT_SIZE),
    DEFAULT_FONT_SIZE
  );
}

export function setFontSize(value: FontSize): void {
  safeSet(STORAGE_KEYS.fontSize, value);
  document.documentElement.setAttribute('data-font-size', value);
}

export function getLayout(): Layout {
  return safeGet(
    STORAGE_KEYS.layout,
    (v) => (v === 'compact' || v === 'normal' ? v : DEFAULT_LAYOUT),
    DEFAULT_LAYOUT
  );
}

export function setLayout(value: Layout): void {
  safeSet(STORAGE_KEYS.layout, value);
}

export function getNotificationEnabled(): boolean {
  return safeGet(
    STORAGE_KEYS.notificationEnabled,
    (v) => v === 'true',
    DEFAULT_NOTIFICATION_ENABLED
  );
}

export function setNotificationEnabled(value: boolean): void {
  safeSet(STORAGE_KEYS.notificationEnabled, String(value));
}

export function getNotificationTypes(): NotificationTypes {
  return safeGet(
    STORAGE_KEYS.notificationTypes,
    (v) => {
      try {
        const parsed = JSON.parse(v) as Partial<NotificationTypes>;
        return {
          success: parsed.success ?? DEFAULT_NOTIFICATION_TYPES.success,
          error: parsed.error ?? DEFAULT_NOTIFICATION_TYPES.error,
          info: parsed.info ?? DEFAULT_NOTIFICATION_TYPES.info,
          warning: parsed.warning ?? DEFAULT_NOTIFICATION_TYPES.warning,
        };
      } catch {
        return DEFAULT_NOTIFICATION_TYPES;
      }
    },
    DEFAULT_NOTIFICATION_TYPES
  );
}

export function setNotificationTypes(value: NotificationTypes): void {
  safeSet(STORAGE_KEYS.notificationTypes, JSON.stringify(value));
}

export function getAutoScan(): boolean {
  return safeGet(
    STORAGE_KEYS.autoScan,
    (v) => v === 'true',
    DEFAULT_AUTO_SCAN
  );
}

export function setAutoScan(value: boolean): void {
  safeSet(STORAGE_KEYS.autoScan, String(value));
}

export function getExperimental(): boolean {
  return safeGet(
    STORAGE_KEYS.experimental,
    (v) => v === 'true',
    DEFAULT_EXPERIMENTAL
  );
}

export function setExperimental(value: boolean): void {
  safeSet(STORAGE_KEYS.experimental, String(value));
}

export function getEnabledAgents(): EnabledAgents {
  return safeGet(
    STORAGE_KEYS.enabledAgents,
    (v) => {
      try {
        const parsed = JSON.parse(v) as Partial<EnabledAgents>;
        return {
          cursor: parsed.cursor ?? DEFAULT_ENABLED_AGENTS.cursor,
          claude: parsed.claude ?? DEFAULT_ENABLED_AGENTS.claude,
        };
      } catch {
        return DEFAULT_ENABLED_AGENTS;
      }
    },
    DEFAULT_ENABLED_AGENTS
  );
}

export function setEnabledAgents(value: EnabledAgents): void {
  safeSet(STORAGE_KEYS.enabledAgents, JSON.stringify(value));
}

export function getCrashReporting(): boolean {
  return readMonitoringPreference(
    STORAGE_KEYS.monitoringCrashReporting,
    DEFAULT_CRASH_REPORTING
  );
}

export function setCrashReporting(value: boolean): boolean {
  const persistedValue = writeMonitoringPreference(
    STORAGE_KEYS.monitoringCrashReporting,
    value
  );
  dispatchMonitoringPreferenceChanged(
    'vibesmith:crash-reporting-changed',
    persistedValue
  );
  return persistedValue;
}

export function getPerformanceMonitoring(): boolean {
  return readMonitoringPreference(
    STORAGE_KEYS.monitoringPerformance,
    DEFAULT_PERFORMANCE_MONITORING
  );
}

export function setPerformanceMonitoring(value: boolean): boolean {
  const persistedValue = writeMonitoringPreference(
    STORAGE_KEYS.monitoringPerformance,
    value
  );
  dispatchMonitoringPreferenceChanged(
    'vibesmith:performance-monitoring-changed',
    persistedValue
  );
  return persistedValue;
}

export function getUsageAnalytics(): boolean {
  return readMonitoringPreference(
    STORAGE_KEYS.monitoringAnalytics,
    DEFAULT_USAGE_ANALYTICS
  );
}

export function setUsageAnalytics(value: boolean): boolean {
  const persistedValue = writeMonitoringPreference(
    STORAGE_KEYS.monitoringAnalytics,
    value
  );
  dispatchMonitoringPreferenceChanged(
    'vibesmith:usage-analytics-changed',
    persistedValue
  );
  return persistedValue;
}
