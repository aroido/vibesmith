/**
 * Backup Page
 * 로컬 백업 생성/목록/복원/삭제 UI
 */

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { ConfirmModal, PageFrame } from '@/components/common';
import type { BackupItem } from '../types';
import { useBackupList } from '../hooks/useBackupList';
import { useCreateBackup } from '../hooks/useCreateBackup';
import { useRestoreBackup } from '../hooks/useRestoreBackup';
import { useDeleteBackup } from '../hooks/useDeleteBackup';

function formatDate(dateText: string, locale: string): string {
  try {
    return new Date(dateText).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateText;
  }
}

function shortChecksum(value: string): string {
  if (!value) return '-';
  if (value.length <= 20) return value;
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

export function BackupPage() {
  const { t, i18n } = useTranslation(['backup', 'common', 'navigation']);
  const { data, isLoading, error, refetch } = useBackupList();
  const createMutation = useCreateBackup();
  const restoreMutation = useRestoreBackup();
  const deleteMutation = useDeleteBackup();

  const [isCreateConfirmOpen, setIsCreateConfirmOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<BackupItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BackupItem | null>(null);

  const backups = useMemo(
    () =>
      [...(data ?? [])].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [data]
  );

  const onCreateConfirm = useCallback(() => {
    createMutation.mutate();
  }, [createMutation]);

  const onRestoreConfirm = useCallback(() => {
    if (!restoreTarget) return;
    restoreMutation.mutate(restoreTarget.id);
  }, [restoreMutation, restoreTarget]);

  const onDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id);
  }, [deleteMutation, deleteTarget]);

  const headerActions = (
    <>
      <button
        type="button"
        onClick={() => void refetch()}
        disabled={isLoading}
        className="inline-flex items-center gap-2 rounded-lg btn-theme-surface px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
        aria-label={t('backup:refresh')}
      >
        <RefreshCw className="h-4 w-4" aria-hidden />
        {t('backup:refresh')}
      </button>
      <button
        type="button"
        onClick={() => setIsCreateConfirmOpen(true)}
        disabled={createMutation.isPending}
        className="inline-flex items-center gap-2 rounded-lg btn-theme-primary-soft px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
        aria-label={t('backup:createAria')}
      >
        <ShieldCheck className="h-4 w-4" aria-hidden />
        {createMutation.isPending ? t('backup:creating') : t('backup:create')}
      </button>
    </>
  );

  return (
    <PageFrame
      activeNav="settings"
      title={t('navigation:secondary.backup')}
      subtitle={t('backup:subtitle')}
      actions={headerActions}
    >
      {isLoading && (
        <div role="status" aria-live="polite" aria-busy="true" className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl border border-theme bg-theme-surface" />
          ))}
        </div>
      )}

      {error && (
        <div role="alert" aria-live="assertive" className="rounded-xl alert-theme-danger p-6 text-center">
          <p className="mb-2 font-medium">{t('backup:loadError')}</p>
          <p className="mb-4 text-sm text-theme-secondary">{error.message}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-lg btn-theme-danger-soft px-4 py-2 font-medium"
          >
            {t('backup:retry')}
          </button>
        </div>
      )}

      {!isLoading && !error && backups.length === 0 && (
        <section className="rounded-xl border border-dashed border-theme bg-theme-elevated px-6 py-10 text-center">
          <h2 className="text-lg font-semibold text-theme-primary">{t('backup:emptyTitle')}</h2>
          <p className="mt-2 text-sm text-theme-secondary">{t('backup:emptyDescription')}</p>
          <button
            type="button"
            onClick={() => setIsCreateConfirmOpen(true)}
            className="mt-5 rounded-lg btn-theme-primary-soft px-4 py-2 text-sm font-medium"
          >
            {t('backup:create')}
          </button>
        </section>
      )}

      {!isLoading && !error && backups.length > 0 && (
        <section role="list" aria-label={t('backup:listAria')} className="space-y-3">
          {backups.map((backup) => {
            const isRestoring =
              restoreMutation.isPending && restoreMutation.variables === backup.id;
            const isDeleting =
              deleteMutation.isPending && deleteMutation.variables === backup.id;

            return (
              <article
                key={backup.id}
                role="listitem"
                className="vs-frost-panel rounded-xl p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm text-theme-primary">{backup.id}</p>
                    <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-theme-secondary sm:grid-cols-2 lg:grid-cols-4">
                      <p>
                        <span className="font-medium">{t('backup:version')}:</span> {backup.version}
                      </p>
                      <p>
                        <span className="font-medium">{t('backup:size')}:</span>{' '}
                        {t('backup:sizeBytes', { size: backup.size_bytes })}
                      </p>
                      <p title={backup.checksum}>
                        <span className="font-medium">{t('backup:checksum')}:</span>{' '}
                        {shortChecksum(backup.checksum)}
                      </p>
                      <p>
                        <span className="font-medium">{t('backup:createdAt')}:</span>{' '}
                        {formatDate(backup.created_at, i18n.language)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRestoreTarget(backup)}
                      disabled={isRestoring}
                      aria-label={t('backup:restoreAria', { id: backup.id })}
                      className="rounded-lg btn-theme-warning-soft px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {isRestoring ? t('backup:restoring') : t('backup:restore')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(backup)}
                      disabled={isDeleting}
                      aria-label={t('backup:deleteAria', { id: backup.id })}
                      className="rounded-lg btn-theme-danger-soft px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {isDeleting ? t('backup:deleting') : t('backup:delete')}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <ConfirmModal
        isOpen={isCreateConfirmOpen}
        onClose={() => setIsCreateConfirmOpen(false)}
        onConfirm={onCreateConfirm}
        title={t('backup:createConfirmTitle')}
        message={t('backup:createConfirmMessage')}
        confirmText={t('backup:create')}
        cancelText={t('common:cancel')}
        variant="info"
      />

      <ConfirmModal
        isOpen={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={onRestoreConfirm}
        title={t('backup:restoreConfirmTitle')}
        message={t('backup:restoreConfirmMessage')}
        confirmText={t('backup:restore')}
        cancelText={t('common:cancel')}
        variant="warning"
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={onDeleteConfirm}
        title={t('backup:deleteConfirmTitle')}
        message={t('backup:deleteConfirmMessage')}
        confirmText={t('backup:delete')}
        cancelText={t('common:cancel')}
        variant="danger"
      />
    </PageFrame>
  );
}
