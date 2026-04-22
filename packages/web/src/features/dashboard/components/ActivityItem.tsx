/**
 * Activity Item Component
 * Terminal-style activity list item
 */

import { useTranslation } from 'react-i18next';
import { ComponentIcon } from '@/components/common';
import type { Component } from '../types';
import {
  formatRelativeTime,
  getComponentTypeBadgeColor,
} from '../utils/helpers';

interface ActivityItemProps {
  component: Component;
  isLive?: boolean;
  compact?: boolean;
}

export function ActivityItem({ component, isLive = false, compact = false }: ActivityItemProps) {
  const { t } = useTranslation('dashboard');
  const badgeColor = getComponentTypeBadgeColor(component.type);

  return (
    <div
      className={`group flex items-center justify-between border-b border-theme hover:bg-theme-hover transition-all duration-200 ${
        compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 font-mono text-sm'
      }`}
    >
      {/* Left: Terminal prompt + Name */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Terminal prompt - cursor blink (Appendix B.1) */}
        {!compact && <span className="text-theme-success animate-cursor-blink">{'>'}</span>}

        {/* Icon */}
        <span className={compact ? 'text-base' : 'text-lg'} aria-hidden>
          <ComponentIcon
            type={component.type}
            className={compact ? 'h-6 w-6 text-theme-secondary' : 'h-7 w-7 text-theme-secondary'}
          />
        </span>

        {/* Name */}
        <span className={`text-theme-primary font-semibold truncate ${compact ? 'text-sm' : ''}`}>
          {component.name}
        </span>

        {/* Type badge */}
        <span
          className={`
            rounded text-xs font-semibold uppercase
            border
            ${compact ? 'px-1.5 py-0' : 'px-2 py-0.5'}
            ${badgeColor}
          `}
        >
          {component.type}
        </span>

        {/* Scope */}
        {!compact && <span className="text-theme-tertiary text-xs">
          {component.scope === 'global' ? t('activity.global') : component.projectName}
        </span>}
      </div>

      {/* Right: Time + Live indicator */}
      <div className={`flex items-center ${compact ? 'gap-2' : 'gap-3'}`}>
        <span className="text-theme-secondary text-xs">
          {component.lastUsed ? formatRelativeTime(component.lastUsed) : t('activity.never')}
        </span>
        <div
          className={`
            rounded-full ${compact ? 'w-1.5 h-1.5' : 'w-2 h-2'}
            ${isLive ? 'bg-theme-success animate-pulse' : 'bg-theme-muted'}
          `}
        />
      </div>
    </div>
  );
}
