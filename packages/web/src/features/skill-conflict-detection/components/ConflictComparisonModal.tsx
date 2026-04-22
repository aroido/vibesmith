/**
 * ConflictComparisonModal - Side-by-Side 비교 (Spec §5.2)
 * 글로벌 vs 프로젝트 내용 비교 + 해결 액션
 * Issue #159
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { ANALYTICS_NO_CAPTURE_CLASS } from '@/common/analytics/privacy';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Conflict } from '../types';
import type { ConflictResolveAction } from '../types';
import { useConflictContent } from '../hooks/useConflictContent';
import { useResolveConflict } from '../hooks/useResolveConflict';

export interface ConflictComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflict: Conflict | null;
  onResolveSuccess?: () => void;
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function ConflictComparisonModal({
  isOpen,
  onClose,
  conflict,
  onResolveSuccess,
  onToast,
}: ConflictComparisonModalProps) {
  const { t } = useTranslation('dashboard');
  const { globalContent, projectContent, isLoading } =
    useConflictContent(conflict);
  const { mutate: resolve, isPending } = useResolveConflict();
  const [renameTarget, setRenameTarget] = useState<'global' | 'project'>(
    'project'
  );
  const [newName, setNewName] = useState('');
  const [showRenameInput, setShowRenameInput] = useState(false);

  const handleResolve = (action: ConflictResolveAction) => {
    if (!conflict) return;

    if (action === 'rename') {
      if (!newName.trim()) {
        onToast?.(t('conflicts.renameRequired'), 'error');
        return;
      }
      resolve(
        {
          conflictId: conflict.id,
          request: { action: 'rename', newName: newName.trim(), target: renameTarget },
        },
        {
          onSuccess: () => {
            onToast?.(t('conflicts.resolveSuccess'), 'success');
            setShowRenameInput(false);
            setNewName('');
            onResolveSuccess?.();
          },
          onError: (err) => {
            onToast?.(err?.message ?? t('conflicts.resolveError'), 'error');
          },
        }
      );
    } else {
      resolve(
        {
          conflictId: conflict.id,
          request: { action },
        },
        {
          onSuccess: () => {
            onToast?.(t('conflicts.resolveSuccess'), 'success');
            onResolveSuccess?.();
          },
          onError: (err) => {
            onToast?.(err?.message ?? t('conflicts.resolveError'), 'error');
          },
        }
      );
    }
  };

  const handleRenameClick = () => {
    setShowRenameInput(true);
  };

  if (!conflict) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col bg-theme-elevated border-theme text-theme-primary"
        aria-labelledby="conflict-comparison-title"
        aria-describedby="conflict-comparison-desc"
      >
        <DialogHeader>
          <DialogTitle id="conflict-comparison-title" className="text-xl text-theme-primary">
            {t('conflicts.comparisonTitle', {
              name: conflict.name,
              type: conflict.type,
            })}
          </DialogTitle>
          <DialogDescription id="conflict-comparison-desc" className="text-theme-secondary">
            {t('conflicts.comparisonDesc', {
              project: conflict.projectName,
            })}
            {t('conflicts.aiUsesVersion')}
          </DialogDescription>
        </DialogHeader>

        {/* Side-by-Side panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 flex-1 min-h-0 overflow-hidden">
          <div
            className="flex flex-col rounded-lg border border-theme bg-theme-surface overflow-hidden"
            aria-label={t('conflicts.globalVersion')}
          >
            <div className="px-3 py-2 bg-theme-elevated text-sm font-medium text-theme-secondary shrink-0">
              {t('conflicts.globalLabel')}
            </div>
            <pre
              className={`${ANALYTICS_NO_CAPTURE_CLASS} flex-1 overflow-auto p-4 text-sm text-theme-secondary whitespace-pre-wrap font-mono min-h-[200px]`}
            >
              {isLoading ? t('conflicts.loadingContent') : globalContent || '—'}
            </pre>
          </div>
          <div
            className="flex flex-col rounded-lg border border-theme bg-theme-surface overflow-hidden"
            aria-label={t('conflicts.projectVersion')}
          >
            <div className="shrink-0 px-3 py-2 text-sm font-medium badge-theme-success">
              <span className="inline-flex items-center gap-1">
                {t('conflicts.projectLabel')} ({conflict.projectName})
                <CheckCircle2 className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <pre
              className={`${ANALYTICS_NO_CAPTURE_CLASS} flex-1 overflow-auto p-4 text-sm text-theme-secondary whitespace-pre-wrap font-mono min-h-[200px]`}
            >
              {isLoading ? t('conflicts.loadingContent') : projectContent || '—'}
            </pre>
          </div>
        </div>

        {/* Rename input (optional) */}
        {showRenameInput && (
          <div className="mt-4 p-4 rounded-lg alert-theme-warning space-y-2">
            <label htmlFor="rename-input" className="block text-sm text-theme-secondary">
              {t('conflicts.newNameLabel')}
            </label>
            <div className="flex gap-2">
              <select
                id="rename-target"
                value={renameTarget}
                onChange={(e) =>
                  setRenameTarget(e.target.value as 'global' | 'project')
                }
                className="px-3 py-2 rounded-lg bg-theme-surface border border-theme text-theme-primary text-sm"
              >
                <option value="global">{t('conflicts.renameGlobal')}</option>
                <option value="project">{t('conflicts.renameProject')}</option>
              </select>
              <input
                id="rename-input"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={conflict.name}
                className="flex-1 px-3 py-2 rounded-lg bg-theme-surface border border-theme text-theme-primary placeholder:text-theme-tertiary text-sm"
                aria-label={t('conflicts.newNameLabel')}
              />
              <button
                type="button"
                onClick={() => handleResolve('rename')}
                disabled={isPending || !newName.trim()}
                className="px-4 py-2 rounded-lg btn-theme-warning-soft disabled:opacity-50 text-sm font-medium"
              >
                {isPending ? '…' : t('conflicts.renameConfirm')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowRenameInput(false);
                  setNewName('');
                }}
                className="px-4 py-2 rounded-lg btn-theme-surface text-sm"
              >
                {t('conflicts.cancel')}
              </button>
            </div>
          </div>
        )}

        {/* Resolution actions */}
        {!showRenameInput && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-theme">
            <button
              type="button"
              onClick={() => handleResolve('disable_global')}
              disabled={isPending}
              className="px-4 py-2 rounded-lg btn-theme-warning-soft text-sm font-medium disabled:opacity-50"
            >
              {t('conflicts.disableGlobal')}
            </button>
            <button
              type="button"
              onClick={() => handleResolve('delete_project')}
              disabled={isPending}
              className="px-4 py-2 rounded-lg btn-theme-danger-soft text-sm font-medium disabled:opacity-50"
            >
              {t('conflicts.deleteProject')}
            </button>
            <button
              type="button"
              onClick={handleRenameClick}
              disabled={isPending}
              className="px-4 py-2 rounded-lg btn-theme-primary-soft text-sm font-medium disabled:opacity-50"
            >
              {t('conflicts.rename')}
            </button>
            <button
              type="button"
              onClick={() => handleResolve('ignore')}
              disabled={isPending}
              className="px-4 py-2 rounded-lg btn-theme-surface text-sm font-medium disabled:opacity-50"
            >
              {t('conflicts.ignore')}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
