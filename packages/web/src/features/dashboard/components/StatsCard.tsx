/**
 * Stats Card Component
 * Glassmorphism + Neon glow (Appendix B.1, B.2)
 * Hover: lift + glow, Count-up animation, Skeleton shimmer
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StatsCardProps } from '../types';
import {
  getNeonColorClass,
  getTrendIcon,
  getTrendColorClass,
  formatPercentage,
} from '../utils/helpers';

export function StatsCard({
  title,
  value,
  trend,
  icon,
  color,
  progress,
  secondaryValue,
  secondaryLabel,
  onClick,
  'data-testid': dataTestId,
}: StatsCardProps & { 'data-testid'?: string; onClick?: () => void }) {
  const { t } = useTranslation('dashboard');
  const [displayValue, setDisplayValue] = useState(0);
  const [displaySecondary, setDisplaySecondary] = useState(0);

  // Count-up animation
  useEffect(() => {
    let start = 0;
    const end = value;
    const duration = 1000;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayValue(end);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [value]);

  useEffect(() => {
    if (secondaryValue === undefined) return;
    let start = 0;
    const end = secondaryValue;
    const duration = 1000;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplaySecondary(end);
        clearInterval(timer);
      } else {
        setDisplaySecondary(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [secondaryValue]);

  const neonClass = getNeonColorClass(color);
  const valueClass = 'text-primary';

  const progressClass = (() => {
    switch (color) {
      case 'green':
        return 'bg-[color-mix(in_srgb,#22c55e_82%,transparent)]';
      case 'orange':
        return 'bg-[color-mix(in_srgb,#f97316_82%,transparent)]';
      case 'purple':
        return 'bg-[color-mix(in_srgb,#a855f7_82%,transparent)]';
      case 'blue':
        return 'bg-[color-mix(in_srgb,#3b82f6_82%,transparent)]';
      case 'cyan':
      default:
        return 'bg-[color-mix(in_srgb,#0fe7ff_82%,transparent)]';
    }
  })();

  const isClickable = !!onClick;

  const CardWrapper = isClickable ? 'button' : 'div';
  const cardProps = isClickable
    ? {
        type: 'button' as const,
        onClick,
        className: `
          relative overflow-hidden rounded-2xl
          bg-[var(--color-card-bg)] backdrop-blur-md
          border border-[var(--color-card-border)] ${neonClass}
          p-6
          h-full min-h-[12.5rem]
          flex flex-col
          transition-all duration-300 ease-out
          hover:-translate-y-1 hover:shadow-lg
          group
          motion-reduce:transition-none motion-reduce:hover:translate-y-0
          cursor-pointer
          w-full text-left
          focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 focus:ring-offset-[var(--color-background)]
        `,
      }
    : {
        className: `
          relative overflow-hidden rounded-2xl
          bg-[var(--color-card-bg)] backdrop-blur-md
          border border-[var(--color-card-border)] ${neonClass}
          p-6
          h-full min-h-[12.5rem]
          flex flex-col
          transition-all duration-300 ease-out
          hover:-translate-y-1 hover:shadow-lg
          group
          motion-reduce:transition-none motion-reduce:hover:translate-y-0
        `,
      };

  return (
    <CardWrapper
      role={isClickable ? undefined : 'region'}
      aria-label={t('statsCard.ariaLabel', { title })}
      data-testid={dataTestId}
      {...cardProps}
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-2">
        <span className="line-clamp-1 text-sm font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
          {title}
        </span>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-theme-secondary" aria-hidden>
          {icon}
        </span>
      </div>

      {/* Value */}
      <div className="mb-2 flex min-h-[3.25rem] flex-wrap items-end gap-2">
        <span className={`text-4xl font-bold font-mono leading-none tabular-nums ${valueClass}`}>
          {displayValue}
        </span>
        {secondaryValue !== undefined && secondaryLabel && (
          <span className="whitespace-nowrap text-base font-mono text-[var(--color-text-muted)]">
            / {displaySecondary} {secondaryLabel}
          </span>
        )}
      </div>

      {/* Trend */}
      <div className="mb-3 min-h-[1.25rem]">
        {trend ? (
          <div className="flex items-center gap-2" role="status" aria-live="polite">
            <span className={`text-sm font-semibold ${getTrendColorClass(trend.direction)}`}>
              {trend.value > 0 ? '+' : ''}{trend.value} {getTrendIcon(trend.direction)}
            </span>
            <span className="text-sm text-[var(--color-text-tertiary)]">
              {formatPercentage(trend.percentage)}
            </span>
          </div>
        ) : (
          <div className="h-5" aria-hidden />
        )}
      </div>

      {/* Progress bar */}
      {progress !== undefined && (
        <div
          className="relative mt-auto h-2 overflow-hidden rounded-full bg-[var(--color-surface-hover)]"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('statsCard.progressAria', { title, progress })}
        >
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-[1500ms] ease-out ${progressClass}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </CardWrapper>
  );
}
