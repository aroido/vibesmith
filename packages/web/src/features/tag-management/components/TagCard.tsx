/**
 * TagCard - 태그 관리 카드 (편집/삭제 버튼 포함)
 * Issue #498
 */

import { useTranslation } from 'react-i18next';
import { TagBadge } from './TagBadge';
import { Pencil, Trash2 } from 'lucide-react';

export interface TagCardData {
  id: number;
  name: string;
  color: string;
  count: number;
  description?: string;
}

interface TagCardProps {
  tag: TagCardData;
  onEdit: (tag: TagCardData) => void;
  onDelete: (tag: TagCardData) => void;
}

export function TagCard({ tag, onEdit, onDelete }: TagCardProps) {
  const { t } = useTranslation('settings');

  return (
    <article
      className="flex flex-col gap-3 p-4 rounded-xl bg-theme-elevated border border-theme transition-colors hover:bg-theme-hover"
      aria-labelledby={`tag-card-${tag.id}-name`}
    >
      <div className="flex items-start justify-between gap-2">
        <span id={`tag-card-${tag.id}-name`} className="sr-only">
          {tag.name} {t('tagManagement.componentCount', { count: tag.count })}
        </span>
        <TagBadge tag={tag.name} count={tag.count} size="sm" />
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onEdit(tag)}
            className="p-1.5 rounded-md text-theme-secondary hover:text-primary hover:bg-theme-hover transition-colors"
            aria-label={t('tagManagement.editTag', { name: tag.name })}
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onDelete(tag)}
            className="p-1.5 rounded-md text-theme-secondary hover:text-theme-danger hover:bg-theme-hover transition-colors"
            aria-label={t('tagManagement.deleteTag', { name: tag.name })}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
      {tag.description && (
        <p id={`tag-card-${tag.id}-desc`} className="text-sm text-theme-tertiary line-clamp-2">
          {tag.description}
        </p>
      )}
    </article>
  );
}
