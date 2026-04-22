import posthogBase from 'posthog-js';
import posthogNoExternal from 'posthog-js/dist/module.full.no-external';
import type { QueuedRequestWithOptions } from 'posthog-js/lib/src/types';
import 'posthog-js/dist/posthog-recorder';

const posthog = posthogNoExternal as unknown as typeof posthogBase;

type AnalyticsEventProperties = Record<string, string | number | boolean | null>;
type BeforeSendCaptureResult = {
  uuid: string;
  event: string;
  properties: Record<string, unknown>;
  $set?: Record<string, unknown>;
  $set_once?: Record<string, unknown>;
  timestamp?: Date;
};
type AnalyticsIdentity = {
  distinctId: string;
  scope: 'installation';
};
type AnalyticsSelfTestResult = {
  success: boolean;
  type: 'event' | 'exception';
  error?: string;
};
type AnalyticsFlushResult = {
  success: boolean;
  eventRequestsFlushed: number;
  replayRequestsFlushed: number;
  error?: string;
};
type MainProcessExceptionPayload = {
  source: string;
  name?: string;
  message: string;
  stack?: string | null;
  metadata?: AnalyticsEventProperties;
};
type PendingAnalyticsAction =
  | {
      kind: 'event';
      eventName: string;
      properties: AnalyticsEventProperties;
    }
  | {
      kind: 'exception';
      error: unknown;
      additionalProperties: AnalyticsEventProperties;
    };
type AnalyticsTransportMethod = 'fetch' | 'xhr' | 'sendBeacon';
type AnalyticsTransportKind = 'event' | 'replay';
type AnalyticsTransportDiagnostics = {
  lastEventCaptureAt: string | null;
  lastEventName: string | null;
  lastExceptionCaptureAt: string | null;
  eventTransportSeen: boolean;
  replayTransportSeen: boolean;
  lastEventTransportAt: string | null;
  lastReplayTransportAt: string | null;
  lastTransportMethod: AnalyticsTransportMethod | null;
  lastTransportStatus: number | null;
  lastTransportError: string | null;
  lastInternalRequestUrl: string | null;
  lastInternalRequestBatchKey: string | null;
  lastInternalRequestKind: AnalyticsTransportKind | null;
  lastQueuedRequestUrl: string | null;
  lastQueuedRequestBatchKey: string | null;
  lastQueuedRequestKind: AnalyticsTransportKind | null;
  lastInternalCaptureEvent: string | null;
};
type AnalyticsGuardDiagnostics = {
  droppedMalformedPageviews: number;
  lastDroppedMalformedPageviewAt: string | null;
  lastDroppedMalformedPageviewReason: string | null;
};

