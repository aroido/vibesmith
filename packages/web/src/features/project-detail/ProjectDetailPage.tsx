/**
 * ProjectDetailPage Component
 * v1.10.0 - 프로젝트 상세 페이지
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, EyeOff, FolderOpen, LayoutGrid, MonitorSmartphone, Terminal } from 'lucide-react';
import { ANALYTICS_MASK_TEXT_CLASS } from '@/common/analytics/privacy';
import { showErrorToast, showSuccessToast } from '@/common/utils';
import { ProjectOverviewPanel } from './components/ProjectOverviewPanel';
import { ProjectTabNavigation } from './components/ProjectTabNavigation';
import { ProjectComponentList } from './components/ProjectComponentList';
import { CollectionApplyModal } from './components/CollectionApplyModal';
import { HideProjectModal } from './components/HideProjectModal';
import { useProjectDetail } from './hooks/useProjectDetail';
import { useProjectComponents } from './hooks/useProjectComponents';
import { useProjectTags } from './hooks/useProjectTags';
import type { TabType } from './types';
import { PageFrame } from '@/components/common';
import { bulkToggleComponents, deleteProject } from '@/common/api';

export function ProjectDetailPage() {
  const { t } = useTranslation(['projectDetail', 'common']);
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL State
  const tabFromUrl = (searchParams.get('tab') || 'overview') as TabType;
  const [selectedTab, setSelectedTab] = useState<TabType>(tabFromUrl);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date'>('name');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([]);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [isHideConfirmOpen, setIsHideConfirmOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const hideProject = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      showSuccessToast(t('common:hooks.projectHidden'));
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'projects'] });
    },
    onError: (error) => {
      showErrorToast(
        error instanceof Error ? error.message : t('common:hooks.projectDeleteFailed')
      );
    },
  });

  // React Query
  const {
    data: project,
    isLoading: projectLoading,
    error: projectError,
  } = useProjectDetail(projectId || '');

  const {
    data: components = [],
    isLoading: componentsLoading,
  } = useProjectComponents(projectId || '', {
    type: selectedTab === 'overview' ? undefined : selectedTab,
    search: searchQuery,
    sortBy,
  });

  // 태그 집계용 전체 컴포넌트 (탭 필터와 무관)
  const { data: allComponents = [] } = useProjectComponents(projectId || '', {});
  const tags = useProjectTags(allComponents);

  const platformBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of allComponents) {
      const p = c.platform || 'unknown';
      counts.set(p, (counts.get(p) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([platform, count]) => ({ platform, count }))
      .sort((a, b) => b.count - a.count);
  }, [allComponents]);

  const filteredComponents = useMemo(() => {
    let result = components;
    if (selectedTag) {
      result = result.filter((c) => c.tags?.includes(selectedTag));
    }
    if (selectedPlatform) {
      result = result.filter((c) => c.platform === selectedPlatform);
    }
    return result;
  }, [components, selectedTag, selectedPlatform]);

  const selectableComponentIds = useMemo(
    () => filteredComponents.filter((component) => component.type !== 'hook').map((component) => component.id),
    [filteredComponents]
  );
  const selectableIdSet = useMemo(() => new Set(selectableComponentIds), [selectableComponentIds]);

  useEffect(() => {
    setSelectedComponentIds((prev) => prev.filter((id) => selectableIdSet.has(id)));
  }, [selectableIdSet]);

  const bulkToggleMutation = useMutation({
    mutationFn: ({ ids, enabled }: { ids: string[]; enabled: boolean }) =>
      bulkToggleComponents(ids, enabled),
    onSuccess: (response, variables) => {
      showSuccessToast(
        t('component.bulkToggleSuccess', {
          count: response.updated_count,
          status: variables.enabled
            ? t('component.bulkEnabled')
            : t('component.bulkDisabled'),
        })
      );
      setSelectedComponentIds([]);
      void queryClient.invalidateQueries({ queryKey: ['project-components', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['components'] });
    },
    onError: (error) => {
      showErrorToast(
        error instanceof Error ? error.message : t('component.bulkToggleFailed')
      );
    },
  });
  const isBulkPending = bulkToggleMutation.isPending;
  const { mutate: mutateBulkToggle } = bulkToggleMutation;

  // URL State 동기화
  useEffect(() => {
    if (selectedTab !== tabFromUrl) {
      setSearchParams({ tab: selectedTab });
    }
  }, [selectedTab, tabFromUrl, setSearchParams]);

  // 에러 처리
  useEffect(() => {
    if (projectError) {
      showErrorToast(t('error.projectNotFound'));
      // 3초 후 프로젝트 목록으로 리다이렉트
      const timer = setTimeout(() => {
        void navigate('/projects');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [projectError, navigate, t]);

  const handleTabChange = useCallback((tab: TabType) => {
    setSelectedTab(tab);
    setSearchQuery(''); // 탭 변경 시 검색어 초기화
    setSelectedComponentIds([]);
    setIsSelectionMode(false);
  }, []);

  const handleSelectionModeToggle = useCallback(() => {
    setIsSelectionMode((prev) => {
      const next = !prev;
      if (!next) setSelectedComponentIds([]);
      return next;
    });
  }, []);

  const handleSelectionChange = useCallback((componentId: string, selected: boolean) => {
    if (!selectableIdSet.has(componentId)) return;
    setSelectedComponentIds((prev) => {
      if (selected) {
        if (prev.includes(componentId)) return prev;
        return [...prev, componentId];
      }
      return prev.filter((id) => id !== componentId);
    });
  }, [selectableIdSet]);

  const handleSelectAll = useCallback(() => {
    if (selectableComponentIds.length === 0) return;
    setSelectedComponentIds(selectableComponentIds);
  }, [selectableComponentIds]);

  const handleClearSelection = useCallback(() => {
    setSelectedComponentIds([]);
  }, []);

  const handleBulkToggle = useCallback((enabled: boolean) => {
    if (selectedComponentIds.length === 0 || isBulkPending) return;
    mutateBulkToggle({ ids: selectedComponentIds, enabled });
  }, [selectedComponentIds, isBulkPending, mutateBulkToggle]);
  const handleTagClick = useCallback((tag: string) => {
    setSelectedTag((prev) => (prev === tag ? null : tag));
  }, []);

  const handlePlatformChange = useCallback((platform: string | null) => {
    setSelectedPlatform(platform);
  }, []);

  const handleBackToProjects = useCallback(() => {
    void navigate('/projects');
  }, [navigate]);

  const handleHideConfirm = useCallback(() => {
    if (!projectId) return;
    hideProject.mutate(projectId, {
      onSuccess: () => void navigate('/projects'),
    });
    setIsHideConfirmOpen(false);
  }, [projectId, hideProject, navigate]);

  // 로딩 상태
  if (projectLoading) {
    return (
      <PageFrame
        activeNav="projects"
        contentClassName="max-w-[88rem] mx-auto"
      >
        {/* Stats Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="vs-frost-panel h-24 rounded-lg animate-pulse"
            />
          ))}
        </div>

        {/* Tabs Skeleton */}
        <div className="flex gap-2 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="vs-frost-panel h-10 w-24 rounded-lg animate-pulse"
            />
          ))}
        </div>

        {/* List Skeleton */}
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="vs-frost-panel h-24 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </PageFrame>
    );
  }

  // 에러 상태
  if (projectError || !project) {
    return (
      <PageFrame
        activeNav="projects"
        title={t('error.projectNotFound')}
        subtitle={t('error.redirectMessage')}
        contentClassName="max-w-[88rem] mx-auto"
      >
        <div className="vs-frost-panel rounded-2xl p-6 text-center">
          <p className="text-theme-danger text-lg mb-4">
            {t('error.projectNotFound')}
          </p>
          <p className="text-theme-secondary text-sm mb-6">
            {t('error.redirectMessage')}
          </p>
          <button
            type="button"
            onClick={handleBackToProjects}
            className="
              px-4 py-2 rounded-lg
              btn-theme-surface
              transition-all duration-200
            "
          >
            {t('error.goToDashboard')}
          </button>
        </div>
      </PageFrame>
    );
  }

  return (
    <PageFrame
      activeNav="projects"
      title={(
        <span className="inline-flex items-center gap-3">
          <button
            type="button"
            onClick={handleBackToProjects}
            className="rounded-lg p-1.5 text-theme-secondary hover:text-theme-primary hover:bg-theme-surface transition-all duration-200"
            aria-label={t('header.backAria')}
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
          {project.name}
        </span>
      )}
      subtitle={(
        <span className="inline-flex items-start gap-2 pl-9">
          <FolderOpen className="h-4 w-4 mt-0.5 text-theme-tertiary" aria-hidden />
          <span className={`${ANALYTICS_MASK_TEXT_CLASS} break-all`}>
            {project.path}
          </span>
        </span>
      )}
      actions={(
        <div className="flex shrink-0 items-center gap-2">
          {!project.is_global && (
            <button
              type="button"
              onClick={() => setIsHideConfirmOpen(true)}
              disabled={hideProject.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold btn-theme-primary-soft disabled:opacity-50"
              aria-label={t('header.hideAria', { name: project.name })}
            >
              <EyeOff className="h-4 w-4" aria-hidden />
              {t('header.hide')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsCollectionModalOpen(true)}
            className="rounded-lg px-4 py-2 text-sm font-semibold btn-theme-primary-soft"
          >
            {t('presetApply.modal.triggerButton')}
          </button>
        </div>
      )}
      contentClassName="max-w-[88rem] mx-auto"
    >
      <CollectionApplyModal
        projectId={project.id}
        open={isCollectionModalOpen}
        onOpenChange={setIsCollectionModalOpen}
      />
      <HideProjectModal
        isOpen={isHideConfirmOpen}
        projectName={project.name}
        onConfirm={handleHideConfirm}
        onCancel={() => setIsHideConfirmOpen(false)}
      />

      {/* Overview */}
      <ProjectOverviewPanel
        projectId={project.id}
        path={project.path}
        lastScannedAt={project.last_scanned_at}
        dirExists={project.dir_exists}
        breakdown={project.breakdown}
        platformBreakdown={platformBreakdown}
        onTabChange={handleTabChange}
      />

      {/* Tabs + Component List */}
      <div className="vs-frost-panel rounded-2xl p-4 space-y-4">
        {/* Platform tabs + Analysis link */}
        <div className="flex items-center gap-2 py-1 -my-1">
          {project.platforms.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => handlePlatformChange(null)}
                className={`px-4 py-2 rounded-lg transition-all duration-200 whitespace-nowrap ${
                  !selectedPlatform
                    ? 'btn-theme-primary-soft'
                    : 'btn-theme-surface text-theme-secondary'
                }`}
              >
                <span className="mr-2 inline-flex items-center"><LayoutGrid className="h-4 w-4" aria-hidden /></span>
                {t('filter.allPlatforms')}
              </button>
              {project.platforms.map((p) => {
                const icon = p === 'claude_code'
                  ? <Terminal className="h-4 w-4" aria-hidden />
                  : <MonitorSmartphone className="h-4 w-4" aria-hidden />;
                const label = p === 'claude_code' ? 'Claude Code' : p === 'cursor' ? 'Cursor' : p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePlatformChange(selectedPlatform === p ? null : p)}
                    className={`px-4 py-2 rounded-lg transition-all duration-200 whitespace-nowrap ${
                      selectedPlatform === p
                        ? 'btn-theme-primary-soft'
                        : 'btn-theme-surface text-theme-secondary'
                    }`}
                  >
                    <span className="mr-2 inline-flex items-center">{icon}</span>
                    {label}
                  </button>
                );
              })}
            </div>
          )}
          <Link
            to={`/components/analysis?project=${projectId}`}
            className="ml-auto inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-theme-secondary hover:text-theme-primary transition-colors"
          >
            {t('analysisLink')}
            <span aria-hidden>→</span>
          </Link>
        </div>

        <ProjectTabNavigation
          activeTab={selectedTab}
          onTabChange={handleTabChange}
        />

        {/* Tag cloud */}
        {tags.length > 0 ? (
          <div className="mt-2 rounded-lg border border-theme bg-theme-elevated/50 px-3 py-2">
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <button
                  key={tag.name}
                  type="button"
                  onClick={() => handleTagClick(tag.name)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-150 ${
                    selectedTag === tag.name
                      ? 'border-transparent btn-theme-primary-soft'
                      : 'border-theme bg-theme-elevated text-theme-secondary hover:text-theme-primary hover:bg-theme-surface'
                  }`}
                >
                  {tag.name}
                  <span className={`ml-1 tabular-nums ${selectedTag === tag.name ? 'opacity-70' : 'text-theme-tertiary'}`}>
                    {tag.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-2" />
        )}

        <div
          role="tabpanel"
          id={`tabpanel-${selectedTab}`}
          aria-labelledby={`tab-${selectedTab}`}
        >
        <ProjectComponentList
          components={filteredComponents}
          loading={componentsLoading}
          searchQuery={searchQuery}
          sortBy={sortBy}
          onSearch={setSearchQuery}
          onSort={setSortBy}
          selectionMode={isSelectionMode}
          selectedComponentIds={selectedComponentIds}
          selectableComponentIds={selectableComponentIds}
          onSelectionModeToggle={handleSelectionModeToggle}
          onSelectionChange={handleSelectionChange}
          onSelectAll={handleSelectAll}
          onClearSelection={handleClearSelection}
          onBulkEnable={() => handleBulkToggle(true)}
          onBulkDisable={() => handleBulkToggle(false)}
          isBulkPending={isBulkPending}
          hasActiveFilter={!!selectedTag || !!selectedPlatform}
          onClearFilter={() => { setSelectedTag(null); setSelectedPlatform(null); }}
        />
        </div>
      </div>
    </PageFrame>
  );
}
