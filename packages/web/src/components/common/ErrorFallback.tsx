import type { ErrorInfo } from 'react';
import { useTranslation } from 'react-i18next';

type ErrorFallbackProps = {
  error: Error;
  errorInfo?: ErrorInfo;
  onReset?: () => void;
  variant?: 'full' | 'inline';
};

/**
 * 에러 발생 시 표시되는 폴백 UI 컴포넌트
 * 
 * @example
 * ```tsx
 * <ErrorBoundary fallback={<ErrorFallback />}>
 *   <App />
 * </ErrorBoundary>
 * ```
 * 
 * @example
 * ```tsx
 * <ErrorBoundary
 *   fallback={(error, errorInfo) => (
 *     <ErrorFallback
 *       error={error}
 *       errorInfo={errorInfo}
 *       variant="inline"
 *       onReset={() => window.location.reload()}
 *     />
 *   )}
 * >
 *   <SomeComponent />
 * </ErrorBoundary>
 * ```
 */
export function ErrorFallback({
  error,
  errorInfo,
  onReset,
  variant = 'full',
}: ErrorFallbackProps) {
  const { t } = useTranslation('common');

  const handleReset = () => {
    if (onReset) {
      onReset();
    } else {
      window.location.reload();
    }
  };

  if (variant === 'inline') {
    return (
      <div className="rounded-lg alert-theme-danger p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-theme-danger"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-theme-danger">{t('errorOccurred')}</h3>
            <p className="mt-1 text-sm text-theme-danger">{error.message}</p>
            {onReset && (
              <button
                onClick={handleReset}
                className="mt-3 rounded px-3 py-1.5 text-xs font-medium btn-theme-danger-soft focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-background)]"
              >
                {t('tryAgain')}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] p-4">
      <div className="w-full max-w-md rounded-lg bg-theme-surface border border-theme p-6 shadow-lg">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-state-danger)_20%,transparent)]">
            <svg
              className="h-6 w-6 text-theme-danger"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-theme-primary">{t('errorOccurred')}</h2>
        </div>

        <p className="mb-4 text-sm text-theme-secondary">
          {t('errorUnexpected')}
        </p>

        <div className="mb-4 rounded-lg bg-theme-elevated border border-theme p-3">
          <p className="text-sm font-medium text-theme-primary">{error.name}</p>
          <p className="mt-1 text-sm text-theme-secondary">{error.message}</p>
        </div>

        {errorInfo && (
          <details className="mb-4">
            <summary className="cursor-pointer text-sm font-medium text-theme-secondary hover:text-theme-primary">
              {t('showDetails')}
            </summary>
            <div className="mt-2 rounded bg-theme-elevated border border-theme p-3">
              <pre className="overflow-x-auto text-xs text-theme-secondary">
                {errorInfo.componentStack}
              </pre>
            </div>
          </details>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="flex-1 rounded-lg px-4 py-2 text-sm font-medium btn-theme-primary-soft focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-background)]"
          >
            {t('refreshPage')}
          </button>
          <button
            onClick={() => window.history.back()}
            className="flex-1 rounded-lg px-4 py-2 text-sm font-medium btn-theme-surface focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-background)]"
          >
            {t('previousPage')}
          </button>
        </div>
      </div>
    </div>
  );
}
