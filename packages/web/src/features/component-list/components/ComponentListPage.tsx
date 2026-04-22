/**
 * Component List Page
 * Top-level page with type filter and list
 */

import { useMemo, useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ComponentTypeFilter } from './ComponentTypeFilter';
import { ComponentList } from './ComponentList';
import { ComponentRow } from './ComponentRow';
import { ProjectFilter } from './ProjectFilter';
import { SearchInput } from './SearchInput';
import { TagFilter } from './TagFilter';
import { StatusFilter } from './StatusFilter';
import { PlatformFilter, type PlatformFilterValue } from './PlatformFilter';
import { SortSelect, type SortOption } from './SortSelect';
import { Pagination } from './Pagination';
import { ComponentWorkspaceTabs, PageFrame } from '@/components/common';
import { PopularTags } from '@/features/tag-management';
import { useTagStats } from '@/features/tag-management';
import type { StatusFilterValue } from './StatusFilter';
import { useComponents } from '../hooks/useComponents';
import type { FilterType } from './ComponentTypeFilter';
import type { ComponentListItem as ComponentListItemType } from '../types';
import { bulkToggleComponents, toggleComponent } from '../services/api';
import { showSuccessToast, showErrorToast } from '@/common/utils';

const VIEW_STORAGE_KEY = 'vibesmith_components_view';
const STATUS_PARAM = 'status';
const VIEW_PARAM = 'view';
const TYPE_PARAM = 'type';
const TYPES_PARAM = 'types';
const PROJECT_PARAM = 'project';
const QUERY_PARAM = 'q';
const TAGS_PARAM = 'tags';
const TAG_MODE_PARAM = 'tag_mode';
const PLATFORM_PARAM = 'platform';
const SORT_PARAM = 'sort';
const PAGE_PARAM = 'page';
const ITEMS_PER_PAGE = 50; // 페이지당 항목 수
type ViewMode = 'cards' | 'table';
const TYPE_ORDER: FilterType[] = ['skill', 'agent', 'command', 'hook', 'rule'];

function parseStatusParam(params: URLSearchParams): StatusFilterValue {
  const v = params.get(STATUS_PARAM);
  if (v === 'enabled' || v === 'disabled') return v;
  return 'all';
}

function getStoredViewMode(): ViewMode {
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === 'table' || stored === 'cards') return stored;
  } catch {
    // localStorage unavailable (e.g. private mode)
  }
  return 'cards';
}

function parseViewParam(params: URLSearchParams, stored: ViewMode): ViewMode {
  const urlView = params.get(VIEW_PARAM);
  if (urlView === 'table' || urlView === 'cards') return urlView;
  return stored;
}

function isValidType(value: string): value is FilterType {
  return TYPE_ORDER.includes(value as FilterType);
}

function parseTypesParam(params: URLSearchParams): FilterType[] {
  const typesParam = params.get(TYPES_PARAM);
  if (typesParam && typesParam.trim()) {
    const parsed = typesParam
      .split(',')
      .map((value) => value.trim())
      .filter((value): value is FilterType => isValidType(value));

    if (parsed.length > 0) {
      return TYPE_ORDER.filter((type) => parsed.includes(type));
    }
  }

  const legacyType = params.get(TYPE_PARAM);
  if (legacyType && isValidType(legacyType)) {
    return [legacyType];
  }

  return [];
}

function parseOptionalParam(params: URLSearchParams, key: string): string | null {
  const value = params.get(key);
  if (!value || value.trim() === '') return null;
  return value;
}

function parseTagsParam(params: URLSearchParams): string[] {
  const v = params.get(TAGS_PARAM);
  if (!v || !v.trim()) return [];
  return v.split(',').map((t) => t.trim()).filter(Boolean);
}

function parseTagModeParam(params: URLSearchParams): 'or' | 'and' {
  const v = params.get(TAG_MODE_PARAM);
  return v === 'and' ? 'and' : 'or';
}

function parsePlatformParam(params: URLSearchParams): PlatformFilterValue {
  const v = params.get(PLATFORM_PARAM);
  if (v === 'claude_code' || v === 'cursor') return v;
  return 'all';
}

