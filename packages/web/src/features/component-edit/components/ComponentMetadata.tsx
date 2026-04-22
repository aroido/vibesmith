/**
 * ComponentMetadata - Type, Project, Created, Updated
 */

import { useTranslation } from 'react-i18next';
import type { ComponentDetailResponse } from '@/common/api';

interface ComponentMetadataProps {
  component: ComponentDetailResponse;
}

export function ComponentMetadata({ component }: ComponentMetadataProps) {
  const { t, i18n } = useTranslation('components');
  const locale = i18n.language === 'ko' ? 'ko-KR' : 'en-US';

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString(locale);
    } catch {
      return iso;
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-theme-secondary">{t('detail.metadata')}</h3>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-theme-tertiary">{t('detail.typeLabel')}</dt>
        <dd className="text-theme-secondary">{component.type}</dd>
        <dt className="text-theme-tertiary">{t('detail.projectLabel')}</dt>
        <dd className="text-theme-secondary">{component.project_name}</dd>
        <dt className="text-theme-tertiary">{t('detail.createdLabel')}</dt>
        <dd className="text-theme-secondary">{formatDate(component.created_at)}</dd>
        <dt className="text-theme-tertiary">{t('detail.updatedLabel')}</dt>
        <dd className="text-theme-secondary">{formatDate(component.updated_at)}</dd>
      </dl>
    </div>
  );
}
