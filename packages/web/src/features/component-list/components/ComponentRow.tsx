/**
 * ComponentRow - Table row for component list table view
 * Used in ComponentListPage when viewMode is 'table'
 */

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ComponentListItem } from '../types';

interface ComponentRowProps {
  component: ComponentListItem;
  onToggle?: (componentId: string, nextEnabled: boolean) => void;
  isTogglePending?: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (componentId: string, selected: boolean) => void;
}

export function ComponentRow({
  component,
  onToggle,
  isTogglePending = false,
  selectionMode = false,
  isSelected = false,
  onSelectionChange,
}: ComponentRowProps) {
  const { t, i18n } = useTranslation(['components']);

  return (
    <tr
      key={component.id}
      className={`border-t border-theme transition-colors hover:bg-theme-hover ${
        isSelected ? 'bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]' : ''
      }`}
    >
      {selectionMode && component.type !== 'hook' && (
        <td className="px-4 py-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(event) => onSelectionChange?.(component.id, event.target.checked)}
            className="h-4 w-4 accent-[var(--color-accent)]"
            data-testid={`component-list-row-select-${component.id}`}
            aria-label={t('components:list.selectItemAria', { name: component.name })}
          />
        </td>
      )}
      <td className="px-4 py-3">
        <Link
          to={`/components/${component.id}`}
          data-testid={`component-list-row-${component.id}-link`}
          className="text-theme-primary hover:text-primary font-medium"
        >
          {component.name}
        </Link>
        {component.description && (
          <p className="text-xs text-theme-secondary mt-1 line-clamp-1">
            {component.description}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-theme-secondary capitalize">{component.type}</td>
      <td className="px-4 py-3 text-theme-secondary">{component.project_name}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-mono px-2 py-0.5 rounded ${
              component.type === 'hook'
                ? 'badge-theme-info'
                : component.enabled
                  ? 'badge-theme-success'
                  : 'badge-theme-muted'
            }`}
          >
            {component.type === 'hook'
              ? t('components:list.hookAlwaysActive')
              : component.enabled
                ? t('components:list.active')
                : t('components:list.sleep')}
          </span>
          {component.type !== 'hook' && (
            <button
              type="button"
              role="switch"
              aria-checked={component.enabled}
              onClick={() => onToggle?.(component.id, !component.enabled)}
              disabled={isTogglePending}
              className="toggle-theme-track shrink-0 relative inline-flex h-6 w-10 items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={
                component.enabled
                  ? t('components:list.toggleToDisabledAria')
                  : t('components:list.toggleToEnabledAria')
              }
            >
              <span
                className={`toggle-theme-thumb inline-block h-4 w-4 rounded-full ${
                  component.enabled ? 'translate-x-[1.25rem]' : 'translate-x-[0.1875rem]'
                }`}
              />
            </button>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {component.tags.slice(0, 3).map((tag) => (
            <Link
              key={tag}
              to={`/components?tags=${encodeURIComponent(tag)}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-block"
            >
              <span className="text-xs text-theme-secondary bg-theme-elevated px-2 py-0.5 rounded hover:bg-theme-hover">
                {tag}
              </span>
            </Link>
          ))}
          {component.tags.length > 3 && (
            <span className="text-xs text-theme-tertiary">
              +{component.tags.length - 3}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-theme-secondary">
        {new Date(component.updated_at).toLocaleString(
          i18n.language === 'ko' ? 'ko-KR' : 'en-US',
          {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }
        )}
      </td>
    </tr>
  );
}
