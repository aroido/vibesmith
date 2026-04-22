import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useUsageSummary } from '../hooks/useDashboardData';
import type { UsageComponentType } from '../types';

interface UsageInsightsWidgetProps {
  projectId?: string | null;
  displayMode?: 'summary' | 'full';
}

type UsageFilterType = 'all' | UsageComponentType;

const DAYS_OPTIONS = [7, 30, 90] as const;
const ACTION_PREVIEW_ITEMS = 3;
const FULL_MORE_STEP = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;
type UnusedAgeTone = 'fresh' | 'stale' | 'cold' | 'unknown';

function formatTypeLabel(t: TranslateFn, type: UsageComponentType): string {
  switch (type) {
    case 'skill':
      return t('usageInsights.typeSkill');
    case 'command':
      return t('usageInsights.typeCommand');
    case 'agent':
      return t('usageInsights.typeAgent');
    case 'hook':
      return t('usageInsights.typeHook');
    default:
      return type;
  }
}

function getUnusedAgeDays(createdAt: Date): number | null {
  const timestamp = createdAt.getTime();
  if (!Number.isFinite(timestamp)) return null;

  const diff = Date.now() - timestamp;
  if (!Number.isFinite(diff)) return null;
  if (diff <= 0) return 0;

  return Math.floor(diff / DAY_MS);
}

function getUnusedAgeBadge(
  t: TranslateFn,
  ageDays: number | null,
): { label: string; tone: UnusedAgeTone } {
  if (ageDays === null) {
    return { label: t('usageInsights.unusedAgeUnknown'), tone: 'unknown' };
  }
  if (ageDays >= 90) {
    return { label: t('usageInsights.unusedAge90'), tone: 'cold' };
  }
  if (ageDays >= 30) {
    return { label: t('usageInsights.unusedAge30'), tone: 'stale' };
  }
  if (ageDays >= 7) {
    return { label: t('usageInsights.unusedAge7'), tone: 'fresh' };
  }

  return { label: t('usageInsights.unusedAgeNew'), tone: 'fresh' };
}

function getUnusedAgeBadgeClass(tone: UnusedAgeTone): string {
  switch (tone) {
    case 'cold':
      return 'badge-theme-danger';
    case 'stale':
      return 'badge-theme-warning';
    case 'fresh':
      return 'badge-theme-success';
    default:
      return 'badge-theme-muted';
  }
}

function getRankingBadgeClass(index: number): string {
  if (index === 0) return 'badge-theme-warning';
  if (index === 1) return 'badge-theme-info';
  if (index === 2) return 'badge-theme-muted';
  return 'badge-theme-muted';
}

function getComponentNavigationTarget(
  componentName: string,
  componentId?: string | null,
): string {
  if (componentId) return `/components/${componentId}`;
  return `/components?q=${encodeURIComponent(componentName)}`;
}

