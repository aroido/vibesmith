/**
 * Type Distribution Chart Component
 * Simple donut chart showing component type distribution
 */

import { useTranslation } from 'react-i18next';
import type { DashboardStats } from '../types';

interface TypeDistributionChartProps {
  stats: DashboardStats;
}

export function TypeDistributionChart({ stats }: TypeDistributionChartProps) {
  const { t } = useTranslation('dashboard');
  const total = stats.totalCount;

  const data = [
    {
      type: t('typeDistribution.labels.skills'),
      count: stats.totalSkills,
      color: '#22d3ee',
      percentage: (stats.totalSkills / total) * 100,
    },
    {
      type: t('typeDistribution.labels.agents'),
      count: stats.totalAgents,
      color: '#c084fc',
      percentage: (stats.totalAgents / total) * 100,
    },
    {
      type: t('typeDistribution.labels.commands'),
      count: stats.totalCommands,
      color: '#4ade80',
      percentage: (stats.totalCommands / total) * 100,
    },
    {
      type: t('typeDistribution.labels.hooks'),
      count: stats.totalHooks,
      color: '#fb923c',
      percentage: (stats.totalHooks / total) * 100,
    },
    {
      type: t('typeDistribution.labels.rules'),
      count: stats.totalRules,
      color: '#60a5fa',
      percentage: (stats.totalRules / total) * 100,
    },
  ];

  // Calculate cumulative percentages for donut segments
  let cumulativePercentage = 0;
  const segments = data.map((item) => {
    const startPercentage = cumulativePercentage;
    cumulativePercentage += item.percentage;
    return {
      ...item,
      startPercentage,
      endPercentage: cumulativePercentage,
    };
  });

  return (
    <div className="vs-dashboard-panel-surface min-h-[16rem] rounded-xl border border-theme bg-theme-surface p-4 backdrop-blur-md md:p-5">
      <h3 className="vs-dashboard-panel-title mb-4 text-base font-semibold text-theme-primary">{t('typeDistribution.title')}</h3>

      <div className="grid gap-5 2xl:grid-cols-[auto_minmax(0,1fr)] 2xl:items-center">
        {/* Donut Chart */}
        <div className="relative mx-auto h-36 w-36 shrink-0 md:h-40 md:w-40 2xl:mx-0">
          <svg viewBox="0 0 100 100" className="transform -rotate-90 overflow-visible">
            {segments.map((segment) => {
              const radius = 40;
              const circumference = 2 * Math.PI * radius;
              const strokeDasharray = `${(segment.percentage / 100) * circumference} ${circumference}`;
              const strokeDashoffset = -((segment.startPercentage / 100) * circumference);

              return (
                <circle
                  key={segment.type}
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="15"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-500"
                  style={{
                    filter: `drop-shadow(0 0 8px ${segment.color}80)`,
                  }}
                />
              );
            })}
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl font-bold font-mono tabular-nums text-theme-primary">{total}</div>
              <div className="text-xs text-theme-secondary">{t('typeDistribution.total')}</div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-2">
          {data.map((item) => (
            <div key={item.type} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: item.color,
                    boxShadow: `0 0 8px ${item.color}80`,
                  }}
                />
                <span className="break-keep whitespace-nowrap text-sm text-theme-secondary">{item.type}</span>
              </div>
              <div className="grid justify-items-end leading-tight tabular-nums text-right">
                <span className="text-sm font-bold text-theme-primary">{item.count}</span>
                <span className="mt-0.5 whitespace-nowrap text-xs text-theme-tertiary">
                  ({item.percentage.toFixed(1)}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
