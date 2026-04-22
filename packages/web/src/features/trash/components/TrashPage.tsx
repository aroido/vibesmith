/**
 * Trash Page
 * 휴지통 목록, 복원, 영구 삭제, 모두 비우기
 */

import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw, Trash2 } from 'lucide-react';
import { ConfirmModal, PageFrame, ComponentWorkspaceTabs } from '@/components/common';
import type { TrashItem } from '../types';
import { useTrashList } from '../hooks/useTrashList';
import { useRestoreTrash } from '../hooks/useRestoreTrash';
import { usePermanentDeleteTrash } from '../hooks/usePermanentDeleteTrash';
import { useEmptyTrash } from '../hooks/useEmptyTrash';
import { TrashCard } from './TrashCard';
import { TrashEmptyState } from './TrashEmptyState';

export function TrashPage() {
  const { t } = useTranslation('trash');
  const { data, isLoading, error, refetch } = useTrashList();
  const items: TrashItem[] = useMemo(() => data ?? [], [data]);
  const restoreMutation = useRestoreTrash();
  const deleteMutation = usePermanentDeleteTrash();
  const emptyMutation = useEmptyTrash();

  const [emptyModalOpen, setEmptyModalOpen] = useState(false);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const handleRestore = useCallback(
    (id: string) => {
      restoreMutation.mutate(id);
    },
    [restoreMutation]
  );

  const handlePermanentDeleteClick = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id);
      if (item) setPermanentDeleteTarget({ id: item.id, name: item.name });
    },
    [items]
  );

  const handlePermanentDeleteConfirm = useCallback(() => {
    if (permanentDeleteTarget) {
      deleteMutation.mutate(permanentDeleteTarget.id);
      setPermanentDeleteTarget(null);
    }
  }, [permanentDeleteTarget, deleteMutation]);

  const handleEmptyAll = useCallback(() => {
    setEmptyModalOpen(true);
  }, []);

  const handleEmptyConfirm = useCallback(() => {
    emptyMutation.mutate();
    setEmptyModalOpen(false);
  }, [emptyMutation]);

  const isRestoring = (id: string) => restoreMutation.isPending && restoreMutation.variables === id;
  const isDeleting = (id: string) => deleteMutation.isPending && deleteMutation.variables === id;

  const headerActions = items.length > 0 ? (
    <>
      <button
        type="button"
        onClick={() => void refetch()}
        disabled={isLoading}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg btn-theme-surface text-sm font-medium transition-colors disabled:opacity-50"
        aria-label={t('refresh')}
      >
        <RotateCcw className="w-4 h-4" aria-hidden />
        {t('refresh')}
      </button>
      <button
        type="button"
        onClick={handleEmptyAll}
        disabled={emptyMutation.isPending}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg btn-theme-danger-soft text-sm font-medium transition-colors disabled:opacity-50"
        aria-label={t('emptyAllAria')}
      >
        <Trash2 className="w-4 h-4" aria-hidden />
        {t('emptyAll')}
      </button>
    </>
  ) : null;

  return (
    <PageFrame
      activeNav="components"
      title={t('title')}
      subtitle={t('subtitle')}
      actions={headerActions}
      contentClassName="max-w-[88rem] mx-auto"
    >
      <div className="mb-6">
        <ComponentWorkspaceTabs active="trash" />
      </div>

      {isLoading && (
        <div
          role="status"
          aria-label={t('title')}
          aria-busy="true"
          className="space-y-4"
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl bg-theme-surface border border-theme animate-pulse"
            />
          ))}
        </div>
      )}

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-xl alert-theme-danger p-6 text-center"
        >
          <p className="font-medium mb-2">{t('loadError')}</p>
          <p className="text-theme-secondary text-sm mb-4">{error.message}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="px-4 py-2 rounded-lg btn-theme-danger-soft font-medium"
            aria-label={t('retry')}
          >
            {t('retry')}
          </button>
        </div>
      )}

      {!isLoading && !error && items.length === 0 && <TrashEmptyState />}

      {!isLoading && !error && items.length > 0 && (
        <section
          className="space-y-4"
          aria-label={t('itemCount', { count: items.length })}
          role="list"
        >
          {items.map((item) => (
            <TrashCard
              key={item.id}
              item={item}
              onRestore={handleRestore}
              onPermanentDelete={handlePermanentDeleteClick}
              isRestoring={isRestoring(item.id)}
              isDeleting={isDeleting(item.id)}
            />
          ))}
        </section>
      )}

      <ConfirmModal
        isOpen={emptyModalOpen}
        onClose={() => setEmptyModalOpen(false)}
        onConfirm={handleEmptyConfirm}
        title={t('emptyAllConfirmTitle')}
        message={t('emptyAllConfirmMessage')}
        confirmText={t('emptyAll')}
        cancelText={t('cancel', { ns: 'common' })}
        variant="danger"
      />

      <ConfirmModal
        isOpen={!!permanentDeleteTarget}
        onClose={() => setPermanentDeleteTarget(null)}
        onConfirm={handlePermanentDeleteConfirm}
        title={t('permanentDeleteConfirmTitle')}
        message={t('permanentDeleteConfirmMessage')}
        confirmText={t('permanentDelete')}
        cancelText={t('cancel', { ns: 'common' })}
        variant="danger"
      />
    </PageFrame>
  );
}
