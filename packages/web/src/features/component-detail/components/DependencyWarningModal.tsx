/**
 * Dependency warning modal - WCAG 2.1 AA: Esc key, focus trap
 * Shown after toggle when affected_dependencies exist (post-toggle, disable case)
 * Cancel = rollback toggle, Confirm = close modal
 */

import { useTranslation } from 'react-i18next';
import FocusLock from 'react-focus-lock';
import { ModalPortal } from '@/components/common';
import type { DependencyItem } from '../types';

interface DependencyWarningModalProps {
  isOpen: boolean;
  componentName: string;
  affectedDependencies: DependencyItem[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function DependencyWarningModal({
  isOpen,
  componentName,
  affectedDependencies,
  onConfirm,
  onCancel,
}: DependencyWarningModalProps) {
  const { t } = useTranslation(['components', 'common']);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
  };

  return (
    <ModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dependency-warning-title"
        aria-describedby="dependency-warning-desc"
        className="fixed inset-0 z-[2147483100] flex items-center justify-center bg-black/60"
        onClick={handleBackdropClick}
        onKeyDown={handleKeyDown}
      >
        <FocusLock autoFocus returnFocus>
          <div
            className="bg-theme-surface rounded-xl border border-theme p-6 max-w-md w-full mx-4"
            role="document"
          >
            <h2
              id="dependency-warning-title"
              className="text-xl font-semibold text-theme-primary mb-2"
            >
              {t('components:detail.disableConfirmTitle', { name: componentName })}
            </h2>
            <p id="dependency-warning-desc" className="text-theme-secondary mb-4">
              {t('components:detail.usedBy')}
            </p>
            <ul className="list-disc list-inside text-theme-secondary mb-4 space-y-1">
              {affectedDependencies.map((dep) => (
                <li key={dep.id}>
                  {dep.name} ({dep.type})
                </li>
              ))}
            </ul>
            <p className="text-theme-secondary text-sm mb-6">
              {t('components:detail.disableWarning')}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded-lg btn-theme-surface"
                aria-label={t('common:cancel')}
              >
                {t('common:cancel')}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="px-4 py-2 rounded-lg btn-theme-warning-soft"
                aria-label={t('components:detail.disableAnywayAria')}
              >
                {t('components:detail.disableAnyway')}
              </button>
            </div>
          </div>
        </FocusLock>
      </div>
    </ModalPortal>
  );
}