export function UsageInsightsWidget({
  projectId,
  displayMode = 'summary',
}: UsageInsightsWidgetProps) {
  const { t, i18n } = useTranslation('dashboard');
  const isFullMode = displayMode === 'full';
  const [componentType, setComponentType] = useState<UsageFilterType>('all');
  const [days, setDays] = useState<number>(30);
  const [visiblePriorityRankingCount, setVisiblePriorityRankingCount] =
    useState<number>(ACTION_PREVIEW_ITEMS);
  const [visiblePriorityUnusedCount, setVisiblePriorityUnusedCount] =
    useState<number>(ACTION_PREVIEW_ITEMS);
  const [visiblePriorityLongTailCount, setVisiblePriorityLongTailCount] =
    useState<number>(ACTION_PREVIEW_ITEMS);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useUsageSummary({
    projectId,
    componentType,
    days,
  });

  const allRanking = useMemo(() => data?.ranking ?? [], [data?.ranking]);
  const allUnused = useMemo(() => data?.unused ?? [], [data?.unused]);

  const totalUseCount = useMemo(
    () => allRanking.reduce((sum, item) => sum + item.useCount, 0),
    [allRanking],
  );
  const top3SharePercent = useMemo(() => {
    if (totalUseCount <= 0) return 0;
    const top3UseCount = allRanking
      .slice(0, 3)
      .reduce((sum, item) => sum + item.useCount, 0);

    return Math.round((top3UseCount / totalUseCount) * 100);
  }, [allRanking, totalUseCount]);
  const unusedRatioPercent = useMemo(() => {
    const trackedCount = allRanking.length + allUnused.length;
    if (trackedCount <= 0) return 0;

    return Math.round((allUnused.length / trackedCount) * 100);
  }, [allRanking, allUnused]);
  const cleanupCandidateCount = useMemo(
    () => allUnused.filter((item) => (getUnusedAgeDays(item.createdAt) ?? 0) >= 30).length,
    [allUnused],
  );
  const staleUnused90Count = useMemo(
    () => allUnused.filter((item) => (getUnusedAgeDays(item.createdAt) ?? 0) >= 90).length,
    [allUnused],
  );
  const top3UseCount = useMemo(
    () => allRanking.slice(0, 3).reduce((sum, item) => sum + item.useCount, 0),
    [allRanking],
  );
  const longTailSharePercent = useMemo(() => {
    if (totalUseCount <= 0) return 0;
    const longTailCount = Math.max(totalUseCount - top3UseCount, 0);
    return Math.round((longTailCount / totalUseCount) * 100);
  }, [top3UseCount, totalUseCount]);
  const timelineCoveragePercent = useMemo(() => {
    const explicitRows = allRanking.filter(
      (item) =>
        typeof item.timeQualifiedCount === 'number' || typeof item.countOnlyCount === 'number',
    );
    if (explicitRows.length === 0) return null;

    const totalWithBreakdown = explicitRows.reduce(
      (sum, item) =>
        sum +
        Math.max((item.timeQualifiedCount ?? 0) + (item.countOnlyCount ?? 0), 0),
      0,
    );
    if (totalWithBreakdown <= 0) return 0;

    const totalTimeQualified = explicitRows.reduce(
      (sum, item) => sum + Math.max(item.timeQualifiedCount ?? 0, 0),
      0,
    );
    return Math.round((totalTimeQualified / totalWithBreakdown) * 100);
  }, [allRanking]);
  const priorityRankingTotal = useMemo(
    () => (isFullMode ? allRanking : allRanking.slice(0, ACTION_PREVIEW_ITEMS)),
    [allRanking, isFullMode],
  );
  const priorityRanking = useMemo(
    () =>
      priorityRankingTotal.slice(
        0,
        isFullMode ? visiblePriorityRankingCount : ACTION_PREVIEW_ITEMS,
      ),
    [isFullMode, priorityRankingTotal, visiblePriorityRankingCount],
  );

  const priorityUnusedTotal = useMemo(() => {
    const sorted = [...allUnused].sort((a, b) => {
      const ageA = getUnusedAgeDays(a.createdAt) ?? -1;
      const ageB = getUnusedAgeDays(b.createdAt) ?? -1;
      return ageB - ageA;
    });
    return isFullMode ? sorted : sorted.slice(0, ACTION_PREVIEW_ITEMS);
  }, [allUnused, isFullMode]);
  const priorityUnused = useMemo(
    () =>
      priorityUnusedTotal.slice(
        0,
        isFullMode ? visiblePriorityUnusedCount : ACTION_PREVIEW_ITEMS,
      ),
    [isFullMode, priorityUnusedTotal, visiblePriorityUnusedCount],
  );

  const priorityLongTailTotal = useMemo(() => {
    const tailCandidates = allRanking.slice(ACTION_PREVIEW_ITEMS);
    if (tailCandidates.length === 0) return [] as typeof allRanking;

    const sorted = [...tailCandidates]
      .sort((a, b) => {
        if (a.useCount !== b.useCount) return a.useCount - b.useCount;
        return a.componentName.localeCompare(b.componentName);
      });

    return isFullMode ? sorted : sorted.slice(0, ACTION_PREVIEW_ITEMS);
  }, [allRanking, isFullMode]);
  const priorityLongTail = useMemo(
    () =>
      priorityLongTailTotal.slice(
        0,
        isFullMode ? visiblePriorityLongTailCount : ACTION_PREVIEW_ITEMS,
      ),
    [isFullMode, priorityLongTailTotal, visiblePriorityLongTailCount],
  );

  const canExpandPriorityRanking =
    isFullMode && visiblePriorityRankingCount < priorityRankingTotal.length;
  const canCollapsePriorityRanking =
    isFullMode &&
    priorityRankingTotal.length > ACTION_PREVIEW_ITEMS &&
    !canExpandPriorityRanking;
  const canExpandPriorityUnused =
    isFullMode && visiblePriorityUnusedCount < priorityUnusedTotal.length;
  const canCollapsePriorityUnused =
    isFullMode &&
    priorityUnusedTotal.length > ACTION_PREVIEW_ITEMS &&
    !canExpandPriorityUnused;
  const canExpandPriorityLongTail =
    isFullMode && visiblePriorityLongTailCount < priorityLongTailTotal.length;
  const canCollapsePriorityLongTail =
    isFullMode &&
    priorityLongTailTotal.length > ACTION_PREVIEW_ITEMS &&
    !canExpandPriorityLongTail;

  useEffect(() => {
    setVisiblePriorityRankingCount(ACTION_PREVIEW_ITEMS);
    setVisiblePriorityUnusedCount(ACTION_PREVIEW_ITEMS);
    setVisiblePriorityLongTailCount(ACTION_PREVIEW_ITEMS);
  }, [projectId, componentType, days, isFullMode]);

  const formattedLastParsed = data?.lastParsedAt
    ? data.lastParsedAt.toLocaleString(i18n.language === 'ko' ? 'ko-KR' : 'en-US', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;
  return (
    <article
      className="vs-dashboard-panel-surface w-full rounded-xl border border-theme bg-theme-surface p-4"
      data-testid="dashboard-usage-insights"
    >
      <header className="mb-4 flex flex-wrap items-center justify-end gap-2">
        {projectId && (
          <p className="mr-auto text-xs text-theme-tertiary">{t('usageInsights.projectScoped')}</p>
        )}
        <div className="flex items-center gap-2">
          <label htmlFor="dashboard-usage-type" className="sr-only">
            {t('usageInsights.componentTypeLabel')}
          </label>
          <div className="relative">
            <select
              id="dashboard-usage-type"
              value={componentType}
              onChange={(event) => setComponentType(event.target.value as UsageFilterType)}
              className="h-8 appearance-none rounded-lg border border-theme bg-theme-elevated pl-3 pr-8 text-xs text-theme-primary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
            >
              <option value="all">{t('usageInsights.allTypes')}</option>
              <option value="skill">{t('usageInsights.typeSkill')}</option>
              <option value="command">{t('usageInsights.typeCommand')}</option>
              <option value="agent">{t('usageInsights.typeAgent')}</option>
              <option value="hook">{t('usageInsights.typeHook')}</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-theme-tertiary"
              aria-hidden="true"
            />
          </div>

          <label htmlFor="dashboard-usage-days" className="sr-only">
            {t('usageInsights.daysLabel')}
          </label>
          <div className="relative">
            <select
              id="dashboard-usage-days"
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              className="h-8 appearance-none rounded-lg border border-theme bg-theme-elevated pl-3 pr-8 text-xs text-theme-primary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
            >
              {DAYS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t('usageInsights.daysOption', { days: option })}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-theme-tertiary"
              aria-hidden="true"
            />
          </div>
        </div>
      </header>

      {isLoading && (
        <div role="status" aria-live="polite" aria-busy="true" className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-8 animate-pulse rounded-lg bg-theme-skeleton" />
          ))}
        </div>
      )}

      {!isLoading && isError && (
        <div
          className="rounded-lg border border-theme bg-theme-elevated p-3 text-xs text-theme-secondary"
          role="status"
        >
          <p>{t('usageInsights.loadError')}</p>
          {error instanceof Error && (
            <p className="mt-1 text-theme-tertiary">{error.message}</p>
          )}
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-2 h-7 rounded-md border border-theme px-2 text-xs font-medium text-theme-primary transition-colors hover:bg-theme-hover"
          >
            {t('refresh')}
          </button>
        </div>
      )}

      {!isLoading && !isError && (
        <div className="space-y-4">
          <section className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div
              data-testid="usage-kpi-top3"
              className="rounded-lg border border-theme bg-theme-elevated px-3 py-2"
            >
              <p className="text-[11px] uppercase tracking-[0.1em] text-theme-tertiary">
                {t('usageInsights.top3ConcentrationLabel')}
              </p>
              <p className="text-sm font-semibold tabular-nums text-theme-primary">
                {t('usageInsights.percentValue', { value: top3SharePercent })}
              </p>
            </div>
            <div
              data-testid="usage-kpi-unused-ratio"
              className="rounded-lg border border-theme bg-theme-elevated px-3 py-2"
            >
              <p className="text-[11px] uppercase tracking-[0.1em] text-theme-tertiary">
                {t('usageInsights.unusedRatioLabel')}
              </p>
              <p className="text-sm font-semibold tabular-nums text-theme-primary">
                {t('usageInsights.percentValue', { value: unusedRatioPercent })}
              </p>
            </div>
            <div
              data-testid="usage-kpi-cleanup"
              className="rounded-lg border border-theme bg-theme-elevated px-3 py-2"
            >
              <p className="text-[11px] uppercase tracking-[0.1em] text-theme-tertiary">
                {t('usageInsights.cleanupCandidatesLabel')}
              </p>
              <p className="text-sm font-semibold tabular-nums text-theme-primary">
                {t('usageInsights.countValue', { count: cleanupCandidateCount })}
              </p>
            </div>
          </section>

          {isFullMode ? (
            <section
              className="rounded-lg border border-theme bg-theme-elevated p-3"
              data-testid="usage-action-queue"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-theme-primary">
                  {t('usageInsights.priorityQueueTitle')}
                </h4>
                <p className="text-[11px] text-theme-tertiary">
                  {t('usageInsights.priorityQueueHint')}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <article className="rounded-md border border-theme bg-theme-surface p-3">
                  <p className="mb-2 text-xs font-medium text-theme-secondary">
                    {t('usageInsights.priorityRankingTitle')}
                  </p>
                  {priorityRanking.length === 0 ? (
                    <p className="text-xs text-theme-tertiary">{t('usageInsights.emptyRanking')}</p>
                  ) : (
                    <>
                      <ol
                        data-testid="usage-priority-ranking-list"
                        className="space-y-2"
                        aria-label={t('usageInsights.priorityRankingTitle')}
                      >
                        {priorityRanking.map((item, index) => (
                          <li
                            key={item.componentId ?? `${item.componentName}-priority-${index}`}
                            className="rounded-md border border-theme bg-theme-elevated"
                          >
                            <Link
                              to={getComponentNavigationTarget(item.componentName, item.componentId)}
                              className="flex items-start justify-between gap-3 rounded-md p-2 hover:bg-theme-hover"
                              aria-label={t('usageInsights.openComponentDetail', {
                                name: item.componentName,
                              })}
                            >
                              <div className="flex min-w-0 items-start gap-2">
                                <span
                                  className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums ${getRankingBadgeClass(index)}`}
                                  aria-label={t('usageInsights.rankAria', { rank: index + 1 })}
                                >
                                  {index + 1}
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-medium text-theme-primary">
                                    {item.componentName}
                                  </p>
                                  <p className="text-[11px] text-theme-tertiary">
                                    {t('usageInsights.useCount', { count: item.useCount })}
                                  </p>
                                </div>
                              </div>
                              <span className="text-[11px] tabular-nums text-theme-tertiary">
                                {t('usageInsights.percentValue', {
                                  value: totalUseCount > 0 ? Math.round((item.useCount / totalUseCount) * 100) : 0,
                                })}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ol>
                      {(canExpandPriorityRanking || canCollapsePriorityRanking) && (
                        <div className="mt-2 flex justify-center">
                          <button
                            type="button"
                            data-testid="usage-priority-ranking-more-button"
                            onClick={() => {
                              if (canExpandPriorityRanking) {
                                setVisiblePriorityRankingCount((prev) => prev + FULL_MORE_STEP);
                                return;
                              }
                              setVisiblePriorityRankingCount(ACTION_PREVIEW_ITEMS);
                            }}
                            className="rounded-md border border-theme px-3 py-1.5 text-xs font-medium text-theme-primary transition-colors hover:bg-theme-hover"
                          >
                            {canExpandPriorityRanking
                              ? t('usageInsights.showMoreButton', {
                                  count: priorityRankingTotal.length - visiblePriorityRankingCount,
                                })
                              : t('usageInsights.showLessButton')}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </article>

                <article className="rounded-md border border-theme bg-theme-surface p-3">
                  <p className="mb-2 text-xs font-medium text-theme-secondary">
                    {t('usageInsights.priorityUnusedTitle')}
                  </p>
                  {priorityUnused.length === 0 ? (
                    <p className="text-xs text-theme-tertiary">{t('usageInsights.emptyUnused')}</p>
                  ) : (
                    <>
                      <ul
                        data-testid="usage-priority-unused-list"
                        className="space-y-2"
                        aria-label={t('usageInsights.priorityUnusedTitle')}
                      >
                        {priorityUnused.map((item, index) => {
                          const ageDays = getUnusedAgeDays(item.createdAt);
                          const ageBadge = getUnusedAgeBadge(t, ageDays);

                          return (
                            <li
                              key={`${item.componentName}-priority-unused-${index}`}
                              className="rounded-md border border-theme bg-theme-elevated"
                            >
                              <Link
                                to={getComponentNavigationTarget(item.componentName)}
                                className="flex items-start justify-between gap-2 rounded-md p-2 hover:bg-theme-hover"
                                aria-label={t('usageInsights.unusedAgeAria', {
                                  name: item.componentName,
                                  label: ageBadge.label,
                                })}
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-medium text-theme-primary">
                                    {item.componentName}
                                  </p>
                                  <p className="text-[11px] text-theme-tertiary">
                                    {formatTypeLabel(t, item.componentType)}
                                  </p>
                                </div>
                                <span
                                  className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold tabular-nums ${getUnusedAgeBadgeClass(ageBadge.tone)}`}
                                >
                                  {ageBadge.label}
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                      {(canExpandPriorityUnused || canCollapsePriorityUnused) && (
                        <div className="mt-2 flex justify-center">
                          <button
                            type="button"
                            data-testid="usage-priority-unused-more-button"
                            onClick={() => {
                              if (canExpandPriorityUnused) {
                                setVisiblePriorityUnusedCount((prev) => prev + FULL_MORE_STEP);
                                return;
                              }
                              setVisiblePriorityUnusedCount(ACTION_PREVIEW_ITEMS);
                            }}
                            className="rounded-md border border-theme px-3 py-1.5 text-xs font-medium text-theme-primary transition-colors hover:bg-theme-hover"
                          >
                            {canExpandPriorityUnused
                              ? t('usageInsights.showMoreButton', {
                                  count: priorityUnusedTotal.length - visiblePriorityUnusedCount,
                                })
                              : t('usageInsights.showLessButton')}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </article>

                <article className="rounded-md border border-theme bg-theme-surface p-3">
                  <p className="mb-2 text-xs font-medium text-theme-secondary">
                    {t('usageInsights.priorityLongTailTitle')}
                  </p>
                  {priorityLongTail.length === 0 ? (
                    <p className="text-xs text-theme-tertiary">{t('usageInsights.emptyRanking')}</p>
                  ) : (
                    <>
                      <ol
                        data-testid="usage-priority-long-tail-list"
                        className="space-y-2"
                        aria-label={t('usageInsights.priorityLongTailTitle')}
                      >
                        {priorityLongTail.map((item, index) => (
                          <li
                            key={item.componentId ?? `${item.componentName}-priority-tail-${index}`}
                            className="rounded-md border border-theme bg-theme-elevated"
                          >
                            <Link
                              to={getComponentNavigationTarget(item.componentName, item.componentId)}
                              className="flex items-start justify-between gap-2 rounded-md p-2 hover:bg-theme-hover"
                              aria-label={t('usageInsights.openComponentDetail', {
                                name: item.componentName,
                              })}
                            >
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium text-theme-primary">
                                  {item.componentName}
                                </p>
                                <p className="text-[11px] text-theme-tertiary">
                                  {t('usageInsights.useCount', { count: item.useCount })}
                                </p>
                              </div>
                              <span className="shrink-0 rounded-full border border-theme bg-theme-hover px-2 py-1 text-[10px] font-semibold tabular-nums text-theme-secondary">
                                {index + 1}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ol>
                      {(canExpandPriorityLongTail || canCollapsePriorityLongTail) && (
                        <div className="mt-2 flex justify-center">
                          <button
                            type="button"
                            data-testid="usage-priority-long-tail-more-button"
                            onClick={() => {
                              if (canExpandPriorityLongTail) {
                                setVisiblePriorityLongTailCount((prev) => prev + FULL_MORE_STEP);
                                return;
                              }
                              setVisiblePriorityLongTailCount(ACTION_PREVIEW_ITEMS);
                            }}
                            className="rounded-md border border-theme px-3 py-1.5 text-xs font-medium text-theme-primary transition-colors hover:bg-theme-hover"
                          >
                            {canExpandPriorityLongTail
                              ? t('usageInsights.showMoreButton', {
                                  count: priorityLongTailTotal.length - visiblePriorityLongTailCount,
                                })
                              : t('usageInsights.showLessButton')}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </article>
              </div>
            </section>
          ) : (
            <section className="grid grid-cols-1 gap-2 lg:grid-cols-[1.25fr_1fr]" data-testid="usage-summary-focus">
              <article className="rounded-lg border border-theme bg-theme-elevated p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-theme-primary">
                    {t('usageInsights.priorityRankingTitle')}
                  </h4>
                  <span className="text-[11px] text-theme-tertiary">
                    {t('usageInsights.percentValue', { value: top3SharePercent })}
                  </span>
                </div>
                {priorityRanking.length === 0 ? (
                  <p className="text-xs text-theme-tertiary">{t('usageInsights.emptyRanking')}</p>
                ) : (
                  <>
                    <ol
                      data-testid="usage-priority-ranking-list"
                      className="space-y-2"
                      aria-label={t('usageInsights.priorityRankingTitle')}
                    >
                      {priorityRanking.map((item, index) => (
                        <li
                          key={item.componentId ?? `${item.componentName}-summary-${index}`}
                          className="rounded-md border border-theme bg-theme-surface"
                        >
                          <Link
                            to={getComponentNavigationTarget(item.componentName, item.componentId)}
                            className="flex items-start justify-between gap-3 rounded-md p-2 hover:bg-theme-hover"
                            aria-label={t('usageInsights.openComponentDetail', {
                              name: item.componentName,
                            })}
                          >
                            <div className="flex min-w-0 items-start gap-2">
                              <span
                                className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums ${getRankingBadgeClass(index)}`}
                                aria-label={t('usageInsights.rankAria', { rank: index + 1 })}
                              >
                                {index + 1}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium text-theme-primary">
                                  {item.componentName}
                                </p>
                                <p className="text-[11px] text-theme-tertiary">
                                  {t('usageInsights.useCount', { count: item.useCount })}
                                </p>
                              </div>
                            </div>
                            <span className="text-[11px] tabular-nums text-theme-tertiary">
                              {t('usageInsights.percentValue', {
                                value: totalUseCount > 0 ? Math.round((item.useCount / totalUseCount) * 100) : 0,
                              })}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-theme-hover">
                      <div
                        className="h-full rounded-full bg-[var(--color-primary)] transition-all"
                        style={{ width: `${top3SharePercent}%` }}
                        aria-hidden="true"
                      />
                    </div>
                  </>
                )}
              </article>

              <article
                className="rounded-lg border border-theme bg-theme-elevated p-3"
                data-testid="usage-summary-signals"
              >
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-theme-primary">
                  {t('usageInsights.summarySignalsTitle')}
                </h4>
                <ul className="space-y-1.5 text-xs text-theme-secondary">
                  <li className="flex items-center justify-between gap-2">
                    <span>{t('usageInsights.summaryLongTailLabel')}</span>
                    <strong className="text-theme-primary tabular-nums">
                      {t('usageInsights.percentValue', { value: longTailSharePercent })}
                    </strong>
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span>{t('usageInsights.summaryStale30Label')}</span>
                    <strong className="text-theme-primary tabular-nums">
                      {t('usageInsights.countValue', { count: cleanupCandidateCount })}
                    </strong>
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span>{t('usageInsights.summaryStale90Label')}</span>
                    <strong className="text-theme-primary tabular-nums">
                      {t('usageInsights.countValue', { count: staleUnused90Count })}
                    </strong>
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span>{t('usageInsights.summaryTimelineCoverageLabel')}</span>
                    <strong className="text-theme-primary tabular-nums">
                      {timelineCoveragePercent === null
                        ? t('usageInsights.notAvailable')
                        : t('usageInsights.percentValue', { value: timelineCoveragePercent })}
                    </strong>
                  </li>
                </ul>
              </article>
            </section>
          )}

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-theme pt-3 text-xs text-theme-tertiary">
            <span>{t('usageInsights.totalSessions', { count: data?.totalSessionsParsed ?? 0 })}</span>
            <span>
              {formattedLastParsed
                ? t('usageInsights.lastParsed', { date: formattedLastParsed })
                : t('usageInsights.lastParsedEmpty')}
            </span>
          </footer>
        </div>
      )}
    </article>
  );
}
