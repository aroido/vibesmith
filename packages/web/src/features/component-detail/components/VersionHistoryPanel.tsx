/**
 * VersionHistoryPanel
 * Component Detail 사이드바용 버전 히스토리/미리보기/롤백 패널
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { VersionHistoryItem } from '@/common/api';
import { ANALYTICS_NO_CAPTURE_CLASS } from '@/common/analytics/privacy';
import { showErrorToast, showSuccessToast } from '@/common/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useComponentVersions, useRollbackComponent } from '@/hooks/useVersions';

interface VersionHistoryPanelProps {
  componentId: string;
  componentName: string;
  onRollbackSuccess?: () => void;
}

interface DiffSummary {
  added: number;
  removed: number;
}

function formatVersionDate(dateText: string, locale: string): string {
  try {
    return new Date(dateText).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateText;
  }
}

function getDiffSummary(current: string, selected: string): DiffSummary {
  const currentLines = new Set(
    current
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0)
  );
  const selectedLines = new Set(
    selected
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0)
  );

  let added = 0;
  for (const line of selectedLines) {
    if (!currentLines.has(line)) added += 1;
  }

  let removed = 0;
  for (const line of currentLines) {
    if (!selectedLines.has(line)) removed += 1;
  }

  return { added, removed };
}

function getSnippet(content: string): string {
  const snippet = content
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  return snippet ?? '';
}

export function VersionHistoryPanel({
  componentId,
  componentName,
  onRollbackSuccess,
}: VersionHistoryPanelProps) {
  const { t, i18n } = useTranslation(['components', 'common']);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [compareWithCurrent, setCompareWithCurrent] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<VersionHistoryItem | null>(null);

  const {
    data: versions = [],
    isLoading,
    error,
    refetch,
  } = useComponentVersions(componentId);
  const rollbackMutation = useRollbackComponent(componentId);

  useEffect(() => {
    if (versions.length === 0) {
      setSelectedVersion(null);
      return;
    }

    if (selectedVersion == null || !versions.some((v) => v.version === selectedVersion)) {
      setSelectedVersion(versions[0].version);
    }
  }, [selectedVersion, versions]);

  const locale = i18n.language;
  const currentVersion = versions[0] ?? null;
  const selectedItem = useMemo(
    () =>
      versions.find((version) => version.version === selectedVersion) ??
      currentVersion,
    [currentVersion, selectedVersion, versions]
  );
  const canCompare =
    !!selectedItem &&
    !!currentVersion &&
    selectedItem.version !== currentVersion.version;
  const isComparing = canCompare && compareWithCurrent;

  const diffSummary = useMemo(() => {
    if (!isComparing || !selectedItem || !currentVersion) return null;
    return getDiffSummary(currentVersion.content, selectedItem.content);
  }, [currentVersion, isComparing, selectedItem]);

  const handleRollbackConfirm = () => {
    if (!rollbackTarget) return;

    const versionNum = rollbackTarget.version;
    rollbackMutation.mutate(
      { version: versionNum },
      {
        onSuccess: () => {
          setRollbackTarget(null);
          setCompareWithCurrent(false);
          onRollbackSuccess?.();
          showSuccessToast(t('common:hooks.versionRollbackSuccess', { version: versionNum }));
        },
        onError: () => {
          showErrorToast(t('common:hooks.rollbackFailed'));
        },
      }
    );
  };

  return (
    <>
      <section
        className="vs-frost-panel rounded-xl p-5"
        data-testid="version-history-panel"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm uppercase tracking-[0.15em] text-theme-secondary">
            {t('components:detail.versionHistory.title')}
          </h2>
          <button
            type="button"
            onClick={() => void refetch()}
            className="h-7 rounded-md border border-theme px-2 text-xs font-medium text-theme-primary transition-colors hover:bg-theme-hover"
          >
            {t('common:retry')}
          </button>
        </div>

        {isLoading && (
          <div role="status" aria-live="polite" aria-busy="true" className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-lg bg-theme-skeleton" />
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg border border-theme bg-theme-elevated p-3 text-xs text-theme-danger">
            {t('components:detail.versionHistory.loadError')}
          </p>
        )}

        {!isLoading && !error && versions.length === 0 && (
          <p className="rounded-lg border border-theme bg-theme-elevated p-3 text-xs text-theme-secondary">
            {t('components:detail.versionHistory.empty')}
          </p>
        )}

        {!isLoading && !error && versions.length > 0 && (
          <div className="space-y-4">
            <ol className="space-y-2" aria-label={t('components:detail.versionHistory.listAria')}>
              {versions.map((version, index) => {
                const isCurrent = index === 0;
                const isSelected = selectedItem?.version === version.version;
                const snippet = getSnippet(version.content);

                return (
                  <li key={version.version}>
                    <button
                      type="button"
                      onClick={() => setSelectedVersion(version.version)}
                      data-testid={`version-history-item-${version.version}`}
                      aria-pressed={isSelected}
                      aria-label={t('components:detail.versionHistory.selectVersionAria', {
                        version: version.version,
                      })}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        isSelected
                          ? 'border-[var(--color-primary)] bg-theme-hover'
                          : 'border-theme bg-theme-elevated hover:bg-theme-hover'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-theme-primary">
                          v{version.version}
                        </span>
                        {isCurrent && (
                          <span className="rounded px-2 py-0.5 text-[10px] font-medium badge-theme-info">
                            {t('components:detail.versionHistory.current')}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-theme-secondary">
                        {formatVersionDate(version.created_at, locale)}
                      </p>
                      <p className="mt-1 line-clamp-1 text-xs text-theme-tertiary">
                        {snippet || t('components:detail.versionHistory.noPreviewSnippet')}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ol>

            {selectedItem && (
              <div className="space-y-3 border-t border-theme pt-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-theme-secondary">
                    {t('components:detail.versionHistory.previewTitle', {
                      version: selectedItem.version,
                    })}
                  </h3>
                  <button
                    type="button"
                    data-testid="version-history-compare-toggle"
                    onClick={() => setCompareWithCurrent((prev) => !prev)}
                    disabled={!canCompare}
                    className="h-7 rounded-md border border-theme px-2 text-xs font-medium text-theme-primary transition-colors hover:bg-theme-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isComparing
                      ? t('components:detail.versionHistory.hideDiff')
                      : t('components:detail.versionHistory.showDiff')}
                  </button>
                </div>

                {!canCompare && (
                  <p className="text-xs text-theme-tertiary">
                    {t('components:detail.versionHistory.compareUnavailable')}
                  </p>
                )}

                {isComparing && diffSummary && (
                  <p className="rounded-md border border-theme bg-theme-elevated px-2 py-1 text-xs text-theme-secondary">
                    {t('components:detail.versionHistory.compareSummary', {
                      added: diffSummary.added,
                      removed: diffSummary.removed,
                    })}
                  </p>
                )}

                {isComparing && currentVersion ? (
                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                    <div>
                      <p className="mb-1 text-[11px] font-medium text-theme-secondary">
                        {t('components:detail.versionHistory.currentContent')}
                      </p>
                      <pre
                        className={`${ANALYTICS_NO_CAPTURE_CLASS} max-h-44 overflow-auto rounded-lg border border-theme bg-theme-elevated p-2 text-[11px] text-theme-secondary`}
                      >
                        {currentVersion.content || t('components:detail.versionHistory.previewEmpty')}
                      </pre>
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] font-medium text-theme-secondary">
                        {t('components:detail.versionHistory.selectedContent')}
                      </p>
                      <pre
                        data-testid="version-history-preview"
                        className={`${ANALYTICS_NO_CAPTURE_CLASS} max-h-44 overflow-auto rounded-lg border border-theme bg-theme-elevated p-2 text-[11px] text-theme-secondary`}
                      >
                        {selectedItem.content || t('components:detail.versionHistory.previewEmpty')}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <pre
                    data-testid="version-history-preview"
                    className={`${ANALYTICS_NO_CAPTURE_CLASS} max-h-52 overflow-auto rounded-lg border border-theme bg-theme-elevated p-2 text-[11px] text-theme-secondary`}
                  >
                    {selectedItem.content || t('components:detail.versionHistory.previewEmpty')}
                  </pre>
                )}

                {currentVersion && selectedItem.version !== currentVersion.version && (
                  <button
                    type="button"
                    data-testid="version-history-rollback-button"
                    onClick={() => setRollbackTarget(selectedItem)}
                    disabled={rollbackMutation.isPending}
                    className="h-8 rounded-md btn-theme-warning-soft px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {rollbackMutation.isPending
                      ? t('components:detail.versionHistory.rollingBack')
                      : t('components:detail.versionHistory.rollback')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <AlertDialog
        open={!!rollbackTarget}
        onOpenChange={(open) => !open && setRollbackTarget(null)}
      >
        <AlertDialogContent className="bg-theme-surface border-theme text-theme-primary">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-theme-primary">
              {t('components:detail.versionHistory.rollbackConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-theme-secondary">
              {rollbackTarget &&
                t('components:detail.versionHistory.rollbackConfirmDesc', {
                  version: rollbackTarget.version,
                  name: componentName,
                })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="btn-theme-surface">
              {t('common:cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRollbackConfirm}
              disabled={rollbackMutation.isPending}
              className="btn-theme-warning-soft disabled:opacity-50"
            >
              {rollbackMutation.isPending
                ? t('components:detail.versionHistory.rollingBack')
                : t('components:detail.versionHistory.rollback')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
