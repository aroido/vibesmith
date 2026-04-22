/**
 * Component Detail Page
 * 탭 기반 레이아웃: Header(고정) + 개요 | 콘텐츠 | 분석
 */

import { useState, useCallback, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useComponentDetail } from '../hooks/useComponentDetail';
import { useComponentUsageTimeline } from '../hooks/useComponentUsageTimeline';
import { useComponentMutations } from '../hooks/useComponentMutations';
import { useComponentUpdate } from '../hooks/useComponentUpdate';
import { ComponentDetailHeader } from './ComponentDetailHeader';
import { ComponentDetailTabs, type DetailTab } from './ComponentDetailTabs';
import { OverviewTab } from './OverviewTab';
import { ContentTab } from './ContentTab';
import { AnalysisTab } from './AnalysisTab';
import { DependencyWarningModal } from './DependencyWarningModal';
import { ApiError } from '@/common/api';
import { PageFrame } from '@/components/common';

function LoadingSkeleton({ t }: { t: (key: string) => string }) {
  return (
    <div
      role="status"
      aria-label={t('components:detail.loadingAria')}
      aria-live="polite"
      aria-busy="true"
      className="space-y-6"
    >
      <div className="vs-frost-panel rounded-xl p-6 animate-pulse">
        <div className="flex items-start gap-4">
          <div className="w-8 h-8 bg-theme-skeleton rounded" />
          <div className="flex-1 space-y-2">
            <div className="h-6 bg-theme-skeleton rounded w-1/3" />
            <div className="h-4 bg-theme-skeleton rounded w-1/4" />
          </div>
        </div>
      </div>
      <div className="vs-frost-panel rounded-xl p-6 animate-pulse">
        <div className="h-4 bg-theme-skeleton rounded w-1/4 mb-4" />
        <div className="space-y-2">
          <div className="h-3 bg-theme-skeleton rounded w-full" />
          <div className="h-3 bg-theme-skeleton rounded w-4/5" />
          <div className="h-3 bg-theme-skeleton rounded w-3/5" />
        </div>
      </div>
      <div className="vs-frost-panel rounded-xl p-6 animate-pulse">
        <div className="h-4 bg-theme-skeleton rounded w-1/3 mb-4" />
        <div className="space-y-2">
          <div className="h-3 bg-theme-skeleton rounded w-full" />
          <div className="h-3 bg-theme-skeleton rounded w-full" />
          <div className="h-3 bg-theme-skeleton rounded w-2/3" />
        </div>
      </div>
    </div>
  );
}

