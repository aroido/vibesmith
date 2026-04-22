import { useTranslation } from 'react-i18next';
import type { ComponentDetail, ComponentUsageTimeline } from '../types';
import { UsageTrendPanel } from './UsageTrendPanel';
import { DiagnosticPanel } from './DiagnosticPanel';
import { VersionHistoryPanel } from './VersionHistoryPanel';

interface AnalysisTabProps {
  component: ComponentDetail;
  usageTimeline: ComponentUsageTimeline | undefined;
  usageLoading: boolean;
  isUsageError: boolean;
  onRetryUsage: () => void;
  onRollbackSuccess: () => void;
}

export function AnalysisTab({
  component,
  usageTimeline,
  usageLoading,
  isUsageError,
  onRetryUsage,
  onRollbackSuccess,
}: AnalysisTabProps) {
  const { i18n } = useTranslation(['components']);

  return (
    <div className="space-y-6">
      <UsageTrendPanel
        usageList={usageTimeline?.timeline ?? []}
        locale={i18n.language}
        usageLoading={usageLoading}
        isUsageError={isUsageError}
        onRetry={onRetryUsage}
      />

      <DiagnosticPanel component={component} />

      <VersionHistoryPanel
        componentId={component.id}
        componentName={component.name}
        onRollbackSuccess={onRollbackSuccess}
      />
    </div>
  );
}
