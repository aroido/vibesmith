/**
 * RescanButton - 단일 동기화 액션 (빠른 갱신 + 조건부 재스캔)
 */

import { useTranslation } from 'react-i18next';
import { RotateCw } from 'lucide-react';
import { useUnifiedSync } from '../hooks/useUnifiedSync';
import type { ScanResponse } from '../types';
import { trackFeatureUsed } from '@/common/analytics/desktopAnalyticsBridge';

interface RescanButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  onSuccess?: (result: ScanResponse) => void;
  'data-testid'?: string;
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'h-10 min-h-[40px] px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

const variantClasses = {
  primary:
    'btn-theme-primary-soft',
  secondary: 'btn-theme-surface text-theme-primary',
};

export function RescanButton({
  variant = 'primary',
  size = 'md',
  onSuccess,
  'data-testid': dataTestId,
}: RescanButtonProps) {
  const { t } = useTranslation(['scan']);
  const analyticsSource = dataTestId ?? 'scan_button';
  const { sync, forceRescan, phase, isPending, statusMessage, canForceRescan } =
    useUnifiedSync({ onSuccess, source: analyticsSource });

  const baseClasses =
    'inline-flex items-center gap-2 font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed';
  const forceButtonClasses =
    'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm btn-theme-surface text-theme-primary transition-colors disabled:cursor-not-allowed disabled:opacity-50';

  const buttonLabel =
    phase === 'refreshing'
      ? t('scan:syncingRefresh')
      : phase === 'rescanning'
        ? t('scan:syncingRescan')
        : t('scan:syncAction');

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            trackFeatureUsed('sync_action', { source: analyticsSource });
            void sync();
          }}
          disabled={isPending}
          data-testid={dataTestId}
          aria-label={t('scan:syncAria')}
          title={t('scan:syncHint')}
          aria-busy={isPending}
          className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]}`}
        >
          <RotateCw
            className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`}
            aria-hidden
          />
          <span>{buttonLabel}</span>
        </button>

        {canForceRescan && (
          <button
            type="button"
            onClick={() => {
              trackFeatureUsed('force_full_scan', { source: analyticsSource });
              void forceRescan();
            }}
            disabled={isPending}
            className={forceButtonClasses}
            aria-label={t('scan:forceRescan')}
            title={t('scan:forceRescanHint')}
          >
            <RotateCw className="h-4 w-4" aria-hidden />
            <span>{t('scan:forceRescan')}</span>
          </button>
        )}
      </div>

      {statusMessage && (
        <p className="absolute right-0 top-full mt-1 text-xs text-theme-secondary whitespace-nowrap" role="status">
          {statusMessage}
        </p>
      )}
    </div>
  );
}