export function ComponentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation(['components', 'navigation', 'common', 'dashboard']);
  const { data: component, isLoading, error, refetch } = useComponentDetail(id);
  const {
    data: usageTimeline,
    isLoading: usageLoading,
    isError: isUsageError,
    refetch: refetchUsageTimeline,
  } = useComponentUsageTimeline(component?.id, 1);

  const {
    deleteMutation,
    toggleMutation,
    isWarningModalOpen,
    affectedDependencies,
    componentNameForModal,
    onConfirmDependencyWarning,
    onCancelDependencyWarning,
  } = useComponentMutations(id, {
    componentName: component?.name ?? '',
  });

  const updateMutation = useComponentUpdate(id);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [isOverviewEditing, setIsOverviewEditing] = useState(false);

  const handleUpdateField = useCallback(
    (field: string, value: unknown) => {
      updateMutation.mutate({ [field]: value });
    },
    [updateMutation]
  );

  const is404 = error instanceof ApiError && error.statusCode === 404;

  const renderFrame = (
    content: ReactNode,
    options?: { title?: ReactNode; subtitle?: string; hideTitle?: boolean }
  ) => (
    <PageFrame
      activeNav="components"
      title={options?.hideTitle ? undefined : options?.title ?? t('navigation:components')}
      subtitle={options?.subtitle}
      contentClassName="max-w-[88rem] mx-auto"
    >
      {content}
    </PageFrame>
  );

  // id 없음
  if (!id) {
    return renderFrame(
      <>
        <Link to="/components" className="text-primary hover:underline">
          ← {t('navigation:components')}
        </Link>
        <div className="vs-frost-panel rounded-xl p-8 text-center">
          <p className="text-theme-secondary">{t('components:detail.notFound')}</p>
          <Link
            to="/components"
            className="inline-block mt-4 px-4 py-2 rounded-lg btn-theme-primary-soft"
          >
            {t('components:detail.backToList')}
          </Link>
        </div>
      </>
    );
  }

  if (isLoading) {
    return renderFrame(
      <>
        <Link to="/components" className="text-primary hover:underline">
          ← {t('navigation:components')}
        </Link>
        <LoadingSkeleton t={t} />
      </>,
      { subtitle: t('components:detail.loadingAria') }
    );
  }

  if (error && is404) {
    return renderFrame(
      <>
        <Link to="/components" className="text-primary hover:underline">
          ← {t('navigation:components')}
        </Link>
        <div
          role="alert"
          aria-live="assertive"
          className="vs-frost-panel rounded-xl p-8 text-center"
        >
          <p className="text-theme-secondary mb-4">{t('components:detail.notFound')}</p>
          <Link
            to="/components"
            className="inline-block px-4 py-2 rounded-lg btn-theme-primary-soft"
          >
            {t('components:detail.backToList')}
          </Link>
        </div>
      </>,
      { subtitle: undefined }
    );
  }

  if (error) {
    return renderFrame(
      <>
        <Link to="/components" className="text-primary hover:underline">
          ← {t('navigation:components')}
        </Link>
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-xl alert-theme-danger p-6 text-center"
        >
          <p className="text-theme-danger font-medium mb-4">{error.message}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => void refetch()}
              data-testid="component-detail-retry-button"
              className="px-4 py-2 rounded-lg font-medium btn-theme-danger-soft"
            >
              {t('common:retry')}
            </button>
            <Link
              to="/components"
              className="px-4 py-2 rounded-lg btn-theme-surface"
            >
              {t('components:detail.backToList')}
            </Link>
          </div>
        </div>
      </>,
      { subtitle: t('components:detail.loadError') }
    );
  }

  if (!component) return null;

  return renderFrame(
    <>
      <nav className="mb-4" aria-label="Breadcrumb">
        <Link to="/components" data-testid="component-detail-back-link" className="text-primary hover:underline">
          {t('navigation:components')}
        </Link>
        <span className="text-theme-tertiary mx-2">/</span>
        <span className="text-theme-secondary font-mono">{component.name}</span>
      </nav>

      <ComponentDetailHeader
        component={component}
        onDelete={() => deleteMutation.mutate()}
        onToggle={() => toggleMutation.mutate()}
        isToggling={toggleMutation.isPending}
        onUpdateName={(name) => handleUpdateField('name', name)}
        isSaving={updateMutation.isPending}
        isEditing={isOverviewEditing}
      />

      <div className="mt-6">
        <ComponentDetailTabs active={activeTab} onChange={setActiveTab} />

        {activeTab === 'overview' && (
          <OverviewTab
            component={component}
            onUpdateField={handleUpdateField}
            isSaving={updateMutation.isPending}
            isEditing={isOverviewEditing}
            onEditingChange={setIsOverviewEditing}
          />
        )}

        {activeTab === 'content' && (
          <ContentTab
            content={component.content}
            fileName={`${component.name}.md`}
            onSave={(content) => handleUpdateField('content', content)}
            isSaving={updateMutation.isPending}
          />
        )}

        {activeTab === 'analysis' && (
          <AnalysisTab
            component={component}
            usageTimeline={usageTimeline}
            usageLoading={usageLoading}
            isUsageError={isUsageError}
            onRetryUsage={() => void refetchUsageTimeline()}
            onRollbackSuccess={() => void refetch()}
          />
        )}
      </div>

      <DependencyWarningModal
        isOpen={isWarningModalOpen}
        componentName={componentNameForModal}
        affectedDependencies={affectedDependencies}
        onConfirm={onConfirmDependencyWarning}
        onCancel={() => void onCancelDependencyWarning()}
      />
    </>,
    { hideTitle: true }
  );
}
