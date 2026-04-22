/**
 * VersionHistoryModal
 * 버전 히스토리 조회 및 롤백 UI (docs/api/spec.md §3)
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { showSuccessToast, showErrorToast } from '@/common/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useComponentVersions, useRollbackComponent } from '@/hooks/useVersions';
import type { VersionHistoryItem } from '@/common/api';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  componentId: string;
  componentName: string;
  onSuccess?: () => void;
}

function formatVersionDate(dateText: string, locale: string): string {
  try {
    return new Date(dateText).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateText;
  }
}

export function VersionHistoryModal({
  isOpen,
  onClose,
  componentId,
  componentName,
  onSuccess,
}: VersionHistoryModalProps) {
  const { t, i18n } = useTranslation(['components', 'common']);
  const [rollbackTarget, setRollbackTarget] = useState<VersionHistoryItem | null>(
    null
  );

  const { data: versions = [], isLoading, error } = useComponentVersions(
    isOpen ? componentId : undefined
  );
  const rollbackMutation = useRollbackComponent(componentId);

  const locale = i18n.language;
  const isCurrentVersion = (_v: VersionHistoryItem, idx: number) => idx === 0;

  const handleRollbackClick = (v: VersionHistoryItem) => setRollbackTarget(v);
  const handleRollbackConfirm = () => {
    if (!rollbackTarget) return;
    const versionNum = rollbackTarget.version;
    rollbackMutation.mutate(
      { version: versionNum },
      {
        onSuccess: () => {
          setRollbackTarget(null);
          onClose();
          onSuccess?.();
          showSuccessToast(
            t('common:hooks.versionRollbackSuccess', { version: versionNum })
          );
        },
        onError: () => {
          showErrorToast(t('common:hooks.rollbackFailed'));
        },
      }
    );
  };
  const handleRollbackCancel = () => setRollbackTarget(null);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className="bg-theme-surface border-theme text-theme-primary max-w-lg"
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle id="version-history-title" className="text-theme-primary">
              {t('components:detail.versionHistory.title')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-theme-secondary text-sm mb-4">
            {t('components:detail.versionHistory.subtitle', { name: componentName })}
          </p>

          {isLoading && (
            <div
              role="status"
              aria-label={t('components:detail.versionHistory.loading')}
              className="h-32 rounded-lg bg-theme-elevated animate-pulse"
            />
          )}

          {error && (
            <p role="alert" className="text-theme-danger text-sm">
              {t('components:detail.versionHistory.loadError')}
            </p>
          )}

          {!isLoading && !error && versions.length === 0 && (
            <p className="text-theme-secondary text-sm py-4">
              {t('components:detail.versionHistory.empty')}
            </p>
          )}

          {!isLoading && !error && versions.length > 0 && (
            <ul
              className="space-y-2 max-h-64 overflow-y-auto"
              role="list"
              aria-label={t('components:detail.versionHistory.listAria')}
            >
              {versions.map((v: VersionHistoryItem, idx: number) => (
                <li
                  key={v.version}
                  className="flex items-center justify-between gap-4 rounded-lg bg-theme-elevated border border-theme p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-primary font-medium">
                        v{v.version}
                      </span>
                      {isCurrentVersion(v, idx) && (
                        <span
                          className="text-xs px-2 py-0.5 rounded badge-theme-info"
                          aria-label={t('components:detail.versionHistory.currentAria')}
                        >
                          {t('components:detail.versionHistory.current')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-theme-secondary mt-1">
                      {formatVersionDate(v.created_at, locale)}
                    </p>
                  </div>
                  {!isCurrentVersion(v, idx) && (
                    <button
                      type="button"
                      onClick={() => handleRollbackClick(v)}
                      className="px-3 py-1.5 rounded-lg btn-theme-warning-soft text-sm font-medium shrink-0"
                      aria-label={t('components:detail.versionHistory.rollbackAria', {
                        version: v.version,
                      })}
                    >
                      {t('components:detail.versionHistory.rollback')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!rollbackTarget}
        onOpenChange={(open) => !open && handleRollbackCancel()}
      >
        <AlertDialogContent className="bg-theme-surface border-theme text-theme-primary">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-theme-primary">
              {t('components:detail.versionHistory.rollbackConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-theme-secondary">
              {rollbackTarget &&
                t('components:detail.versionHistory.rollbackConfirmDesc', {
                  version: rollbackTarget.version,
                  name: componentName,
                })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={handleRollbackCancel}
              className="btn-theme-surface"
            >
              {t('common:cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRollbackConfirm}
              disabled={rollbackMutation.isPending}
              className="btn-theme-warning-soft disabled:opacity-50"
            >
              {rollbackMutation.isPending
                ? t('components:detail.versionHistory.rollingBack')
                : t('components:detail.versionHistory.rollback')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