type MonitoringPreferenceChangedEvent = CustomEvent<{ enabled: boolean }>;
type AnalyticsBridgeStatus = {
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
  lastTransportMethod: AnalyticsTransportMethod | null;
  lastTransportStatus: number | null;
  lastTransportError: string | null;
  lastInternalRequestUrl: string | null;
  lastInternalRequestBatchKey: string | null;
  lastInternalRequestKind: AnalyticsTransportKind | null;
  lastQueuedRequestUrl: string | null;
  lastQueuedRequestBatchKey: string | null;
  lastQueuedRequestKind: AnalyticsTransportKind | null;
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

type PostHogClient = typeof posthog;
type ExtendedPostHogClient = PostHogClient & {
  startSessionRecording?: (
    override?:
      | boolean
      | {
          sampling?: boolean;
          linked_flag?: boolean;
          url_trigger?: boolean;
          event_trigger?: boolean;
        }
  ) => void;
  stopSessionRecording?: () => void;
  sessionRecordingStarted?: () => boolean;
  get_session_replay_url?: (options?: { withTimestamp?: boolean; timestampLookBack?: number }) => string;
  get_distinct_id?: () => string;
  identify?: (
    distinctId: string,
    userProperties?: AnalyticsEventProperties
  ) => void;
  captureException?: (
    error: unknown,
    additionalProperties?: AnalyticsEventProperties
  ) => void;
  startExceptionAutocapture?: (config?: {
    capture_unhandled_errors: boolean;
    capture_unhandled_rejections: boolean;
    capture_console_errors: boolean;
  }) => void;
  stopExceptionAutocapture?: () => void;
};
type InternalPostHogRequestOptions = QueuedRequestWithOptions & {
  callback?: (response: InternalPostHogResponse) => void;
  error?: unknown;
  text?: string;
};
type InternalPostHogResponse = {
  statusCode: number;
  error?: unknown;
};
type InternalPostHogRequestQueue = {
  _clearFlushTimeout?: () => void;
  _formatQueue?: () => Record<string, InternalPostHogRequestOptions>;
  enqueue?: (requestOptions: InternalPostHogRequestOptions) => void;
  _queue?: InternalPostHogRequestOptions[];
  _isPaused?: boolean;
};
type InternalPostHogEventEmitter = {
  emit?: (event: 'eventCaptured', data: Record<string, unknown>) => void;
};
type InternalLazyLoadedSessionRecording = {
  _clearFlushBufferTimer?: () => void;
  _flushBuffer?: () => unknown;
};
type InternalSessionRecording = {
  _lazyLoadedSessionRecording?: InternalLazyLoadedSessionRecording | null;
  sdkDebugProperties?: Record<string, unknown>;
};
type InternalPostHogClient = ExtendedPostHogClient & {
  _requestQueue?: InternalPostHogRequestQueue;
  _internalEventEmitter?: InternalPostHogEventEmitter;
  _send_retriable_request?: (request: InternalPostHogRequestOptions) => void;
  _send_request?: (request: InternalPostHogRequestOptions) => void;
  calculateEventProperties?: (
    eventName: string,
    eventProperties?: AnalyticsEventProperties,
    timestamp?: Date,
    uuid?: string,
    readOnly?: boolean
  ) => Record<string, unknown> | null | undefined;
  config?: {
    ip?: boolean;
    opt_out_useragent_filter?: boolean;
    request_headers?: Record<string, string>;
    fetch_options?: RequestInit;
    on_request_error?: (response: InternalPostHogResponse) => void;
  };
  is_capturing?: () => boolean;
  has_opted_in_capturing?: () => boolean;
  has_opted_out_capturing?: () => boolean;
  sessionRecording?: InternalSessionRecording;
  _retryQueue?: {
    length?: number;
  };
};

declare const __VIBESMITH_POSTHOG_KEY__: string;
declare const __VIBESMITH_POSTHOG_HOST__: string;
declare const __VIBESMITH_APP_VERSION__: string;
declare const __VIBESMITH_BUILD_FLAVOR__: string;
declare const __VIBESMITH_POSTHOG_ALLOW_WEBDRIVER__: string;

declare global {
  interface Window {
    api?: {
      getAppVersion?: () => Promise<string>;
      getAnalyticsIdentity?: () => Promise<AnalyticsIdentity>;
      onAnalyticsMainProcessException?: (
        callback: (payload: MainProcessExceptionPayload) => void
      ) => () => void;
    };
    __vibesmithAnalytics?: {
      track: (eventName: string, properties?: AnalyticsEventProperties) => void;
      isEnabled: () => boolean;
      getStatus: () => AnalyticsBridgeStatus;
      refreshStatus: () => AnalyticsBridgeStatus;
      forceFlush: () => Promise<AnalyticsFlushResult>;
      runSelfTest: (
        type: 'event' | 'exception'
      ) => Promise<AnalyticsSelfTestResult>;
      captureException: (
        error: unknown,
        additionalProperties?: AnalyticsEventProperties
      ) => void;
    };
  }
}

// Keep these aligned with packages/web/src/features/settings-expansion/types/index.ts
const ANALYTICS_STORAGE_KEY = 'monitoring.analytics';
const CRASH_REPORTING_STORAGE_KEY = 'monitoring.crashReporting';
const PERFORMANCE_MONITORING_STORAGE_KEY = 'monitoring.performance';
const DEFAULT_USAGE_ANALYTICS = true;
const DEFAULT_CRASH_REPORTING = true;
const DEFAULT_PERFORMANCE_MONITORING = true;
const ANALYTICS_CHANGED_EVENT = 'vibesmith:usage-analytics-changed';
const CRASH_REPORTING_CHANGED_EVENT = 'vibesmith:crash-reporting-changed';
const PERFORMANCE_MONITORING_CHANGED_EVENT = 'vibesmith:performance-monitoring-changed';
const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';
const POSTHOG_KEY = __VIBESMITH_POSTHOG_KEY__.trim();
const POSTHOG_HOST = __VIBESMITH_POSTHOG_HOST__.trim() || DEFAULT_POSTHOG_HOST;
const BUILD_APP_VERSION = __VIBESMITH_APP_VERSION__.trim() || 'unknown';
const BUILD_FLAVOR = __VIBESMITH_BUILD_FLAVOR__ === 'internal' ? 'internal' : 'release';
const ALLOW_POSTHOG_WEBDRIVER =
  __VIBESMITH_POSTHOG_ALLOW_WEBDRIVER__ === 'true';
const POSTHOG_DEFAULTS_VERSION = '2026-01-30';
const ENABLE_RECORDING_CONSOLE_LOG = true;
const SESSION_RECORDING_MASK_TEXT_SELECTOR = '.analytics-mask-text';
const SESSION_RECORDING_BLOCK_SELECTOR = '.ph-no-capture';
const POSTHOG_PROPERTY_DENYLIST = [
  'password',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'cookie',
  'set-cookie',
  'api_key',
  'apikey',
  'secret',
] as const;
const CAPTURE_EXCEPTIONS_CONFIG = {
  capture_unhandled_errors: true,
  capture_unhandled_rejections: true,
  capture_console_errors: true,
} as const;
const CAPTURE_PERFORMANCE_CONFIG = {
  network_timing: true,
  web_vitals: true,
} as const;
const MONITORING_PREFERENCE_CHANGED_EVENT = 'monitoring_preference_changed';
const PAGEVIEW_EVENT_NAME = '$pageview';
const POSTHOG_US_HOST_PATTERN = /^https:\/\/(app|us|us-assets)(\.i)?\.posthog\.com$/i;
const POSTHOG_EU_HOST_PATTERN = /^https:\/\/(eu|eu-assets)(\.i)?\.posthog\.com$/i;
const MAX_PENDING_ANALYTICS_ACTIONS = 50;

let initialized = false;
let posthogClient: PostHogClient | null = null;
let posthogReady = false;
let usageAnalyticsEnabled = DEFAULT_USAGE_ANALYTICS;
let crashReportingEnabled = DEFAULT_CRASH_REPORTING;
let performanceMonitoringEnabled = DEFAULT_PERFORMANCE_MONITORING;
let appVersion = BUILD_APP_VERSION;
let releaseChannel = inferReleaseChannel(BUILD_APP_VERSION);
let analyticsIdentity: AnalyticsIdentity | null = null;
let analyticsIdentityResolved = false;
let analyticsIdentityError: string | null = null;
let analyticsIdentityPromise: Promise<void> | null = null;
let appVersionResolved = false;
let appVersionLoadPromise: Promise<void> | null = null;
let appOpenedTracked = false;
let lastSelfTestAt: string | null = null;
let lastSelfTestError: string | null = null;
let remoteConfigDiagnosticsPromise: Promise<void> | null = null;
let pendingAnalyticsActions: PendingAnalyticsAction[] = [];
let unsubscribeMainProcessExceptionListener: (() => void) | null = null;
let analyticsTransportInstrumentationInstalled = false;
let analyticsTransportClientInstrumentationInstalled = false;
let analyticsFlushLifecycleHandlersInstalled = false;
let commonProperties: AnalyticsEventProperties = {
  app_version: appVersion,
  release_channel: releaseChannel,
  platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
  locale: typeof navigator !== 'undefined' ? navigator.language : 'unknown',
  runtime: 'desktop',
  build_flavor: BUILD_FLAVOR,
};
let remoteConfigDiagnostics: {
  loaded: boolean;
  error: string | null;
  sessionRecording: boolean | null;
  exceptionAutocapture: boolean | null;
  consoleLogCapture: boolean | null;
  networkCapture: boolean | null;
} = {
  loaded: false,
  error: null,
  sessionRecording: null,
  exceptionAutocapture: null,
  consoleLogCapture: null,
  networkCapture: null,
};
let analyticsTransportDiagnostics: AnalyticsTransportDiagnostics = {
  lastEventCaptureAt: null,
  lastEventName: null,
  lastExceptionCaptureAt: null,
  eventTransportSeen: false,
  replayTransportSeen: false,
  lastEventTransportAt: null,
  lastReplayTransportAt: null,
  lastTransportMethod: null,
  lastTransportStatus: null,
  lastTransportError: null,
  lastInternalRequestUrl: null,
  lastInternalRequestBatchKey: null,
  lastInternalRequestKind: null,
  lastQueuedRequestUrl: null,
  lastQueuedRequestBatchKey: null,
  lastQueuedRequestKind: null,
  lastInternalCaptureEvent: null,
};
let analyticsGuardDiagnostics: AnalyticsGuardDiagnostics = {
  droppedMalformedPageviews: 0,
  lastDroppedMalformedPageviewAt: null,
  lastDroppedMalformedPageviewReason: null,
};

function hasConfiguredPostHogKey(): boolean {
  return POSTHOG_KEY.length > 0;
}

function getMalformedPageviewReason(route: unknown): string | null {
  if (route === null || route === undefined) {
    return 'missing_route';
  }

  if (typeof route !== 'string') {
    return 'invalid_route_type';
  }

  return route.trim().length === 0 ? 'blank_route' : null;
}

function recordMalformedPageviewDrop(reason: string): void {
  analyticsGuardDiagnostics.droppedMalformedPageviews += 1;
  analyticsGuardDiagnostics.lastDroppedMalformedPageviewAt =
    new Date().toISOString();
  analyticsGuardDiagnostics.lastDroppedMalformedPageviewReason = reason;
}

function normalizePageviewRoute(route: unknown): string | null {
  if (typeof route !== 'string') {
    return null;
  }

  const normalizedRoute = route.trim();
  return normalizedRoute.length > 0 ? normalizedRoute : null;
}

function sanitizePageviewProperties(
  properties: AnalyticsEventProperties
): AnalyticsEventProperties | null {
  const dropReason = getMalformedPageviewReason(properties.route);
  if (dropReason) {
    recordMalformedPageviewDrop(dropReason);
    return null;
  }

  const normalizedRoute = normalizePageviewRoute(properties.route);
  if (properties.route === normalizedRoute) {
    return properties;
  }

  return {
    ...properties,
    route: normalizedRoute,
  };
}

function sanitizeAnalyticsEventProperties(
  eventName: string,
  properties: AnalyticsEventProperties
): AnalyticsEventProperties | null {
  if (eventName !== PAGEVIEW_EVENT_NAME) {
    return properties;
  }

  return sanitizePageviewProperties(properties);
}

function guardMalformedPageviewEvent(
  captureEvent: BeforeSendCaptureResult | null
): BeforeSendCaptureResult | null {
  if (!captureEvent || captureEvent.event !== PAGEVIEW_EVENT_NAME) {
    return captureEvent;
  }

  const dropReason = getMalformedPageviewReason(captureEvent.properties.route);
  if (dropReason) {
    recordMalformedPageviewDrop(dropReason);
    return null;
  }

  const normalizedRoute = normalizePageviewRoute(captureEvent.properties.route);
  if (captureEvent.properties.route === normalizedRoute) {
    return captureEvent;
  }

  return {
    ...captureEvent,
    properties: {
      ...captureEvent.properties,
      route: normalizedRoute,
    },
  };
}

function shouldAllowPostHogWebdriverAnalytics(): boolean {
  return (
    ALLOW_POSTHOG_WEBDRIVER ||
    (BUILD_FLAVOR === 'internal' &&
      typeof globalThis.navigator !== 'undefined' &&
      globalThis.navigator.webdriver === true)
  );
}

function markEventCapture(eventName: string): void {
  analyticsTransportDiagnostics.lastEventCaptureAt = new Date().toISOString();
  analyticsTransportDiagnostics.lastEventName = eventName;
}

function markExceptionCapture(): void {
  analyticsTransportDiagnostics.lastExceptionCaptureAt = new Date().toISOString();
}

function normalizeTransportUrl(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  if (
    typeof Request !== 'undefined' &&
    value instanceof Request &&
    typeof value.url === 'string' &&
    value.url.length > 0
  ) {
    return value.url;
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'url' in value &&
    typeof (value as { url?: unknown }).url === 'string'
  ) {
    return (value as { url: string }).url;
  }

  return null;
}

function classifyTransportUrl(url: string | null): AnalyticsTransportKind | null {
  if (!url) {
    return null;
  }

  try {
    const parsedUrl = new URL(url, POSTHOG_HOST);
    const pathname = parsedUrl.pathname;

    if (pathname.includes('/s/')) {
      return 'replay';
    }

    if (pathname.includes('/i/v0/e/') || pathname.includes('/e/')) {
      return 'event';
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeTransportMethod(value: unknown): AnalyticsTransportMethod | null {
  if (value === 'fetch') {
    return 'fetch';
  }

  if (value === 'sendBeacon') {
    return 'sendBeacon';
  }

  if (value === 'XHR') {
    return 'xhr';
  }

  return null;
}

function recordTransportSeen(
  kind: AnalyticsTransportKind,
  method: AnalyticsTransportMethod,
  statusCode: number | null = null
): void {
  const timestamp = new Date().toISOString();

  if (kind === 'event') {
    analyticsTransportDiagnostics.eventTransportSeen = true;
    analyticsTransportDiagnostics.lastEventTransportAt = timestamp;
  } else {
    analyticsTransportDiagnostics.replayTransportSeen = true;
    analyticsTransportDiagnostics.lastReplayTransportAt = timestamp;
  }

  analyticsTransportDiagnostics.lastTransportMethod = method;
  analyticsTransportDiagnostics.lastTransportStatus = statusCode;
  analyticsTransportDiagnostics.lastTransportError = null;
}

function recordTransportError(
  method: AnalyticsTransportMethod,
  error: unknown,
  statusCode: number | null = null
): void {
  analyticsTransportDiagnostics.lastTransportMethod = method;
  analyticsTransportDiagnostics.lastTransportStatus = statusCode;
  analyticsTransportDiagnostics.lastTransportError =
    error instanceof Error && error.message.trim().length > 0
      ? error.message.trim()
      : String(error);
}

function stringifyAnalyticsPayload(data: unknown): string {
  return JSON.stringify(data, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );
}

function buildManualEventRequestUrl(): string {
  const requestUrl = new URL('/e/', POSTHOG_HOST);
  requestUrl.searchParams.set('ip', '0');
  requestUrl.searchParams.set('_', Date.now().toString());
  requestUrl.searchParams.set('ver', 'vibesmith-desktop');
  return requestUrl.toString();
}

async function dispatchAnalyticsEventToPostHog(
  eventName: string,
  properties: AnalyticsEventProperties
): Promise<void> {
  const distinctId = getAnalyticsDistinctId();
  if (!distinctId) {
    recordTransportError('fetch', 'missing_distinct_id');
    return;
  }

  try {
    const response = await fetch(buildManualEventRequestUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: stringifyAnalyticsPayload({
        api_key: POSTHOG_KEY,
        event: eventName,
        properties: {
          token: POSTHOG_KEY,
          distinct_id: distinctId,
          ...properties,
        },
      }),
      credentials: 'omit',
      keepalive: false,
    });

    if (response.ok) {
      recordTransportSeen('event', 'fetch', response.status);
      return;
    }

    recordTransportError(
      'fetch',
      `posthog_http_${response.status}`,
      response.status
    );
  } catch (error) {
    recordTransportError('fetch', error);
  }
}

function installClientAnalyticsTransportDiagnostics(): void {
  const client = getInternalPostHogClient();
  if (
    analyticsTransportClientInstrumentationInstalled ||
    !client?._send_request
  ) {
    return;
  }

  analyticsTransportClientInstrumentationInstalled = true;
  const requestQueue = client._requestQueue as
    | InternalPostHogRequestQueue
    | undefined;
  if (requestQueue?.enqueue) {
    const originalEnqueue = requestQueue.enqueue.bind(requestQueue) as (
      requestOptions: InternalPostHogRequestOptions
    ) => void;
    requestQueue.enqueue = ((requestOptions: InternalPostHogRequestOptions) => {
      const requestUrl = normalizeTransportUrl(requestOptions.url);
      analyticsTransportDiagnostics.lastQueuedRequestUrl = requestUrl;
      analyticsTransportDiagnostics.lastQueuedRequestBatchKey =
        typeof requestOptions.batchKey === 'string'
          ? requestOptions.batchKey
          : null;
      analyticsTransportDiagnostics.lastQueuedRequestKind =
        classifyTransportUrl(requestUrl);

      return originalEnqueue(requestOptions);
    }) as InternalPostHogRequestQueue['enqueue'];
  }

  const originalCapture = client.capture.bind(client) as (
    eventName: string,
    properties?: AnalyticsEventProperties,
    options?: Record<string, unknown>
  ) => unknown;
  client.capture = ((
    eventName: string,
    properties?: AnalyticsEventProperties,
    options?: Record<string, unknown>
  ) => {
    analyticsTransportDiagnostics.lastInternalCaptureEvent = eventName;
    return originalCapture(eventName, properties, options);
  }) as typeof client.capture;

  const originalSendRequest = client._send_request.bind(client) as (
    requestOptions: InternalPostHogRequestOptions
  ) => void;
  client._send_request = ((requestOptions: InternalPostHogRequestOptions) => {
    const requestUrl = normalizeTransportUrl(requestOptions.url);
    const transportKind = classifyTransportUrl(requestUrl);
    analyticsTransportDiagnostics.lastInternalRequestUrl = requestUrl;
    analyticsTransportDiagnostics.lastInternalRequestBatchKey =
      typeof requestOptions.batchKey === 'string'
        ? requestOptions.batchKey
        : null;
    analyticsTransportDiagnostics.lastInternalRequestKind = transportKind;
    const originalCallback = requestOptions.callback;
    requestOptions.callback = (response: InternalPostHogResponse) => {
      if (transportKind) {
        const transportMethod =
          normalizeTransportMethod(requestOptions.transport) ?? 'fetch';

        if (response.statusCode >= 200 && response.statusCode < 400) {
          recordTransportSeen(
            transportKind,
            transportMethod,
            response.statusCode
          );
        } else {
          recordTransportError(
            transportMethod,
            response.error ?? `posthog_http_${response.statusCode}`,
            response.statusCode
          );
        }
      }

      originalCallback?.call(requestOptions, response);
    };

    return originalSendRequest(requestOptions);
  }) as InternalPostHogClient['_send_request'];
}

function installAnalyticsTransportDiagnostics(): void {
  installClientAnalyticsTransportDiagnostics();

  if (analyticsTransportInstrumentationInstalled) {
    return;
  }

  analyticsTransportInstrumentationInstalled = true;

  if (typeof globalThis.fetch === 'function') {
    const originalFetch = globalThis.fetch.bind(globalThis);

    globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
      const transportKind = classifyTransportUrl(normalizeTransportUrl(args[0]));

      try {
        const response = await originalFetch(...args);

        if (transportKind) {
          if (response.ok) {
            recordTransportSeen(transportKind, 'fetch', response.status);
          } else {
            recordTransportError('fetch', `posthog_http_${response.status}`, response.status);
          }
        }

        return response;
      } catch (error) {
        if (transportKind) {
          recordTransportError('fetch', error);
        }
        throw error;
      }
    }) as typeof fetch;
  }

  if (typeof XMLHttpRequest !== 'undefined') {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function patchedOpen(
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null
    ) {
      (
        this as XMLHttpRequest & { __vibesmithAnalyticsTransportKind?: AnalyticsTransportKind | null }
      ).__vibesmithAnalyticsTransportKind = classifyTransportUrl(
        normalizeTransportUrl(url)
      );

      return originalOpen.call(this, method, url, async ?? true, username, password);
    };

    XMLHttpRequest.prototype.send = function patchedSend(
      body?: Document | XMLHttpRequestBodyInit | null
    ) {
      const request = this as XMLHttpRequest & {
        __vibesmithAnalyticsTransportKind?: AnalyticsTransportKind | null;
      };
      const transportKind = request.__vibesmithAnalyticsTransportKind;

      if (transportKind) {
        const handleLoadend = () => {
          if (request.status >= 200 && request.status < 400) {
            recordTransportSeen(transportKind, 'xhr', request.status);
          } else {
            recordTransportError('xhr', `posthog_http_${request.status}`, request.status);
          }
          cleanup();
        };
        const handleError = () => {
          recordTransportError('xhr', 'posthog_xhr_error');
          cleanup();
        };
        const handleAbort = () => {
          recordTransportError('xhr', 'posthog_xhr_aborted');
          cleanup();
        };
        const cleanup = () => {
          request.removeEventListener('loadend', handleLoadend);
          request.removeEventListener('error', handleError);
          request.removeEventListener('abort', handleAbort);
        };

        request.addEventListener('loadend', handleLoadend);
        request.addEventListener('error', handleError);
        request.addEventListener('abort', handleAbort);
      }

      return originalSend.call(this, body);
    };
  }

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.sendBeacon === 'function'
  ) {
    const originalSendBeacon = navigator.sendBeacon.bind(navigator);
    const patchedSendBeacon = (url: string | URL, data?: BodyInit | null) => {
      const transportKind = classifyTransportUrl(normalizeTransportUrl(url));

      try {
        const queued = originalSendBeacon(url, data);

        if (transportKind) {
          if (queued) {
            recordTransportSeen(transportKind, 'sendBeacon');
          } else {
            recordTransportError('sendBeacon', 'posthog_sendbeacon_rejected');
          }
        }

        return queued;
      } catch (error) {
        if (transportKind) {
          recordTransportError('sendBeacon', error);
        }
        throw error;
      }
    };

    try {
      Object.defineProperty(navigator, 'sendBeacon', {
        configurable: true,
        value: patchedSendBeacon,
      });
    } catch {
      // Some runtimes expose navigator.sendBeacon as non-configurable.
    }
  }
}

