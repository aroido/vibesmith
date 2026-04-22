/**
 * System Status Banner Component
 * Shows live system status with animated pulse
 */

import { useTranslation } from 'react-i18next';
import { formatRelativeTime } from '../utils/helpers';
import type { SystemStatus } from '../types';

interface SystemStatusBannerProps {
  status: SystemStatus;
  /** API fetch 실패 시 true — 서버 연결 끊김 (#810) */
  isOffline?: boolean;
}

export function SystemStatusBanner({ status, isOffline = false }: SystemStatusBannerProps) {
  const { t } = useTranslation('dashboard');

  const isLive = !isOffline;

  const { watcher, usageScanner } = status.activeWorkers;

  return (
    <div
      className="
        relative overflow-hidden rounded-2xl
        panel-theme-status
        backdrop-blur-md
        p-4 md:p-5
      "
    >
      {/* Animated border glow */}
      <div
        className="
          absolute inset-0
          panel-theme-status-glow
          animate-pulse
          pointer-events-none
        "
        style={{ animationDuration: '2s' }}
      />

      <div className="relative space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-theme-primary font-display">
            {t('systemStatus.title')}
          </h2>
          <div className="flex items-center gap-2">
            {isLive && (
              <>
                <div className="relative">
                  <div className="w-2 h-2 bg-theme-success rounded-full animate-pulse" />
                  <div className="absolute inset-0 w-2 h-2 bg-theme-success rounded-full animate-ping" />
                </div>
                <span className="text-sm font-semibold text-theme-success uppercase tracking-wide">
                  {t('systemStatus.live')}
                </span>
              </>
            )}
            {!isLive && (
              <>
                <div className="w-2 h-2 bg-theme-muted rounded-full" />
                <span className="text-sm font-semibold text-theme-secondary uppercase tracking-wide">
                  {t('systemStatus.offline')}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg border border-theme bg-theme-surface px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.1em] text-theme-tertiary">
              {t('systemStatus.lastScan')}
            </p>
            <p className="mt-0.5 font-mono tabular-nums text-theme-primary">
              {formatRelativeTime(status.lastScanAt)}
            </p>
          </div>
          <div className="rounded-lg border border-theme bg-theme-surface px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.1em] text-theme-tertiary">
              {t('systemStatus.watcher')}
            </p>
            <p className={`mt-0.5 font-mono font-bold tabular-nums ${
              watcher ? 'text-theme-success' : 'text-[var(--color-state-danger)]'
            }`}>
              {watcher ? t('systemStatus.active') : t('systemStatus.down')}
            </p>
          </div>
          <div className="rounded-lg border border-theme bg-theme-surface px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.1em] text-theme-tertiary">
              {t('systemStatus.scanner')}
            </p>
            <p className={`mt-0.5 font-mono font-bold tabular-nums ${
              usageScanner ? 'text-theme-success' : 'text-[var(--color-state-danger)]'
            }`}>
              {usageScanner ? t('systemStatus.active') : t('systemStatus.down')}
            </p>
          </div>
          <div className="rounded-lg border border-theme bg-theme-surface px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.1em] text-theme-tertiary">
              {t('systemStatus.health')}
            </p>
            <p className="mt-0.5 font-mono font-bold tabular-nums text-theme-success">
              {status.healthScore}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
