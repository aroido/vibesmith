/**
 * ProjectComponentList Component
 * v1.10.0 - 프로젝트별 구성요소 목록
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ComponentIcon } from '@/components/common';
import type { Component } from '../../../common/types';
import { getRelativeTime } from '../utils/relativeTime';

interface ProjectComponentListProps {
  components: Component[];
  loading?: boolean;
  searchQuery?: string;
  sortBy?: 'name' | 'date';
  onSearch?: (query: string) => void;
  onSort?: (sortBy: 'name' | 'date') => void;
  selectionMode?: boolean;
  selectedComponentIds?: string[];
  selectableComponentIds?: string[];
  onSelectionModeToggle?: () => void;
  onSelectionChange?: (componentId: string, selected: boolean) => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  onBulkEnable?: () => void;
  onBulkDisable?: () => void;
  isBulkPending?: boolean;
  hasActiveFilter?: boolean;
  onClearFilter?: () => void;
}

const TYPE_ORDER: Component['type'][] = ['skill', 'agent', 'command', 'hook', 'rule'];

const TYPE_SECTION_LABEL_KEY: Record<
  Component['type'],
  'typeTabSkill' | 'typeTabAgent' | 'typeTabCommand' | 'typeTabHook' | 'typeTabRule'
> = {
  skill: 'typeTabSkill',
  agent: 'typeTabAgent',
  command: 'typeTabCommand',
  hook: 'typeTabHook',
  rule: 'typeTabRule',
};

const TYPE_BADGE_LABEL_KEY: Record<
  Component['type'],
  'typeSkill' | 'typeAgent' | 'typeCommand' | 'typeHook' | 'typeRule'
> = {
  skill: 'typeSkill',
  agent: 'typeAgent',
  command: 'typeCommand',
  hook: 'typeHook',
  rule: 'typeRule',
};

export function ProjectComponentList({
  components,
  loading = false,
  searchQuery = '',
  sortBy = 'name',
  onSearch,
  onSort,
  selectionMode = false,
  selectedComponentIds = [],
  selectableComponentIds = [],
  onSelectionModeToggle,
  onSelectionChange,
  onSelectAll,
  onClearSelection,
  onBulkEnable,
  onBulkDisable,
  isBulkPending = false,
  hasActiveFilter = false,
  onClearFilter,
}: ProjectComponentListProps) {
  const { t } = useTranslation(['projectDetail', 'components']);
  const selectedCount = selectedComponentIds.length;
  const isAllSelectableSelected =
    selectableComponentIds.length > 0 &&
    selectableComponentIds.every((id) => selectedComponentIds.includes(id));
  const groupedComponents = useMemo(() => {
    if (components.length === 0) return [];

    const grouped = new Map<Component['type'], Component[]>();
    for (const component of components) {
      const existing = grouped.get(component.type) ?? [];
      existing.push(component);
      grouped.set(component.type, existing);
    }

    return TYPE_ORDER
      .map((type) => ({ type, items: grouped.get(type) ?? [] }))
      .filter((group) => group.items.length > 0);
  }, [components]);

  if (loading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="h-8 w-52 animate-pulse rounded-lg bg-theme-skeleton" />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div
                  key={`${i}-${j}`}
                  className="vs-frost-panel h-48 animate-pulse rounded-2xl"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (components.length === 0) {
    return (
      <div className="vs-frost-panel rounded-xl py-12 text-center">
        <p className="text-theme-secondary mb-4">
          {searchQuery
            ? t('empty.noSearchResults')
            : hasActiveFilter
              ? t('empty.noFilterResults')
              : t('empty.noComponents')}
        </p>
        {searchQuery && onSearch && (
          <button
            type="button"
            onClick={() => onSearch('')}
            className="px-4 py-2 rounded-lg btn-theme-surface transition-all duration-200"
          >
            {t('searchReset')}
          </button>
        )}
        {!searchQuery && hasActiveFilter && onClearFilter && (
          <button
            type="button"
            onClick={onClearFilter}
            className="px-4 py-2 rounded-lg btn-theme-surface transition-all duration-200"
          >
            {t('empty.clearFilter')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Search & Sort */}
      {(onSearch || onSort || onSelectionModeToggle) && (
        <div className="flex gap-4 mb-4">
          {onSearch && (
            <input
              type="text"
              placeholder={t('search.placeholder')}
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              className="
                flex-1 px-4 py-2 rounded-lg
                input-theme
                transition-colors
              "
              aria-label={t('search.ariaLabel')}
            />
          )}
          {onSort && (
            <select
              value={sortBy}
              onChange={(e) => onSort(e.target.value as 'name' | 'date')}
              className="
                px-4 py-2 rounded-lg
                input-theme
                transition-colors
              "
              aria-label={t('sort.ariaLabel')}
            >
              <option value="name">{t('sort.name')}</option>
              <option value="date">{t('sort.date')}</option>
            </select>
          )}
          {onSelectionModeToggle && (
            <button
              type="button"
              onClick={onSelectionModeToggle}
              data-testid="project-detail-selection-mode-toggle"
              className={`ml-auto px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectionMode ? 'btn-theme-warning-soft' : 'btn-theme-surface'
              }`}
            >
              {selectionMode
                ? t('component.selectionModeExit')
                : t('component.selectionModeEnter')}
            </button>
          )}
        </div>
      )}

      {selectionMode && (
        <section
          className="vs-frost-panel mb-4 rounded-xl p-3"
          aria-label={t('component.bulkToolbarAria')}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-theme-primary">
              {t('component.selectedCount', { count: selectedCount })}
            </span>
            <button
              type="button"
              onClick={isAllSelectableSelected ? onClearSelection : onSelectAll}
              disabled={selectableComponentIds.length === 0 || isBulkPending}
              data-testid="project-detail-bulk-select-all-button"
              className="px-3 py-1.5 rounded-md btn-theme-surface text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isAllSelectableSelected
                ? t('component.deselectAll')
                : t('component.selectAll')}
            </button>
            <button
              type="button"
              onClick={onBulkEnable}
              disabled={selectedCount === 0 || isBulkPending}
              data-testid="project-detail-bulk-enable-button"
              className="px-3 py-1.5 rounded-md btn-theme-primary-soft text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isBulkPending ? t('component.bulkProcessing') : t('component.bulkEnable')}
            </button>
            <button
              type="button"
              onClick={onBulkDisable}
              disabled={selectedCount === 0 || isBulkPending}
              data-testid="project-detail-bulk-disable-button"
              className="px-3 py-1.5 rounded-md btn-theme-warning-soft text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isBulkPending ? t('component.bulkProcessing') : t('component.bulkDisable')}
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              disabled={selectedCount === 0 || isBulkPending}
              data-testid="project-detail-bulk-clear-selection-button"
              className="ml-auto px-3 py-1.5 rounded-md btn-theme-surface text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {t('component.clearSelection')}
            </button>
          </div>
        </section>
      )}

      {/* Component List */}
      <div className="space-y-6">
        {groupedComponents.map((group) => {
          const typeSectionLabel = t(`components:list.${TYPE_SECTION_LABEL_KEY[group.type]}`);
          const headingId = `project-detail-group-${group.type}`;

          return (
            <section key={group.type} aria-labelledby={headingId} className="space-y-3">
              <header className="flex items-center justify-between border-b border-theme pb-2">
                <div className="flex items-center gap-2">
                  <ComponentIcon
                    type={group.type}
                    aria-label={t('components:list.componentTypeAria', { type: typeSectionLabel })}
                  />
                  <h3 id={headingId} className="text-sm font-semibold text-theme-primary">
                    {typeSectionLabel}
                  </h3>
                </div>
                <span className="rounded-full border border-theme bg-theme-elevated px-2 py-0.5 text-xs text-theme-secondary">
                  {t('components:list.typeLabel', {
                    type: typeSectionLabel,
                    count: group.items.length,
                  })}
                </span>
              </header>

              <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {group.items.map((component) => {
                  const isSelectable = component.type !== 'hook';
                  const isSelected = selectedComponentIds.includes(component.id);
                  const typeBadgeLabel = t(`components:list.${TYPE_BADGE_LABEL_KEY[component.type]}`);
                  const cardClass = [
                    'vs-frost-panel h-full rounded-2xl border p-4 transition-all',
                    'flex flex-col gap-2',
                    selectionMode ? '' : 'vs-card-lift',
                    isSelected ? 'ring-2 ring-[var(--color-focus-ring)]' : '',
                    !component.enabled ? 'opacity-80' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');

                  const relative = getRelativeTime(component.updated_at);

                  const content = (
                    <>
                      {/* Line 1: checkbox + icon + name + type badge + status badge */}
                      <div className="flex items-center gap-2 min-w-0">
                        {selectionMode && isSelectable && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(event) => onSelectionChange?.(component.id, event.target.checked)}
                            onClick={(event) => event.stopPropagation()}
                            className="h-4 w-4 accent-[var(--color-accent)] shrink-0"
                            data-testid={`project-detail-select-${component.id}`}
                            aria-label={t('component.selectItemAria', { name: component.name })}
                          />
                        )}

                        <div className="shrink-0">
                          <ComponentIcon type={component.type} />
                        </div>

                        <p
                          className={`truncate font-semibold leading-tight ${
                            component.enabled ? 'text-theme-primary' : 'text-theme-secondary'
                          }`}
                        >
                          {component.name}
                        </p>

                        <span className="shrink-0 rounded-md border border-theme bg-theme-elevated px-2 py-0.5 text-xs text-theme-secondary">
                          {typeBadgeLabel}
                        </span>

                        {component.platform && (
                          <span className="shrink-0 rounded-md border border-theme bg-theme-elevated px-2 py-0.5 text-xs text-theme-tertiary">
                            {component.platform === 'claude_code' ? 'Claude' : component.platform === 'cursor' ? 'Cursor' : component.platform}
                          </span>
                        )}

                        <span
                          className={`ml-auto shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${
                            component.type === 'hook'
                              ? 'badge-theme-info'
                              : component.enabled
                                ? 'badge-theme-success'
                                : 'badge-theme-muted'
                          }`}
                        >
                          {component.type === 'hook'
                            ? t('component.statusAlwaysActive')
                            : component.enabled
                              ? t('component.statusActive')
                              : t('component.statusInactive')}
                        </span>
                      </div>

                      {/* Line 2: description + tags | path + time */}
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="flex-1 min-w-0">
                          {component.description && (
                            <p
                              className={`line-clamp-2 text-sm ${
                                component.enabled ? 'text-theme-secondary' : 'text-theme-tertiary'
                              }`}
                            >
                              {component.description}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-right text-xs text-theme-tertiary space-y-0.5">
                          {component.path && (
                            <p className="truncate max-w-[180px]" title={component.path}>
                              {component.path.includes('.claude')
                                ? component.path.slice(component.path.indexOf('.claude'))
                                : component.path.includes('.cursor')
                                  ? component.path.slice(component.path.indexOf('.cursor'))
                                  : component.path.split('/').pop()}
                            </p>
                          )}
                          <p>{t(`relativeTime.${relative.key}`, { count: relative.count })}</p>
                        </div>
                      </div>
                    </>
                  );

                  if (selectionMode) {
                    return (
                      <li key={component.id} className="h-full list-none">
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            if (!isSelectable) return;
                            onSelectionChange?.(component.id, !isSelected);
                          }}
                          onKeyDown={(event) => {
                            if (!isSelectable) return;
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              onSelectionChange?.(component.id, !isSelected);
                            }
                          }}
                          className={cardClass}
                          aria-label={t('component.selectItemAria', { name: component.name })}
                        >
                          {content}
                        </div>
                      </li>
                    );
                  }

                  return (
                    <li key={component.id} className="h-full list-none">
                      <Link
                        to={`/components/${component.id}`}
                        className={cardClass}
                        aria-label={t('component.viewDetailAria', { name: component.name })}
                      >
                        {content}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {/* Component Count */}
      <div className="mt-6 text-center text-sm text-theme-tertiary">
        {t('component.showing', { count: components.length })}
      </div>
    </div>
  );
}
