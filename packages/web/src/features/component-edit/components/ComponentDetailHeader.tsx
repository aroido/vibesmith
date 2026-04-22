/**
 * ComponentDetailHeader - Back button, name, description, tags, path, badge
 */

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FolderOpen, Tag } from 'lucide-react';
import type { ComponentDetailResponse } from '@/common/api';

interface ComponentDetailHeaderProps {
  component: ComponentDetailResponse;
}

export function ComponentDetailHeader({ component }: ComponentDetailHeaderProps) {
  const { t } = useTranslation('components');
  return (
    <header className="space-y-2">
      <Link
        to="/components"
        className="text-primary hover:underline font-medium"
      >
        ← {t('detail.backToList')}
      </Link>
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-2xl font-bold text-theme-primary">{component.name}</h1>
        <span
          className="text-xs font-mono px-2 py-0.5 rounded"
          aria-label={component.enabled ? t('detail.enabledLabel') : t('detail.disabledLabel')}
        >
          {component.enabled ? t('detail.enabled') : t('detail.disabled')}
        </span>
      </div>
      {component.description && (
        <p className="text-theme-secondary">{component.description}</p>
      )}
      {component.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <Tag className="h-3.5 w-3.5 text-theme-tertiary" aria-hidden />
          {component.tags.map((tag: string) => (
            <span
              key={tag}
              className="text-xs bg-theme-elevated px-2 py-0.5 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      {component.path && (
        <p className="inline-flex items-center gap-1 text-xs text-theme-tertiary font-mono">
          <FolderOpen className="h-3.5 w-3.5" aria-hidden />
          {component.path}
        </p>
      )}
    </header>
  );
}