function parseBooleanPreference(value: string | null): boolean | null {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function persistBooleanPreference(storageKey: string, enabled: boolean): void {
  try {
    localStorage.setItem(storageKey, String(enabled));
  } catch {
    // ignore localStorage write failures
  }
}

function readBooleanPreference(storageKey: string, defaultValue: boolean): boolean {
  try {
    const parsedPreference = parseBooleanPreference(localStorage.getItem(storageKey));
    if (parsedPreference !== null) {
      return parsedPreference;
    }
    persistBooleanPreference(storageKey, defaultValue);
    return defaultValue;
  } catch {
    return false;
  }
}

function inferReleaseChannel(version: string): string {
  const normalizedVersion = version.trim().toLowerCase();
  if (!normalizedVersion) return 'unknown';
  if (normalizedVersion.includes('alpha')) return 'alpha';
  if (normalizedVersion.includes('beta')) return 'beta';
  if (normalizedVersion.includes('rc')) return 'rc';
  return 'stable';
}

function sanitizeAnalyticsIdentity(value: unknown): AnalyticsIdentity | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<AnalyticsIdentity>;
  if (typeof candidate.distinctId !== 'string' || candidate.distinctId.trim().length === 0) {
    return null;
  }

  return {
    distinctId: candidate.distinctId.trim(),
    scope: candidate.scope === 'installation' ? 'installation' : 'installation',
  };
}

