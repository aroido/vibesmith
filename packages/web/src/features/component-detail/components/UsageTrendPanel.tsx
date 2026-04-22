import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ComponentUsageTimelineEntry } from '../types';

interface UsageTrendPanelProps {
  usageList: ComponentUsageTimelineEntry[];
  locale: string;
  usageLoading: boolean;
  isUsageError: boolean;
  onRetry: () => void;
}

interface HeatmapCell {
  date: string;
  count: number;
  intensity: number;
}

const DAILY_HEATMAP_DAYS = 84;
const WEEKLY_PERIODS = 12;

function parseDateOnly(dateText: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function startOfUtcWeek(date: Date): Date {
  return addUtcDays(date, -date.getUTCDay());
}

function endOfUtcWeek(date: Date): Date {
  return addUtcDays(date, 6 - date.getUTCDay());
}

function formatUsageDate(dateText: string, locale: string, withWeekday: boolean = false): string {
  try {
    const parsed = parseDateOnly(dateText);
    if (!parsed) return dateText;

    return parsed.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
      month: '2-digit',
      day: '2-digit',
      ...(withWeekday ? { weekday: 'short' as const } : {}),
    });
  } catch {
    return dateText;
  }
}

function formatMonthDay(date: Date, locale: string): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return locale === 'ko' ? `${month}.${day}` : `${month}/${day}`;
}

function formatWeeklyRange(dateText: string, locale: string): string {
  const end = parseDateOnly(dateText);
  if (!end) return dateText;
  const start = addUtcDays(end, -6);
  return `${formatMonthDay(start, locale)}~${formatMonthDay(end, locale)}`;
}

function getHeatLevel(count: number, intensity: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || intensity <= 0) return 0;
  if (intensity >= 0.8) return 4;
  if (intensity >= 0.6) return 3;
  if (intensity >= 0.35) return 2;
  return 1;
}

function getHeatClass(level: 0 | 1 | 2 | 3 | 4): string {
  switch (level) {
    case 1:
      return 'usage-heat-level-1';
    case 2:
      return 'usage-heat-level-2';
    case 3:
      return 'usage-heat-level-3';
    case 4:
      return 'usage-heat-level-4';
    case 0:
    default:
      return 'usage-heat-level-0';
  }
}

function buildHeatmapWeeks(timeline: ComponentUsageTimelineEntry[]): HeatmapCell[][] {
  if (timeline.length === 0) return [];

  const sorted = [...timeline].sort((a, b) => a.date.localeCompare(b.date));
  const latestDate = parseDateOnly(sorted[sorted.length - 1]?.date ?? '');
  if (!latestDate) return [];

  const byDate = new Map<string, ComponentUsageTimelineEntry>(
    timeline.map((entry) => [entry.date, entry])
  );

  const startDate = addUtcDays(latestDate, -(DAILY_HEATMAP_DAYS - 1));
  const start = startOfUtcWeek(startDate);
  const end = endOfUtcWeek(latestDate);

  const cells: HeatmapCell[] = [];
  for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = addUtcDays(cursor, 1)) {
    const date = toDateOnly(cursor);
    const fromTimeline = byDate.get(date);
    cells.push({
      date,
      count: fromTimeline?.count ?? 0,
      intensity: fromTimeline?.intensity ?? 0,
    });
  }

  const weeks: HeatmapCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function buildWeeklyTimelineFromDaily(
  timeline: ComponentUsageTimelineEntry[]
): ComponentUsageTimelineEntry[] {
  if (timeline.length === 0) return [];

  const sorted = [...timeline].sort((a, b) => a.date.localeCompare(b.date));
  const latestDate = parseDateOnly(sorted[sorted.length - 1]?.date ?? '');
  if (!latestDate) return [];

  const byDate = new Map<string, ComponentUsageTimelineEntry>(
    timeline.map((entry) => [entry.date, entry])
  );

  const weeklyRaw: ComponentUsageTimelineEntry[] = [];

  for (let offset = WEEKLY_PERIODS - 1; offset >= 0; offset -= 1) {
    const weekEnd = addUtcDays(latestDate, -offset * 7);
    const weekStart = addUtcDays(weekEnd, -6);

    let count = 0;
    for (let day = 0; day < 7; day += 1) {
      const date = toDateOnly(addUtcDays(weekStart, day));
      count += byDate.get(date)?.count ?? 0;
    }

    weeklyRaw.push({
      date: toDateOnly(weekEnd),
      count,
      intensity: 0,
    });
  }

  const maxCount = Math.max(1, ...weeklyRaw.map((item) => item.count));
  return weeklyRaw.map((item) => ({
    ...item,
    intensity: item.count / maxCount,
  }));
}

