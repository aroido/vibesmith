/**
 * Settings Page - 스캔 설정 및 프로젝트 관리 (spec §5.1)
 * Tailwind CSS, spec §5.2 컴포넌트 계층
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check, CheckCircle2, Pencil, Plus, X } from 'lucide-react';
import {
  RescanButton,
  ChangeGlobalPathForm,
  useScan,
} from '../features/scan';
import { showErrorToast, showSuccessToast } from '@/common/utils';
import { TagManagerSection } from '../features/tag-management';
import {
  DisplaySettings,
  NotificationSettings,
  AdvancedSettings,
  EnabledAgentsSettings,
  MonitoringSettings,
} from '../features/settings-expansion';
import { useSystemStatus } from '../features/dashboard/hooks/useDashboardData';
import { LanguageSelector, PageFrame } from '@/components/common';
import { TourTrigger } from '../features/onboarding';
import { getConfig, removeRootPath, dryRunRemoveRootPath, factoryReset } from '@/services/configApi';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { useElectronUpdater } from '@/hooks/useElectronUpdater';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MarkdownRenderer } from '@/features/document-viewer';
import { useDesktopAnalyticsStatus } from '@/hooks/useDesktopAnalyticsStatus';
import {
  consumePendingReleaseNotesRequest,
  OPEN_RELEASE_NOTES_EVENT,
  type OpenReleaseNotesEventDetail,
} from '@/components/updater/releaseNotesBridge';
import {
  captureAnalyticsException,
  trackAnalyticsEvent,
  trackProjectCreated,
  type AnalyticsSelfTestResult,
} from '@/common/analytics/desktopAnalyticsBridge';
import { trackFirstValueOnce } from '@/common/analytics/activation';
import { ANALYTICS_MASK_TEXT_CLASS } from '@/common/analytics/privacy';
import type { DesktopApiBridge, DesktopDebugSettings, DesktopDiagnosticBundleResult } from '@/types/electron.d';

/** 현재 글로벌 경로 기본값 */
const DEFAULT_CLAUDE_GLOBAL_PATH = '~/.claude';
const DEFAULT_CURSOR_GLOBAL_PATH = '~/.cursor';
const PANEL_CLASS = 'vs-frost-panel rounded-2xl p-6';
const INSTALL_HINT_DELAY_MS = 20_000;
const RELEASES_BASE_URL = 'https://github.com/aroido/vibesmith/releases';
const isTeamFeatureEnabled = import.meta.env.VITE_ENABLE_TEAM_FEATURE === 'true';
const CHECKBOX_CLASS =
  'h-4 w-4 rounded border border-theme bg-theme-surface accent-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-background)]';