function isAnalyticsIdentityReady(): boolean {
  return Boolean(analyticsIdentity?.distinctId);
}

function maskDistinctId(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 12) return `${value.slice(0, 4)}...${value.slice(-2)}`;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function getAnalyticsDistinctId(): string | null {
  return (
    getExtendedPostHogClient()?.get_distinct_id?.() ??
    analyticsIdentity?.distinctId ??
    null
  );
}

function getDegradedReason(): string | null {
  if (!hasConfiguredPostHogKey()) {
    return 'missing_posthog_key';
  }

  if (analyticsIdentityError) {
    return analyticsIdentityError;
  }

  if (!analyticsIdentityResolved) {
    return 'analytics_identity_pending';
  }

  if (!isAnalyticsIdentityReady()) {
    return 'analytics_identity_unavailable';
  }

  if (!posthogReady) {
    return 'posthog_not_ready';
  }

  if (!usageAnalyticsEnabled) {
    return 'usage_analytics_disabled';
  }

  return null;
}

function isEventCaptureEnabled(): boolean {
  return Boolean(
    hasConfiguredPostHogKey() &&
      posthogClient &&
      posthogReady &&
      usageAnalyticsEnabled &&
      isAnalyticsIdentityReady()
  );
}

function isExceptionCaptureEnabled(): boolean {
  return isEventCaptureEnabled() && crashReportingEnabled;
}

function isPerformanceCaptureEnabled(): boolean {
  return isEventCaptureEnabled() && performanceMonitoringEnabled;
}

function isConsoleLogCaptureEnabled(): boolean {
  return isEventCaptureEnabled() && ENABLE_RECORDING_CONSOLE_LOG;
}

function shouldBufferAnalyticsActions(): boolean {
  return Boolean(
    hasConfiguredPostHogKey() &&
      usageAnalyticsEnabled &&
      (!posthogReady || !isAnalyticsIdentityReady())
  );
}

function enqueuePendingAnalyticsAction(action: PendingAnalyticsAction): void {
  pendingAnalyticsActions.push(action);
  if (pendingAnalyticsActions.length > MAX_PENDING_ANALYTICS_ACTIONS) {
    pendingAnalyticsActions = pendingAnalyticsActions.slice(
      -MAX_PENDING_ANALYTICS_ACTIONS
    );
  }
}

function clearPendingAnalyticsActions(): void {
  pendingAnalyticsActions = [];
}

