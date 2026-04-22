/**
 * Settings Expansion types
 */

export type FontSize = 'sm' | 'md' | 'lg';
export type Layout = 'compact' | 'normal';

export interface NotificationTypes {
  success: boolean;
  error: boolean;
  info: boolean;
  warning: boolean;
}

export interface EnabledAgents {
  cursor: boolean;
  claude: boolean;
}

export const STORAGE_KEYS = {
  theme: 'vibesmith-theme',
  locale: 'vibesmith-locale',
  fontSize: 'vibesmith-font-size',
  layout: 'vibesmith-layout',
  notificationEnabled: 'vibesmith-notification-enabled',
  notificationTypes: 'vibesmith-notification-types',
  autoScan: 'vibesmith-auto-scan',
  experimental: 'vibesmith-experimental',
  enabledAgents: 'vibesmith-enabled-agents',
  monitoringCrashReporting: 'monitoring.crashReporting',
  monitoringPerformance: 'monitoring.performance',
  monitoringAnalytics: 'monitoring.analytics',
} as const;

export const DEFAULT_FONT_SIZE: FontSize = 'md';
export const DEFAULT_LAYOUT: Layout = 'normal';
export const DEFAULT_NOTIFICATION_ENABLED = true;
export const DEFAULT_NOTIFICATION_TYPES: NotificationTypes = {
  success: true,
  error: true,
  info: true,
  warning: true,
};
export const DEFAULT_AUTO_SCAN = true;
export const DEFAULT_EXPERIMENTAL = false;
export const DEFAULT_ENABLED_AGENTS: EnabledAgents = {
  cursor: true,
  claude: true,
};

export const DEFAULT_CRASH_REPORTING = true;
export const DEFAULT_PERFORMANCE_MONITORING = true;
export const DEFAULT_USAGE_ANALYTICS = true;
