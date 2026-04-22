import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { showErrorToast, showSuccessToast } from '@/common/utils';
import { PageFrame } from '@/components/common';
import { useCheckoutSession } from '../hooks/useLicense';
import type { PlanType } from '../types';

const PANEL_CLASS = 'vs-frost-panel rounded-2xl p-4 md:p-6';
const FEATURE_KEYS = ['f1', 'f2', 'f3'] as const;

export function PricingPage() {
  const { t } = useTranslation('license');
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const checkoutMutation = useCheckoutSession();

  const handleCheckout = async (plan: Extract<PlanType, 'pro' | 'team'>) => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      showErrorToast(t('errors.emailRequired'));
      return;
    }

    try {
      const result = await checkoutMutation.mutateAsync({ plan, email: trimmedEmail });
      showSuccessToast(t('messages.redirecting'));

      if (typeof window !== 'undefined') {
        window.open(result.checkout_url, '_self');
      }
    } catch {
      // Error toast is handled in mutation onError.
    }
  };

  return (
    <PageFrame
      activeNav="settings"
      title={t('pages.pricing.title')}
      subtitle={t('pages.pricing.subtitle')}
    >
      <section className={PANEL_CLASS}>
        <label htmlFor="checkout-email" className="mb-1 block text-sm font-medium text-theme-secondary">
          {t('pricing.emailLabel')}
        </label>
        <input
          id="checkout-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t('pricing.emailPlaceholder')}
          className="w-full rounded-lg input-theme md:max-w-md"
        />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {(['free', 'pro', 'team'] as const).map((plan) => (
          <article key={plan} className={`${PANEL_CLASS} border border-theme`}>
            <h2 className="text-xl font-semibold text-theme-primary">{t(`plans.${plan}.name`)}</h2>
            <p className="mt-1 text-sm text-theme-secondary">{t(`plans.${plan}.price`)}</p>
            <p className="mt-3 text-sm text-theme-secondary">{t(`plans.${plan}.description`)}</p>

            <ul className="mt-4 space-y-1 text-sm text-theme-secondary">
              {FEATURE_KEYS.map((key) => (
                <li key={key}>• {t(`plans.${plan}.features.${key}`)}</li>
              ))}
            </ul>

            <div className="mt-5">
              {plan === 'free' ? (
                <button
                  type="button"
                  onClick={() => void navigate('/license')}
                  className="w-full rounded-lg px-4 py-2 btn-theme-surface"
                >
                  {t('actions.manageLicense')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    void handleCheckout(plan);
                  }}
                  disabled={checkoutMutation.isPending}
                  className="w-full rounded-lg px-4 py-2 btn-theme-primary-soft disabled:opacity-60"
                >
                  {checkoutMutation.isPending
                    ? t('actions.checkoutPending')
                    : t('actions.checkout', { plan: t(`plans.${plan}.name`) })}
                </button>
              )}
            </div>
          </article>
        ))}
      </section>
    </PageFrame>
  );
}
