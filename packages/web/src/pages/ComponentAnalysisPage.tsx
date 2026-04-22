import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { ComponentWorkspaceTabs, PageFrame } from '@/components/common';
import { ConflictBadgeWidget } from '@/features/skill-conflict-detection';
import {
  ContextOptimizerWidget,
  ProjectSelector,
  TypeDistributionChart,
  UsageTreemapPanel,
  useDashboardStats,
  useProjects,
} from '@/features/dashboard';
import { notify } from '@/common/utils/notify';

export function ComponentAnalysisPage() {
  const { t } = useTranslation(['components', 'dashboard']);
  const [searchParams] = useSearchParams();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    searchParams.get('project')
  );
  const { data: projects } = useProjects();
  const { data: stats, isLoading: statsLoading } = useDashboardStats(selectedProjectId);

  const handleToast = (
    message: string,
    type: 'success' | 'error' | 'info'
  ) => {
    if (type === 'success') notify.success(message);
    else if (type === 'error') notify.error(message);
    else notify.info(message);
  };

  return (
    <PageFrame
      activeNav="components"
      title={t('components:workspace.analysis.title')}
      subtitle={t('components:workspace.analysis.subtitle')}
      contentClassName="max-w-[96rem] mx-auto"
    >
      <div className="space-y-6">
        <ComponentWorkspaceTabs active="analysis" />

        <div className="flex items-center justify-between rounded-xl border border-theme bg-theme-surface/60 px-4 py-2.5 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-theme-secondary">
              {selectedProjectId
                ? projects?.find((p) => p.id === selectedProjectId)?.name ?? ''
                : t('dashboard:projectSelector.allProjects')}
            </span>
            {stats && (
              <>
                <span className="text-theme-tertiary">·</span>
                <span className="font-mono text-theme-tertiary">
                  {stats.totalCount} {t('components:workspace.analysis.components', { defaultValue: 'components' })}
                </span>
              </>
            )}
          </div>
          {projects && projects.length > 0 && (
            <ProjectSelector
              projects={projects}
              currentProjectId={selectedProjectId}
              onProjectChange={(projectId) =>
                setSelectedProjectId(projectId === 'all' ? null : projectId)
              }
            />
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-stretch">
          <ContextOptimizerWidget
            projectId={selectedProjectId ?? undefined}
            onToast={(message, type) => handleToast(message, type)}
          />

          {statsLoading || !stats ? (
            <div
              className="min-h-[16rem] animate-pulse rounded-xl border border-theme bg-theme-surface p-4 md:p-5"
              role="status"
              aria-live="polite"
              aria-label={t('dashboard:typeDistribution.title')}
            >
              <div className="h-5 w-36 rounded bg-theme-hover" />
              <div className="mt-4 h-40 rounded bg-theme-hover" />
            </div>
          ) : (
            <TypeDistributionChart stats={stats} />
          )}
        </div>

        <section className="vs-frost-panel vs-card-lift rounded-2xl p-4 md:p-6">
          <h2 className="mb-4 text-lg font-semibold text-theme-primary">
            {t('dashboard:usageInsightsV2.title')}
          </h2>
          <UsageTreemapPanel projectId={selectedProjectId} />
        </section>

        <ConflictBadgeWidget onToast={handleToast} />
      </div>
    </PageFrame>
  );
}
