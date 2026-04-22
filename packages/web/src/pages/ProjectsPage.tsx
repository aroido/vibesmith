import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, EyeOff, Globe, Plus, RotateCcw } from 'lucide-react';
import { ANALYTICS_MASK_TEXT_CLASS } from '@/common/analytics/privacy';
import { PageFrame } from '@/components/common';
import {
  CreateProjectPresetModal,
} from '@/features/scan';
import { ProjectBar, useProjects, useUnhideProject } from '@/features/dashboard';

export function ProjectsPage() {
  const { t } = useTranslation(['navigation', 'dashboard', 'scan']);
  const { data: projects, isLoading } = useProjects();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isHiddenExpanded, setIsHiddenExpanded] = useState(false);
  const unhideProject = useUnhideProject();

  const { globalProject, regularProjects, hiddenProjects } = useMemo(() => {
    const list = [...(projects ?? [])];
    const global = list.find((p) => p.isGlobal) ?? null;
    const regular = list
      .filter((p) => !p.isGlobal && !p.hiddenAt)
      .sort((a, b) => {
        if (b.componentCount !== a.componentCount) return b.componentCount - a.componentCount;
        return a.name.localeCompare(b.name);
      });
    const hidden = list
      .filter((p) => !p.isGlobal && !!p.hiddenAt)
      .sort((a, b) => a.name.localeCompare(b.name));
    return { globalProject: global, regularProjects: regular, hiddenProjects: hidden };
  }, [projects]);

  const hasProjects = regularProjects.length > 0 || globalProject !== null;

  return (
    <PageFrame
      activeNav="projects"
      title={t('navigation:primary.projects')}
      subtitle={t('dashboard:projectBreakdown.summary', { count: regularProjects.length })}
      beforeTitle={
        !isLoading && globalProject ? (
          <section className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <Globe className="h-4 w-4 text-[var(--color-primary)]" aria-hidden />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">
                Global
              </h2>
            </div>
            <ProjectBar project={globalProject} />
          </section>
        ) : null
      }
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold btn-theme-surface"
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t('scan:createProjectAction')}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {!isLoading && !hasProjects && (
          <div className="rounded-2xl border border-theme bg-theme-surface p-8 text-center">
            <h2 className="text-lg font-semibold text-theme-primary">
              {t('dashboard:noProjects')}
            </h2>
            <p className="mt-2 text-sm text-theme-secondary">
              {t('scan:projectRootLabel')}
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-2 h-10 min-h-[40px] rounded-lg px-4 py-2 text-sm font-semibold btn-theme-surface"
              >
                <Plus className="h-4 w-4" aria-hidden />
                {t('scan:createProjectAction')}
              </button>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-xl border border-theme bg-theme-surface"
              />
            ))}
          </div>
        )}

        {!isLoading && regularProjects.length > 0 && (
          <div className="space-y-3" data-testid="projects-page-list">
            {regularProjects.map((project) => (
              <ProjectBar key={project.id} project={project} />
            ))}
          </div>
        )}

        {/* 숨긴 프로젝트 접이식 섹션 */}
        {!isLoading && hiddenProjects.length > 0 && (
          <section className="mt-6" data-testid="hidden-projects-section">
            <button
              type="button"
              onClick={() => setIsHiddenExpanded(!isHiddenExpanded)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-theme-tertiary transition-colors hover:bg-theme-hover hover:text-theme-secondary"
              aria-expanded={isHiddenExpanded}
            >
              {isHiddenExpanded ? (
                <ChevronDown className="h-4 w-4" aria-hidden />
              ) : (
                <ChevronRight className="h-4 w-4" aria-hidden />
              )}
              <EyeOff className="h-4 w-4" aria-hidden />
              <span>
                {t('dashboard:hiddenProjects', {
                  count: hiddenProjects.length,
                  defaultValue: `숨긴 프로젝트 (${hiddenProjects.length})`,
                })}
              </span>
            </button>

            {isHiddenExpanded && (
              <div className="mt-2 space-y-2 pl-2">
                {hiddenProjects.map((project) => (
                  <div
                    key={project.id}
                    className="group flex items-center gap-3 rounded-lg border border-theme bg-theme-surface/30 px-4 py-3 opacity-60 transition-opacity hover:opacity-80"
                    data-testid={`hidden-project-${project.id}`}
                  >
                    <EyeOff className="h-4 w-4 shrink-0 text-theme-tertiary" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-theme-secondary">
                        {project.name}
                      </span>
                      <span
                        className={`${ANALYTICS_MASK_TEXT_CLASS} block truncate text-xs font-mono text-theme-tertiary`}
                      >
                        {project.path}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => unhideProject.mutate(project.id)}
                      disabled={unhideProject.isPending}
                      className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-theme-secondary transition-colors hover:bg-theme-hover hover:text-[var(--color-primary)] disabled:opacity-50"
                      aria-label={t('dashboard:unhideProject', {
                        name: project.name,
                        defaultValue: `${project.name} 복원`,
                      })}
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                      {t('dashboard:restoreAction', { defaultValue: '복원' })}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <CreateProjectPresetModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </PageFrame>
  );
}
