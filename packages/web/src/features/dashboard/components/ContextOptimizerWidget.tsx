/**
 * Context Optimizer Widget (Spec §5.2.1)
 * 플랫폼별 탭 + 계층(tier) 분류 뷰
 * Issue #691, #749
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, BarChart3, Info } from 'lucide-react';
import { useContextStats } from '../hooks/useContextStats';
import { SuggestionsModal } from './SuggestionsModal';
import type { PlatformContextStats, TierStats } from '../types';

export interface ContextOptimizerWidgetProps {
  projectId?: string;
  onToast?: (message: string, type: 'success' | 'error') => void;
}

const PLATFORM_LABELS: Record<string, string> = {
  claude_code: 'Claude Code',
  cursor: 'Cursor',
};

function TierRow({
  tier,
  label,
  isAverage,
}: {
  tier: TierStats;
  label: string;
  isAverage?: boolean;
}) {
  const { t } = useTranslation('dashboard');
  const unit = isAverage
    ? t('optimizer.units.tokenPerProject')
    : t('optimizer.units.token');
  const countLabel = isAverage
    ? t('optimizer.units.countApprox', { count: tier.count })
    : t('optimizer.units.count', { count: tier.count });
  const description = t(`optimizer.tierDescriptions.${tier.name}`, { defaultValue: '' });

  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-theme-primary font-medium">{label}</span>
        {description && (
          <span className="relative group">
            <Info className="h-3.5 w-3.5 text-theme-tertiary cursor-help" aria-hidden />
            <span
              role="tooltip"
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-50 w-56 px-3 py-2 text-xs leading-relaxed text-theme-primary bg-theme-surface border border-theme rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            >
              {description}
            </span>
          </span>
        )}
        {tier.counts_toward_limit && (
          <span className="text-[10px] text-theme-tertiary px-1.5 py-0.5 rounded bg-theme-hover">
            {t('optimizer.limitTag')}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 font-mono tabular-nums text-xs">
        <span className="text-theme-secondary">{countLabel}</span>
        <span className="text-theme-primary font-semibold">
          {tier.total_tokens.toLocaleString()} {unit}
        </span>
      </div>
    </div>
  );
}

function PlatformPanel({ platform, isAverage }: { platform: PlatformContextStats; isAverage?: boolean }) {
  const { t } = useTranslation('dashboard');
  const isOverLimit = platform.effective_tokens > platform.recommended_max_tokens;
  const overPercentage = Math.round(
    ((platform.effective_tokens - platform.recommended_max_tokens) /
      platform.recommended_max_tokens) *
      100
  );

  return (
    <div>
      {/* Progress Bar */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-theme-secondary flex items-center gap-1">
            {t('optimizer.tokenUsage')}
            <span
              className="text-xs text-theme-tertiary cursor-help"
              title={t('optimizer.tokenHelp')}
            >
              <Info className="h-3.5 w-3.5" aria-hidden />
            </span>
          </span>
          <span className="whitespace-nowrap font-mono font-semibold tabular-nums text-theme-primary">
            {platform.effective_tokens.toLocaleString()} / {platform.recommended_max_tokens.toLocaleString()}
            {isAverage && (
              <span className="ml-1 text-[10px] font-normal text-theme-tertiary">
                {t('optimizer.units.tokenPerProject')}
              </span>
            )}
          </span>
        </div>
        <div className="h-3 rounded-full bg-theme-hover overflow-hidden">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${Math.min(
                (platform.effective_tokens / platform.recommended_max_tokens) * 100,
                100
              )}%`,
              background: isOverLimit
                ? 'linear-gradient(90deg, var(--color-state-danger), color-mix(in_srgb,var(--color-state-danger)_70%,black))'
                : 'linear-gradient(90deg, var(--color-primary), #3b82f6)',
            }}
            role="progressbar"
            aria-valuenow={platform.effective_tokens}
            aria-valuemin={0}
            aria-valuemax={platform.recommended_max_tokens}
            aria-label={t('optimizer.tokenUsage')}
          />
        </div>
        {isOverLimit && (
          <p className="text-xs text-theme-danger mt-1">
            {t('optimizer.overLimit', { percent: overPercentage })}
          </p>
        )}
      </div>

      {/* Tier Breakdown */}
      <div className="rounded-lg border border-theme bg-theme-elevated p-3">
        <div className="divide-y divide-theme">
          {platform.tiers.map((tier) => {
            const label = t(`optimizer.tiers.${tier.name}`, {
              defaultValue: tier.label,
            });
            return <TierRow key={tier.name} tier={tier} label={label} isAverage={isAverage} />;
          })}
        </div>
      </div>
    </div>
  );
}

export function ContextOptimizerWidget({
  projectId,
  onToast,
}: ContextOptimizerWidgetProps) {
  const { t } = useTranslation('dashboard');
  const { data, isLoading, refetch } = useContextStats(projectId);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activePlatformIdx, setActivePlatformIdx] = useState(0);

  if (isLoading || !data) {
    return (
      <div
        className="rounded-2xl bg-theme-surface border border-theme p-6 animate-pulse"
        aria-label={t('optimizer.loadingAria')}
        role="status"
      >
        <div className="flex justify-between items-center mb-4">
          <div className="h-6 bg-theme-hover rounded w-48" />
          <div className="h-8 bg-theme-hover rounded w-20" />
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-theme-hover rounded w-full" />
          <div className="h-4 bg-theme-hover rounded w-3/4" />
          <div className="h-4 bg-theme-hover rounded w-1/2" />
          <div className="h-10 bg-theme-hover rounded w-40 mt-4" />
        </div>
      </div>
    );
  }

  const activePlatform = data.platforms[activePlatformIdx];
  const isOverLimit = activePlatform.effective_tokens > activePlatform.recommended_max_tokens;
  const overPercentage = isOverLimit
    ? Math.round(
        ((activePlatform.effective_tokens - activePlatform.recommended_max_tokens) /
          activePlatform.recommended_max_tokens) *
          100
      )
    : 0;

  const handleModalClose = () => {
    setIsModalOpen(false);
    void refetch();
  };

  const handleDisableSuccess = (count: number) => {
    onToast?.(t('optimizer.disableSuccess', { count }), 'success');
    handleModalClose();
  };

  return (
    <>
      <section
        className={`min-h-[16rem] rounded-2xl p-5 backdrop-blur-md transition-all duration-300 ${
          isOverLimit
            ? 'alert-theme-danger border-2 shadow-xl ring-2 ring-[color-mix(in_srgb,var(--color-state-danger)_36%,transparent)]'
            : 'bg-theme-surface border border-theme hover:shadow-lg hover:shadow-cyan-400/10'
        }`}
        aria-label={t('optimizer.sectionAria')}
      >
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-theme-primary">
              {isOverLimit ? (
                <AlertTriangle className="h-5 w-5 text-theme-danger animate-pulse" aria-hidden />
              ) : (
                <BarChart3 className="h-5 w-5 text-theme-secondary" aria-hidden />
              )}
              {t('optimizer.title')}
              {isOverLimit && (
                <span className="ml-2 px-2 py-0.5 text-xs font-bold text-theme-danger bg-[color-mix(in_srgb,var(--color-state-danger)_24%,transparent)] border border-[color-mix(in_srgb,var(--color-state-danger)_45%,transparent)] rounded-full">
                  {t('optimizer.overLimitBadge', { percent: overPercentage })}
                </span>
              )}
            </h2>
          </div>
          <p className="mt-2 text-sm text-theme-secondary">
            {t('optimizer.description')}
          </p>
        </div>

        {/* Platform Tabs */}
        <div className="flex gap-1 mb-4 rounded-lg bg-theme-hover p-1" role="tablist">
          {data.platforms.map((p, idx) => (
            <button
              key={p.platform}
              role="tab"
              aria-selected={idx === activePlatformIdx}
              onClick={() => setActivePlatformIdx(idx)}
              className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                idx === activePlatformIdx
                  ? 'bg-theme-surface text-theme-primary shadow-sm'
                  : 'text-theme-tertiary hover:text-theme-secondary'
              }`}
            >
              {PLATFORM_LABELS[p.platform] ?? p.platform}
            </button>
          ))}
        </div>

        {/* Active Platform Panel */}
        <PlatformPanel platform={activePlatform} isAverage={!projectId} />

        {/* Over-limit Alert */}
        {isOverLimit && (
          <div
            className="mt-4 p-4 rounded-lg alert-theme-danger border-2 shadow-lg"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-theme-danger flex-shrink-0 mt-0.5 animate-pulse" aria-hidden />
              <p className="text-theme-danger font-bold text-sm">
                {t('optimizer.contextOverLimit', { percent: overPercentage })}
              </p>
            </div>
          </div>
        )}

        {/* All-good message */}
        {!isOverLimit && data.suggestions.length === 0 && (
          <div className="mt-4 p-3 rounded-lg alert-theme-success">
            <p className="text-theme-success font-medium">
              {t('optimizer.contextOptimized')}
            </p>
          </div>
        )}

        {/* Suggestions Button */}
        {data.suggestions.length > 0 && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            data-testid="dashboard-optimizer-suggestions-button"
            className="mt-4 w-full py-2.5 rounded-lg btn-theme-primary-soft font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-background)]"
          >
            {t('optimizer.viewSuggestions', { count: data.suggestions.length })}
          </button>
        )}
      </section>

      <SuggestionsModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        suggestions={data.suggestions}
        onDisableSuccess={handleDisableSuccess}
      />
    </>
  );
}
