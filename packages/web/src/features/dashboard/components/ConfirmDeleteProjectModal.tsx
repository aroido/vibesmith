/**
 * Project hide confirmation modal - WCAG 2.1 AA: Esc key, focus trap
 * Pattern: ConfirmDeleteModal (component-detail)
 *
 * 프로젝트 삭제 → 숨기기(soft delete)로 전환됨.
 * 숨긴 프로젝트는 목록 하단에서 복원 가능.
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import FocusLock from 'react-focus-lock';
import { ModalPortal } from '@/components/common';

interface ConfirmDeleteProjectModalProps {
  isOpen: boolean;
  projectName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDeleteProjectModal({
  isOpen,
  projectName,
  onConfirm,
  onCancel,
}: ConfirmDeleteProjectModalProps) {
  const { t } = useTranslation('dashboard');
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="hide-project-modal-title"
        aria-describedby="hide-project-modal-desc"
        className="fixed inset-0 z-[2147483100] flex items-center justify-center bg-black/60"
      >
        <FocusLock autoFocus returnFocus>
          <div className="bg-theme-surface rounded-xl border border-theme p-6 max-w-md w-full mx-4">
            <h2
              id="hide-project-modal-title"
              className="text-xl font-semibold text-theme-primary mb-2"
            >
              {t('confirmHide.title')}
            </h2>
            <p id="hide-project-modal-desc" className="text-theme-secondary mb-6">
              {t('confirmHide.desc', { name: projectName })}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded-lg btn-theme-surface"
              >
                {t('confirmHide.cancel')}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="px-4 py-2 rounded-lg btn-theme-danger-soft"
                aria-label={t('confirmHide.confirmAria')}
              >
                {t('confirmHide.confirm')}
              </button>
            </div>
          </div>
        </FocusLock>
      </div>
    </ModalPortal>
  );
}
