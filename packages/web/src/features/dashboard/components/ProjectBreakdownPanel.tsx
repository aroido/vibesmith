/**
 * Project Breakdown Panel - Animated progress bars (Spec §5.3)
 * EmptyState when no projects (Quick Start v1.7.0)
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Project } from '../types';
import { ProjectBar } from './ProjectBar';
import { ProjectBarSkeleton } from './LoadingSkeleton';
import { EmptyState } from './EmptyState';

interface ProjectBreakdownPanelProps {
  projects: Project[] | null | undefined;
  isLoading: boolean;
  /** Quick Start: handlers when empty */
  onTrySample?: () => void;
  onAddProject?: () => void;
  isCreatingSample?: boolean;
}

type ProjectSort = 'coverage_desc' | 'coverage_asc' | 'components_desc' | 'name_asc';
const DASHBOARD_PROJECT_LIMIT = 6;

export function ProjectBreakdownPanel({
  projects,
  isLoading,
  onTrySample,
  onAddProject,
  isCreatingSample = false,
}: ProjectBreakdownPanelProps) {
  const { t } = useTranslation('dashboard');
  const [sortBy, setSortBy] = useState<ProjectSort>('coverage_desc');
  const projectList = useMemo(() => projects ?? [], [projects]);
  const isEmpty = !isLoading && (!projects || projects.length === 0);
  const showEmptyState = isEmpty && onTrySample && onAddProject;

  const sortedProjects = useMemo(() => {
    const list = [...projectList];

    list.sort((a, b) => {
      switch (sortBy) {
        case 'coverage_asc':
          return a.percentage - b.percentage;
        case 'components_desc':
          return b.componentCount - a.componentCount || b.percentage - a.percentage;
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'coverage_desc':
        default:
          return b.percentage - a.percentage;
      }
    });

    return list;
  }, [projectList, sortBy]);

  const visibleProjects = useMemo(
    () => sortedProjects.slice(0, DASHBOARD_PROJECT_LIMIT),
    [sortedProjects]
  );

  return (
    <section
      aria-label={t('projectBreakdown.sectionAria')}
      className="vs-dashboard-panel-shell space-y-4"
    >
      <h2 className="vs-dashboard-panel-title text-xl font-semibold md:text-2xl">
        {t('projectBreakdown.title')}
      </h2>

      {isLoading && (
        <>
          {Array.from({ length: 3 }).map((_, i) => (
            <ProjectBarSkeleton key={i} />
          ))}
        </>
      )}

      {!isLoading && projects && projects.length > 0 && (
        <div className="space-y-3">
          <div className="vs-dashboard-panel-headrow flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-mono text-theme-tertiary">
                {t('projectBreakdown.summary', { count: projectList.length })}
              </p>
              <p className="text-xs text-theme-tertiary">
                {t('projectBreakdown.showingTop', { shown: visibleProjects.length })}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="dashboard-project-sort" className="text-xs text-theme-tertiary">
                {t('projectBreakdown.sortLabel')}
              </label>
              <select
                id="dashboard-project-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as ProjectSort)}
                className="h-8 rounded-lg border border-theme bg-theme-surface px-2 text-xs text-theme-primary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
              >
                <option value="coverage_desc">{t('projectBreakdown.sortCoverageDesc')}</option>
                <option value="coverage_asc">{t('projectBreakdown.sortCoverageAsc')}</option>
                <option value="components_desc">{t('projectBreakdown.sortComponentsDesc')}</option>
                <option value="name_asc">{t('projectBreakdown.sortNameAsc')}</option>
              </select>
            </div>
          </div>

          <ul
            className="vs-dashboard-panel-list m-0 grid list-none grid-cols-1 gap-2 p-0 xl:grid-cols-2"
            aria-label={t('projectBreakdown.listAria')}
            data-testid="project-list"
          >
            {visibleProjects.map((project) => (
              <li key={project.id} data-testid="project-item">
                <ProjectBar project={project} compact />
              </li>
            ))}
          </ul>

        </div>
      )}

      {showEmptyState && (
        <div
          className="rounded-xl bg-theme-surface backdrop-blur-md border border-theme"
          role="status"
        >
          <EmptyState
            onTrySample={onTrySample}
            onAddProject={onAddProject}
            isCreatingSample={isCreatingSample}
          />
        </div>
      )}

      {isEmpty && !showEmptyState && (
        <div
          className="p-8 text-center rounded-xl bg-theme-surface backdrop-blur-md border border-theme"
          role="status"
        >
          <p className="text-theme-secondary font-mono">{t('projectBreakdown.noProjects')}</p>
        </div>
      )}
    </section>
  );
}