function flushPendingAnalyticsActions(): void {
  if (pendingAnalyticsActions.length === 0) {
    return;
  }

  if (!isEventCaptureEnabled()) {
    if (!hasConfiguredPostHogKey() || !usageAnalyticsEnabled) {
      clearPendingAnalyticsActions();
    }
    return;
  }

  const pendingActions = pendingAnalyticsActions;
  pendingAnalyticsActions = [];

  pendingActions.forEach((action) => {
    if (action.kind === 'event') {
      const eventProperties = {
        ...commonProperties,
        ...action.properties,
      };
      emitSyntheticEventCaptured(action.eventName, eventProperties);
      void dispatchAnalyticsEventToPostHog(action.eventName, eventProperties);
      return;
    }

    if (!isExceptionCaptureEnabled()) {
      return;
    }

    getExtendedPostHogClient()?.captureException?.(action.error, {
      ...commonProperties,
      ...action.additionalProperties,
    });
  });
}

function emitSyntheticEventCaptured(
  eventName: string,
  properties: AnalyticsEventProperties
): void {
  const client = getInternalPostHogClient();
  const calculateEventProperties = client?.calculateEventProperties?.bind(client);
  const emitEventCaptured = client?._internalEventEmitter?.emit?.bind(
    client._internalEventEmitter
  );

  if (!calculateEventProperties || !emitEventCaptured) {
    return;
  }

  try {
    const payload = calculateEventProperties(
      eventName,
      properties,
      new Date(),
      undefined,
      false
    );

    if (payload && typeof payload === 'object') {
      emitEventCaptured('eventCaptured', payload);
    }
  } catch {
    // Keep analytics delivery best-effort; replay hooks should not break capture.
  }
}

function getExtendedPostHogClient(): ExtendedPostHogClient | null {
  if (!posthogClient) return null;
  return posthogClient as ExtendedPostHogClient;
}

function getInternalPostHogClient(): InternalPostHogClient | null {
  if (!posthogClient) return null;
  return posthogClient as InternalPostHogClient;
}

function forceFlushQueuedRequests(client: InternalPostHogClient): number {
  const requestQueue = client._requestQueue as
    | InternalPostHogRequestQueue
    | undefined;
  const sendRetriableRequest =
    client._send_retriable_request?.bind(client) as
      | ((request: InternalPostHogRequestOptions) => void)
      | undefined;

  if (!requestQueue || !sendRetriableRequest) {
    return 0;
  }

  requestQueue._clearFlushTimeout?.();

  const formattedRequests = requestQueue._formatQueue?.();
  if (!formattedRequests) {
    return 0;
  }

  const requestList = Object.values(
    formattedRequests
  ) as InternalPostHogRequestOptions[];
  requestList.forEach((request) => {
    sendRetriableRequest(request);
  });

  return requestList.length;
}

function forceFlushReplayBuffer(client: InternalPostHogClient): boolean {
  const sessionRecording = client.sessionRecording as
    | InternalSessionRecording
    | undefined;
  const recorder = sessionRecording?._lazyLoadedSessionRecording as
    | InternalLazyLoadedSessionRecording
    | null
    | undefined;
  if (!recorder?._flushBuffer) {
    return false;
  }

  recorder._clearFlushBufferTimer?.();
  recorder._flushBuffer();
  return true;
}

async function forceFlushAnalyticsDelivery(): Promise<AnalyticsFlushResult> {
  const client = getInternalPostHogClient();
  if (!client) {
    return {
      success: false,
      eventRequestsFlushed: 0,
      replayRequestsFlushed: 0,
      error: 'analytics_uninitialized',
    };
  }

  try {
    const eventRequestsFlushed = forceFlushQueuedRequests(client);

    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 250);
    });

    forceFlushReplayBuffer(client);
    const replayRequestsFlushed = forceFlushQueuedRequests(client);

    return {
      success: true,
      eventRequestsFlushed,
      replayRequestsFlushed,
    };
  } catch (error) {
    return {
      success: false,
      eventRequestsFlushed: 0,
      replayRequestsFlushed: 0,
      error:
        error instanceof Error && error.message.trim().length > 0
          ? error.message.trim()
          : 'analytics_force_flush_failed',
    };
  }
}

function updateCommonProperties(nextProperties: AnalyticsEventProperties): void {
  commonProperties = {
    ...commonProperties,
    ...nextProperties,
  };
}

function syncRegisteredProperties(): void {
  const registrationProperties: AnalyticsEventProperties = {
    app_version: appVersion,
    release_channel: releaseChannel,
    build_flavor: BUILD_FLAVOR,
    identity_scope: analyticsIdentity?.scope ?? null,
    monitoring_usage_analytics_enabled: usageAnalyticsEnabled,
    monitoring_crash_reporting_enabled: crashReportingEnabled,
    monitoring_performance_enabled: performanceMonitoringEnabled,
  };

  updateCommonProperties(registrationProperties);
  posthogClient?.register(registrationProperties);
}

function identifyClientWithAnalyticsIdentity(): void {
  const extendedClient = getExtendedPostHogClient();
  if (!extendedClient || !analyticsIdentity) {
    return;
  }

  extendedClient.identify?.(analyticsIdentity.distinctId, {
    identity_scope: analyticsIdentity.scope,
    runtime: 'desktop',
  });
}

async function loadAnalyticsIdentity(): Promise<void> {
  if (analyticsIdentityResolved) {
    identifyClientWithAnalyticsIdentity();
    return;
  }

  if (analyticsIdentityPromise) {
    return analyticsIdentityPromise;
  }

  analyticsIdentityPromise = Promise.resolve()
    .then(async () => {
      if (!window.api?.getAnalyticsIdentity) {
        analyticsIdentityError = 'missing_analytics_identity_bridge';
        return;
      }

      const identity = sanitizeAnalyticsIdentity(
        await window.api.getAnalyticsIdentity()
      );
      if (!identity) {
        analyticsIdentityError = 'invalid_analytics_identity';
        return;
      }

      analyticsIdentity = identity;
      analyticsIdentityError = null;
      updateCommonProperties({
        identity_scope: identity.scope,
      });
      syncRegisteredProperties();
      identifyClientWithAnalyticsIdentity();
    })
    .catch((error: unknown) => {
      analyticsIdentityError =
        error instanceof Error && error.message.trim().length > 0
          ? error.message.trim()
          : 'analytics_identity_load_failed';
    })
    .finally(() => {
      analyticsIdentityResolved = true;
      analyticsIdentityPromise = null;
      applyMonitoringPreferences();
      trackAppOpened();
    });

  return analyticsIdentityPromise;
}

function captureAnalyticsEvent(
  eventName: string,
  properties: AnalyticsEventProperties = {}
): void {
  const sanitizedProperties = sanitizeAnalyticsEventProperties(
    eventName,
    properties
  );
  if (!sanitizedProperties) {
    return;
  }

  markEventCapture(eventName);

  if (!isEventCaptureEnabled()) {
    if (shouldBufferAnalyticsActions()) {
      enqueuePendingAnalyticsAction({
        kind: 'event',
        eventName,
        properties: sanitizedProperties,
      });
    }
    return;
  }

  const eventProperties = {
    ...commonProperties,
    ...sanitizedProperties,
  };
  emitSyntheticEventCaptured(eventName, eventProperties);
  void dispatchAnalyticsEventToPostHog(eventName, eventProperties);
}

function captureAnalyticsException(
  error: unknown,
  additionalProperties: AnalyticsEventProperties = {}
): void {
  markExceptionCapture();

  if (!isExceptionCaptureEnabled()) {
    if (shouldBufferAnalyticsActions()) {
      enqueuePendingAnalyticsAction({
        kind: 'exception',
        error,
        additionalProperties,
      });
    }
    return;
  }

  getExtendedPostHogClient()?.captureException?.(error, {
    ...commonProperties,
    ...additionalProperties,
  });
}