function parseSortParam(params: URLSearchParams): SortOption {
  const v = params.get(SORT_PARAM);
  if (
    v === 'name-asc' ||
    v === 'name-desc' ||
    v === 'date-asc' ||
    v === 'date-desc'
  ) {
    return v;
  }
  return 'date-desc'; // 기본값: 최신순
}

function parsePageParam(params: URLSearchParams): number {
  const v = params.get(PAGE_PARAM);
  const page = parseInt(v ?? '1', 10);
  return isNaN(page) || page < 1 ? 1 : page;
}

export function ComponentListPage() {
  const { t, i18n } = useTranslation(['components', 'common']);
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const storedView = getStoredViewMode();
  const viewMode = parseViewParam(searchParams, storedView);
  const selectedTypes = parseTypesParam(searchParams);
  const selectedProjectId = parseOptionalParam(searchParams, PROJECT_PARAM);
  // 'q' 또는 'search' 파라미터 모두 지원 (#483)
  const searchQuery = searchParams.get(QUERY_PARAM) ?? searchParams.get('search') ?? '';
  const selectedTags = parseTagsParam(searchParams);
  const tagFilterMode = parseTagModeParam(searchParams);
  const statusFilter = parseStatusParam(searchParams);
  const platformFilter = parsePlatformParam(searchParams);
  const sortOption = parseSortParam(searchParams);
  const currentPage = parsePageParam(searchParams);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([]);

  const updateParam = useCallback((
    key: string,
    value: string | null,
    options?: { resetPage?: boolean }
  ) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!value || value.trim() === '') {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      if (options?.resetPage) {
        next.delete(PAGE_PARAM);
      }
      return next;
    });
  }, [setSearchParams]);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    updateParam(VIEW_PARAM, mode === 'cards' ? null : mode);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, mode);
    } catch {
      // localStorage unavailable (e.g. private mode)
    }
  }, [updateParam]);

  const handleTypesChange = useCallback((types: FilterType[]) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const orderedTypes = TYPE_ORDER.filter((type) => types.includes(type));
      if (orderedTypes.length === 0) {
        next.delete(TYPES_PARAM);
      } else {
        next.set(TYPES_PARAM, orderedTypes.join(','));
      }
      next.delete(TYPE_PARAM); // legacy param cleanup
      next.delete(PAGE_PARAM);
      return next;
    });
  }, [setSearchParams]);

  const handleProjectChange = useCallback((projectId: string | null) => {
    updateParam(PROJECT_PARAM, projectId, { resetPage: true });
  }, [updateParam]);

  const handleTagsChange = useCallback((tags: string[]) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tags.length === 0) {
        next.delete(TAGS_PARAM);
        next.delete(TAG_MODE_PARAM);
      } else {
        next.set(TAGS_PARAM, tags.join(','));
      }
      next.delete(PAGE_PARAM);
      return next;
    });
  }, [setSearchParams]);

  const handleTagFilterModeChange = useCallback((mode: 'or' | 'and') => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (mode === 'or') {
        next.delete(TAG_MODE_PARAM);
      } else {
        next.set(TAG_MODE_PARAM, 'and');
      }
      next.delete(PAGE_PARAM);
      return next;
    });
  }, [setSearchParams]);

  const handleStatusChange = useCallback((value: StatusFilterValue) => {
    updateParam(STATUS_PARAM, value === 'all' ? null : value, { resetPage: true });
  }, [updateParam]);

  const handlePlatformChange = useCallback((value: PlatformFilterValue) => {
    updateParam(PLATFORM_PARAM, value === 'all' ? null : value, { resetPage: true });
  }, [updateParam]);

  const handleSearchChange = useCallback((q: string) => {
    updateParam(QUERY_PARAM, q.trim() ? q : null, { resetPage: true });
  }, [updateParam]);

  const handleSortChange = useCallback((sort: SortOption) => {
    updateParam(SORT_PARAM, sort === 'date-desc' ? null : sort, { resetPage: true });
  }, [updateParam]);

  const handlePageChange = useCallback((page: number) => {
    updateParam(PAGE_PARAM, page === 1 ? null : page.toString());
  }, [updateParam]);

  const handleClearAllFilters = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(TYPE_PARAM);
      next.delete(TYPES_PARAM);
      next.delete(PROJECT_PARAM);
      next.delete(QUERY_PARAM);
      next.delete(TAGS_PARAM);
      next.delete(TAG_MODE_PARAM);
      next.delete(STATUS_PARAM);
      next.delete(PLATFORM_PARAM);
      next.delete(PAGE_PARAM);
      // SORT_PARAM은 유지
      return next;
    });
  }, [setSearchParams]);

  const filters = useMemo(
    () => ({
      type: selectedTypes.length === 1 ? selectedTypes[0] : undefined,
      types: selectedTypes.length > 0 ? selectedTypes : undefined,
      project_id: selectedProjectId ?? undefined,
      q: searchQuery || undefined,
      tags: selectedTags,
      tag_filter_mode: tagFilterMode,
      tag: selectedTags.length > 0 ? selectedTags.join(',') : undefined,
      enabled:
        statusFilter === 'all'
          ? undefined
          : statusFilter === 'enabled'
            ? true
            : false,
      platform: platformFilter === 'all' ? undefined : platformFilter,
    }),
    [
      selectedTypes,
      selectedProjectId,
      searchQuery,
      selectedTags,
      tagFilterMode,
      statusFilter,
      platformFilter,
    ]
  );

  const {
    data: components,
    isLoading,
    error,
    refetch,
  } = useComponents(filters);
  const canNormalizePage = components !== undefined;

  const toggleMutation = useMutation({
    mutationFn: ({ componentId, nextEnabled }: { componentId: string; nextEnabled: boolean }) =>
      toggleComponent(componentId, nextEnabled),
    onMutate: async ({ componentId, nextEnabled }) => {
      await queryClient.cancelQueries({ queryKey: ['components'] });
      const previousQueries = queryClient.getQueriesData<ComponentListItemType[]>({
        queryKey: ['components'],
      });

      previousQueries.forEach(([key, queryData]) => {
        if (!queryData) return;
        queryClient.setQueryData<ComponentListItemType[]>(
          key,
          queryData.map((item) =>
            item.id === componentId ? { ...item, enabled: nextEnabled } : item
          )
        );
      });

      return { previousQueries };
    },
    onSuccess: (response) => {
      queryClient.setQueriesData<ComponentListItemType[]>(
        { queryKey: ['components'] },
        (oldData) => {
          if (!oldData) return oldData;
          return oldData.map((item) =>
            item.id === response.id ? { ...item, enabled: response.enabled } : item
          );
        }
      );
      showSuccessToast(
        response.enabled ? t('common:hooks.toggleEnabled') : t('common:hooks.toggleDisabled')
      );
    },
    onError: (error, _variables, context) => {
      context?.previousQueries?.forEach(([key, queryData]) => {
        queryClient.setQueryData(key, queryData);
      });
      showErrorToast(error instanceof Error ? error.message : t('common:hooks.toggleFailed'));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['components'] });
    },
  });

  const bulkToggleMutation = useMutation({
    mutationFn: ({ componentIds, nextEnabled }: { componentIds: string[]; nextEnabled: boolean }) =>
      bulkToggleComponents(componentIds, nextEnabled),
    onMutate: async ({ componentIds, nextEnabled }) => {
      await queryClient.cancelQueries({ queryKey: ['components'] });
      const previousQueries = queryClient.getQueriesData<ComponentListItemType[]>({
        queryKey: ['components'],
      });

      previousQueries.forEach(([key, queryData]) => {
        if (!queryData) return;
        queryClient.setQueryData<ComponentListItemType[]>(
          key,
          queryData.map((item) =>
            componentIds.includes(item.id) ? { ...item, enabled: nextEnabled } : item
          )
        );
      });

      return { previousQueries };
    },
    onSuccess: (response, variables) => {
      showSuccessToast(
        t('components:list.bulkToggleSuccess', {
          count: response.updated_count,
          status: variables.nextEnabled
            ? t('components:list.statusEnabled')
            : t('components:list.statusDisabled'),
        })
      );
      setSelectedComponentIds([]);
    },
    onError: (error, _variables, context) => {
      context?.previousQueries?.forEach(([key, queryData]) => {
        queryClient.setQueryData(key, queryData);
      });
      showErrorToast(error instanceof Error ? error.message : t('components:list.bulkToggleFailed'));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['components'] });
    },
  });
  const { mutate: mutateBulkToggle } = bulkToggleMutation;

  const { data: tagStats = [] } = useTagStats();

  // 정렬 및 페이지네이션 적용
  const { sortedComponents, paginatedComponents, totalPages, safeCurrentPage } = useMemo(() => {
    const list = components ?? [];

    // 정렬
    const sorted = [...list].sort((a, b) => {
      switch (sortOption) {
        case 'name-asc':
          return a.name.localeCompare(b.name, i18n.language);
        case 'name-desc':
          return b.name.localeCompare(a.name, i18n.language);
        case 'date-asc':
          return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
        case 'date-desc':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        default:
          return 0;
      }
    });

    // 페이지네이션
    const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
    const safeCurrentPage = totalPages === 0 ? 1 : Math.min(currentPage, totalPages);
    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginated = sorted.slice(startIndex, endIndex);

    return {
      sortedComponents: sorted,
      paginatedComponents: paginated,
      totalPages,
      safeCurrentPage,
    };
  }, [components, sortOption, currentPage, i18n.language]);

  // page 파라미터가 범위를 벗어나면 유효 페이지로 보정
  useEffect(() => {
    if (!canNormalizePage) return;
    if (currentPage === safeCurrentPage) return;
    updateParam(
      PAGE_PARAM,
      safeCurrentPage === 1 ? null : safeCurrentPage.toString()
    );
  }, [canNormalizePage, currentPage, safeCurrentPage, updateParam]);

  // 페이지 변경 시 스크롤 최상단으로
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [safeCurrentPage]);

  const summary = useMemo(() => {
    const list = sortedComponents;
    const total = list.length;
    const active = list.filter((item) => item.enabled).length;
    const activeRate = total > 0 ? Math.round((active / total) * 100) : 0;
    const topType = list.reduce<Record<string, number>>((acc, item) => {
      acc[item.type] = (acc[item.type] ?? 0) + 1;
      return acc;
    }, {});
    const topTypeEntry = Object.entries(topType).sort((a, b) => b[1] - a[1])[0];
    const typeKeyMap: Record<string, string> = {
      skill: 'typeSkill',
      agent: 'typeAgent',
      command: 'typeCommand',
      hook: 'typeHook',
      rule: 'typeRule',
    };
    const topTypeLabel = topTypeEntry
      ? t('components:list.typeLabel', {
          type: t(`components:list.${typeKeyMap[topTypeEntry[0]] ?? topTypeEntry[0]}`),
          count: topTypeEntry[1],
        })
      : '—';

    return {
      total,
      active,
      activeRate,
      topTypeLabel,
    };
  }, [sortedComponents, t]);

  const selectableComponentIds = useMemo(
    () => sortedComponents.filter((component) => component.type !== 'hook').map((component) => component.id),
    [sortedComponents]
  );

  const selectableIdSet = useMemo(() => new Set(selectableComponentIds), [selectableComponentIds]);

  useEffect(() => {
    setSelectedComponentIds((prev) => prev.filter((id) => selectableIdSet.has(id)));
  }, [selectableIdSet]);

  const hasActiveFilters =
    selectedTypes.length > 0 ||
    !!selectedProjectId ||
    !!searchQuery ||
    selectedTags.length > 0 ||
    statusFilter !== 'all' ||
    platformFilter !== 'all';

  const selectedCount = selectedComponentIds.length;
  const isAllSelectableSelected =
    selectableComponentIds.length > 0 &&
    selectableComponentIds.every((id) => selectedComponentIds.includes(id));
  const isBulkPending = bulkToggleMutation.isPending;

  const handleToggleComponent = useCallback((componentId: string, nextEnabled: boolean) => {
    toggleMutation.mutate({ componentId, nextEnabled });
  }, [toggleMutation]);

  const activeToggleComponentId = toggleMutation.isPending
    ? toggleMutation.variables?.componentId ?? null
    : null;

  const handleSelectionModeToggle = useCallback(() => {
    setIsSelectionMode((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedComponentIds([]);
      }
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

  const handleBulkToggle = useCallback((nextEnabled: boolean) => {
    if (selectedComponentIds.length === 0 || isBulkPending) return;
    mutateBulkToggle({
      componentIds: selectedComponentIds,
      nextEnabled,
    });
  }, [selectedComponentIds, isBulkPending, mutateBulkToggle]);

  const renderTable = (rows: ComponentListItemType[]) => {
    return (
      <div className="vs-frost-panel overflow-x-auto rounded-xl">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="bg-theme-elevated text-left text-xs uppercase tracking-[0.12em] text-theme-secondary">
            <tr>
              {isSelectionMode && (
                <th scope="col" className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={isAllSelectableSelected}
                    onChange={(event) => {
                      if (event.target.checked) handleSelectAll();
                      else handleClearSelection();
                    }}
                    disabled={selectableComponentIds.length === 0 || isBulkPending}
                    className="h-4 w-4 accent-[var(--color-accent)]"
                    data-testid="component-list-table-select-all"
                    aria-label={t('components:list.selectAllAria')}
                  />
                </th>
              )}
              <th scope="col" className="px-4 py-3">{t('components:list.name')}</th>
              <th scope="col" className="px-4 py-3">{t('components:list.type')}</th>
              <th scope="col" className="px-4 py-3">{t('components:list.project')}</th>
              <th scope="col" className="px-4 py-3">{t('components:list.status')}</th>
              <th scope="col" className="px-4 py-3">{t('components:list.tags')}</th>
              <th scope="col" className="px-4 py-3">{t('components:list.updated')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((component) => (
              <ComponentRow
                key={component.id}
                component={component}
                onToggle={handleToggleComponent}
                isTogglePending={activeToggleComponentId === component.id}
                selectionMode={isSelectionMode}
                isSelected={selectedComponentIds.includes(component.id)}
                onSelectionChange={handleSelectionChange}
              />
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const createComponentButton = (
    <Link
      to="/components/create"
      className="px-4 py-2 rounded-lg font-medium btn-theme-primary-soft transition-colors shrink-0"
    >
      {t('components:list.createComponent')}
    </Link>
  );

  return (
    <PageFrame
      activeNav="components"
      title={t('components:list.title')}
      subtitle={t('components:list.subtitle')}
      contentClassName="max-w-[88rem] mx-auto"
    >
      <div className="space-y-6">
        <ComponentWorkspaceTabs active="list" />

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4" aria-label={t('components:list.summaryAria')}>
          <article className="vs-frost-panel rounded-xl p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-theme-secondary">
              {t('components:list.total')}
            </p>
            <p className="mt-2 text-3xl font-semibold text-theme-primary tabular-nums">
              {summary.total}
            </p>
            <p className="text-xs text-theme-secondary mt-1">
              {t('components:list.currentResultSet')}
            </p>
          </article>
          <article className="vs-frost-panel rounded-xl p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-theme-secondary">
              {t('components:list.activeRatio')}
            </p>
            <p className="mt-2 text-3xl font-semibold text-theme-success tabular-nums">
              {summary.activeRate}%
            </p>
            <p className="text-xs text-theme-secondary mt-1">
              {summary.active} / {summary.total}
            </p>
          </article>
          <article className="vs-frost-panel rounded-xl p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-theme-secondary">
              {t('components:list.topType')}
            </p>
            <p className="mt-2 text-2xl font-semibold text-primary">{summary.topTypeLabel}</p>
            <p className="text-xs text-theme-secondary mt-1">
              {t('components:list.dominantCategory')}
            </p>
          </article>
        </section>

        {/* Filter Section */}
        <div className="vs-frost-panel rounded-2xl p-6">
          <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
            <h2 className="text-lg font-semibold text-theme-primary">
              {t('components:list.filter')}
            </h2>
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <button
                type="button"
                data-testid="component-list-selection-mode-toggle"
                onClick={handleSelectionModeToggle}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isSelectionMode
                    ? 'btn-theme-warning-soft'
                    : 'btn-theme-surface'
                }`}
              >
                {isSelectionMode
                  ? t('components:list.selectionModeExit')
                  : t('components:list.selectionModeEnter')}
              </button>
              {createComponentButton}
              <div className="inline-flex rounded-lg border border-theme bg-theme-surface p-1">
                <button
                  type="button"
                  onClick={() => handleViewModeChange('cards')}
                  data-testid="view-toggle-cards"
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                    viewMode === 'cards'
                      ? 'btn-theme-primary-soft text-theme-primary'
                      : 'text-theme-secondary hover:text-theme-primary'
                  }`}
                  aria-pressed={viewMode === 'cards'}
                >
                  {t('components:list.viewCards')}
                </button>
                <button
                  type="button"
                  onClick={() => handleViewModeChange('table')}
                  data-testid="view-toggle-table"
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                    viewMode === 'table'
                      ? 'btn-theme-primary-soft text-theme-primary'
                      : 'text-theme-secondary hover:text-theme-primary'
                  }`}
                  aria-pressed={viewMode === 'table'}
                >
                  {t('components:list.viewTable')}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2 mb-5">
            <p className="text-sm font-medium text-theme-secondary">
              {t('components:list.typeFilter')}
            </p>
            <ComponentTypeFilter
              selectedTypes={selectedTypes}
              onTypesChange={handleTypesChange}
            />
          </div>

          <div className="space-y-2 mb-5">
            <p className="text-sm font-medium text-theme-secondary">
              {t('components:list.platformLabel')}
            </p>
            <PlatformFilter selected={platformFilter} onChange={handlePlatformChange} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 items-start">
            <ProjectFilter
              selectedProjectId={selectedProjectId}
              onProjectChange={handleProjectChange}
            />
            <StatusFilter value={statusFilter} onChange={handleStatusChange} />
            <SearchInput value={searchQuery} onChange={handleSearchChange} />
            <TagFilter
              selectedTags={selectedTags}
              onTagsChange={handleTagsChange}
              tagFilterMode={tagFilterMode}
              onTagFilterModeChange={handleTagFilterModeChange}
            />
            <SortSelect value={sortOption} onChange={handleSortChange} />
          </div>

          {tagStats.length > 0 && (
            <div className="mt-4 pt-4 border-t border-theme">
              <p className="text-xs text-theme-tertiary mb-2">{t('components:list.popularTags')}</p>
              <PopularTags tags={tagStats} maxTags={10} />
            </div>
          )}

          {/* Active Filters Summary */}
          {hasActiveFilters && (
            <div className="mt-4 pt-4 border-t border-theme">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm text-theme-secondary">{t('components:list.activeFilters')}:</span>
                {selectedTypes.map((selectedType) => (
                  <span key={selectedType} className="px-2 py-1 rounded-md badge-theme-info text-sm">
                    {t('components:list.filterType', {
                      type: t(`components:list.type${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)}` as 'typeSkill' | 'typeAgent' | 'typeCommand' | 'typeHook' | 'typeRule'),
                    })}
                  </span>
                ))}
                {selectedProjectId && (
                  <span className="px-2 py-1 rounded-md badge-theme-muted text-sm">
                    {t('components:list.filterProject')}
                  </span>
                )}
                {searchQuery && (
                  <span className="px-2 py-1 rounded-md badge-theme-info text-sm">
                    {t('components:list.filterSearch', { query: searchQuery })}
                  </span>
                )}
                {selectedTags.length > 0 && (
                  <span className="px-2 py-1 rounded-md badge-theme-success text-sm">
                    {t('components:list.filterTags', { tags: selectedTags.join(', ') })}
                    {tagFilterMode === 'and' && selectedTags.length > 1 && t('components:list.filterTagsAnd')}
                  </span>
                )}
                {platformFilter !== 'all' && (
                  <span className="px-2 py-1 rounded-md badge-theme-muted text-sm">
                    {t('components:list.filterPlatform', {
                      platform: platformFilter === 'claude_code'
                        ? t('components:list.platformClaudeCode')
                        : t('components:list.platformCursor'),
                    })}
                  </span>
                )}
                {statusFilter !== 'all' && (
                  <span className="px-2 py-1 rounded-md badge-theme-warning text-sm">
                    {statusFilter === 'enabled' ? t('components:list.filterStatusEnabled') : t('components:list.filterStatusDisabled')}
                  </span>
                )}
                <button
                  onClick={handleClearAllFilters}
                  data-testid="component-list-clear-filters-button"
                  className="ml-auto px-3 py-1 rounded-md btn-theme-surface text-sm transition-colors"
                  aria-label={t('components:list.clearAllFiltersAria')}
                >
                  {t('components:list.clearAllFilters')}
                </button>
              </div>
            </div>
          )}
        </div>

        {isSelectionMode && (
          <section
            data-testid="component-list-bulk-toolbar"
            className="vs-frost-panel rounded-xl border border-theme p-4"
            aria-label={t('components:list.bulkToolbarAria')}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-theme-primary">
                {t('components:list.selectedCount', { count: selectedCount })}
              </span>
              <button
                type="button"
                onClick={isAllSelectableSelected ? handleClearSelection : handleSelectAll}
                disabled={selectableComponentIds.length === 0 || isBulkPending}
                data-testid="component-list-bulk-select-all-button"
                className="px-3 py-1.5 rounded-md btn-theme-surface text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isAllSelectableSelected
                  ? t('components:list.deselectAll')
                  : t('components:list.selectAll')}
              </button>
              <button
                type="button"
                onClick={() => handleBulkToggle(true)}
                disabled={selectedCount === 0 || isBulkPending}
                data-testid="component-list-bulk-enable-button"
                className="px-3 py-1.5 rounded-md btn-theme-primary-soft text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isBulkPending
                  ? t('components:list.bulkProcessing')
                  : t('components:list.bulkEnable')}
              </button>
              <button
                type="button"
                onClick={() => handleBulkToggle(false)}
                disabled={selectedCount === 0 || isBulkPending}
                data-testid="component-list-bulk-disable-button"
                className="px-3 py-1.5 rounded-md btn-theme-warning-soft text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isBulkPending
                  ? t('components:list.bulkProcessing')
                  : t('components:list.bulkDisable')}
              </button>
              <button
                type="button"
                onClick={handleClearSelection}
                disabled={selectedCount === 0 || isBulkPending}
                data-testid="component-list-bulk-clear-selection-button"
                className="ml-auto px-3 py-1.5 rounded-md btn-theme-surface text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {t('components:list.clearSelection')}
              </button>
            </div>
          </section>
        )}

        {viewMode === 'table' && !isLoading && !error && paginatedComponents && paginatedComponents.length > 0 ? (
          <>
            {renderTable(paginatedComponents)}
            <Pagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              totalItems={sortedComponents.length}
              itemsPerPage={ITEMS_PER_PAGE}
            />
          </>
        ) : (
          <>
            <ComponentList
              filters={filters}
              components={paginatedComponents}
              isLoading={isLoading}
              error={error ?? null}
              onRetry={() => void refetch()}
              onToggle={handleToggleComponent}
              activeToggleComponentId={activeToggleComponentId}
              selectionMode={isSelectionMode}
              selectedComponentIds={selectedComponentIds}
              onSelectionChange={handleSelectionChange}
            />
            {!isLoading && !error && paginatedComponents && paginatedComponents.length > 0 && (
              <Pagination
                currentPage={safeCurrentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                totalItems={sortedComponents.length}
                itemsPerPage={ITEMS_PER_PAGE}
              />
            )}
          </>
        )}
      </div>
    </PageFrame>
  );
}
