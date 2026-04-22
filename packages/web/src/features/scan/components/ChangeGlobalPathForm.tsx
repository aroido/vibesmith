/**
 * ChangeGlobalPathForm - 글로벌 경로 변경 (spec §5.3)
 * Tailwind CSS, 접근성(a11y), 확인 다이얼로그
 */

import { useState, useCallback, useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCw } from 'lucide-react';
import { ModalPortal } from '@/components/common';
import { useScan } from '../hooks/useScan';
import type { ScanResponse } from '../types';

interface ChangeGlobalPathFormProps {
  currentPath: string;
  mode?: 'claude' | 'cursor';
  onSuccess?: (result: ScanResponse) => void;
}

function isValidPath(path: string): boolean {
  const trimmed = path.trim();
  if (!trimmed) return false;
  return trimmed.startsWith('/') || trimmed.startsWith('~/');
}

export function ChangeGlobalPathForm({
  currentPath,
  mode = 'claude',
  onSuccess,
}: ChangeGlobalPathFormProps) {
  const { t } = useTranslation(['scan', 'common']);
  const [homePath, setHomePath] = useState(currentPath);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const isCursorMode = mode === 'cursor';
  const labelKey = isCursorMode ? 'scan:cursorGlobalPathLabel' : 'scan:globalPathLabel';
  const placeholderKey = isCursorMode
    ? 'scan:cursorGlobalPathPlaceholder'
    : 'scan:globalPathPlaceholder';
  const inputId = useId();
  const errorId = `${inputId}-error`;

  // Sync with currentPath prop changes
  useEffect(() => {
    setHomePath(currentPath);
  }, [currentPath]);

  const { mutate, isPending } = useScan({
    onSuccess: (result) => {
      setError(null);
      setShowConfirm(false);
      onSuccess?.(result);
    },
  });

  const handlePathChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setHomePath(e.target.value);
    setError(null);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = homePath.trim();
    if (!trimmed) {
      setError(t('scan:pathRequired'));
      return;
    }
    if (!isValidPath(trimmed)) {
      setError(t('scan:pathAbsoluteRequired'));
      return;
    }

    setShowConfirm(true);
  };

  const handleConfirm = () => {
    const trimmed = homePath.trim();
    if (isCursorMode) {
      mutate({ cursor_global_path: trimmed });
      return;
    }
    mutate({ home_path: trimmed });
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-theme-secondary mb-2"
          >
            {t(labelKey)}
          </label>
          <div className="flex gap-2">
            <input
              id={inputId}
              type="text"
              value={homePath}
              onChange={handlePathChange}
              disabled={isPending}
              placeholder={t(placeholderKey)}
              aria-describedby={error ? errorId : undefined}
              aria-invalid={!!error}
              className="flex-1 px-4 py-2 rounded-lg input-theme disabled:opacity-50"
            />
          </div>
          {error && (
            <p
              id={errorId}
              role="alert"
              className="mt-2 text-sm text-theme-danger"
            >
              {error}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg btn-theme-primary-soft font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <RotateCw className="h-4 w-4 animate-spin" aria-hidden />
              <span>{t('scan:changing')}</span>
            </>
          ) : (
            <span>{t('scan:changeGlobalPath')}</span>
          )}
        </button>
      </form>

      {showConfirm && (
        <ModalPortal>
          <div
            role="dialog"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-desc"
            aria-modal="true"
            className="fixed inset-0 z-[2147483100] flex items-center justify-center p-4 bg-black/60"
            onClick={(e) => e.target === e.currentTarget && handleCancel()}
            onKeyDown={(e) => e.key === 'Escape' && handleCancel()}
          >
            <div
              className="bg-theme-elevated border border-theme rounded-xl p-6 max-w-md w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                id="confirm-dialog-title"
                className="text-lg font-semibold text-theme-primary mb-2"
              >
                {t('scan:confirmTitle')}
              </h2>
              <p
                id="confirm-dialog-desc"
                className="text-theme-secondary mb-4"
              >
                {t('scan:confirmMessage')}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 rounded-lg btn-theme-surface font-medium transition-colors"
                >
                  {t('common:cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isPending}
                  className="px-4 py-2 rounded-lg btn-theme-primary-soft font-semibold transition-all disabled:opacity-50"
                >
                  {t('common:confirm')}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
