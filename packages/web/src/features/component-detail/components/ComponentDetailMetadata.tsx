/**
 * Component detail metadata
 * 설명, 프로젝트, 경로, 태그, 날짜, frontmatter
 */

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ANALYTICS_MASK_TEXT_CLASS,
  ANALYTICS_NO_CAPTURE_CLASS,
} from '@/common/analytics/privacy';
import { TagBadge } from '@/features/tag-management';
import type { ComponentDetail } from '../types';

interface ComponentDetailMetadataProps {
  component: ComponentDetail;
}

function formatDate(isoString: string, locale: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function ComponentDetailMetadata({ component }: ComponentDetailMetadataProps) {
  const { t, i18n } = useTranslation('components');
  const navigate = useNavigate();
  const locale = i18n.language;
  const fmEntries =
    component.frontmatter && typeof component.frontmatter === 'object'
      ? Object.entries(component.frontmatter)
      : [];

  return (
    <div className="vs-frost-panel rounded-xl p-6 space-y-4">
      <h2 className="text-lg font-semibold text-theme-primary mb-4">{t('detail.metadata')}</h2>

      {component.description && (
        <div>
          <span className="text-sm text-theme-tertiary">{t('detail.description')}</span>
          <p className="text-theme-secondary mt-1">{component.description}</p>
        </div>
      )}

      <div>
        <span className="text-sm text-theme-tertiary">{t('list.project')}</span>
        <p className="text-theme-secondary font-mono mt-1">{component.project_name}</p>
      </div>

      <div>
        <span className="text-sm text-theme-tertiary">{t('detail.path')}</span>
        <p
          className={`${ANALYTICS_MASK_TEXT_CLASS} text-theme-secondary font-mono text-sm mt-1 truncate`}
          title={component.path}
        >
          {component.path}
        </p>
      </div>

      {component.tags && component.tags.length > 0 && (
        <div>
          <span className="text-sm text-theme-tertiary">{t('list.tags')}</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {component.tags.map((tag) => (
                <TagBadge
                  key={tag}
                  tag={tag}
                  size="sm"
                  onClick={() => void navigate(`/components?tags=${encodeURIComponent(tag)}`)}
                />
              ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <span className="text-sm text-theme-tertiary">{t('detail.created')}</span>
          <p className="text-theme-secondary text-sm mt-1">
            {formatDate(component.created_at, locale)}
          </p>
        </div>
        <div>
          <span className="text-sm text-theme-tertiary">{t('detail.updated')}</span>
          <p className="text-theme-secondary text-sm mt-1">
            {formatDate(component.updated_at, locale)}
          </p>
        </div>
      </div>

      {fmEntries.length > 0 && (
        <div>
          <span className="text-sm text-theme-tertiary">{t('detail.frontmatter')}</span>
          <dl className={`${ANALYTICS_NO_CAPTURE_CLASS} mt-2 space-y-1`}>
            {fmEntries.map(([key, value]) => (
              <div key={key} className="flex gap-2 font-mono text-sm">
                <dt className="text-theme-tertiary shrink-0">{key}:</dt>
                <dd className="text-theme-secondary break-all">
                  {typeof value === 'object'
                    ? JSON.stringify(value)
                    : String(value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
