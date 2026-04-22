/**
 * Component Create Page
 * Top-level page for creating new components
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ComponentCreateForm } from './ComponentCreateForm';
import { PageFrame } from '@/components/common';
import type { ComponentCreateResponse } from '../types';
import { notify } from '@/common/utils/notify';

export function ComponentCreatePage() {
  const { t } = useTranslation('components');

  const handleSuccess = useCallback(
    (_response: ComponentCreateResponse) => {
      notify.success(t('create.successToast'));
    },
    [t]
  );

  return (
    <PageFrame
      activeNav="components"
      title={t('create.title')}
      subtitle={t('create.subtitle')}
      contentClassName="max-w-[88rem] mx-auto"
    >
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr,320px]">
        <div className="space-y-4">
          <div className="vs-frost-panel rounded-xl p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-theme-secondary mb-3">
              {t('create.flowTitle')}
            </p>
            <ol className="grid grid-cols-1 gap-2 md:grid-cols-3 text-sm">
              <li className="rounded-lg border badge-theme-info px-3 py-2">
                {t('create.flowStep1')}
              </li>
              <li className="rounded-lg border border-theme bg-theme-surface px-3 py-2 text-theme-secondary">
                {t('create.flowStep2')}
              </li>
              <li className="rounded-lg border border-theme bg-theme-surface px-3 py-2 text-theme-secondary">
                {t('create.flowStep3')}
              </li>
            </ol>
          </div>

          <ComponentCreateForm onSuccess={handleSuccess} />
        </div>

        <aside className="space-y-4">
          <section className="vs-frost-panel rounded-xl p-4">
            <h2 className="text-sm uppercase tracking-[0.15em] text-theme-secondary mb-2">
              {t('create.tipsTitle')}
            </h2>
            <ul className="space-y-2 text-sm text-theme-secondary">
              <li>{t('create.tip1')}</li>
              <li>{t('create.tip2')}</li>
              <li>{t('create.tip3')}</li>
              <li>{t('create.tip4')}</li>
            </ul>
          </section>

          <section className="vs-frost-panel rounded-xl p-4">
            <h2 className="text-sm uppercase tracking-[0.15em] text-theme-secondary mb-2">
              {t('create.checklistTitle')}
            </h2>
            <div className="space-y-2 text-sm">
              <p className="rounded-md bg-theme-surface border border-theme px-3 py-2 text-theme-secondary">
                {t('create.check1')}
              </p>
              <p className="rounded-md bg-theme-surface border border-theme px-3 py-2 text-theme-secondary">
                {t('create.check2')}
              </p>
              <p className="rounded-md bg-theme-surface border border-theme px-3 py-2 text-theme-secondary">
                {t('create.check3')}
              </p>
            </div>
          </section>
        </aside>
      </section>
    </PageFrame>
  );
}
