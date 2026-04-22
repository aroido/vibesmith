/**
 * Component list item
 * Displays name, description, tags, path, enabled status
 */

import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FolderOpen } from 'lucide-react';
import { ComponentIcon } from '@/components/common';
import { TagBadge } from '@/features/tag-management';
import type { ComponentListItem as ComponentListItemType } from '../types';

interface ComponentListItemProps {
  component: ComponentListItemType;
  onToggle?: (componentId: string, nextEnabled: boolean) => void;
  isTogglePending?: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (componentId: string, selected: boolean) => void;
}

const TYPE_LABEL_KEY: Record<ComponentListItemType['type'], 'typeSkill' | 'typeAgent' | 'typeCommand' | 'typeHook' | 'typeRule'> = {
  skill: 'typeSkill',
  agent: 'typeAgent',
  command: 'typeCommand',
  hook: 'typeHook',
  rule: 'typeRule',
};

export function ComponentListItem({
  component,
  onToggle,
  isTogglePending = false,
  selectionMode = false,
  isSelected = false,
  onSelectionChange,
}: ComponentListItemProps) {
  const { t, i18n } = useTranslation(['components', 'common']);
  const isDisabled = !component.enabled;
  const navigate = useNavigate();
  const typeLabel = t(`components:list.${TYPE_LABEL_KEY[component.type]}`);
  const detailPath = `/components/${component.id}`;

  const handleTagClick = (e: React.MouseEvent, tag: string) => {
    e.preventDefault();
    e.stopPropagation();
    void navigate(`/components?tags=${encodeURIComponent(tag)}`);
  };

  const handleToggleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onToggle || isTogglePending) return;
    onToggle(component.id, !component.enabled);
  };

  const handleCardClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('a,button,[role="button"]')) return;
    if (selectionMode && onSelectionChange) {
      onSelectionChange(component.id, !isSelected);
      return;
    }
    void navigate(detailPath);
  };

  return (
    <article
      onClick={handleCardClick}
      data-testid={`component-list-item-${component.id}-card`}
      className={`vs-frost-panel h-full rounded-2xl p-5 flex flex-col gap-4 border transition-all ${
        isSelected ? 'ring-2 ring-[var(--color-focus-ring)]' : ''
      } ${
        isDisabled ? 'opacity-80' : 'vs-card-lift'
      }`}
      aria-label={t('list.itemDetailAria', { name: component.name })}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {selectionMode && component.type !== 'hook' && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(event) => onSelectionChange?.(component.id, event.target.checked)}
              onClick={(event) => event.stopPropagation()}
              className="mt-1 h-4 w-4 accent-[var(--color-accent)]"
              data-testid={`component-list-select-${component.id}`}
              aria-label={t('components:list.selectItemAria', { name: component.name })}
            />
          )}
          <div className="mt-0.5">
            <ComponentIcon
              type={component.type}
              aria-label={t('list.componentTypeAria', { type: component.type })}
            />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={detailPath}
                data-testid={`component-list-item-${component.id}-link`}
                className={`block max-w-full break-all font-semibold leading-tight hover:text-primary transition-colors ${
                  isDisabled ? 'text-theme-secondary' : 'text-theme-primary'
                }`}
              >
                {component.name}
              </Link>
              <span className="rounded-md border border-theme bg-theme-elevated px-2 py-0.5 text-xs text-theme-secondary">
                {typeLabel}
              </span>
            </div>
            {component.description && (
              <p
                className={`mt-2 text-sm break-words line-clamp-3 ${
                  isDisabled ? 'text-theme-tertiary' : 'text-theme-secondary'
                }`}
              >
                {component.description}
              </p>
            )}
          </div>
        </div>
        {component.type !== 'hook' && (
          <button
            type="button"
            role="switch"
            aria-checked={component.enabled}
            onClick={handleToggleClick}
            disabled={isTogglePending}
            className="toggle-theme-track shrink-0 relative inline-flex h-7 w-12 items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={
              component.enabled
                ? t('components:list.toggleToDisabledAria')
                : t('components:list.toggleToEnabledAria')
            }
          >
            <span
              className={`toggle-theme-thumb inline-block h-5 w-5 rounded-full ${
                component.enabled ? 'translate-x-[1.375rem]' : 'translate-x-[0.1875rem]'
              }`}
            />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-md px-2 py-1 text-xs font-semibold ${
            component.type === 'hook'
              ? 'badge-theme-info'
              : component.enabled ? 'badge-theme-success' : 'badge-theme-muted'
          }`}
        >
          {component.type === 'hook'
            ? t('components:list.hookAlwaysActive')
            : component.enabled ? t('components:list.active') : t('components:list.sleep')}
        </span>
        <span
          className="inline-block max-w-full truncate rounded-md border border-theme bg-theme-elevated px-2 py-1 text-xs text-theme-secondary"
          title={component.project_name}
        >
          {component.project_name}
        </span>
      </div>

      {component.tags && component.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('list.tagsAria')}>
          {component.tags.map((tag) => (
            <span
              key={tag}
              onClick={(e) => handleTagClick(e, tag)}
              role="button"
              tabIndex={0}
              className="cursor-pointer inline-block"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleTagClick(e as unknown as React.MouseEvent, tag);
                }
              }}
            >
              <TagBadge tag={tag} size="sm" />
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto space-y-2">
        {component.path && (
          <p
            className="inline-flex items-center gap-1 text-xs text-theme-tertiary font-mono break-all line-clamp-2"
            title={component.path}
          >
            <FolderOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {component.path}
          </p>
        )}
        <p className="text-xs text-theme-tertiary">
          {new Date(component.updated_at).toLocaleString(
            i18n.language === 'ko' ? 'ko-KR' : 'en-US',
            {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            }
          )}
        </p>
      </div>
    </article>
  );
}