function buildMainProcessExceptionError(
  payload: MainProcessExceptionPayload
): Error {
  const error = new Error(payload.message);
  error.name =
    typeof payload.name === 'string' && payload.name.trim().length > 0
      ? payload.name.trim()
      : 'ElectronMainProcessError';

  if (typeof payload.stack === 'string' && payload.stack.trim().length > 0) {
    error.stack = payload.stack;
  }

  return error;
}

function setupMainProcessExceptionListener(): void {
  if (
    unsubscribeMainProcessExceptionListener ||
    !window.api?.onAnalyticsMainProcessException
  ) {
    return;
  }

  unsubscribeMainProcessExceptionListener =
    window.api.onAnalyticsMainProcessException((payload) => {
      if (
        !payload ||
        typeof payload.message !== 'string' ||
        payload.message.trim().length === 0
      ) {
        return;
      }

      captureAnalyticsException(buildMainProcessExceptionError(payload), {
        handled_by: 'electron_main_process_bridge',
        exception_source: payload.source,
        ...(payload.metadata ?? {}),
      });
    });
}

function setupAnalyticsFlushLifecycleHandlers(): void {
  if (
    analyticsFlushLifecycleHandlersInstalled ||
    typeof window === 'undefined' ||
    typeof document === 'undefined'
  ) {
    return;
  }

  analyticsFlushLifecycleHandlersInstalled = true;

  const flushAnalytics = () => {
    void forceFlushAnalyticsDelivery();
  };

  window.addEventListener('pagehide', flushAnalytics);
  window.addEventListener('beforeunload', flushAnalytics);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushAnalytics();
    }
  });
}

function captureMonitoringPreferenceChange(
  settingName: 'usage_analytics' | 'crash_reporting' | 'performance_monitoring',
  enabled: boolean
): void {
  captureAnalyticsEvent(MONITORING_PREFERENCE_CHANGED_EVENT, {
    setting_name: settingName,
    enabled,
  });
}

function trackAppOpened(): void {
  if (appOpenedTracked || !isEventCaptureEnabled()) {
    return;
  }

  appOpenedTracked = true;
  captureAnalyticsEvent('app_opened', {
    source: 'desktop_renderer',
  });
}

function updateSessionReplay(enabled: boolean): void {
  const replayClient = getExtendedPostHogClient();
  if (!replayClient) return;
  if (enabled) replayClient.startSessionRecording?.(true);
  else replayClient.stopSessionRecording?.();
}

function syncExceptionCapturePreference(): void {
  const extendedClient = getExtendedPostHogClient();
  if (!extendedClient) return;

  if (isExceptionCaptureEnabled()) {
    extendedClient.startExceptionAutocapture?.(CAPTURE_EXCEPTIONS_CONFIG);
    return;
  }

  extendedClient.stopExceptionAutocapture?.();
}

function syncPerformanceCapturePreference(): void {
  posthogClient?.set_config?.({
    capture_performance: isPerformanceCaptureEnabled()
      ? CAPTURE_PERFORMANCE_CONFIG
      : false,
    enable_recording_console_log: isConsoleLogCaptureEnabled(),
  });
}

function applyMonitoringPreferences(): void {
  if (!posthogClient) return;

  if (usageAnalyticsEnabled && posthogReady && isAnalyticsIdentityReady()) {
    posthogClient.opt_in_capturing();
  } else {
    posthogClient.opt_out_capturing();
  }

  updateSessionReplay(
    usageAnalyticsEnabled && posthogReady && isAnalyticsIdentityReady()
  );
  syncExceptionCapturePreference();
  syncPerformanceCapturePreference();
  syncRegisteredProperties();
  flushPendingAnalyticsActions();
}

function syncUsageAnalyticsPreference(enabled: boolean): void {
  if (usageAnalyticsEnabled === enabled) {
    return;
  }

  if (usageAnalyticsEnabled && !enabled) {
    captureMonitoringPreferenceChange('usage_analytics', false);
  }

  usageAnalyticsEnabled = enabled;
  appOpenedTracked = false;
  if (!enabled) {
    clearPendingAnalyticsActions();
  }
  applyMonitoringPreferences();

  if (enabled) {
    captureMonitoringPreferenceChange('usage_analytics', true);
    trackAppOpened();
  }
}

function syncCrashReportingPreference(enabled: boolean): void {
  if (crashReportingEnabled === enabled) {
    return;
  }

  crashReportingEnabled = enabled;
  applyMonitoringPreferences();
  captureMonitoringPreferenceChange('crash_reporting', enabled);
}

function syncPerformanceMonitoringPreference(enabled: boolean): void {
  if (performanceMonitoringEnabled === enabled) {
    return;
  }

  performanceMonitoringEnabled = enabled;
  applyMonitoringPreferences();
  captureMonitoringPreferenceChange('performance_monitoring', enabled);
}

function getReplayUrl(): string | null {
  const extendedClient = getExtendedPostHogClient();
  if (!extendedClient || !isEventCaptureEnabled()) {
    return null;
  }

  const replayUrl = extendedClient.get_session_replay_url?.({
    withTimestamp: true,
    timestampLookBack: 15,
  });

  if (typeof replayUrl !== 'string' || replayUrl.trim().length === 0) {
    return null;
  }

  return replayUrl.trim();
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getSessionRecordingDebugProperties():
  | Record<string, unknown>
  | null {
  const client = getInternalPostHogClient();
  const sessionRecording = client?.sessionRecording as
    | (InternalSessionRecording & { sdkDebugProperties?: Record<string, unknown> })
    | undefined;

  const debugProperties = sessionRecording?.sdkDebugProperties;
  if (!debugProperties || typeof debugProperties !== 'object') {
    return null;
  }

  return debugProperties;
}

function toBooleanOrNull(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function getSessionRecordingEnabled(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'object' && value !== null) {
    return true;
  }

  return null;
}

function getAssetsHost(apiHost: string): string {
  const normalizedHost = apiHost.trim().replace(/\/$/, '');

  if (normalizedHost === 'https://app.posthog.com') {
    return 'https://us-assets.i.posthog.com';
  }

  if (POSTHOG_US_HOST_PATTERN.test(normalizedHost)) {
    return 'https://us-assets.i.posthog.com';
  }

  if (POSTHOG_EU_HOST_PATTERN.test(normalizedHost)) {
    return 'https://eu-assets.i.posthog.com';
  }

  return normalizedHost;
}

function extractRemoteConfigDiagnostics(
  config: unknown
): typeof remoteConfigDiagnostics {
  const typedConfig = typeof config === 'object' && config !== null
    ? (config as {
        sessionRecording?: unknown;
        autocaptureExceptions?: unknown;
        errorTracking?: {
          autocaptureExceptions?: unknown;
        };
        logs?: {
          captureConsoleLogs?: unknown;
        };
        capturePerformance?: {
          network_timing?: unknown;
        };
      })
    : {};
  const sessionRecordingConfig =
    typeof typedConfig.sessionRecording === 'object' && typedConfig.sessionRecording !== null
      ? (typedConfig.sessionRecording as {
          consoleLogRecordingEnabled?: unknown;
          networkPayloadCapture?: {
            capturePerformance?: unknown;
          };
        })
      : null;

  return {
    loaded: true,
    error: null,
    sessionRecording: getSessionRecordingEnabled(typedConfig.sessionRecording),
    exceptionAutocapture:
      toBooleanOrNull(typedConfig.errorTracking?.autocaptureExceptions) ??
      toBooleanOrNull(typedConfig.autocaptureExceptions),
    consoleLogCapture:
      toBooleanOrNull(sessionRecordingConfig?.consoleLogRecordingEnabled) ??
      toBooleanOrNull(typedConfig.logs?.captureConsoleLogs),
    networkCapture:
      toBooleanOrNull(sessionRecordingConfig?.networkPayloadCapture?.capturePerformance) ??
      toBooleanOrNull(typedConfig.capturePerformance?.network_timing),
  };
}

async function loadRemoteConfigDiagnostics(): Promise<void> {
  if (!hasConfiguredPostHogKey()) {
    remoteConfigDiagnostics = {
      loaded: false,
      error: 'missing_posthog_key',
      sessionRecording: null,
      exceptionAutocapture: null,
      consoleLogCapture: null,
      networkCapture: null,
    };
    return;
  }

  if (remoteConfigDiagnosticsPromise) {
    return remoteConfigDiagnosticsPromise;
  }

  const configUrl = `${getAssetsHost(POSTHOG_HOST)}/array/${encodeURIComponent(POSTHOG_KEY)}/config`;
  remoteConfigDiagnosticsPromise = fetch(configUrl, {
    method: 'GET',
    credentials: 'omit',
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`remote_config_http_${response.status}`);
      }

      const config = (await response.json()) as unknown;
      remoteConfigDiagnostics = extractRemoteConfigDiagnostics(config);
    })
    .catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'remote_config_fetch_failed';
      remoteConfigDiagnostics = {
        loaded: false,
        error: message,
        sessionRecording: null,
        exceptionAutocapture: null,
        consoleLogCapture: null,
        networkCapture: null,
      };
    })
    .finally(() => {
      remoteConfigDiagnosticsPromise = null;
    });

  return remoteConfigDiagnosticsPromise;
}