export function UsageTrendPanel({
  usageList,
  locale,
  usageLoading,
  isUsageError,
  onRetry,
}: UsageTrendPanelProps) {
  const { t } = useTranslation(['components', 'common']);

  const summary = useMemo(() => {
    const totalUsage = usageList.reduce((sum, item) => sum + item.count, 0);
    const activeDays = usageList.filter((item) => item.count > 0).length;
    const sortedByDateDesc = [...usageList].sort((a, b) => b.date.localeCompare(a.date));
    const lastUsed = sortedByDateDesc.find((item) => item.count > 0)?.date ?? null;
    return {
      totalUsage,
      activeDays,
      lastUsed,
      hasActivity: activeDays > 0,
    };
  }, [usageList]);

  const dailyHeatmapWeeks = useMemo(() => buildHeatmapWeeks(usageList), [usageList]);
  const weeklyTimeline = useMemo(() => buildWeeklyTimelineFromDaily(usageList), [usageList]);

  const weeklyActiveCount = useMemo(
    () => weeklyTimeline.filter((item) => item.count > 0).length,
    [weeklyTimeline]
  );

  const weeklyLatest = weeklyTimeline.length > 0 ? weeklyTimeline[weeklyTimeline.length - 1] : null;
  const weeklyFirst = weeklyTimeline.length > 0 ? weeklyTimeline[0] : null;
  const weeklyMiddle =
    weeklyTimeline.length > 0
      ? weeklyTimeline[Math.floor((weeklyTimeline.length - 1) / 2)]
      : null;


  return (
    <section className="vs-frost-panel rounded-xl p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm uppercase tracking-[0.15em] text-theme-secondary">
          {t('components:detail.usageTrend')}
        </h2>
        <span className="rounded-full border border-theme bg-theme-elevated px-2 py-0.5 text-[10px] font-medium text-theme-secondary">
          {t('components:detail.usageTrendIntegratedHint')}
        </span>
      </div>

      {!usageLoading && !isUsageError && (
        <div className="mb-3 grid grid-cols-3 gap-2">
          <article className="rounded-lg border border-theme bg-theme-elevated px-2.5 py-2">
            <p className="text-[11px] text-theme-secondary">
              {t('components:detail.usageTrendTotalUsage')}
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-theme-primary">{summary.totalUsage}</p>
          </article>
          <article className="rounded-lg border border-theme bg-theme-elevated px-2.5 py-2">
            <p className="text-[11px] text-theme-secondary">
              {t('components:detail.usageTrendActiveDays')}
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-theme-primary">{summary.activeDays}</p>
          </article>
          <article className="rounded-lg border border-theme bg-theme-elevated px-2.5 py-2">
            <p className="text-[11px] text-theme-secondary">
              {t('components:detail.usageTrendLastUsed')}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-theme-primary">
              {summary.lastUsed
                ? formatUsageDate(summary.lastUsed, locale, true)
                : t('components:detail.usageTrendLastUsedEmpty')}
            </p>
          </article>
        </div>
      )}

      {usageLoading && (
        <div role="status" aria-live="polite" aria-busy="true" className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-8 animate-pulse rounded-lg bg-theme-skeleton" />
          ))}
        </div>
      )}

      {!usageLoading && isUsageError && (
        <div className="rounded-lg border border-theme bg-theme-elevated p-3 text-xs text-theme-secondary">
          <p>{t('components:detail.usageTrendLoadError')}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 h-7 rounded-md border border-theme px-2 text-xs font-medium text-theme-primary transition-colors hover:bg-theme-hover"
          >
            {t('common:retry')}
          </button>
        </div>
      )}

      {!usageLoading && !isUsageError && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section className="rounded-lg border border-theme bg-theme-elevated p-3">
            <p className="mb-2 text-xs font-medium text-theme-secondary">
              {t('components:detail.usageTrendDailyPanelTitle')}
            </p>
            <p className="mb-2 text-[11px] text-theme-secondary">
              {t('components:detail.usageTrendHeatmapHint', { days: DAILY_HEATMAP_DAYS })}
            </p>
            <div className="rounded-lg border border-theme bg-theme-surface p-2.5">
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(dailyHeatmapWeeks.length, 1)}, minmax(0, 1fr))`,
                }}
                aria-label={t('components:detail.usageTrendHeatmapAria')}
              >
                {dailyHeatmapWeeks.map((week, weekIndex) => (
                  <div key={`week-${weekIndex}`} className="grid grid-rows-7 gap-1.5">
                    {week.map((cell) => {
                      const level = getHeatLevel(cell.count, cell.intensity);
                      const cellLabel = t('components:detail.usageTrendCellAria', {
                        date: formatUsageDate(cell.date, locale, true),
                        count: cell.count,
                      });

                      return (
                        <div
                          key={cell.date}
                          role="img"
                          aria-label={cellLabel}
                          title={cellLabel}
                          className={`aspect-square w-full rounded-[6px] border border-theme ${getHeatClass(level)}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-theme-secondary">
              <span>{t('components:detail.usageTrendLegendLow')}</span>
              {[0, 1, 2, 3, 4].map((level) => (
                <span
                  key={`legend-${level}`}
                  className={`h-3.5 w-3.5 rounded-[3px] border border-theme ${getHeatClass(level as 0 | 1 | 2 | 3 | 4)}`}
                  aria-hidden
                />
              ))}
              <span>{t('components:detail.usageTrendLegendHigh')}</span>
            </div>
            <p className="mt-2 text-[11px] text-theme-secondary">
              {t('components:detail.usageTrendDailyZeroHint')}
            </p>
          </section>

          <section className="rounded-lg border border-theme bg-theme-elevated p-3">
            <p className="mb-2 text-xs font-medium text-theme-secondary">
              {t('components:detail.usageTrendWeeklyPanelTitle')}
            </p>
            {weeklyLatest && (
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs text-theme-secondary">
                  {formatWeeklyRange(weeklyLatest.date, locale)}
                </span>
                <span className="text-xs font-semibold tabular-nums text-theme-primary">
                  {t('components:detail.usageTrendCount', { count: weeklyLatest.count })}
                </span>
              </div>
            )}

            <div className="rounded-lg border border-theme bg-theme-surface px-2.5 py-2">
              <div
                className="grid h-72 grid-cols-12 items-end gap-1.5"
                aria-label={t('components:detail.usageTrendWeeklyBarsAria')}
              >
                {weeklyTimeline.map((item) => {
                  const level = getHeatLevel(item.count, item.intensity);
                  const cellLabel = t('components:detail.usageTrendCellAria', {
                    date: formatWeeklyRange(item.date, locale),
                    count: item.count,
                  });
                  const heightPercent =
                    item.count > 0
                      ? Math.max(Math.round(item.intensity * 100), 18)
                      : 8;

                  return (
                    <div key={item.date} className="flex h-full items-end">
                      <div className="flex h-full w-full items-end overflow-hidden rounded-[4px] bg-theme-skeleton/60">
                        <div
                          role="img"
                          aria-label={cellLabel}
                          title={cellLabel}
                          className={`w-full rounded-[4px] border border-theme transition-all ${getHeatClass(level)} ${item.count > 0 ? 'opacity-100' : 'opacity-60'}`}
                          style={{
                            height: `${heightPercent}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 grid grid-cols-3 text-[11px] text-theme-secondary">
                <span>
                  {weeklyFirst ? formatWeeklyRange(weeklyFirst.date, locale) : ''}
                </span>
                <span className="text-center">
                  {weeklyMiddle ? formatWeeklyRange(weeklyMiddle.date, locale) : ''}
                </span>
                <span className="text-right">
                  {weeklyLatest ? formatWeeklyRange(weeklyLatest.date, locale) : ''}
                </span>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-theme-secondary">
              {t('components:detail.usageTrendWeeklySummary', {
                active: weeklyActiveCount,
                total: weeklyTimeline.length,
              })}
            </p>
            <p className="mt-1 text-[11px] text-theme-secondary">
              {t('components:detail.usageTrendWeeklyZeroHint')}
            </p>
          </section>
        </div>
      )}
    </section>
  );
}
