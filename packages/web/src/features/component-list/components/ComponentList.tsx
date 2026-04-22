/**
 * Component list container
 * Handles loading, error, empty states
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ComponentListItem } from './ComponentListItem';
import { ComponentIcon } from '@/components/common';
import type { ComponentListFilters } from '../types';
import type { ComponentListItem as ComponentListItemType } from '../types';

interface ComponentListProps {
  filters: ComponentListFilters;
  components: ComponentListItemType[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
  onToggle?: (componentId: string, nextEnabled: boolean) => void;
  activeToggleComponentId?: string | null;
  selectionMode?: boolean;
  selectedComponentIds?: string[];
  onSelectionChange?: (componentId: string, selected: boolean) => void;
}

const TYPE_ORDER: ComponentListItemType['type'][] = [
  'skill',
  'agent',
  'command',
  'hook',
  'rule',
];

const TYPE_LABEL_KEY: Record<
  ComponentListItemType['type'],
  'typeTabSkill' | 'typeTabAgent' | 'typeTabCommand' | 'typeTabHook' | 'typeTabRule'
> = {
  skill: 'typeTabSkill',
  agent: 'typeTabAgent',
  command: 'typeTabCommand',
  hook: 'typeTabHook',
  rule: 'typeTabRule',
};

export function ComponentList({
  filters,
  components,
  isLoading,
  error,
  onRetry,
  onToggle,
  activeToggleComponentId = null,
  selectionMode = false,
  selectedComponentIds = [],
  onSelectionChange,
}: ComponentListProps) {
  const { t } = useTranslation(['components', 'common']);
  const groupedComponents = useMemo(() => {
    if (!components || components.length === 0) return [];

    const grouped = new Map<ComponentListItemType['type'], ComponentListItemType[]>();
    for (const component of components) {
      const existing = grouped.get(component.type) ?? [];
      existing.push(component);
      grouped.set(component.type, existing);
    }

    return TYPE_ORDER
      .map((type) => ({
        type,
        items: grouped.get(type) ?? [],
      }))
      .filter((group) => group.items.length > 0);
  }, [components]);

  // Loading state
  if (isLoading) {
    return (
      <div
        role="status"
        className="space-y-4"
        aria-live="polite"
        aria-busy="true"
        aria-label={t('common:loading')}
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="vs-frost-panel rounded-xl p-4 animate-pulse"
          >
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-theme-skeleton rounded" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-theme-skeleton rounded w-1/3" />
                <div className="h-3 bg-theme-skeleton rounded w-2/3" />
                <div className="h-3 bg-theme-skeleton rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="rounded-xl alert-theme-danger p-6 text-center"
      >
        <p className="font-medium mb-4">{error.message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 btn-theme-danger-soft rounded-lg font-medium transition-colors"
          >
            {t('common:retry')}
          </button>
        )}
      </div>
    );
  }

  // Empty state
  if (!components || components.length === 0) {
    const hasTypeFilter = Boolean(
      filters.type || (Array.isArray(filters.types) && filters.types.length > 0)
    );
    const message = hasTypeFilter
      ? t('components:list.noComponentsForType')
      : t('components:list.noComponentsYet');
    return (
      <div
        className="vs-frost-panel rounded-xl p-8 text-center"
        role="status"
      >
        <p className="text-theme-secondary font-mono">{message}</p>
      </div>
    );
  }

  // List state
  return (
    <ul
      className="space-y-6"
      aria-label={t('components:list.componentList')}
    >
      {groupedComponents.map((group) => {
        const typeLabel = t(`components:list.${TYPE_LABEL_KEY[group.type]}`);
        const headingId = `component-list-group-${group.type}`;
        return (
          <li key={group.type} className="list-none">
            <section aria-labelledby={headingId} className="space-y-3">
              <header className="flex items-center justify-between border-b border-theme pb-2">
                <div className="flex items-center gap-2">
                  <ComponentIcon
                    type={group.type}
                    aria-label={t('components:list.componentTypeAria', { type: typeLabel })}
                  />
                  <h3 id={headingId} className="text-sm font-semibold text-theme-primary">
                    {typeLabel}
                  </h3>
                </div>
                <span className="rounded-full border border-theme bg-theme-elevated px-2 py-0.5 text-xs text-theme-secondary">
                  {t('components:list.typeLabel', {
                    type: typeLabel,
                    count: group.items.length,
                  })}
                </span>
              </header>
              <ul
                role="list"
                aria-label={t('components:list.typeSectionAria', {
                  type: typeLabel,
                })}
                className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4"
              >
                {group.items.map((component) => (
                  <li key={component.id} className="h-full">
                    <ComponentListItem
                      component={component}
                      onToggle={onToggle}
                      isTogglePending={activeToggleComponentId === component.id}
                      selectionMode={selectionMode}
                      isSelected={selectedComponentIds.includes(component.id)}
                      onSelectionChange={onSelectionChange}
                    />
                  </li>
                ))}
              </ul>
            </section>
          </li>
        );
      })}
    </ul>
  );
}