function ensureRemoteConfigDiagnostics(): void {
  if (!hasConfiguredPostHogKey()) {
    return;
  }

  if (remoteConfigDiagnostics.loaded || remoteConfigDiagnosticsPromise) {
    return;
  }

  void loadRemoteConfigDiagnostics();
}

async function runAnalyticsSelfTest(
  type: 'event' | 'exception'
): Promise<AnalyticsSelfTestResult> {
  lastSelfTestAt = new Date().toISOString();
  lastSelfTestError = null;

  if (type === 'event') {
    if (!isEventCaptureEnabled()) {
      lastSelfTestError = 'analytics_disabled';
      return {
        success: false,
        type,
        error: lastSelfTestError,
      };
    }

    captureAnalyticsEvent('posthog_verification_event', {
      source: 'settings_debug',
      verification_type: 'event',
    });
    return { success: true, type };
  }

  if (!isExceptionCaptureEnabled()) {
    lastSelfTestError = 'exception_capture_disabled';
    return {
      success: false,
      type,
      error: lastSelfTestError,
    };
  }

  const error = new Error('PostHog verification exception');
  captureAnalyticsException(error, {
    source: 'settings_debug',
    verification_type: 'exception',
  });
  return { success: true, type };
}

function getAnalyticsStatus(): AnalyticsBridgeStatus {
  ensureRemoteConfigDiagnostics();
  const extendedClient = getExtendedPostHogClient();
  const internalClient = getInternalPostHogClient();
  const internalRequestQueue = internalClient?._requestQueue as
    | InternalPostHogRequestQueue
    | undefined;
  const distinctId = getAnalyticsDistinctId();
  const replayDebugProperties = getSessionRecordingDebugProperties();

  return {
    configured: hasConfiguredPostHogKey(),
    ready: posthogReady && isAnalyticsIdentityReady(),
    enabled: isEventCaptureEnabled(),
    sdkCapturing: internalClient?.is_capturing?.() === true,
    sdkOptedIn:
      typeof internalClient?.has_opted_in_capturing?.() === 'boolean'
        ? internalClient.has_opted_in_capturing()
        : null,
    sdkOptedOut:
      typeof internalClient?.has_opted_out_capturing?.() === 'boolean'
        ? internalClient.has_opted_out_capturing()
        : null,
    sdkOptOutUseragentFilter:
      typeof internalClient?.config?.opt_out_useragent_filter === 'boolean'
        ? internalClient.config.opt_out_useragent_filter
        : null,
    host: POSTHOG_HOST,
    appVersion,
    releaseChannel,
    identityScope: analyticsIdentity?.scope ?? null,
    identityReady: isAnalyticsIdentityReady(),
    maskedDistinctId: maskDistinctId(distinctId),
    degradedReason: getDegradedReason(),
    captureExceptions: isExceptionCaptureEnabled(),
    captureConsoleLogs: isConsoleLogCaptureEnabled(),
    capturePerformance: isPerformanceCaptureEnabled(),
    sessionRecording: Boolean(
      usageAnalyticsEnabled && extendedClient?.sessionRecordingStarted?.()
    ),
    replayUrl: getReplayUrl(),
    lastSelfTestAt,
    lastSelfTestError,
    lastEventCaptureAt: analyticsTransportDiagnostics.lastEventCaptureAt,
    lastEventName: analyticsTransportDiagnostics.lastEventName,
    lastExceptionCaptureAt: analyticsTransportDiagnostics.lastExceptionCaptureAt,
    eventTransportSeen: analyticsTransportDiagnostics.eventTransportSeen,
    replayTransportSeen: analyticsTransportDiagnostics.replayTransportSeen,
    lastEventTransportAt: analyticsTransportDiagnostics.lastEventTransportAt,
    lastReplayTransportAt: analyticsTransportDiagnostics.lastReplayTransportAt,
    lastTransportMethod: analyticsTransportDiagnostics.lastTransportMethod,
    lastTransportStatus: analyticsTransportDiagnostics.lastTransportStatus,
    lastTransportError: analyticsTransportDiagnostics.lastTransportError,
    lastInternalRequestUrl: analyticsTransportDiagnostics.lastInternalRequestUrl,
    lastInternalRequestBatchKey:
      analyticsTransportDiagnostics.lastInternalRequestBatchKey,
    lastInternalRequestKind: analyticsTransportDiagnostics.lastInternalRequestKind,
    lastQueuedRequestUrl: analyticsTransportDiagnostics.lastQueuedRequestUrl,
    lastQueuedRequestBatchKey:
      analyticsTransportDiagnostics.lastQueuedRequestBatchKey,
    lastQueuedRequestKind: analyticsTransportDiagnostics.lastQueuedRequestKind,
    lastInternalCaptureEvent: analyticsTransportDiagnostics.lastInternalCaptureEvent,
    replayRecordingStatus:
      typeof replayDebugProperties?.$recording_status === 'string'
        ? replayDebugProperties.$recording_status
        : null,
    replayInternalBufferLength: toNullableNumber(
      replayDebugProperties?.$sdk_debug_replay_internal_buffer_length
    ),
    replayInternalBufferSize: toNullableNumber(
      replayDebugProperties?.$sdk_debug_replay_internal_buffer_size
    ),
    replayFlushedSize: toNullableNumber(
      replayDebugProperties?.$sdk_debug_replay_flushed_size
    ),
    replayRetryQueueSize: toNullableNumber(internalClient?._retryQueue?.length),
    replayRequestQueueLength: toNullableNumber(internalRequestQueue?._queue?.length),
    replayRequestQueuePaused:
      typeof internalRequestQueue?._isPaused === 'boolean'
        ? internalRequestQueue._isPaused
        : null,
    droppedMalformedPageviews:
      analyticsGuardDiagnostics.droppedMalformedPageviews,
    lastDroppedMalformedPageviewAt:
      analyticsGuardDiagnostics.lastDroppedMalformedPageviewAt,
    lastDroppedMalformedPageviewReason:
      analyticsGuardDiagnostics.lastDroppedMalformedPageviewReason,
    serverRemoteConfigLoaded: remoteConfigDiagnostics.loaded,
    serverRemoteConfigError: remoteConfigDiagnostics.error,
    serverSessionRecording: remoteConfigDiagnostics.sessionRecording,
    serverExceptionAutocapture: remoteConfigDiagnostics.exceptionAutocapture,
    serverConsoleLogCapture: remoteConfigDiagnostics.consoleLogCapture,
    serverNetworkCapture: remoteConfigDiagnostics.networkCapture,
  };
}