export function SettingsPage() {
  const { t, i18n } = useTranslation(['settings', 'common', 'license']);
  const { data: systemStatus, isError: statusError } = useSystemStatus();
  const [debugSettings, setDebugSettings] = useState<DesktopDebugSettings | null>(null);
  const [isUpdatingDebugSettings, setIsUpdatingDebugSettings] = useState(false);
  const [isCreatingDiagnosticBundle, setIsCreatingDiagnosticBundle] = useState(false);
  const [diagnosticBundleResult, setDiagnosticBundleResult] =
    useState<DesktopDiagnosticBundleResult | null>(null);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);

  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: getConfig,
    staleTime: 5 * 60 * 1000, // 5분 캐싱
    placeholderData: (previousData) => previousData,
  });
  
  // Auto-updater
  const {
    isElectronEnv,
    status: updateStatus,
    currentVersion,
    updateInfo,
    downloadProgress,
    pendingInstallVersion,
    installingSince,
    checkForUpdates,
    downloadUpdate,
    quitAndInstall,
    isChecking,
    isAvailable,
    isDownloading,
    isDownloaded,
    isInstalling,
  } = useElectronUpdater();
  const {
    status: analyticsStatus,
    refreshStatus: refreshAnalyticsStatus,
    runSelfTest: runAnalyticsSelfTest,
  } = useDesktopAnalyticsStatus();
  const [showInstallDelayHint, setShowInstallDelayHint] = useState(false);
  const [isReleaseNotesOpen, setIsReleaseNotesOpen] = useState(false);
  const [reviewedReleaseNotesVersion, setReviewedReleaseNotesVersion] =
    useState<string | null>(null);
  const [selfTestResult, setSelfTestResult] = useState<AnalyticsSelfTestResult | null>(null);
  const [isRunningAnalyticsSelfTest, setIsRunningAnalyticsSelfTest] = useState(false);
  
  const lastScanAt = systemStatus?.lastScanAt ?? null;
  const workers = systemStatus?.activeWorkers ?? null;
  const healthScore = systemStatus?.healthScore ?? null;
  const liveLabel = statusError
    ? t('settings:offline')
    : t('settings:live');
  const currentClaudeGlobalPath = config?.home_path ?? DEFAULT_CLAUDE_GLOBAL_PATH;
  const currentCursorGlobalPath = config?.cursor_global_path ?? DEFAULT_CURSOR_GLOBAL_PATH;
  const normalizedUpdateVersion = (updateInfo?.version ?? '').trim();
  const releaseNotes = updateInfo?.releaseNotes?.trim() ?? '';
  const hasReleaseNotes = releaseNotes.length > 0;
  const releaseVersion = (updateInfo?.version ?? '').replace(/^v/i, '');
  const hasReviewedCurrentReleaseNotes =
    normalizedUpdateVersion.length > 0 &&
    reviewedReleaseNotesVersion === normalizedUpdateVersion;
  const releasePageUrl = releaseVersion
    ? `${RELEASES_BASE_URL}/tag/v${encodeURIComponent(releaseVersion)}`
    : RELEASES_BASE_URL;

  useEffect(() => {
    const desktopApi: DesktopApiBridge | undefined =
      typeof window !== 'undefined' ? window.api : undefined;
    if (!isElectronEnv || !desktopApi?.getDebugSettings) {
      return;
    }

    let mounted = true;
    desktopApi
      .getDebugSettings()
      .then((settings) => {
        if (!mounted) return;
        setDebugSettings(settings);
      })
      .catch(() => {
        if (!mounted) return;
        setDiagnosticError(t('settings:desktopDebug.debugModeLoadError'));
      });

    return () => {
      mounted = false;
    };
  }, [isElectronEnv, t]);

  useEffect(() => {
    if (!isElectronEnv || !isInstalling || !installingSince) {
      setShowInstallDelayHint(false);
      return;
    }

    const elapsedMs = Date.now() - installingSince;
    if (elapsedMs >= INSTALL_HINT_DELAY_MS) {
      setShowInstallDelayHint(true);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowInstallDelayHint(true);
    }, INSTALL_HINT_DELAY_MS - elapsedMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isElectronEnv, isInstalling, installingSince]);

  useEffect(() => {
    if (!isAvailable) {
      setIsReleaseNotesOpen(false);
      setReviewedReleaseNotesVersion(null);
    }
  }, [isAvailable]);

  useEffect(() => {
    if (!normalizedUpdateVersion) {
      setReviewedReleaseNotesVersion(null);
      return;
    }

    setReviewedReleaseNotesVersion((prev) =>
      prev === normalizedUpdateVersion ? prev : null
    );
  }, [normalizedUpdateVersion]);

  useEffect(() => {
    if (!isElectronEnv || !isAvailable || !normalizedUpdateVersion) {
      return;
    }

    if (!consumePendingReleaseNotesRequest(normalizedUpdateVersion)) {
      return;
    }

    setReviewedReleaseNotesVersion(normalizedUpdateVersion);
    setIsReleaseNotesOpen(true);
  }, [isElectronEnv, isAvailable, normalizedUpdateVersion]);

  useEffect(() => {
    if (!isElectronEnv || typeof window === 'undefined') {
      return;
    }

    const handleOpenReleaseNotes = (event: Event) => {
      const customEvent = event as CustomEvent<OpenReleaseNotesEventDetail>;
      const requestedVersion = customEvent.detail?.version?.trim() ?? '';
      if (!isAvailable || !normalizedUpdateVersion) {
        return;
      }
      if (requestedVersion && requestedVersion !== normalizedUpdateVersion) {
        return;
      }

      setReviewedReleaseNotesVersion(normalizedUpdateVersion);
      setIsReleaseNotesOpen(true);
    };

    window.addEventListener(
      OPEN_RELEASE_NOTES_EVENT,
      handleOpenReleaseNotes as EventListener
    );
    return () => {
      window.removeEventListener(
        OPEN_RELEASE_NOTES_EVENT,
        handleOpenReleaseNotes as EventListener
      );
    };
  }, [isElectronEnv, isAvailable, normalizedUpdateVersion]);

  function openReleaseNotesModal(): void {
    if (normalizedUpdateVersion) {
      setReviewedReleaseNotesVersion(normalizedUpdateVersion);
    }
    setIsReleaseNotesOpen(true);
  }

  function formatLastScan(date: Date | null): string {
    if (!date) return '—';
    return date.toLocaleString(i18n.language === 'ko' ? 'ko-KR' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async function handleDebugModeToggle(enabled: boolean): Promise<void> {
    const desktopApi: DesktopApiBridge | undefined =
      typeof window !== 'undefined' ? window.api : undefined;
    if (!desktopApi?.setDebugSettings) {
      return;
    }

    setIsUpdatingDebugSettings(true);
    setDiagnosticError(null);
    try {
      const next = await desktopApi.setDebugSettings({
        enabled,
        level: enabled ? 'debug' : 'info',
        ttlHours: 24,
        expireAt: enabled ? undefined : null,
      });
      setDebugSettings(next);
    } catch {
      setDiagnosticError(t('settings:desktopDebug.debugModeUpdateError'));
    } finally {
      setIsUpdatingDebugSettings(false);
    }
  }

  async function handleCreateDiagnosticBundle(): Promise<void> {
    const desktopApi: DesktopApiBridge | undefined =
      typeof window !== 'undefined' ? window.api : undefined;
    if (!desktopApi?.createDiagnosticBundle) {
      return;
    }

    setIsCreatingDiagnosticBundle(true);
    setDiagnosticBundleResult(null);
    setDiagnosticError(null);

    try {
      const result = await desktopApi.createDiagnosticBundle({
        anonymizePaths: true,
        maxBundleSizeMb: 25,
      });
      setDiagnosticBundleResult(result);

      if (result.success) {
        trackAnalyticsEvent('diagnostic_bundle_created', {
          source: 'settings_page',
          file_count: result.fileCount ?? null,
          size_bytes: result.sizeBytes ?? null,
          anonymize_paths: true,
        });
      }

      if (result.canceled) {
        trackAnalyticsEvent('diagnostic_bundle_cancelled', {
          source: 'settings_page',
        });
      }

      if (!result.success && !result.canceled) {
        trackAnalyticsEvent('diagnostic_bundle_failed', {
          source: 'settings_page',
          message: result.error ?? t('settings:desktopDebug.exportError'),
        });
        setDiagnosticError(result.error ?? t('settings:desktopDebug.exportError'));
      }
    } catch (error) {
      trackAnalyticsEvent('diagnostic_bundle_failed', {
        source: 'settings_page',
        message:
          error instanceof Error ? error.message : t('settings:desktopDebug.exportError'),
      });
      captureAnalyticsException(error, {
        handled_by: 'diagnostic_bundle_export',
        source: 'settings_page',
      });
      setDiagnosticError(t('settings:desktopDebug.exportError'));
    } finally {
      setIsCreatingDiagnosticBundle(false);
    }
  }

  async function handleRunAnalyticsSelfTest(
    type: 'event' | 'exception'
  ): Promise<void> {
    setIsRunningAnalyticsSelfTest(true);
    setSelfTestResult(null);

    try {
      const result = await runAnalyticsSelfTest(type);
      setSelfTestResult(result);
    } finally {
      setIsRunningAnalyticsSelfTest(false);
    }
  }

  return (
    <PageFrame
      activeNav="settings"
      contentClassName="max-w-[88rem] mx-auto"
    >
      <div className="space-y-8">
          <section
            className={PANEL_CLASS}
            aria-labelledby="language-settings-title"
          >
            <h2
              id="language-settings-title"
              className="text-lg font-semibold text-theme-primary mb-2"
            >
              {t('settings:language')}
            </h2>
            <p className="text-sm text-theme-secondary mb-4">
              {t('settings:languageDescription')}
            </p>
            <LanguageSelector />
          </section>

          <section
            className={PANEL_CLASS}
            aria-labelledby="license-settings-title"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2
                id="license-settings-title"
                className="text-lg font-semibold text-theme-primary"
              >
                {t('license:entry.title')}
              </h2>
              <span className="rounded-full border border-theme bg-theme-elevated px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-theme-secondary">
                {t('license:entry.comingSoonBadge')}
              </span>
            </div>
            <p className="text-sm text-theme-secondary mb-4">
              {t('license:entry.description')}
            </p>
            <p className="text-xs text-theme-tertiary mb-4">
              {t('license:entry.comingSoonDescription')}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="rounded-lg border border-theme bg-theme-elevated px-4 py-2 text-theme-secondary opacity-70 cursor-not-allowed"
              >
                {t('license:entry.manage')}
              </button>
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="rounded-lg border border-theme bg-theme-elevated px-4 py-2 text-theme-secondary opacity-70 cursor-not-allowed"
              >
                {t('license:entry.pricing')}
              </button>
            </div>
          </section>

          <section
            className={PANEL_CLASS}
            aria-labelledby="data-management-title"
          >
            <h2
              id="data-management-title"
              className="text-lg font-semibold text-theme-primary mb-2"
            >
              {t('settings:data.title')}
            </h2>
            <p className="text-sm text-theme-secondary mb-4">
              {t('settings:data.description')}
            </p>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Link
                to="/settings/data/backup"
                className="rounded-xl border border-theme bg-theme-elevated p-4 transition-colors hover:bg-theme-surface"
              >
                <h3 className="text-sm font-semibold text-theme-primary">
                  {t('settings:data.backupTitle')}
                </h3>
                <p className="mt-2 text-sm text-theme-secondary">
                  {t('settings:data.backupDescription')}
                </p>
              </Link>

              {isTeamFeatureEnabled && (
                <Link
                  to="/settings/team"
                  className="rounded-xl border border-theme bg-theme-elevated p-4 transition-colors hover:bg-theme-surface"
                >
                  <h3 className="text-sm font-semibold text-theme-primary">
                    {t('settings:data.teamTitle')}
                  </h3>
                  <p className="mt-2 text-sm text-theme-secondary">
                    {t('settings:data.teamDescription')}
                  </p>
                </Link>
              )}
            </div>
          </section>

          <section
            className="grid grid-cols-1 md:grid-cols-4 gap-4"
            aria-label={t('settings:operationsSummary')}
          >
            <article className="vs-frost-panel rounded-xl p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-theme-secondary">
                {t('settings:system')}
              </p>
              <p
                className={`mt-2 text-xl font-semibold ${
                  !statusError ? 'text-[var(--color-state-success)]' : 'text-theme-secondary'
                }`}
              >
                {liveLabel}
              </p>
            </article>
            <article className="vs-frost-panel rounded-xl p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-theme-secondary">
                {t('settings:lastScan')}
              </p>
              <p className="mt-2 text-sm font-medium text-theme-primary">
                {formatLastScan(lastScanAt)}
              </p>
            </article>
            <article className="vs-frost-panel rounded-xl p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-theme-secondary">
                {t('settings:watcher')}
              </p>
              <p className={`mt-2 text-sm font-medium ${
                workers?.watcher ? 'text-theme-success' : 'text-[var(--color-state-danger)]'
              }`}>
                {workers ? (workers.watcher ? 'Active' : 'Down') : '—'}
              </p>
            </article>
            <article className="vs-frost-panel rounded-xl p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-theme-secondary">
                {t('settings:scanner')}
              </p>
              <p className={`mt-2 text-sm font-medium ${
                workers?.usageScanner ? 'text-theme-success' : 'text-[var(--color-state-danger)]'
              }`}>
                {workers ? (workers.usageScanner ? 'Active' : 'Down') : '—'}
              </p>
            </article>
            <article className="vs-frost-panel rounded-xl p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-theme-secondary">
                {t('settings:health')}
              </p>
              <p className="mt-2 text-xl font-semibold text-[var(--color-primary)]">
                {healthScore ? `${healthScore}%` : '—'}
              </p>
            </article>
          </section>

          <section
            aria-labelledby="scan-settings-title"
            className={PANEL_CLASS}
          >
            <h2
              id="scan-settings-title"
              className="text-lg font-semibold text-theme-primary mb-4"
            >
              {t('settings:coreScanSettings')}
            </h2>
            <div className="space-y-4">
              <RescanButton variant="primary" size="md" />
              <p className="text-sm text-theme-secondary">
                {t('settings:lastScan')}: {formatLastScan(lastScanAt)}
              </p>
            </div>
          </section>

          <WorkspacePathsSection config={config ?? null} />

          <section
            aria-labelledby="global-settings-title"
            className={PANEL_CLASS}
          >
            <h2
              id="global-settings-title"
              className="text-lg font-semibold text-theme-primary mb-4"
            >
              {t('settings:globalSettings')}
            </h2>
            <p className="text-sm text-theme-secondary mb-4">
              {t('settings:globalDescription')}
            </p>
            <div className="mb-6">
              <EnabledAgentsSettings />
            </div>
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-theme-primary">
                  {t('settings:claudeGlobalPath')}
                </h3>
                <ChangeGlobalPathForm mode="claude" currentPath={currentClaudeGlobalPath} />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-theme-primary">
                  {t('settings:cursorGlobalPath')}
                </h3>
                <ChangeGlobalPathForm mode="cursor" currentPath={currentCursorGlobalPath} />
              </div>
            </div>
          </section>

          <TagManagerSection />

          <DisplaySettings />
          <NotificationSettings />
          <AdvancedSettings />
          <MonitoringSettings
            analyticsStatus={analyticsStatus}
            isElectronEnv={isElectronEnv}
            onRefreshAnalyticsStatus={refreshAnalyticsStatus}
          />

          <DangerZoneSection />

          <section
            aria-labelledby="onboarding-title"
            className={PANEL_CLASS}
          >
            <h2
              id="onboarding-title"
              className="text-lg font-semibold text-theme-primary mb-4"
            >
              {t('settings:onboarding')}
            </h2>
            <p className="text-sm text-theme-secondary mb-4">
              {t('settings:onboardingDescription')}
            </p>
            <TourTrigger />
          </section>

          {/* About & Updates (Electron only) */}
          {isElectronEnv && (
            <section
              aria-labelledby="about-title"
              className={PANEL_CLASS}
            >
              <h2
                id="about-title"
                className="text-lg font-semibold text-theme-primary mb-4"
              >
                {t('settings:about')}
              </h2>

              {/* Current Version */}
              <div className="mb-6">
                <p className="text-sm text-theme-secondary mb-2">
                  {t('common:updates.currentVersion')}
                </p>
                <p className="text-base font-medium text-theme-primary">
                  {currentVersion || '—'}
                </p>
              </div>

              {/* Debug Mode + Diagnostic Bundle */}
              <div className="mb-6 border-t border-theme pt-6">
                <h3 className="text-base font-semibold text-theme-primary mb-2">
                  {t('settings:desktopDebug.title')}
                </h3>
                <p className="text-sm text-theme-secondary mb-4">
                  {t('settings:desktopDebug.description')}
                </p>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <input
                      id="desktop-debug-mode"
                      type="checkbox"
                      className={CHECKBOX_CLASS}
                      checked={Boolean(debugSettings?.enabled)}
                      disabled={isUpdatingDebugSettings || !debugSettings}
                      onChange={(event) => {
                        void handleDebugModeToggle(event.target.checked);
                      }}
                    />
                    <div className="space-y-1">
                      <label
                        htmlFor="desktop-debug-mode"
                        className="text-sm font-medium text-theme-primary"
                      >
                        {t('settings:desktopDebug.debugModeLabel')}
                      </label>
                      <p className="text-xs text-theme-secondary">
                        {t('settings:desktopDebug.debugModeHelp')}
                      </p>
                      {debugSettings?.enabled && debugSettings.expireAt && (
                        <p className="text-xs text-theme-secondary">
                          {t('settings:desktopDebug.debugModeExpires', {
                            time: formatLastScan(new Date(debugSettings.expireAt)),
                          })}
                        </p>
                      )}
                    </div>
                  </div>

                  <Button
                    onClick={() => {
                      void handleCreateDiagnosticBundle();
                    }}
                    disabled={isCreatingDiagnosticBundle}
                    variant="outline"
                    className="w-full"
                  >
                    {isCreatingDiagnosticBundle
                      ? t('settings:desktopDebug.exporting')
                      : t('settings:desktopDebug.exportBundle')}
                  </Button>

                  {debugSettings?.enabled && (
                    <div className="rounded-lg border border-theme bg-theme-elevated p-4 space-y-3">
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-theme-primary">
                          {t('settings:desktopDebug.analyticsSelfTestTitle')}
                        </h4>
                        <p className="text-xs text-theme-secondary">
                          {t('settings:desktopDebug.analyticsSelfTestDescription')}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Button
                          onClick={() => {
                            void handleRunAnalyticsSelfTest('event');
                          }}
                          disabled={
                            isRunningAnalyticsSelfTest ||
                            !analyticsStatus?.enabled
                          }
                          variant="outline"
                          className="w-full"
                        >
                          {t('settings:desktopDebug.sendTestEvent')}
                        </Button>
                        <Button
                          onClick={() => {
                            void handleRunAnalyticsSelfTest('exception');
                          }}
                          disabled={
                            isRunningAnalyticsSelfTest ||
                            !analyticsStatus?.captureExceptions
                          }
                          variant="outline"
                          className="w-full"
                        >
                          {t('settings:desktopDebug.sendTestException')}
                        </Button>
                      </div>

                      {selfTestResult && (
                        <div
                          className={`rounded-lg p-3 ${
                            selfTestResult.success
                              ? 'alert-theme-success'
                              : 'alert-theme-warning'
                          }`}
                        >
                          <p
                            className={`text-sm ${
                              selfTestResult.success
                                ? 'text-theme-success'
                                : 'text-theme-warning'
                            }`}
                          >
                            {selfTestResult.success
                              ? t('settings:desktopDebug.analyticsSelfTestSuccess', {
                                  type:
                                    selfTestResult.type === 'event'
                                      ? t('settings:desktopDebug.sendTestEvent')
                                      : t(
                                          'settings:desktopDebug.sendTestException'
                                        ),
                                })
                              : t('settings:desktopDebug.analyticsSelfTestFailure', {
                                  reason:
                                    selfTestResult.error ??
                                    analyticsStatus?.lastSelfTestError ??
                                    analyticsStatus?.degradedReason ??
                                    t('settings:monitoring.valueUnknown'),
                                })}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {diagnosticBundleResult?.success && diagnosticBundleResult.path && (
                    <div className="alert-theme-success rounded-lg p-3 space-y-1">
                      <p className="text-sm text-theme-success">
                        {t('settings:desktopDebug.exportSuccess')}
                      </p>
                      <p
                        className={`${ANALYTICS_MASK_TEXT_CLASS} text-xs text-theme-secondary break-all`}
                      >
                        {t('settings:desktopDebug.exportPath', {
                          path: diagnosticBundleResult.path,
                        })}
                      </p>
                    </div>
                  )}

                  {diagnosticBundleResult?.canceled && (
                    <div className="panel-theme-status rounded-lg p-3">
                      <p className="text-sm text-theme-secondary">
                        {t('settings:desktopDebug.exportCancelled')}
                      </p>
                    </div>
                  )}

                  {diagnosticError && (
                    <div className="alert-theme-danger rounded-lg p-3">
                      <p className="text-sm text-theme-danger">{diagnosticError}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Update Check */}
              <div className="space-y-4">
                <Button
                  onClick={() => {
                    void checkForUpdates();
                  }}
                  disabled={isChecking || isDownloading || isInstalling}
                  className="w-full"
                >
                  {isChecking
                    ? t('common:updates.checking')
                    : t('common:updates.checkNow')}
                </Button>
                <Button
                  onClick={() => {
                    openReleaseNotesModal();
                  }}
                  disabled={isInstalling}
                  variant="outline"
                  className="w-full"
                >
                  {t('common:updates.releaseNotes')}
                </Button>

                {/* Update Status */}
                {updateStatus === 'not-available' && (
                  <div className="alert-theme-success rounded-lg p-3">
                    <p className="inline-flex items-center gap-1 text-sm text-theme-success">
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                      {t('common:updates.upToDate')}
                    </p>
                  </div>
                )}

                {isAvailable && updateInfo && (
                  <div className="panel-theme-status rounded-lg p-4">
                    <p className="mb-2 text-sm font-medium text-theme-primary">
                      {t('common:updates.updateAvailableMessage', {
                        version: updateInfo.version,
                      })}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        onClick={() => {
                          if (
                            normalizedUpdateVersion &&
                            !hasReviewedCurrentReleaseNotes
                          ) {
                            openReleaseNotesModal();
                            return;
                          }
                          void downloadUpdate();
                        }}
                        disabled={isDownloading || isInstalling}
                        size="sm"
                      >
                        {t('common:updates.downloadNow')}
                      </Button>
                    </div>
                  </div>
                )}

                {isDownloading && downloadProgress && (
                  <div className="panel-theme-status rounded-lg p-4 space-y-3">
                    <p className="text-sm font-medium text-theme-primary">
                      {t('common:updates.downloading')}
                    </p>
                    <Progress
                      value={downloadProgress.percent}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-theme-secondary">
                      <span>{Math.round(downloadProgress.percent)}%</span>
                      <span>
                        {(downloadProgress.bytesPerSecond / 1024 / 1024).toFixed(2)} MB/s
                      </span>
                    </div>
                  </div>
                )}

                {isInstalling && (
                  <div className="alert-theme-warning rounded-lg p-4 space-y-2">
                    <p className="text-sm font-medium text-theme-warning">
                      {t('common:updates.installing')}
                    </p>
                    <p className="text-xs text-theme-secondary">
                      {t('common:updates.installingMessage', {
                        version: pendingInstallVersion ?? updateInfo?.version ?? '',
                      })}
                    </p>
                    {showInstallDelayHint && (
                      <p className="text-xs text-theme-secondary">
                        {t('common:updates.installDelayHint')}
                      </p>
                    )}
                  </div>
                )}

                {isDownloaded && updateInfo && (
                  <div className="alert-theme-success rounded-lg p-4">
                    <p className="mb-2 text-sm font-medium text-theme-success">
                      {t('common:updates.readyToInstall')}
                    </p>
                    <p className="mb-3 text-xs text-theme-secondary">
                      {t('common:updates.willInstallOnRestart')}
                    </p>
                    <Button
                      onClick={() => {
                        void quitAndInstall();
                      }}
                      size="sm"
                      className="btn-theme-primary-soft"
                    >
                      {t('common:updates.restartNow')}
                    </Button>
                  </div>
                )}

                {updateStatus === 'error' && (
                  <div className="alert-theme-danger rounded-lg p-3">
                    <p className="text-sm text-theme-danger">
                      {t('common:updates.error')}
                    </p>
                  </div>
                )}

                <Dialog
                  open={isReleaseNotesOpen}
                  onOpenChange={setIsReleaseNotesOpen}
                >
                  <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden bg-theme-surface border-theme text-theme-primary sm:max-w-3xl">
                    <DialogHeader className="flex-shrink-0">
                      <DialogTitle>
                        {t('common:updates.whatsNew')}{' '}
                        {updateInfo?.version ? `v${updateInfo.version.replace(/^v/i, '')}` : ''}
                      </DialogTitle>
                      <DialogDescription className="text-theme-secondary">
                        {t('common:updates.releaseNotes')}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="mt-2 min-h-0 flex-1 overflow-y-auto pr-1">
                      {hasReleaseNotes ? (
                        <MarkdownRenderer content={releaseNotes} />
                      ) : (
                        <div className="space-y-3">
                          <p className="text-sm text-theme-secondary">
                            {t('common:updates.releaseNotesUnavailable')}
                          </p>
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                          >
                            <a
                              href={releasePageUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {t('common:updates.openReleasePage')}
                            </a>
                          </Button>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </section>
          )}
      </div>
    </PageFrame>
  );
}

/* ── 워크스페이스 경로 테이블 섹션 ── */

const PANEL_CLASS_INNER = 'vs-frost-panel rounded-2xl p-6';

function isValidPath(path: string): boolean {
  const trimmed = path.trim();
  if (!trimmed) return false;
  return trimmed.startsWith('/') || trimmed.startsWith('~/');
}

function WorkspacePathsSection({ config }: { config: { root_paths: string[] } | null }) {
  const { t } = useTranslation(['settings', 'scan']);
  const queryClient = useQueryClient();
  const [newPath, setNewPath] = useState('');
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemovePath, setConfirmRemovePath] = useState<string | null>(null);
  const [affectedCount, setAffectedCount] = useState(0);
  const [pendingEditNewPath, setPendingEditNewPath] = useState<string | null>(null);

  const rootPaths = config?.root_paths ?? [];

  const { mutate: scanMutate, isPending: isScanPending } = useScan({
    onSuccess: () => {
      if (!editingPath) {
        trackProjectCreated({
          source: 'settings_root_path_add',
        });
        trackFirstValueOnce('project_created', {
          project_create_source: 'settings_root_path_add',
        });
      }
      setNewPath('');
      setError(null);
    },
  });

  const removeMutation = useMutation({
    mutationFn: removeRootPath,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['config'] });
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      void queryClient.invalidateQueries({ queryKey: ['components'] });
      showSuccessToast(t('settings:pathRemoved'));
    },
    onError: (err: Error) => {
      showErrorToast(err.message);
    },
  });

  const handleRemoveClick = useCallback(async (path: string) => {
    try {
      const preview = await dryRunRemoveRootPath(path);
      setAffectedCount(preview.affected_projects);
      setConfirmRemovePath(path);
    } catch {
      // dry_run 실패 시 경고 없이 바로 확인
      setAffectedCount(0);
      setConfirmRemovePath(path);
    }
  }, []);

  const handleConfirmRemove = useCallback(() => {
    if (!confirmRemovePath) return;
    if (pendingEditNewPath) {
      // 편집: 기존 삭제 → 새 경로 스캔
      removeMutation.mutate(confirmRemovePath, {
        onSuccess: () => {
          scanMutate({ root_path: pendingEditNewPath });
          setEditingPath(null);
        },
      });
      setPendingEditNewPath(null);
    } else {
      // 단순 삭제
      removeMutation.mutate(confirmRemovePath);
    }
    setConfirmRemovePath(null);
  }, [confirmRemovePath, pendingEditNewPath, removeMutation, scanMutate]);

  const handleAdd = useCallback(() => {
    setError(null);
    const trimmed = newPath.trim();
    if (!trimmed) {
      setError(t('scan:pathRequired'));
      return;
    }
    if (!isValidPath(trimmed)) {
      setError(t('scan:pathAbsoluteRequired'));
      return;
    }
    if (rootPaths.includes(trimmed) && trimmed !== editingPath) {
      setError(t('settings:pathAlreadyExists'));
      return;
    }
    if (editingPath) {
      // 편집 = 기존 경로 삭제 + 새 경로 스캔 → 삭제 전 경고 필요
      void (async () => {
        try {
          const preview = await dryRunRemoveRootPath(editingPath);
          setAffectedCount(preview.affected_projects);
        } catch {
          setAffectedCount(0);
        }
        setPendingEditNewPath(trimmed);
        setConfirmRemovePath(editingPath);
      })();
    } else {
      scanMutate({ root_path: trimmed });
    }
  }, [newPath, rootPaths, editingPath, scanMutate, t]);

  const handleCancelEdit = useCallback(() => {
    setEditingPath(null);
    setNewPath('');
    setError(null);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAdd();
      }
    },
    [handleAdd]
  );

  return (
    <section aria-labelledby="add-project-title" className={PANEL_CLASS_INNER}>
      <h2
        id="add-project-title"
        className="text-lg font-semibold text-theme-primary mb-2"
      >
        {t('settings:workspaceSettings')}
      </h2>
      <p className="text-sm text-theme-secondary mb-4">
        {t('settings:workspaceDescription')}
      </p>

      <div className="overflow-hidden rounded-lg border border-theme">
        {/* Rows */}
        {rootPaths.map((p) =>
          editingPath === p ? (
            <div
              key={p}
              className="grid grid-cols-[1fr_auto] items-center border-b border-theme px-4 py-2"
            >
              <div>
                <input
                  type="text"
                  value={newPath}
                  onChange={(e) => {
                    setNewPath(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={isScanPending}
                  autoFocus
                  aria-label={t('settings:workspacePathInputLabel')}
                  className="w-full rounded-lg border border-theme bg-theme-bg px-3 py-1.5 font-mono text-sm text-theme-primary disabled:opacity-50"
                />
                {error && (
                  <p className="mt-1 text-xs text-theme-danger">{error}</p>
                )}
              </div>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex h-8 w-10 items-center justify-center rounded text-theme-secondary hover:text-theme-primary transition-colors"
                  aria-label={t('settings:cancelEdit')}
                >
                  <X className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={isScanPending}
                  className="flex h-8 w-10 items-center justify-center rounded text-theme-secondary hover:text-theme-primary transition-colors disabled:opacity-50"
                  aria-label={t('settings:editPath')}
                >
                  <Check className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div
              key={p}
              className="grid grid-cols-[1fr_auto] items-center border-b border-theme px-4 py-2"
            >
              <span className="truncate font-mono text-sm text-theme-primary">{p}</span>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    setEditingPath(p);
                    setNewPath(p);
                    setError(null);
                  }}
                  className="flex h-8 w-10 items-center justify-center rounded text-theme-secondary hover:text-theme-primary transition-colors"
                  aria-label={t('settings:editPath')}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleRemoveClick(p)}
                  disabled={removeMutation.isPending}
                  className="flex h-8 w-10 items-center justify-center rounded text-theme-secondary hover:text-theme-danger transition-colors"
                  aria-label={t('settings:removePath')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )
        )}

        {rootPaths.length === 0 && (
          <div className="px-4 py-3 text-center text-sm text-theme-secondary">
            {t('settings:noRegisteredPaths')}
          </div>
        )}

        {/* Add row */}
        <div className="grid grid-cols-[1fr_auto] items-center px-4 py-2">
          <input
            type="text"
            value={editingPath ? '' : newPath}
            onChange={(e) => {
              setNewPath(e.target.value);
              setError(null);
            }}
            onKeyDown={editingPath ? undefined : handleKeyDown}
            disabled={isScanPending || Boolean(editingPath)}
            aria-label={t('settings:workspacePathInputLabel')}
            placeholder={t('scan:projectRootPlaceholder')}
            className="w-full rounded-lg border border-theme bg-theme-bg px-3 py-1.5 font-mono text-sm text-theme-primary placeholder:text-theme-tertiary disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={isScanPending || Boolean(editingPath)}
            className="flex h-8 w-10 items-center justify-center rounded text-theme-secondary hover:text-theme-primary transition-colors disabled:opacity-50"
            aria-label={t('settings:addPath')}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmRemovePath !== null}
        onClose={() => { setConfirmRemovePath(null); setPendingEditNewPath(null); }}
        onConfirm={handleConfirmRemove}
        title={t('settings:removePathConfirmTitle')}
        message={
          affectedCount > 0
            ? t('settings:removePathConfirmMessage', { count: affectedCount })
            : t('settings:removePathConfirmNoProjects')
        }
        variant={affectedCount > 0 ? 'danger' : 'warning'}
      />
    </section>
  );
}

/* ── Danger Zone 섹션 ── */

function DangerZoneSection() {
  const { t } = useTranslation('settings');
  const queryClient = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);

  const resetMutation = useMutation({
    mutationFn: factoryReset,
    onSuccess: (data) => {
      void queryClient.invalidateQueries();
      showSuccessToast(
        t('dangerZone.factoryResetSuccess', {
          projects: data.scanned_projects,
          components: data.total_components,
        })
      );
    },
    onError: (err: Error) => {
      showErrorToast(err.message);
    },
  });

  return (
    <section
      aria-labelledby="danger-zone-title"
      className="rounded-2xl border-2 border-[color-mix(in_srgb,var(--color-state-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-state-danger)_5%,transparent)] p-6"
    >
      <h2
        id="danger-zone-title"
        className="mb-2 text-lg font-semibold text-[var(--color-state-danger)]"
      >
        {t('dangerZone.title')}
      </h2>
      <p className="text-sm text-theme-secondary mb-4">
        {t('dangerZone.description')}
      </p>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={resetMutation.isPending}
        className="rounded-lg bg-[var(--color-state-danger)] px-4 py-2 font-medium text-white transition-[filter,opacity] hover:brightness-95 disabled:opacity-50"
      >
        {resetMutation.isPending ? t('dangerZone.factoryResetRunning') : t('dangerZone.factoryResetButton')}
      </button>

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={() => resetMutation.mutate()}
        title={t('dangerZone.factoryResetConfirmTitle')}
        message={t('dangerZone.factoryResetConfirmMessage')}
        variant="danger"
      />
    </section>
  );
}
