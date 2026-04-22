/**
 * Dashboard Page - Cyberpunk Command Center (Spec §5.2)
 * Tailwind CSS only, 반응형, 접근성(a11y)
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DashboardHeader } from './DashboardHeader';
import { SystemStatusBanner } from './SystemStatusBanner';
import { StatsGrid } from './StatsGrid';
import { RecentActivityPanel } from './RecentActivityPanel';
import { ProjectBreakdownPanel } from './ProjectBreakdownPanel';
import { TypeDistributionChart } from './TypeDistributionChart';
import { UsageInsightsWidget } from './UsageInsightsWidget';
import { ContextOptimizerWidget } from './ContextOptimizerWidget';
import { ConflictBadgeWidget } from '@/features/skill-conflict-detection';
import { EmptyState } from './EmptyState';
import { PopularTags } from '@/features/tag-management';
import { useTagStats } from '@/features/tag-management';
import { ChartSkeleton } from './LoadingSkeleton';
import { formatRelativeTime } from '../utils/helpers';
import { useTheme } from '@/hooks/useTheme';
import {
  useDashboardStats,
  useSystemStatus,
  useRecentActivity,
  useProjects,
} from '../hooks/useDashboardData';
import { useSampleProject as useSampleProjectHook } from '../hooks/useSampleProject';
import { useKeyboardShortcuts, useKonamiCode } from '../hooks/useKeyboardShortcuts';
import { notify } from '@/common/utils/notify';

export function DashboardPage() {
  const { t } = useTranslation(['dashboard', 'navigation']);
  const { stylePreset } = useTheme();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isMatrixMode, setIsMatrixMode] = useState(false);

  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useDashboardStats(selectedProjectId);
  const { data: systemStatus, isLoading: statusLoading } = useSystemStatus();
  const { data: tagStats = [] } = useTagStats();
  const { data: recentActivity, isLoading: activityLoading } = useRecentActivity();
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { createSampleProject, isCreating: isCreatingSample } = useSampleProjectHook();

  useKeyboardShortcuts([
    { key: 'r', ctrl: true, handler: () => window.location.reload() },
  ]);

  useKonamiCode(() => {
    setIsMatrixMode(true);
    notify.success(t('dashboard:matrixModeActivated'));
    setTimeout(() => {
      setIsMatrixMode(false);
      notify.info(t('dashboard:matrixModeDeactivated'));
    }, 5000);
  });

  const handleDashboardToast = (message: string, type?: 'success' | 'error' | 'info') => {
    if (type === 'success') notify.success(message);
    else if (type === 'error') notify.error(message);
    else notify.info(message);
  };

  const isInitialLoading = statsLoading && statusLoading;
  const isHipPreset = stylePreset !== 'classic';
  const projectCount = projects?.length ?? 0;
  const isSystemLive = systemStatus?.isLive ?? false;
  const lastScanLabel = systemStatus
    ? formatRelativeTime(systemStatus.lastScanAt)
    : '--';
  const workers = systemStatus?.activeWorkers;
  const watcherLabel = workers ? (workers.watcher ? 'Active' : 'Down') : '--';
  const scannerLabel = workers ? (workers.usageScanner ? 'Active' : 'Down') : '--';
  const healthLabel = systemStatus ? `${systemStatus.healthScore}%` : '--';

  if (isInitialLoading) {
    return (
      <div
        className="min-h-screen bg-[var(--color-background)] text-[var(--color-text-primary)] p-4 md:p-6"
        role="main"
        id="main-content"
      >
        <div className="animate-pulse mb-8">
          <div className="h-10 bg-[var(--color-surface-hover)] rounded w-64 mb-2" />
          <div className="h-4 bg-[var(--color-surface-hover)] rounded w-96" />
        </div>
        <div className="h-20 bg-[var(--color-surface-elevated)] rounded-xl mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-40 rounded-2xl bg-[var(--color-card-bg)] border border-[var(--color-card-border)]"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen bg-[var(--color-background)] text-[var(--color-text-primary)] ${isMatrixMode ? 'matrix-mode' : ''}`}
    >
      <DashboardHeader
        projects={projects}
        selectedProjectId={selectedProjectId}
        onProjectChange={setSelectedProjectId}
      />

      <main
        id="main-content"
        className="mx-auto max-w-[88rem] p-4 md:p-6"
        role="main"
      >

        {/* Empty State: 프로젝트 또는 구성요소가 없을 때 */}
        {!statsLoading && stats && stats.totalCount === 0 && (
          <EmptyState
            onTrySample={() => createSampleProject()}
            onAddProject={() => void navigate('/settings')}
            isCreatingSample={isCreatingSample}
          />
        )}

        {/* Dashboard Content: 구성요소가 있을 때만 표시 */}
        {stats && stats.totalCount > 0 && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 xl:items-start">
            <div className="space-y-6 xl:col-span-8">
              {isHipPreset && (
                <section className="vs-dashboard-hero vs-frost-panel">
                  <div className="vs-dashboard-hero-main">
                    <span className="vs-dashboard-hero-label">
                      {t('controlDeck.eyebrow')}
                    </span>
                    <h2 className="vs-dashboard-hero-title">
                      {selectedProjectId
                        ? t('controlDeck.projectMode')
                        : t('controlDeck.allMode')}
                    </h2>
                    <p className="vs-dashboard-hero-copy">{t('controlDeck.scopeHint')}</p>
                    <div className="vs-dashboard-kpi-grid">
                      <article className="vs-dashboard-kpi">
                        <strong>{stats.totalCount}</strong>
                        <span>{t('overview')}</span>
                      </article>
                      <article className="vs-dashboard-kpi">
                        <strong>{stats.activeCount}</strong>
                        <span>{t('stats.activeSleep')}</span>
                      </article>
                      <article className="vs-dashboard-kpi">
                        <strong>{projectCount}</strong>
                        <span>{t('navigation:primary.projects')}</span>
                      </article>
                    </div>
                  </div>
                  <aside className="vs-dashboard-hero-side" aria-label={t('systemStatus.title')}>
                    <header>
                      <h3>{t('systemStatus.title')}</h3>
                      <span
                        className={`vs-dashboard-live-pill ${isSystemLive ? 'is-live' : 'is-offline'}`}
                      >
                        {isSystemLive ? t('systemStatus.live') : t('systemStatus.offline')}
                      </span>
                    </header>
                    <div className="vs-dashboard-status-grid">
                      <article className="vs-dashboard-status-card">
                        <small>{t('systemStatus.lastScan')}</small>
                        <b>{lastScanLabel}</b>
                      </article>
                      <article className="vs-dashboard-status-card">
                        <small>{t('systemStatus.watcher')}</small>
                        <b>{watcherLabel}</b>
                      </article>
                      <article className="vs-dashboard-status-card">
                        <small>{t('systemStatus.scanner')}</small>
                        <b>{scannerLabel}</b>
                      </article>
                      <article className="vs-dashboard-status-card">
                        <small>{t('systemStatus.health')}</small>
                        <b>{healthLabel}</b>
                      </article>
                    </div>
                  </aside>
                </section>
              )}

              <section className="vs-frost-panel vs-card-lift rounded-2xl p-4 md:p-6">
                <h2 className="mb-4 text-lg font-semibold text-theme-primary">
                  {t('overview')}
                </h2>
                <StatsGrid stats={stats} isLoading={statsLoading} />
              </section>

              <div>
                <ProjectBreakdownPanel
                  projects={projects ?? undefined}
                  isLoading={projectsLoading}
                  onTrySample={() => createSampleProject()}
                  onAddProject={() => void navigate('/settings')}
                  isCreatingSample={isCreatingSample}
                />
              </div>

              <div>
                <RecentActivityPanel
                  activities={recentActivity ?? undefined}
                  isLoading={activityLoading}
                />
              </div>

              {tagStats.length > 0 && (
                <div className="vs-frost-panel vs-card-lift self-start rounded-xl p-6">
                  <h2 className="mb-3 text-lg font-semibold text-theme-primary">
                    {t('dashboard:popularTags')}
                  </h2>
                  <PopularTags tags={tagStats} maxTags={10} />
                </div>
              )}
            </div>

            <div className="space-y-6 xl:col-span-4">
              <div className="grid self-start h-fit gap-4">
                {!isHipPreset && systemStatus && <SystemStatusBanner status={systemStatus} />}
                <ConflictBadgeWidget onToast={handleDashboardToast} />
                <ContextOptimizerWidget onToast={handleDashboardToast} />
              </div>

              <section className="vs-frost-panel vs-card-lift self-start h-fit rounded-2xl p-4 md:p-6">
                <h2 className="mb-4 text-lg font-semibold text-theme-primary">
                  {t('insights')}
                </h2>
                <div className="grid grid-cols-1 gap-4">
                  {statsLoading ? (
                    <>
                      <ChartSkeleton />
                      <ChartSkeleton />
                    </>
                  ) : (
                    <>
                      <TypeDistributionChart stats={stats} />
                      <UsageInsightsWidget projectId={selectedProjectId} displayMode="summary" />
                      <button
                        type="button"
                        onClick={() => void navigate('/components/analysis')}
                        className="h-9 rounded-lg border border-theme bg-theme-surface px-3 text-sm font-medium text-theme-primary transition-colors hover:bg-theme-hover"
                        data-testid="dashboard-open-usage-analysis"
                      >
                        {t('usageInsights.openAnalysis')}
                      </button>
                    </>
                  )}
                </div>
              </section>

            </div>
          </div>
        )}

        {isMatrixMode && (
          <div
            className="fixed inset-0 pointer-events-none z-40"
            aria-hidden
          >
            <div className="absolute inset-0 animate-pulse bg-[color-mix(in_srgb,var(--color-state-success)_8%,transparent)]" />
            <div className="absolute top-0 left-0 right-0 text-theme-success font-mono text-xs opacity-30 overflow-hidden">
              {Array.from({ length: 50 }).map((_, i) => (
                <div
                  key={i}
                  className="inline-block animate-pulse"
                  style={{
                    animationDelay: `${i * 0.1}s`,
                    animationDuration: '2s',
                  }}
                >
                  01010101
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
