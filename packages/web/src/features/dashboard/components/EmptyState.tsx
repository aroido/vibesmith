/**
 * Dashboard Empty State
 * 프로젝트가 없을 때 표시되는 Quick Start UI
 */

import { useTranslation } from 'react-i18next';
import { Sparkles, FolderPlus, BookOpen, Check } from 'lucide-react';
import { useState } from 'react';

interface EmptyStateProps {
  onTrySample: () => void;
  onAddProject: () => void;
  isCreatingSample?: boolean;
}

export function EmptyState({
  onTrySample,
  onAddProject,
  isCreatingSample = false,
}: EmptyStateProps) {
  const { t } = useTranslation('dashboard');
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-primary)_20%,transparent),color-mix(in_srgb,#a855f7_20%,transparent))] border border-[color-mix(in_srgb,var(--color-primary)_32%,transparent)] mb-6">
            <Sparkles className="w-10 h-10 text-[var(--color-primary)]" aria-hidden />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-theme-primary mb-4">
            {t('emptyState.welcome')}
          </h1>
          <p className="text-lg text-theme-secondary mb-2">
            {t('emptyState.manageComponents')}
          </p>
          <p className="text-sm text-theme-tertiary">
            {t('emptyState.componentTypes')}
          </p>
        </div>

        {/* Quick Start Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Try Sample Project */}
          <button
            type="button"
            onClick={onTrySample}
            disabled={isCreatingSample}
            data-testid="dashboard-empty-try-sample-button"
            className="group relative overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--color-primary)_45%,transparent)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-primary)_10%,transparent),color-mix(in_srgb,#a855f7_10%,transparent))] p-6 text-left transition-all hover:bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-primary)_20%,transparent),color-mix(in_srgb,#a855f7_20%,transparent))] hover:border-[color-mix(in_srgb,var(--color-primary)_70%,transparent)] hover:shadow-[0_0_30px_color-mix(in_srgb,var(--color-primary)_30%,transparent)] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-background)]"
          >
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <Sparkles className="w-6 h-6 text-[var(--color-primary)]" aria-hidden />
                <h3 className="text-xl font-semibold text-[var(--color-primary)]">
                  {isCreatingSample ? t('emptyState.creating') : t('emptyState.tryVibeSmith')}
                </h3>
              </div>
              <p className="text-sm text-theme-secondary mb-4">
                {t('emptyState.quickStart')}
              </p>
              <ul className="space-y-2 text-sm text-theme-secondary">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[var(--color-primary)]" aria-hidden />
                  <span>{t('emptyState.sampleAutoCreate')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[var(--color-primary)]" aria-hidden />
                  <span>{t('emptyState.sampleComponents')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[var(--color-primary)]" aria-hidden />
                  <span>{t('emptyState.realUsage')}</span>
                </li>
              </ul>
            </div>
            {isCreatingSample && (
              <div className="absolute inset-0 bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-primary)_20%,transparent),color-mix(in_srgb,#a855f7_20%,transparent))] animate-pulse" />
            )}
          </button>

          {/* Add Your Project */}
          <button
            type="button"
            onClick={onAddProject}
            data-testid="dashboard-empty-add-project-button"
            className="group rounded-xl border border-theme bg-theme-elevated p-6 text-left transition-all hover:bg-theme-surface hover:border-[color-mix(in_srgb,var(--color-fg-primary)_20%,transparent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-background)]"
          >
            <div className="flex items-center gap-3 mb-3">
              <FolderPlus className="w-6 h-6 text-theme-secondary group-hover:text-theme-secondary" aria-hidden />
              <h3 className="text-xl font-semibold text-theme-secondary group-hover:text-theme-primary">
                {t('emptyState.addYourProject')}
              </h3>
            </div>
            <p className="text-sm text-theme-secondary mb-4">
              {t('emptyState.connectProject')}
            </p>
            <ul className="space-y-2 text-sm text-theme-tertiary">
              <li className="flex items-center gap-2">
                <span>•</span>
                <span>{t('emptyState.localFolder')}</span>
              </li>
              <li className="flex items-center gap-2">
                <span>•</span>
                <span>{t('emptyState.autoScan')}</span>
              </li>
              <li className="flex items-center gap-2">
                <span>•</span>
                <span>{t('emptyState.startManage')}</span>
              </li>
            </ul>
          </button>
        </div>

        {/* Sample Content Details */}
        <div className="rounded-xl border border-theme bg-theme-surface p-4">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            data-testid="dashboard-empty-sample-details-button"
            className="flex items-center justify-between w-full text-left focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-background)] rounded-lg p-2 hover:bg-theme-hover"
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-theme-secondary" aria-hidden />
              <span className="text-sm font-medium text-theme-secondary">
                {t('emptyState.sampleContent')}
              </span>
            </div>
            <span className="text-theme-tertiary text-xs">
              {showDetails ? t('emptyState.collapse') : t('emptyState.expand')}
            </span>
          </button>

          {showDetails && (
            <div className="mt-4 pt-4 border-t border-theme grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-semibold text-[var(--color-primary)] mb-2">{t('emptyState.skillsCount')}</h4>
                <ul className="space-y-1 text-theme-secondary">
                  <li>• {t('emptyState.codeReview')}</li>
                  <li>• {t('emptyState.testWriter')}</li>
                  <li>• {t('emptyState.gitCommit')}</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-[#a855f7] mb-2">{t('emptyState.agentsCount')}</h4>
                <ul className="space-y-1 text-theme-secondary">
                  <li>• {t('emptyState.architect')}</li>
                  <li>• {t('emptyState.planner')}</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-[var(--color-state-success)] mb-2">{t('emptyState.commandsCount')}</h4>
                <ul className="space-y-1 text-theme-secondary">
                  <li>• {t('emptyState.taskStart')}</li>
                  <li>• {t('emptyState.commandsReview')}</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-[#f97316] mb-2">{t('emptyState.rulesCount')}</h4>
                <ul className="space-y-1 text-theme-secondary">
                  <li>• {t('emptyState.codingStandards')}</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Help Text */}
        <p className="text-center text-xs text-theme-tertiary mt-6">
          {t('emptyState.sampleDeleteHint')}
        </p>
      </div>
    </div>
  );
}
