/**
 * Dashboard utility functions
 */

import {
  Bot,
  FileText,
  Link2,
  Package,
  Sparkles,
  TerminalSquare,
  type LucideIcon,
} from 'lucide-react';
import type { StatsCardColor, TrendDirection } from '../types';

/**
 * Get neon color class for stats card
 */
export function getNeonColorClass(color: StatsCardColor): string {
  const colors: Record<StatsCardColor, string> = {
    cyan:
      'shadow-[0_0_20px_color-mix(in_srgb,#0fe7ff_45%,transparent)] hover:shadow-[0_0_24px_color-mix(in_srgb,#0fe7ff_70%,transparent)]',
    purple:
      'shadow-[0_0_20px_color-mix(in_srgb,#a855f7_45%,transparent)] hover:shadow-[0_0_24px_color-mix(in_srgb,#a855f7_70%,transparent)]',
    green:
      'shadow-[0_0_20px_color-mix(in_srgb,#22c55e_45%,transparent)] hover:shadow-[0_0_24px_color-mix(in_srgb,#22c55e_70%,transparent)]',
    orange:
      'shadow-[0_0_20px_color-mix(in_srgb,#f97316_45%,transparent)] hover:shadow-[0_0_24px_color-mix(in_srgb,#f97316_70%,transparent)]',
    blue:
      'shadow-[0_0_20px_color-mix(in_srgb,#3b82f6_45%,transparent)] hover:shadow-[0_0_24px_color-mix(in_srgb,#3b82f6_70%,transparent)]',
    white:
      'shadow-[0_0_20px_color-mix(in_srgb,#e2e8f0_28%,transparent)] hover:shadow-[0_0_24px_color-mix(in_srgb,#e2e8f0_42%,transparent)]',
  };
  return colors[color];
}

/**
 * Get trend icon based on direction
 */
export function getTrendIcon(direction: TrendDirection): string {
  switch (direction) {
    case 'up':
      return '↗';
    case 'down':
      return '↘';
    case 'neutral':
      return '→';
  }
}

/**
 * Get trend color class
 */
export function getTrendColorClass(direction: TrendDirection): string {
  switch (direction) {
    case 'up':
      return 'text-[var(--color-state-success)]';
    case 'down':
      return 'text-[var(--color-state-danger)]';
    case 'neutral':
      return 'text-theme-secondary';
  }
}

/**
 * Format relative time (e.g., "2m ago", "1h ago")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

/**
 * Format percentage with sign
 */
export function formatPercentage(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

/**
 * Get component type icon
 */
export function getComponentTypeIcon(type: string): LucideIcon {
  const icons: Record<string, LucideIcon> = {
    skill: Sparkles,
    agent: Bot,
    command: TerminalSquare,
    hook: Link2,
    rule: FileText,
  };
  return icons[type] || Package;
}

/**
 * Get component type badge color
 */
export function getComponentTypeBadgeColor(type: string): string {
  const colors: Record<string, string> = {
    skill:
      'bg-[color-mix(in_srgb,var(--color-primary)_20%,transparent)] text-[var(--color-primary)] border-[color-mix(in_srgb,var(--color-primary)_45%,transparent)]',
    agent:
      'bg-[color-mix(in_srgb,#a855f7_20%,transparent)] text-[#a855f7] border-[color-mix(in_srgb,#a855f7_45%,transparent)]',
    command:
      'bg-[color-mix(in_srgb,var(--color-state-success)_20%,transparent)] text-[var(--color-state-success)] border-[color-mix(in_srgb,var(--color-state-success)_45%,transparent)]',
    hook:
      'bg-[color-mix(in_srgb,#f97316_20%,transparent)] text-[#f97316] border-[color-mix(in_srgb,#f97316_45%,transparent)]',
    rule:
      'bg-[color-mix(in_srgb,#3b82f6_20%,transparent)] text-[#60a5fa] border-[color-mix(in_srgb,#3b82f6_45%,transparent)]',
  };
  return (
    colors[type] ||
    'bg-[color-mix(in_srgb,var(--color-fg-secondary)_20%,transparent)] text-theme-secondary border-[color-mix(in_srgb,var(--color-fg-secondary)_45%,transparent)]'
  );
}
