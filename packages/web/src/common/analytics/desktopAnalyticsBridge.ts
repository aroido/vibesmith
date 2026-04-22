type AnalyticsEventProperties = Record<string, string | number | boolean | null>;
const ANALYTICS_EVENT_NAMES = {
  featureUsed: 'feature_used',
  firstValueReached: 'first_value_reached',
  pageview: '$pageview',
  projectSyncCompleted: 'project_sync_completed',
  projectSyncFailed: 'project_sync_failed',
  projectCreated: 'project_created',
} as const;

export type AnalyticsSelfTestResult = {
  success: boolean;
  type: 'event' | 'exception';
  error?: string;
};
export type AnalyticsFlushResult = {
  success: boolean;
  eventRequestsFlushed: number;
  replayRequestsFlushed: number;
  error?: string;
};
export type PageViewNavigationType = 'initial_load' | 'hash_change';
export type ProjectSyncMode = 'quick_refresh' | 'auto_rescan' | 'force_rescan';

export type AnalyticsBridgeStatus = {
  configured: boolean;
  ready: boolean;
  enabled: boolean;
  sdkCapturing: boolean;
  sdkOptedIn: boolean | null;
  sdkOptedOut: boolean | null;
  sdkOptOutUseragentFilter: boolean | null;
  host: string;
  appVersion: string;
  releaseChannel: string;
  identityScope: 'installation' | null;
  identityReady: boolean;
  maskedDistinctId: string | null;
  degradedReason: string | null;
  captureExceptions: boolean;
  captureConsoleLogs: boolean;
  capturePerformance: boolean;
  sessionRecording: boolean;
  replayUrl: string | null;
  lastSelfTestAt: string | null;
  lastSelfTestError: string | null;
  lastEventCaptureAt: string | null;
  lastEventName: string | null;
  lastExceptionCaptureAt: string | null;
  eventTransportSeen: boolean;
  replayTransportSeen: boolean;
  lastEventTransportAt: string | null;
  lastReplayTransportAt: string | null;
  lastTransportMethod: 'fetch' | 'xhr' | 'sendBeacon' | null;
  lastTransportStatus: number | null;
  lastTransportError: string | null;
  lastInternalRequestUrl: string | null;
  lastInternalRequestBatchKey: string | null;
  lastInternalRequestKind: 'event' | 'replay' | null;
  lastQueuedRequestUrl: string | null;
  lastQueuedRequestBatchKey: string | null;
  lastQueuedRequestKind: 'event' | 'replay' | null;
  lastInternalCaptureEvent: string | null;
  replayRecordingStatus: string | null;
  replayInternalBufferLength: number | null;
  replayInternalBufferSize: number | null;
  replayFlushedSize: number | null;
  replayRetryQueueSize: number | null;
  replayRequestQueueLength: number | null;
  replayRequestQueuePaused: boolean | null;
  droppedMalformedPageviews: number;
  lastDroppedMalformedPageviewAt: string | null;
  lastDroppedMalformedPageviewReason: string | null;
  serverRemoteConfigLoaded: boolean;
  serverRemoteConfigError: string | null;
  serverSessionRecording: boolean | null;
  serverExceptionAutocapture: boolean | null;
  serverConsoleLogCapture: boolean | null;
  serverNetworkCapture: boolean | null;
};

function getAnalyticsBridge():
  | {
      track: (eventName: string, properties?: AnalyticsEventProperties) => void;
      isEnabled: () => boolean;
      getStatus?: () => AnalyticsBridgeStatus;
      refreshStatus?: () => AnalyticsBridgeStatus;
      forceFlush?: () => Promise<AnalyticsFlushResult>;
      runSelfTest?: (
        type: 'event' | 'exception'
      ) => Promise<AnalyticsSelfTestResult>;
      captureException?: (
        error: unknown,
        additionalProperties?: AnalyticsEventProperties
      ) => void;
    }
  | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.__vibesmithAnalytics;
}

function normalizePageViewRoute(route: string): string | null {
  const normalizedRoute = route.trim();
  return normalizedRoute.length > 0 ? normalizedRoute : null;
}

export function trackAnalyticsEvent(
  eventName: string,
  properties: AnalyticsEventProperties = {}
): void {
  const bridge = getAnalyticsBridge();
  if (!bridge) return;
  bridge.track(eventName, properties);
}

export function trackPageView(
  route: string,
  navigationType: PageViewNavigationType = 'hash_change'
): void {
  const normalizedRoute = normalizePageViewRoute(route);
  if (!normalizedRoute) return;

  trackAnalyticsEvent(ANALYTICS_EVENT_NAMES.pageview, {
    navigation_type: navigationType,
    route: normalizedRoute,
  });
}

export function trackFeatureUsed(
  featureName: string,
  properties: AnalyticsEventProperties = {}
): void {
  trackAnalyticsEvent(ANALYTICS_EVENT_NAMES.featureUsed, {
    feature_name: featureName,
    ...properties,
  });
}

export function trackProjectCreated(
  properties: AnalyticsEventProperties = {}
): void {
  trackAnalyticsEvent(ANALYTICS_EVENT_NAMES.projectCreated, properties);
}

export function trackProjectSyncCompleted(
  properties: AnalyticsEventProperties = {}
): void {
  trackAnalyticsEvent(ANALYTICS_EVENT_NAMES.projectSyncCompleted, properties);
}

export function trackProjectSyncFailed(
  properties: AnalyticsEventProperties = {}
): void {
  trackAnalyticsEvent(ANALYTICS_EVENT_NAMES.projectSyncFailed, properties);
}

export function trackFirstValueReached(
  properties: AnalyticsEventProperties = {}
): void {
  trackAnalyticsEvent(ANALYTICS_EVENT_NAMES.firstValueReached, properties);
}

export function getAnalyticsBridgeStatus(): AnalyticsBridgeStatus | null {
  const bridge = getAnalyticsBridge();
  return bridge?.getStatus?.() ?? null;
}

export function refreshAnalyticsBridgeStatus(): AnalyticsBridgeStatus | null {
  const bridge = getAnalyticsBridge();
  return bridge?.refreshStatus?.() ?? bridge?.getStatus?.() ?? null;
}

export async function runAnalyticsSelfTest(
  type: 'event' | 'exception'
): Promise<AnalyticsSelfTestResult> {
  const bridge = getAnalyticsBridge();
  if (!bridge?.runSelfTest) {
    return {
      success: false,
      type,
      error: 'analytics_bridge_unavailable',
    };
  }

  return bridge.runSelfTest(type);
}

export function captureAnalyticsException(
  error: unknown,
  additionalProperties: AnalyticsEventProperties = {}
): void {
  const bridge = getAnalyticsBridge();
  if (!bridge) return;
  bridge.captureException?.(error, additionalProperties);
}
