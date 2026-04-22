import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { showErrorToast, showSuccessToast } from '@/common/utils';
import { PageFrame } from '@/components/common';
import { clearStoredLicenseKey, getStoredLicenseKey, setStoredLicenseKey } from '../services/storage';
import { useLicenseMe, useValidateLicense } from '../hooks/useLicense';

const PANEL_CLASS = 'vs-frost-panel rounded-2xl p-4 md:p-6';

function formatDate(dateText: string | null, locale: string): string {
  if (!dateText) return '-';

  try {
    return new Date(dateText).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateText;
  }
}

export function LicensePage() {
  const { t, i18n } = useTranslation('license');
  const navigate = useNavigate();

  const [storedKey, setStoredKey] = useState<string | null>(() => getStoredLicenseKey());
  const [inputKey, setInputKey] = useState(storedKey ?? '');

  const { data, isLoading, error } = useLicenseMe(storedKey);
  const validateMutation = useValidateLicense();

  const handleValidate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const key = inputKey.trim();
    if (!key) {
      showErrorToast(t('errors.keyRequired'));
      return;
    }

    try {
      const result = await validateMutation.mutateAsync(key);
      if (!result.valid) {
        showErrorToast(t('errors.invalidKey'));
        return;
      }

      setStoredLicenseKey(key);
      setStoredKey(key);
      showSuccessToast(t('messages.validated', { plan: t(`plans.${result.plan}.name`) }));
    } catch {
      // Error toast is handled in mutation onError.
    }
  };

  const handleClearKey = () => {
    clearStoredLicenseKey();
    setStoredKey(null);
    setInputKey('');
    showSuccessToast(t('messages.cleared'));
  };

  return (
    <PageFrame
      activeNav="settings"
      title={t('pages.license.title')}
      subtitle={t('pages.license.subtitle')}
    >
      <section className={PANEL_CLASS}>
        <h2 className="mb-3 text-lg font-semibold text-theme-primary">{t('status.title')}</h2>

        {isLoading && (
          <div role="status" aria-live="polite" className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-10 animate-pulse rounded-lg bg-theme-skeleton" />
            ))}
          </div>
        )}

        {!isLoading && error && (
          <p role="alert" className="text-sm text-theme-danger">
            {error.message}
          </p>
        )}

        {!isLoading && !error && data && (
          <div className="grid gap-3 md:grid-cols-3">
            <article className="rounded-xl border border-theme bg-theme-elevated p-3">
              <p className="text-xs uppercase tracking-wide text-theme-secondary">{t('status.validity')}</p>
              <p className={`mt-2 text-lg font-semibold ${data.valid ? 'text-theme-success' : 'text-theme-warning'}`}>
                {data.valid ? t('status.valid') : t('status.invalid')}
              </p>
            </article>

            <article className="rounded-xl border border-theme bg-theme-elevated p-3">
              <p className="text-xs uppercase tracking-wide text-theme-secondary">{t('status.plan')}</p>
              <p className="mt-2 text-lg font-semibold text-theme-primary">
                {t(`plans.${data.plan}.name`)}
              </p>
            </article>

            <article className="rounded-xl border border-theme bg-theme-elevated p-3">
              <p className="text-xs uppercase tracking-wide text-theme-secondary">{t('status.expiresAt')}</p>
              <p className="mt-2 text-sm font-medium text-theme-primary">
                {formatDate(data.expires_at, i18n.language)}
              </p>
            </article>
          </div>
        )}
      </section>

      <section className={`${PANEL_CLASS} mt-6`}>
        <h2 className="mb-3 text-lg font-semibold text-theme-primary">{t('form.title')}</h2>

        <form className="space-y-3" onSubmit={(event) => { void handleValidate(event); }}>
          <div>
            <label htmlFor="license-key" className="mb-1 block text-sm font-medium text-theme-secondary">
              {t('form.keyLabel')}
            </label>
            <input
              id="license-key"
              type="text"
              value={inputKey}
              onChange={(event) => setInputKey(event.target.value)}
              placeholder={t('form.keyPlaceholder')}
              className="w-full rounded-lg input-theme"
              autoComplete="off"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={validateMutation.isPending}
              className="rounded-lg px-4 py-2 btn-theme-primary-soft disabled:opacity-60"
            >
              {validateMutation.isPending ? t('actions.validating') : t('actions.validate')}
            </button>

            {storedKey && (
              <button
                type="button"
                onClick={handleClearKey}
                className="rounded-lg px-4 py-2 btn-theme-surface"
              >
                {t('actions.clearKey')}
              </button>
            )}

            <button
              type="button"
              onClick={() => void navigate('/pricing')}
              className="ml-auto rounded-lg px-4 py-2 btn-theme-warning-soft"
            >
              {t('actions.goPricing')}
            </button>
          </div>
        </form>

        <p className="mt-3 text-xs text-theme-tertiary">{t('form.help')}</p>
      </section>
    </PageFrame>
  );
}
