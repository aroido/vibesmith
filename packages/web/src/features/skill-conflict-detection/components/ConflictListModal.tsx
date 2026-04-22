/**
 * ConflictListModal - 충돌 목록 모달 (Spec §5.2)
 * Issue #159
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ComponentIcon } from '@/components/common';
import type { Conflict } from '../types';
import { ConflictComparisonModal } from './ConflictComparisonModal';

export interface ConflictListModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: Conflict[];
  onConflictSelect: (conflict: Conflict) => void;
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function ConflictListModal({
  isOpen,
  onClose,
  conflicts,
  onConflictSelect,
  onToast,
}: ConflictListModalProps) {
  const { t } = useTranslation('dashboard');
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(
    null
  );
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);

  const handleItemClick = (conflict: Conflict) => {
    setSelectedConflict(conflict);
    setIsComparisonOpen(true);
    onConflictSelect(conflict);
  };

  const handleComparisonClose = () => {
    setIsComparisonOpen(false);
    setSelectedConflict(null);
  };

  const handleResolveSuccess = () => {
    handleComparisonClose();
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-theme-elevated border-theme text-theme-primary"
          aria-labelledby="conflict-list-title"
          aria-describedby="conflict-list-desc"
        >
          <DialogHeader>
            <DialogTitle id="conflict-list-title" className="text-xl text-theme-primary">
              {t('conflicts.listTitle')}
            </DialogTitle>
            <p id="conflict-list-desc" className="text-sm text-theme-secondary mt-1">
              {t('conflicts.listDesc', { count: conflicts.length })}
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 mt-4">
            {conflicts.map((conflict) => (
              <button
                key={conflict.id}
                type="button"
                onClick={() => handleItemClick(conflict)}
                className="w-full text-left p-4 rounded-lg border border-theme bg-theme-surface hover:bg-theme-hover transition-colors"
                aria-label={t('conflicts.itemAria', {
                  name: conflict.name,
                  project: conflict.projectName,
                })}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <ComponentIcon type={conflict.type} className="h-6 w-6" />
                    <span className="font-mono font-semibold text-theme-primary truncate">
                      {conflict.name}
                    </span>
                    <span className="text-xs text-theme-secondary shrink-0">
                      ({conflict.type})
                    </span>
                    {conflict.isIntentional && (
                      <span className="text-xs px-2 py-0.5 rounded badge-theme-muted shrink-0">
                        {t('conflicts.ignored')}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-theme-secondary shrink-0">
                    {conflict.projectName} · {t('conflicts.priority')}:{' '}
                    {conflict.priority}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <ConflictComparisonModal
        isOpen={isComparisonOpen}
        onClose={handleComparisonClose}
        conflict={selectedConflict}
        onResolveSuccess={handleResolveSuccess}
        onToast={onToast}
      />
    </>
  );
}
