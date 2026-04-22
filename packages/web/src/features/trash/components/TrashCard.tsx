/**
 * Trash Card - 휴지통 항목 카드
 * 복원, 영구 삭제 액션
 */

import { useTranslation } from 'react-i18next';
import { ComponentIcon } from '@/components/common';
import type { TrashItem } from '../types';

interface TrashCardProps {
  item: TrashItem;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  isRestoring?: boolean;
  isDeleting?: boolean;
}

function formatDeletedAt(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function TrashCard({
  item,
  onRestore,
  onPermanentDelete,
  isRestoring = false,
  isDeleting = false,
}: TrashCardProps) {
  const { t } = useTranslation('trash');

  return (
    <article
      className="vs-frost-panel rounded-xl p-5 transition-colors"
      aria-labelledby={`trash-item-${item.id}-name`}
    >
      <div className="flex items-start gap-4">
        <ComponentIcon
          type={item.type}
          aria-label={t('typeAria', { type: item.type })}
          className="shrink-0"
        />
        <div className="flex-1 min-w-0">
          <h3
            id={`trash-item-${item.id}-name`}
            className="text-lg font-semibold text-theme-primary font-mono truncate"
          >
            {item.name}
          </h3>
          <p className="text-sm text-theme-secondary mt-0.5 line-clamp-2">
            {item.description || '—'}
          </p>
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-theme-tertiary">
            <span>{item.project_name}</span>
            <span aria-label={t('deletedAt')}>
              {formatDeletedAt(item.deleted_at)}
            </span>
          </div>
          {item.content && (
            <pre className="mt-2 text-xs text-theme-tertiary line-clamp-2 overflow-hidden rounded bg-theme-elevated p-2 font-mono">
              {item.content.slice(0, 120)}...
            </pre>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => onRestore(item.id)}
            disabled={isRestoring || isDeleting}
            className="px-3 py-1.5 rounded-lg btn-theme-primary-soft text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={t('restoreAria', { name: item.name })}
          >
            {isRestoring ? '...' : t('restore')}
          </button>
          <button
            type="button"
            onClick={() => onPermanentDelete(item.id)}
            disabled={isRestoring || isDeleting}
            className="px-3 py-1.5 rounded-lg btn-theme-danger-soft text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={t('permanentDeleteAria', { name: item.name })}
          >
            {isDeleting ? '...' : t('permanentDelete')}
          </button>
        </div>
      </div>
    </article>
  );
}
