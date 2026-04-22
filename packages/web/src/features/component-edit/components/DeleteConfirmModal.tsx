/**
 * Delete confirmation modal - WCAG 2.1 AA: Esc key, focus trap
 * Requires user confirmation before deleting component
 */

import { useEffect } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import FocusLock from 'react-focus-lock';
import { ModalPortal } from '@/components/common';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  componentName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export function DeleteConfirmModal({
  isOpen,
  componentName,
  onConfirm,
  onCancel,
  isDeleting = false,
}: DeleteConfirmModalProps) {
  const { t } = useTranslation('components');
  
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[2147483100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        aria-describedby="delete-modal-desc"
      >
        <FocusLock autoFocus returnFocus>
          <div
            className="mx-4 w-full max-w-md rounded-xl bg-theme-surface border border-theme p-6 shadow-xl"
            role="document"
          >
            <h2
              id="delete-modal-title"
              className="text-xl font-semibold text-theme-primary mb-2"
            >
              {t('edit.deleteTitle')}
            </h2>
            <p
              id="delete-modal-desc"
              className="text-theme-secondary mb-6"
            >
              <Trans
                i18nKey="components:edit.deleteMessage"
                values={{ name: componentName }}
                components={{ strong: <strong className="text-primary" /> }}
              />
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onCancel}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg font-medium btn-theme-surface transition-colors disabled:opacity-50"
              >
                {t('edit.deleteCancel')}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg font-medium btn-theme-danger-soft transition-colors disabled:opacity-50"
                aria-label={t('edit.deleteConfirmLabel')}
              >
                {isDeleting ? t('edit.deleting') : t('edit.deleteConfirm')}
              </button>
            </div>
          </div>
        </FocusLock>
      </div>
    </ModalPortal>
  );
}
