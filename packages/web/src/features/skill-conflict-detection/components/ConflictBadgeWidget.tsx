/**
 * ConflictBadgeWidget - Skill Conflict Detection (Spec §5.3)
 * Dashboard 경고 배지: "N개 충돌 발견"
 * Issue #159
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { useConflicts } from '../hooks/useConflicts';
import { ConflictListModal } from './ConflictListModal';

export interface ConflictBadgeWidgetProps {
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function ConflictBadgeWidget({ onToast }: ConflictBadgeWidgetProps) {
  const { t } = useTranslation('dashboard');
  const { data: conflicts, isLoading, refetch } = useConflicts();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleModalClose = () => {
    setIsModalOpen(false);
    void refetch();
  };

  const handleConflictSelect = () => {
    // ConflictComparisonModal is opened from ConflictListModal
  };

  if (isLoading || !conflicts || conflicts.length === 0) {
    if (isLoading) {
      return (
        <div
          className="rounded-2xl bg-theme-surface border border-theme p-6 animate-pulse"
          aria-label={t('conflicts.loading')}
          role="status"
        >
          <div className="flex justify-between items-center">
            <div className="h-6 bg-theme-skeleton rounded w-48" />
            <div className="h-8 bg-theme-skeleton rounded w-24" />
          </div>
        </div>
      );
    }
    return null;
  }

  const names = conflicts.map((c) => c.name).slice(0, 3).join(', ');
  const more = conflicts.length > 3 ? ` +${conflicts.length - 3}` : '';

  return (
    <>
      <section
        className="h-full min-h-[10rem] rounded-2xl border border-theme bg-theme-surface p-5 backdrop-blur-md transition-all duration-300"
        aria-label={t('conflicts.badgeAria', { count: conflicts.length })}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-theme-primary">
            <span aria-hidden>
              <AlertTriangle className="w-5 h-5 text-theme-warning" />
            </span>
            {t('conflicts.title')}
          </h2>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium transition-colors btn-theme-warning-soft"
            aria-label={t('conflicts.viewAria', { count: conflicts.length })}
          >
            {t('conflicts.viewButton', { count: conflicts.length })}
          </button>
        </div>

        <p className="mb-2 text-sm text-theme-secondary">
          {t('conflicts.summary', { count: conflicts.length })}
        </p>
        <p className="truncate text-sm font-mono text-theme-secondary">
          {t('conflicts.affected')}: {names}
          {more}
        </p>
        <p className="text-xs text-theme-tertiary mt-2">
          {t('conflicts.priorityRule')}
        </p>
      </section>

      <ConflictListModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        conflicts={conflicts}
        onConflictSelect={handleConflictSelect}
        onToast={onToast}
      />
    </>
  );
}
