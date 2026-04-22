/**
 * Delete confirmation modal
 */

import { useTranslation } from 'react-i18next';
import { ModalPortal } from '@/components/common';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  componentName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDeleteModal({
  isOpen,
  componentName,
  onConfirm,
  onCancel,
}: ConfirmDeleteModalProps) {
  const { t } = useTranslation(['components', 'common']);

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        className="fixed inset-0 z-[2147483100] flex items-center justify-center bg-black/60"
      >
        <div className="bg-theme-surface rounded-xl border border-theme p-6 max-w-md w-full mx-4">
          <h2 id="delete-modal-title" className="text-xl font-semibold text-theme-primary mb-2">
            {t('components:detail.deleteTitle')}
          </h2>
          <p className="text-theme-secondary mb-6">
            {t('components:detail.deleteConfirm', { name: componentName })}
          </p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg btn-theme-surface"
            >
              {t('common:cancel')}
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 rounded-lg btn-theme-danger-soft"
              aria-label={t('components:detail.deleteConfirmAria')}
            >
              {t('components:detail.delete')}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
