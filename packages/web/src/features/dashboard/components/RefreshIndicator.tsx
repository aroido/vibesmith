/**
 * Refresh Indicator - 마지막 업데이트 시간 표시
 */

import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';

interface RefreshIndicatorProps {
  lastUpdated: Date | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function RefreshIndicator({
  lastUpdated,
  onRefresh,
  isRefreshing = false,
}: RefreshIndicatorProps) {
  const { t, i18n } = useTranslation('dashboard');
  const locale = i18n.language === 'ko' ? ko : enUS;

  const timeAgo = lastUpdated
    ? formatDistanceToNow(lastUpdated, { addSuffix: true, locale })
    : t('neverUpdated');

  return (
    <div className="flex items-center gap-3 text-sm text-theme-secondary">
      <span>
        {t('lastUpdated')}: {timeAgo}
      </span>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex h-10 min-h-[40px] items-center rounded-lg border border-theme px-3 text-xs font-semibold text-theme-primary transition-colors hover:bg-theme-hover disabled:opacity-60"
        >
          {isRefreshing ? `${t('refresh')}...` : t('refresh')}
        </button>
      )}
    </div>
  );
}