function registerAnalyticsBridge(): void {
  window.__vibesmithAnalytics = {
    track: (eventName, properties = {}) => {
      captureAnalyticsEvent(eventName, properties);
    },
    isEnabled: () => isEventCaptureEnabled(),
    getStatus: () => getAnalyticsStatus(),
    refreshStatus: () => getAnalyticsStatus(),
    forceFlush: () => forceFlushAnalyticsDelivery(),
    runSelfTest: (type) => runAnalyticsSelfTest(type),
    captureException: (error, additionalProperties = {}) => {
      captureAnalyticsException(error, additionalProperties);
    },
  };
}

function setupPreferenceListener(
  eventName:
    | typeof ANALYTICS_CHANGED_EVENT
    | typeof CRASH_REPORTING_CHANGED_EVENT
    | typeof PERFORMANCE_MONITORING_CHANGED_EVENT,
  onChange: (enabled: boolean) => void
): void {
  window.addEventListener(eventName, (event: Event) => {
    const customEvent = event as MonitoringPreferenceChangedEvent;
    const enabled = customEvent.detail?.enabled;
    if (typeof enabled !== 'boolean') return;
    onChange(enabled);
  });
}

function setupPreferenceListeners(): void {
  setupPreferenceListener(ANALYTICS_CHANGED_EVENT, (enabled) => {
    persistBooleanPreference(ANALYTICS_STORAGE_KEY, enabled);
    syncUsageAnalyticsPreference(enabled);
  });

  setupPreferenceListener(CRASH_REPORTING_CHANGED_EVENT, (enabled) => {
    persistBooleanPreference(CRASH_REPORTING_STORAGE_KEY, enabled);
    syncCrashReportingPreference(enabled);
  });

  setupPreferenceListener(PERFORMANCE_MONITORING_CHANGED_EVENT, (enabled) => {
    persistBooleanPreference(PERFORMANCE_MONITORING_STORAGE_KEY, enabled);
    syncPerformanceMonitoringPreference(enabled);
  });
}

function setupStorageSyncListener(): void {
  window.addEventListener('storage', (event: StorageEvent) => {
    if (event.key === ANALYTICS_STORAGE_KEY) {
      const parsedPreference = parseBooleanPreference(event.newValue);
      if (parsedPreference === null) return;
      syncUsageAnalyticsPreference(parsedPreference);
      return;
    }

    if (event.key === CRASH_REPORTING_STORAGE_KEY) {
      const parsedPreference = parseBooleanPreference(event.newValue);
      if (parsedPreference === null) return;
      syncCrashReportingPreference(parsedPreference);
      return;
    }

    if (event.key === PERFORMANCE_MONITORING_STORAGE_KEY) {
      const parsedPreference = parseBooleanPreference(event.newValue);
      if (parsedPreference === null) return;
      syncPerformanceMonitoringPreference(parsedPreference);
    }
  });
}

function loadAppVersion(): void {
  if (BUILD_APP_VERSION !== 'unknown') {
    appVersionResolved = true;
    updateCommonProperties({
      app_version: BUILD_APP_VERSION,
      release_channel: releaseChannel,
    });
    syncRegisteredProperties();
    return;
  }

  if (!window.api?.getAppVersion) {
    appVersionResolved = true;
    return;
  }

  appVersionLoadPromise = window.api.getAppVersion()
    .then((version) => {
      appVersion = version;
      releaseChannel = inferReleaseChannel(version);
      updateCommonProperties({
        app_version: version,
        release_channel: releaseChannel,
      });
      syncRegisteredProperties();
      trackAppOpened();
    })
    .catch(() => {
      // keep unknown fallback
    })
    .finally(() => {
      appVersionResolved = true;
      trackAppOpened();
    });
}

function readAnalyticsConfig(): {
  key: string;
  host: string;
} {
  return {
    key: POSTHOG_KEY,
    host: POSTHOG_HOST,
  };
}

export function initializePostHog(): PostHogClient | null {
  if (initialized) return posthogClient;
  initialized = true;

  usageAnalyticsEnabled = readBooleanPreference(
    ANALYTICS_STORAGE_KEY,
    DEFAULT_USAGE_ANALYTICS
  );
  crashReportingEnabled = readBooleanPreference(
    CRASH_REPORTING_STORAGE_KEY,
    DEFAULT_CRASH_REPORTING
  );
  performanceMonitoringEnabled = readBooleanPreference(
    PERFORMANCE_MONITORING_STORAGE_KEY,
    DEFAULT_PERFORMANCE_MONITORING
  );

  setupPreferenceListeners();
  setupStorageSyncListener();
  setupMainProcessExceptionListener();
  setupAnalyticsFlushLifecycleHandlers();
  installAnalyticsTransportDiagnostics();
  loadAppVersion();
  void loadAnalyticsIdentity();

  const { key, host } = readAnalyticsConfig();
  if (!key) {
    registerAnalyticsBridge();
    return null;
  }

  posthogClient = posthog;
  installAnalyticsTransportDiagnostics();
  syncRegisteredProperties();

  posthog.init(key, {
    defaults: POSTHOG_DEFAULTS_VERSION,
    api_host: host,
    autocapture: true,
    api_transport: 'fetch',
    before_send: guardMalformedPageviewEvent,
    capture_pageview: false,
    capture_exceptions: CAPTURE_EXCEPTIONS_CONFIG,
    capture_performance: CAPTURE_PERFORMANCE_CONFIG,
    debug: BUILD_FLAVOR === 'internal',
    disable_compression: true,
    disable_external_dependency_loading: true,
    disable_session_recording: true,
    enable_recording_console_log: ENABLE_RECORDING_CONSOLE_LOG,
    mask_all_element_attributes: true,
    opt_out_useragent_filter: shouldAllowPostHogWebdriverAnalytics(),
    person_profiles: 'identified_only',
    persistence: 'localStorage',
    property_denylist: [...POSTHOG_PROPERTY_DENYLIST],
    session_recording: {
      blockSelector: SESSION_RECORDING_BLOCK_SELECTOR,
      maskAllInputs: true,
      maskTextSelector: SESSION_RECORDING_MASK_TEXT_SELECTOR,
    },
    loaded: (client) => {
      posthogReady = true;
      client.register(commonProperties);
      identifyClientWithAnalyticsIdentity();
      applyMonitoringPreferences();
      registerAnalyticsBridge();

      if (
        isAnalyticsIdentityReady() &&
        (appVersionResolved || !appVersionLoadPromise)
      ) {
        trackAppOpened();
      } else {
        void Promise.allSettled([
          appVersionLoadPromise ?? Promise.resolve(),
          analyticsIdentityPromise ?? Promise.resolve(),
        ]).finally(() => {
          trackAppOpened();
        });
      }
    },
  });

  registerAnalyticsBridge();
  applyMonitoringPreferences();

  return posthogClient;
}
