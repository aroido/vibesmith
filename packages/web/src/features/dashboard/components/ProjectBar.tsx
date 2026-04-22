/**
 * Project Bar Component
 * Animated progress bar with component breakdown
 *
 * 펼침 시 실제 구성요소 목록 표시 (Issue #489)
 * - 개수 카드 제거, 실제 항목 목록으로 대체
 * - 각 항목 클릭 시 /components/{id} 상세 페이지 이동
 * - 빈 카테고리는 회색 처리
 *
 * Hide button: non-global, non-sample projects only (#28, #302)
 * - 글로벌 프로젝트: 숨기기 버튼 숨김 (백엔드 400 차단과 이중 보호)
 * - 샘플 프로젝트: SampleProjectBadge 별도 삭제 플로우
 * - 숨긴 프로젝트는 ProjectsPage 하단에서 복원 가능
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { EyeOff, Folder, FolderOpen, Globe, Package } from 'lucide-react';
import { ANALYTICS_MASK_TEXT_CLASS } from '@/common/analytics/privacy';
import type { Project } from '../types';
import { getTrendIcon, getTrendColorClass } from '../utils/helpers';
import { useDeleteProject } from '../hooks/useDashboardData';
import { useProjectComponentList } from '../hooks/useProjectComponentList';
import { ConfirmDeleteProjectModal } from './ConfirmDeleteProjectModal';
import { SampleProjectBadge } from './SampleProjectBadge';

const CATEGORY_CONFIG = [
  {
    key: 'skills' as const,
    labelKey: 'projectBar.skills',
    emptyClass: 'rounded bg-theme-surface/30 border border-theme opacity-60',
    filledClass:
      'rounded bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] border border-[color-mix(in_srgb,var(--color-primary)_32%,transparent)]',
    headingClass: 'text-[var(--color-primary)]',
    linkClass: 'text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]',
  },
  {
    key: 'agents' as const,
    labelKey: 'projectBar.agents',
    emptyClass: 'rounded bg-theme-surface/30 border border-theme opacity-60',
    filledClass:
      'rounded bg-[color-mix(in_srgb,#a855f7_10%,transparent)] border border-[color-mix(in_srgb,#a855f7_32%,transparent)]',
    headingClass: 'text-[#a855f7]',
    linkClass: 'text-[#c084fc] hover:text-[#e9d5ff]',
  },
  {
    key: 'commands' as const,
    labelKey: 'projectBar.cmds',
    emptyClass: 'rounded bg-theme-surface/30 border border-theme opacity-60',
    filledClass:
      'rounded bg-[color-mix(in_srgb,var(--color-state-success)_10%,transparent)] border border-[color-mix(in_srgb,var(--color-state-success)_32%,transparent)]',
    headingClass: 'text-[var(--color-state-success)]',
    linkClass: 'text-[var(--color-state-success)] hover:opacity-85',
  },
  {
    key: 'hooks' as const,
    labelKey: 'projectBar.hooks',
    emptyClass: 'rounded bg-theme-surface/30 border border-theme opacity-60',
    filledClass:
      'rounded bg-[color-mix(in_srgb,#f97316_10%,transparent)] border border-[color-mix(in_srgb,#f97316_32%,transparent)]',
    headingClass: 'text-[#f97316]',
    linkClass: 'text-[#fdba74] hover:text-[#ffedd5]',
  },
  {
    key: 'rules' as const,
    labelKey: 'projectBar.rules',
    emptyClass: 'rounded bg-theme-surface/30 border border-theme opacity-60',
    filledClass:
      'rounded bg-[color-mix(in_srgb,#3b82f6_10%,transparent)] border border-[color-mix(in_srgb,#3b82f6_32%,transparent)]',
    headingClass: 'text-[#60a5fa]',
    linkClass: 'text-[#93c5fd] hover:text-[#dbeafe]',
  },
] as const;

interface ProjectBarProps {
  project: Project;
  compact?: boolean;
}

export function ProjectBar({ project, compact = false }: ProjectBarProps) {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHideModalOpen, setIsHideModalOpen] = useState(false);
  const deleteProject = useDeleteProject();
  const { byType, isLoading } = useProjectComponentList(project.id, isExpanded);
  const ProjectIcon = project.isSample ? Package : project.isGlobal ? Globe : Folder;
  const hasProjectPath = Boolean(project.path?.trim());

  const moveToProjectDetail = () => {
    void navigate(`/projects/${project.id}`);
  };

  const handleCardClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('a, button, input, select, textarea')) {
      return;
    }
    moveToProjectDetail();
  };

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    const isSpaceKey = event.key === ' ' || event.key === 'Space' || event.key === 'Spacebar' || event.code === 'Space';
    if (event.key === 'Enter' || isSpaceKey) {
      event.preventDefault();
      moveToProjectDetail();
    }
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleHideClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsHideModalOpen(true);
  };

  const handleHideConfirm = () => {
    deleteProject.mutate(project.id);
    setIsHideModalOpen(false);
  };

  const handleHideCancel = () => setIsHideModalOpen(false);

  const handleSampleDelete = () => {
    // TODO: Implement sample project deletion
    deleteProject.mutate(project.id);
  };

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={t('projectBar.ariaDetail', { name: project.name })}
      data-testid={`project-bar-card-${project.id}`}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      className={`
        relative rounded-xl p-3 md:p-4
        backdrop-blur-sm cursor-pointer
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]
        transition-all duration-300
        ${project.isGlobal
          ? 'bg-[color-mix(in_srgb,var(--color-primary)_8%,var(--color-bg-surface))] border border-[color-mix(in_srgb,var(--color-primary)_28%,transparent)] hover:border-[color-mix(in_srgb,var(--color-primary)_50%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-primary)_12%,var(--color-bg-surface))]'
          : 'bg-theme-surface/40 border border-theme hover:border-[color-mix(in_srgb,var(--color-primary)_34%,transparent)] hover:bg-theme-surface/55'
        }
      `}
    >
      {/* Project name & percentage */}
      <div className="mb-2 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 items-center gap-2">
            {!project.isGlobal && (
              <span className="shrink-0 text-sm" aria-hidden>
                <ProjectIcon className="h-4 w-4 text-theme-tertiary" />
              </span>
            )}
            <span
              className={`min-w-0 truncate rounded font-bold text-theme-primary transition-colors hover:text-[var(--color-primary)] ${compact ? 'text-sm sm:text-base' : 'text-base sm:text-lg'}`}
            >
              {project.name}
            </span>
            {project.platforms?.length > 0 && (
              <div className="flex items-center gap-1">
                {project.platforms.map((p) => (
                  <span
                    key={p}
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium leading-tight ${
                      p === 'claude_code'
                        ? 'bg-[color-mix(in_srgb,#f97316_12%,transparent)] text-[#fb923c]'
                        : p === 'cursor'
                          ? 'bg-[color-mix(in_srgb,#3b82f6_12%,transparent)] text-[#60a5fa]'
                          : 'bg-theme-hover text-theme-tertiary'
                    }`}
                  >
                    {p === 'claude_code' ? 'Claude Code' : p === 'cursor' ? 'Cursor' : p}
                  </span>
                ))}
              </div>
            )}
            {project.isSample && (
              <div onClick={(e) => e.stopPropagation()}>
                <SampleProjectBadge
                  projectId={project.id}
                  projectName={project.name}
                  onDelete={handleSampleDelete}
                  isDeleting={deleteProject.isPending}
                />
              </div>
            )}
          </div>
          {!compact && (
            <div className="h-5">
              {hasProjectPath ? (
                <span
                  className={`${ANALYTICS_MASK_TEXT_CLASS} block truncate text-xs font-mono text-theme-tertiary`}
                  title={project.path}
                >
                  <span className="inline-flex items-center gap-1">
                    <FolderOpen className="h-3.5 w-3.5" aria-hidden />
                    {project.path}
                  </span>
                </span>
              ) : project.trend && !project.isSample ? (
                <span
                  className={`text-sm font-semibold ${getTrendColorClass(project.trend.direction)}`}
                >
                  {project.trend.value > 0 ? '+' : ''}
                  {project.trend.value} {getTrendIcon(project.trend.direction)}
                </span>
              ) : (
                <span aria-hidden />
              )}
            </div>
          )}
        </div>
        <div className="flex items-end gap-2 lg:justify-end">
          {!project.isGlobal && (
            <span className={`inline-flex justify-end font-bold font-mono leading-none tabular-nums text-[var(--color-primary)] ${compact ? 'w-[3.5rem] text-lg' : 'w-[4.25rem] text-2xl'}`}>
              {project.percentage}%
            </span>
          )}
          <span className={`inline-flex justify-end font-mono tabular-nums text-theme-secondary ${compact ? 'w-[3rem] text-xs' : 'w-[3.75rem] text-sm'}`}>
            [{project.componentCount}]
          </span>
          {!compact && !project.isGlobal && !project.isSample && (
            <button
              type="button"
              onClick={handleHideClick}
              disabled={deleteProject.isPending}
              data-testid={`project-bar-hide-${project.name}-button`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-theme px-3 py-1.5 text-xs font-medium text-theme-tertiary transition-colors hover:border-[color-mix(in_srgb,var(--color-state-warning)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-state-warning)_8%,transparent)] hover:text-[var(--color-state-warning)] disabled:opacity-50"
              aria-label={t('projectBar.ariaHide', { name: project.name })}
            >
              <EyeOff className="h-3.5 w-3.5" aria-hidden />
              {t('projectBar.hide')}
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {!project.isGlobal && <div className={`relative bg-theme-hover rounded-full overflow-hidden ${compact ? 'mb-1 h-2' : 'mb-2 h-3'}`}>
        <div
          className="
            absolute inset-y-0 left-0
            transition-all duration-1500 ease-out
            rounded-full
          "
          style={{
            width: `${project.percentage}%`,
            background:
              'linear-gradient(90deg, var(--color-primary), #a855f7, var(--color-primary))',
            animation: 'shimmer 2s infinite',
          }}
        />
      </div>}

      {compact && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-theme-secondary">
          <span>{t('projectBar.skills')} {project.breakdown.skills}</span>
          <span>{t('projectBar.agents')} {project.breakdown.agents}</span>
          <span>{t('projectBar.cmds')} {project.breakdown.commands}</span>
          <span>{t('projectBar.hooks')} {project.breakdown.hooks}</span>
          <span>{t('projectBar.rules')} {project.breakdown.rules}</span>
        </div>
      )}

      {/* Component breakdown */}
      {!compact && <div className="grid grid-cols-2 gap-2 text-xs font-mono text-theme-secondary sm:grid-cols-3 lg:grid-cols-[repeat(5,minmax(0,max-content))_1fr] lg:items-center">
        <span className="whitespace-nowrap rounded-md border border-theme bg-theme-hover/45 px-2 py-1 text-theme-primary">
          {t('projectBar.skills')} {project.breakdown.skills}
        </span>
        <span className="whitespace-nowrap rounded-md border border-theme bg-theme-hover/45 px-2 py-1 text-theme-primary">
          {t('projectBar.agents')} {project.breakdown.agents}
        </span>
        <span className="whitespace-nowrap rounded-md border border-theme bg-theme-hover/45 px-2 py-1 text-theme-primary">
          {t('projectBar.cmds')} {project.breakdown.commands}
        </span>
        <span className="whitespace-nowrap rounded-md border border-theme bg-theme-hover/45 px-2 py-1 text-theme-primary">
          {t('projectBar.hooks')} {project.breakdown.hooks}
        </span>
        <span className="whitespace-nowrap rounded-md border border-theme bg-theme-hover/45 px-2 py-1 text-theme-primary">
          {t('projectBar.rules')} {project.breakdown.rules}
        </span>
        <button
          type="button"
          onClick={handleExpandClick}
          data-testid={`project-bar-expand-${project.name}-button`}
          className="inline-flex h-7 w-7 items-center justify-center justify-self-end rounded-md text-[var(--color-primary)] transition-colors hover:bg-theme-hover hover:text-[var(--color-primary-hover)] lg:col-start-6"
          aria-label={isExpanded ? t('projectBar.collapse') : t('projectBar.expand')}
          aria-expanded={isExpanded}
        >
          {isExpanded ? '▲' : '▼'}
        </button>
      </div>}

      {/* Expanded details — 실제 항목 목록 (Issue #489) */}
      {!compact && isExpanded && (
        <div className="mt-4 pt-4 border-t border-theme space-y-4">
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {CATEGORY_CONFIG.map(({ key }) => (
                <div
                  key={key}
                  className="h-24 rounded bg-theme-surface/40 animate-pulse"
                  aria-hidden
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {CATEGORY_CONFIG.map((cfg) => {
                const items = byType[cfg.key];
                const isEmpty = items.length === 0;
                return (
                  <section
                    key={cfg.key}
                    className={`p-3 ${isEmpty ? cfg.emptyClass : cfg.filledClass}`}
                  >
                    <h4
                      className={`text-xs font-medium mb-2 ${
                        isEmpty ? 'text-theme-tertiary' : cfg.headingClass
                      }`}
                    >
                      {t(cfg.labelKey)}
                    </h4>
                    {isEmpty ? (
                      <p className="text-xs text-theme-tertiary">{t('projectBar.empty')}</p>
                    ) : (
                      <ul className="space-y-1" role="list">
                        {items.map((item) => (
                          <li key={item.id}>
                            <Link
                              to={`/components/${item.id}`}
                              className={`text-sm hover:underline block truncate ${cfg.linkClass}`}
                            >
                              {item.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          )}
          <div
            className={`${ANALYTICS_MASK_TEXT_CLASS} truncate text-xs text-theme-tertiary font-mono`}
          >
            <span className="inline-flex items-center gap-1">
              <FolderOpen className="h-3.5 w-3.5" aria-hidden />
              {project.path}
            </span>
          </div>
        </div>
      )}

      {!project.isSample && (
        <ConfirmDeleteProjectModal
          isOpen={isHideModalOpen}
          projectName={project.name}
          onConfirm={handleHideConfirm}
          onCancel={handleHideCancel}
        />
      )}
    </div>
  );
}
