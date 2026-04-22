/**
 * Trash Empty State
 * 휴지통이 비어 있을 때 표시
 */

import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function TrashEmptyState() {
  const { t } = useTranslation('trash');

  return (
    <div
      className="vs-frost-panel flex flex-col items-center justify-center rounded-xl px-6 py-16"
      role="status"
      aria-live="polite"
    >
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-theme-elevated border border-theme mb-4">
        <Trash2 className="w-8 h-8 text-theme-tertiary" aria-hidden />
      </div>
      <h2 className="text-xl font-semibold text-theme-secondary mb-2">
        {t('empty')}
      </h2>
      <p className="text-theme-tertiary mb-6 text-center max-w-sm">
        {t('emptyDescription')}
      </p>
      <Link
        to="/components"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg btn-theme-primary-soft font-medium transition-colors"
      >
        {t('goToComponents')}
      </Link>
    </div>
  );
}
