import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PageFrame } from '@/components/common';

const PANEL_CLASS = 'vs-frost-panel rounded-2xl p-6 text-center';

export function CheckoutSuccessPage() {
  const { t } = useTranslation('license');
  const navigate = useNavigate();

  return (
    <PageFrame
      activeNav="settings"
      title={t('pages.checkoutSuccess.title')}
      subtitle={t('pages.checkoutSuccess.subtitle')}
    >
      <section className={PANEL_CLASS}>
        <p className="text-sm text-theme-secondary">{t('pages.checkoutSuccess.description')}</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => void navigate('/license')}
            className="rounded-lg px-4 py-2 btn-theme-primary-soft"
          >
            {t('actions.goLicense')}
          </button>
          <button
            type="button"
            onClick={() => void navigate('/pricing')}
            className="rounded-lg px-4 py-2 btn-theme-surface"
          >
            {t('actions.goPricing')}
          </button>
        </div>
      </section>
    </PageFrame>
  );
}
