import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import FocusLock from 'react-focus-lock';
import { AlertTriangle, Info } from 'lucide-react';
import { ModalPortal } from './ModalPortal';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  variant = 'danger',
}: ConfirmModalProps) {
  const { t } = useTranslation('common');
  const resolvedConfirmText = confirmText ?? t('confirm');
  const resolvedCancelText = cancelText ?? t('cancel');

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      button: 'btn-theme-danger-soft',
      icon: <AlertTriangle className="h-6 w-6 text-theme-warning" aria-hidden />,
    },
    warning: {
      button: 'btn-theme-warning-soft',
      icon: <AlertTriangle className="h-6 w-6 text-theme-warning" aria-hidden />,
    },
    info: {
      button: 'btn-theme-primary-soft',
      icon: <Info className="h-6 w-6 text-primary" aria-hidden />,
    },
  };

  const style = variantStyles[variant];

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[2147483100] flex items-center justify-center bg-black/70"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-desc"
      >
        <FocusLock autoFocus returnFocus>
          <div
            className="bg-theme-elevated border border-theme rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <span className="inline-flex h-7 w-7 items-center justify-center" aria-hidden>
                {style.icon}
              </span>
              <div className="flex-1">
                <h2
                  id="confirm-modal-title"
                  className="text-lg font-semibold text-theme-primary mb-2"
                >
                  {title}
                </h2>
                <p id="confirm-modal-desc" className="text-sm text-theme-secondary">
                  {message}
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 btn-theme-surface rounded-lg font-medium transition-all"
              >
                {resolvedCancelText}
              </button>
              <button
                type="button"
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${style.button}`}
              >
                {resolvedConfirmText}
              </button>
            </div>
          </div>
        </FocusLock>
      </div>
    </ModalPortal>
  );
}
