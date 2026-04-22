import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import FocusLock from 'react-focus-lock';
import { ModalPortal } from '@/components/common';

interface HideProjectModalProps {
  isOpen: boolean;
  projectName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function HideProjectModal({
  isOpen,
  projectName,
  onConfirm,
  onCancel,
}: HideProjectModalProps) {
  const { t } = useTranslation('dashboard');

  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
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
          <div className="mx-4 w-full max-w-md rounded-xl border border-theme bg-theme-surface p-6">
            <h2 id="hide-project-modal-title" className="mb-2 text-xl font-semibold text-theme-primary">
              {t('confirmHide.title')}
            </h2>
            <p id="hide-project-modal-desc" className="mb-6 text-theme-secondary">
              {t('confirmHide.desc', { name: projectName })}
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg px-4 py-2 btn-theme-surface"
              >
                {t('confirmHide.cancel')}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="rounded-lg px-4 py-2 btn-theme-danger-soft"
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
