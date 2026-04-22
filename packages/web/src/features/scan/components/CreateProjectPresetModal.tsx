import { useTranslation } from 'react-i18next';
import FocusLock from 'react-focus-lock';
import { ModalPortal } from '@/components/common/ModalPortal';
import { CreateProjectPresetForm } from './CreateProjectPresetForm';

interface CreateProjectPresetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateProjectPresetModal({ isOpen, onClose }: CreateProjectPresetModalProps) {
  const { t } = useTranslation('scan');

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <FocusLock returnFocus>
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-theme bg-theme-surface shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-theme px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-theme-primary">
                  {t('createProjectWithPreset')}
                </h2>
                <p className="mt-1 text-sm text-theme-secondary">
                  {t('createProjectWithPresetHint')}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-2 py-1 text-sm text-theme-secondary hover:text-theme-primary"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <CreateProjectPresetForm onSuccess={() => onClose()} />
            </div>
          </div>
        </div>
      </FocusLock>
    </ModalPortal>
  );
}
