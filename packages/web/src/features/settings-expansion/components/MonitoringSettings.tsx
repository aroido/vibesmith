/**
 * MonitoringSettings - 사용자용 분석/진단 수집 설정
 */

import { useTranslation } from 'react-i18next';
import type { AnalyticsBridgeStatus } from '@/common/analytics/desktopAnalyticsBridge';
import { useMonitoringSettings } from '../hooks/useMonitoringSettings';

const sectionClass = 'vs-frost-panel rounded-2xl p-6';

const checkboxClass =
  'h-4 w-4 rounded border border-theme bg-theme-surface accent-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-background)]';

interface MonitoringSettingsProps {
  analyticsStatus?: AnalyticsBridgeStatus | null;
  isElectronEnv?: boolean;
  onRefreshAnalyticsStatus?: () => void;
}

export function MonitoringSettings({
  analyticsStatus = null,
  isElectronEnv = false,
  onRefreshAnalyticsStatus,
}: MonitoringSettingsProps) {
  const { t } = useTranslation('settings');
  const {
    crashReporting,
    setCrashReporting,
    performanceMonitoring,
    setPerformanceMonitoring,
    usageAnalytics,
    setUsageAnalytics,
  } = useMonitoringSettings();

  const getBooleanLabel = (value: boolean | null | undefined): string => {
    if (value === true) return t('monitoring.valueOn');
    if (value === false) return t('monitoring.valueOff');
    return t('monitoring.valueUnknown');
  };

  const getDegradedReasonLabel = (reason: string | null | undefined): string => {
    if (!reason) return t('monitoring.valueHealthy');

    const reasonMap: Record<string, string> = {
      missing_posthog_key: t('monitoring.degradedReasons.missingPosthogKey'),
      missing_analytics_identity_bridge: t(
        'monitoring.degradedReasons.missingAnalyticsIdentityBridge'
      ),
      invalid_analytics_identity: t(
        'monitoring.degradedReasons.invalidAnalyticsIdentity'
      ),
      analytics_identity_load_failed: t(
        'monitoring.degradedReasons.analyticsIdentityLoadFailed'
      ),
      analytics_identity_pending: t(
        'monitoring.degradedReasons.analyticsIdentityPending'
      ),
      analytics_identity_unavailable: t(
        'monitoring.degradedReasons.analyticsIdentityUnavailable'
      ),
      posthog_not_ready: t('monitoring.degradedReasons.posthogNotReady'),
      usage_analytics_disabled: t(
        'monitoring.degradedReasons.usageAnalyticsDisabled'
      ),
    };

    return reasonMap[reason] ?? reason;
  };

  const formatStatusTimestamp = (
    value: string | null | undefined
  ): string => {
    if (!value) return t('monitoring.valueUnknown');

    const timestamp = new Date(value);
    if (Number.isNaN(timestamp.getTime())) {
      return value;
    }

    return timestamp.toLocaleString();
  };

  const getMalformedPageviewReasonLabel = (
    reason: string | null | undefined
  ): string => {
    if (!reason) return t('monitoring.valueHealthy');

    const reasonMap: Record<string, string> = {
      missing_route: t('monitoring.malformedPageviewReasons.missingRoute'),
      blank_route: t('monitoring.malformedPageviewReasons.blankRoute'),
      invalid_route_type: t(
        'monitoring.malformedPageviewReasons.invalidRouteType'
      ),
    };

    return reasonMap[reason] ?? reason;
  };

  const statusToneClass = analyticsStatus?.enabled
    ? 'badge-theme-success'
    : analyticsStatus?.ready
    ? 'badge-theme-info'
    : analyticsStatus?.degradedReason
    ? 'badge-theme-warning'
    : 'badge-theme-muted';

  const statusLabel = analyticsStatus?.enabled
    ? t('monitoring.statusEnabled')
    : analyticsStatus?.ready
    ? t('monitoring.statusReady')
    : analyticsStatus?.degradedReason
    ? t('monitoring.statusDegraded')
    : t('monitoring.statusUnavailable');

  return (
    <section className={sectionClass} aria-labelledby="monitoring-settings-title">
      <h2
        id="monitoring-settings-title"
        className="text-lg font-semibold text-theme-primary mb-4"
      >
        {t('monitoring.title')}
      </h2>
      <p className="text-sm text-theme-secondary mb-6">
        {t('monitoring.privacyNote')}
      </p>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <input
              id="crash-reporting"
              type="checkbox"
              checked={crashReporting}
              onChange={(e) => setCrashReporting(e.target.checked)}
              aria-describedby="crash-reporting-desc"
              aria-label={t('monitoring.crashReporting')}
              className={checkboxClass}
            />
            <label
              htmlFor="crash-reporting"
              id="crash-reporting-desc"
              className="text-sm font-medium text-theme-primary"
            >
              {t('monitoring.crashReporting')}
            </label>
          </div>
          <p className="text-xs text-theme-tertiary pl-7">
            {t('monitoring.crashReportingDesc')}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <input
              id="performance-monitoring"
              type="checkbox"
              checked={performanceMonitoring}
              onChange={(e) => setPerformanceMonitoring(e.target.checked)}
              aria-describedby="performance-monitoring-desc"
              aria-label={t('monitoring.performanceMonitoring')}
              className={checkboxClass}
            />
            <label
              htmlFor="performance-monitoring"
              id="performance-monitoring-desc"
              className="text-sm font-medium text-theme-primary"
            >
              {t('monitoring.performanceMonitoring')}
            </label>
          </div>
          <p className="text-xs text-theme-tertiary pl-7">
            {t('monitoring.performanceMonitoringDesc')}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <input
              id="usage-analytics"
              type="checkbox"
              checked={usageAnalytics}
              onChange={(e) => setUsageAnalytics(e.target.checked)}
              aria-describedby="usage-analytics-desc"
              aria-label={t('monitoring.usageAnalytics')}
              className={checkboxClass}
            />
            <label
              htmlFor="usage-analytics"
              id="usage-analytics-desc"
              className="text-sm font-medium text-theme-primary"
            >
              {t('monitoring.usageAnalytics')}
            </label>
          </div>
          <p className="text-xs text-theme-tertiary pl-7">
            {t('monitoring.usageAnalyticsDesc')}
          </p>
        </div>

        {isElectronEnv && (
          <section
            aria-labelledby="posthog-desktop-status-title"
            className="rounded-2xl border border-theme bg-theme-elevated p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3
                  id="posthog-desktop-status-title"
                  className="text-sm font-semibold text-theme-primary"
                >
                  {t('monitoring.desktopStatusTitle')}
                </h3>
                <p className="mt-1 text-xs text-theme-secondary">
                  {t('monitoring.desktopStatusDescription')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${statusToneClass}`}
                >
                  {statusLabel}
                </span>
                <button
                  type="button"
                  onClick={onRefreshAnalyticsStatus}
                  className="rounded-lg border border-theme px-3 py-1.5 text-xs font-semibold btn-theme-surface"
                >
                  {t('monitoring.refreshStatus')}
                </button>
              </div>
            </div>

            {analyticsStatus ? (
              <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
                <StatusField
                  label={t('monitoring.fields.configured')}
                  value={getBooleanLabel(analyticsStatus.configured)}
                />
                <StatusField
                  label={t('monitoring.fields.ready')}
                  value={getBooleanLabel(analyticsStatus.ready)}
                />
                <StatusField
                  label={t('monitoring.fields.enabled')}
                  value={getBooleanLabel(analyticsStatus.enabled)}
                />
                <StatusField
                  label={t('monitoring.fields.identityReady')}
                  value={getBooleanLabel(analyticsStatus.identityReady)}
                />
                <StatusField
                  label={t('monitoring.fields.identityScope')}
                  value={
                    analyticsStatus.identityScope ??
                    t('monitoring.valueUnknown')
                  }
                />
                <StatusField
                  label={t('monitoring.fields.maskedDistinctId')}
                  value={
                    analyticsStatus.maskedDistinctId ??
                    t('monitoring.valueUnknown')
                  }
                  className="font-mono text-xs"
                />
                <StatusField
                  label={t('monitoring.fields.host')}
                  value={analyticsStatus.host || t('monitoring.valueUnknown')}
                  className="font-mono text-xs"
                />
                <StatusField
                  label={t('monitoring.fields.appVersion')}
                  value={analyticsStatus.appVersion || t('monitoring.valueUnknown')}
                />
                <StatusField
                  label={t('monitoring.fields.releaseChannel')}
                  value={
                    analyticsStatus.releaseChannel ||
                    t('monitoring.valueUnknown')
                  }
                />
                <StatusField
                  label={t('monitoring.fields.sessionRecording')}
                  value={getBooleanLabel(analyticsStatus.sessionRecording)}
                />
                <StatusField
                  label={t('monitoring.fields.lastEventName')}
                  value={
                    analyticsStatus.lastEventName ??
                    t('monitoring.valueUnknown')
                  }
                  className="font-mono text-xs"
                />
                <StatusField
                  label={t('monitoring.fields.eventTransportSeen')}
                  value={getBooleanLabel(analyticsStatus.eventTransportSeen)}
                />
                <StatusField
                  label={t('monitoring.fields.replayTransportSeen')}
                  value={getBooleanLabel(analyticsStatus.replayTransportSeen)}
                />
                <StatusField
                  label={t('monitoring.fields.captureExceptions')}
                  value={getBooleanLabel(analyticsStatus.captureExceptions)}
                />
                <StatusField
                  label={t('monitoring.fields.capturePerformance')}
                  value={getBooleanLabel(analyticsStatus.capturePerformance)}
                />
                <StatusField
                  label={t('monitoring.fields.remoteConfig')}
                  value={getBooleanLabel(analyticsStatus.serverRemoteConfigLoaded)}
                />
                <StatusField
                  label={t('monitoring.fields.degradedReason')}
                  value={getDegradedReasonLabel(analyticsStatus.degradedReason)}
                />
                <StatusField
                  label={t('monitoring.fields.remoteConfigError')}
                  value={
                    analyticsStatus.serverRemoteConfigError ??
                    t('monitoring.valueHealthy')
                  }
                  className="font-mono text-xs"
                />
                <StatusField
                  label={t('monitoring.fields.lastTransportError')}
                  value={
                    analyticsStatus.lastTransportError ??
                    t('monitoring.valueHealthy')
                  }
                  className="font-mono text-xs"
                />
                <StatusField
                  label={t('monitoring.fields.droppedMalformedPageviews')}
                  value={String(analyticsStatus.droppedMalformedPageviews)}
                />
                <StatusField
                  label={t('monitoring.fields.lastDroppedMalformedPageviewReason')}
                  value={getMalformedPageviewReasonLabel(
                    analyticsStatus.lastDroppedMalformedPageviewReason
                  )}
                />
                <StatusField
                  label={t('monitoring.fields.lastDroppedMalformedPageviewAt')}
                  value={formatStatusTimestamp(
                    analyticsStatus.lastDroppedMalformedPageviewAt
                  )}
                />
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-theme px-4 py-3 text-sm text-theme-secondary">
                {t('monitoring.desktopStatusUnavailable')}
              </div>
            )}

            {analyticsStatus?.replayUrl && (
              <div className="mt-4">
                <a
                  href={analyticsStatus.replayUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-theme px-3 py-2 text-sm font-medium btn-theme-surface"
                >
                  {t('monitoring.openCurrentReplay')}
                </a>
              </div>
            )}
          </section>
        )}
      </div>
    </section>
  );
}

function StatusField({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-xl border border-theme bg-theme-surface px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.14em] text-theme-secondary">
        {label}
      </p>
      <p className={`mt-1 text-sm text-theme-primary ${className}`}>{value}</p>
    </div>
  );
}
