import { test, expect, type Page } from '@playwright/test';
import { SettingsPage } from '../pages/settings.page';

type AnalyticsEvent = {
  eventName: string;
  properties: Record<string, unknown>;
  at: string;
};

type DiagnosticBundleResult = {
  success: boolean;
  canceled?: boolean;
  path?: string;
  error?: string;
  sizeBytes?: number;
  fileCount?: number;
  includedFiles?: string[];
};

type UpdateInfo = {
  version: string;
  releaseDate: string;
  releaseNotes: string;
};

async function installDesktopAnalyticsHarness(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const root = window as Window & {
      __e2eDesktopBridge?: {
        getAnalyticsEvents: () => Array<{
          eventName: string;
          properties: Record<string, unknown>;
          at: string;
        }>;
        clearAnalyticsEvents: () => void;
        setDiagnosticBundleResult: (result: Record<string, unknown>) => void;
        setAvailableUpdate: (update: Record<string, unknown> | null) => void;
        setJsonResponse: (
          method: string,
          path: string,
          payload: unknown
        ) => void;
      };
      __vibesmithAnalytics?: {
        track: (
          eventName: string,
          properties?: Record<string, unknown>
        ) => void;
        isEnabled: () => boolean;
        getStatus: () => Record<string, unknown>;
        refreshStatus: () => Record<string, unknown>;
        runSelfTest: (
          type: 'event' | 'exception'
        ) => Promise<{ success: boolean; type: 'event' | 'exception' }>;
        captureException: (
          error: unknown,
          additionalProperties?: Record<string, unknown>
        ) => void;
      };
      electronAPI?: Record<string, unknown>;
      api?: Record<string, unknown>;
    };

    const analyticsEvents: Array<{
      eventName: string;
      properties: Record<string, unknown>;
      at: string;
    }> = [];
    const fetchOverrides = new Map<string, unknown>();
    const updaterListeners = {
      checking: new Set<() => void>(),
      available: new Set<
        (info: {
          version: string;
          releaseDate: string;
          releaseNotes: string;
        }) => void
      >(),
      notAvailable: new Set<(info: { version: string }) => void>(),
      error: new Set<(error: { message: string }) => void>(),
      progress: new Set<
        (progress: {
          percent: number;
          transferred: number;
          total: number;
          bytesPerSecond: number;
        }) => void
      >(),
      downloaded: new Set<(info: { version: string }) => void>(),
    };
    const debugSettings = {
      enabled: false,
      level: 'info' as const,
      expireAt: null as string | null,
      updatedAt: '2026-03-20T00:00:00.000Z',
    };
    let diagnosticBundleResult: DiagnosticBundleResult = {
      success: true,
      path: '/tmp/vibesmith-diagnostic.zip',
      sizeBytes: 4096,
      fileCount: 4,
      includedFiles: ['debug.log'],
    };
    let availableUpdate: UpdateInfo | null = null;
    const currentVersion = '0.5.4-alpha.11';
    const analyticsStatus = {
      configured: true,
      ready: true,
      enabled: true,
      sdkCapturing: true,
      sdkOptedIn: true,
      sdkOptedOut: false,
      sdkOptOutUseragentFilter: false,
      host: 'https://us.i.posthog.com',
      appVersion: currentVersion,
      releaseChannel: 'alpha',
      identityScope: 'installation',
      identityReady: true,
      maskedDistinctId: 'ph_disti..._e2e',
      degradedReason: null,
      captureExceptions: true,
      captureConsoleLogs: true,
      capturePerformance: true,
      sessionRecording: true,
      replayUrl: 'https://app.posthog.com/project/1/replay/e2e',
      lastSelfTestAt: null,
      lastSelfTestError: null,
      lastEventCaptureAt: null,
      lastEventName: null,
      lastExceptionCaptureAt: null,
      eventTransportSeen: true,
      replayTransportSeen: true,
      lastEventTransportAt: null,
      lastReplayTransportAt: null,
      lastTransportMethod: 'fetch',
      lastTransportStatus: 200,
      lastTransportError: null,
      lastInternalRequestUrl: null,
      lastInternalRequestBatchKey: null,
      lastInternalRequestKind: null,
      lastQueuedRequestUrl: null,
      lastQueuedRequestBatchKey: null,
      lastQueuedRequestKind: null,
      lastInternalCaptureEvent: null,
      replayRecordingStatus: 'active',
      replayInternalBufferLength: 1,
      replayInternalBufferSize: 128,
      replayFlushedSize: 128,
      replayRetryQueueSize: 0,
      replayRequestQueueLength: 0,
      replayRequestQueuePaused: false,
      droppedMalformedPageviews: 0,
      lastDroppedMalformedPageviewAt: null,
      lastDroppedMalformedPageviewReason: null,
      serverRemoteConfigLoaded: true,
      serverRemoteConfigError: null,
      serverSessionRecording: true,
      serverExceptionAutocapture: true,
      serverConsoleLogCapture: true,
      serverNetworkCapture: true,
    };

    const originalFetch = window.fetch.bind(window);

    function track(eventName: string, properties: Record<string, unknown> = {}) {
      analyticsEvents.push({
        eventName,
        properties,
        at: new Date().toISOString(),
      });
      analyticsStatus.lastEventCaptureAt = new Date().toISOString();
      analyticsStatus.lastEventName = eventName;
      analyticsStatus.lastInternalCaptureEvent = eventName;
    }

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : null;
      const method = (
        init?.method ??
        request?.method ??
        'GET'
      ).toUpperCase();
      const rawUrl =
        typeof input === 'string' || input instanceof URL
          ? String(input)
          : request?.url ?? '';
      const url = new URL(rawUrl, window.location.origin);
      const key = `${method} ${url.pathname}`;

      if (fetchOverrides.has(key)) {
        return new Response(JSON.stringify(fetchOverrides.get(key)), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      return originalFetch(input, init);
    };

    fetchOverrides.set('GET /api/system/scan-progress', {
      scanning: false,
      projects: [],
    });
    fetchOverrides.set('GET /api/config', {
      home_path: '~/.claude',
      cursor_global_path: '~/.cursor',
      root_paths: [],
    });

    root.__e2eDesktopBridge = {
      getAnalyticsEvents: () => analyticsEvents.slice(),
      clearAnalyticsEvents: () => {
        analyticsEvents.length = 0;
        analyticsStatus.lastEventCaptureAt = null;
        analyticsStatus.lastEventName = null;
        analyticsStatus.lastInternalCaptureEvent = null;
      },
      setDiagnosticBundleResult: (result) => {
        diagnosticBundleResult = {
          ...diagnosticBundleResult,
          ...result,
        };
      },
      setAvailableUpdate: (update) => {
        availableUpdate = update
          ? {
              version: String(update.version ?? ''),
              releaseDate: String(update.releaseDate ?? ''),
              releaseNotes: String(update.releaseNotes ?? ''),
            }
          : null;
      },
      setJsonResponse: (method, path, payload) => {
        fetchOverrides.set(`${method.toUpperCase()} ${path}`, payload);
      },
    };

    root.__vibesmithAnalytics = {
      track: (eventName, properties = {}) => {
        track(eventName, properties);
      },
      isEnabled: () => true,
      getStatus: () => ({ ...analyticsStatus }),
      refreshStatus: () => ({ ...analyticsStatus }),
      runSelfTest: async (type) => ({
        success: true,
        type,
      }),
      captureException: (error, additionalProperties = {}) => {
        track('captured_exception', {
          message: error instanceof Error ? error.message : String(error),
          ...additionalProperties,
        });
      },
    };

    function subscribe<T>(
      listeners: Set<(value: T) => void>,
      callback: (value: T) => void
    ) {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    }

    root.electronAPI = {};
    root.api = {
      getDebugSettings: async () => ({ ...debugSettings }),
      setDebugSettings: async (patch: {
        enabled?: boolean;
        level?: 'info' | 'debug';
        expireAt?: string | null;
      }) => {
        if (typeof patch.enabled === 'boolean') {
          debugSettings.enabled = patch.enabled;
          debugSettings.level = patch.enabled ? 'debug' : 'info';
          debugSettings.expireAt = patch.enabled
            ? '2026-03-21T00:00:00.000Z'
            : null;
        }
        if (patch.level) {
          debugSettings.level = patch.level;
        }
        if (patch.expireAt !== undefined) {
          debugSettings.expireAt = patch.expireAt;
        }
        debugSettings.updatedAt = new Date().toISOString();
        return { ...debugSettings };
      },
      createDiagnosticBundle: async () => ({ ...diagnosticBundleResult }),
      checkForUpdates: async () => {
        updaterListeners.checking.forEach((listener) => listener());
        queueMicrotask(() => {
          if (availableUpdate) {
            updaterListeners.available.forEach((listener) =>
              listener({ ...availableUpdate })
            );
            return;
          }

          updaterListeners.notAvailable.forEach((listener) =>
            listener({ version: currentVersion })
          );
        });

        return {
          success: true,
          version: currentVersion,
        };
      },
      downloadUpdate: async () => {
        queueMicrotask(() => {
          const version = availableUpdate?.version ?? currentVersion;
          updaterListeners.progress.forEach((listener) =>
            listener({
              percent: 100,
              transferred: 10,
              total: 10,
              bytesPerSecond: 1,
            })
          );
          updaterListeners.downloaded.forEach((listener) =>
            listener({ version })
          );
        });
        return { success: true };
      },
      quitAndInstall: () => {},
      getAppVersion: async () => currentVersion,
      fetchReleaseNotes: async (version: string) => ({
        success: true,
        version,
        source: 'github-release-api' as const,
        releaseNotes: availableUpdate?.releaseNotes ?? `## ${version}`,
      }),
      onUpdateChecking: (callback: () => void) =>
        subscribe(updaterListeners.checking, callback),
      onUpdateAvailable: (
        callback: (info: {
          version: string;
          releaseDate: string;
          releaseNotes: string;
        }) => void
      ) => subscribe(updaterListeners.available, callback),
      onUpdateNotAvailable: (
        callback: (info: { version: string }) => void
      ) => subscribe(updaterListeners.notAvailable, callback),
      onUpdateError: (
        callback: (error: { message: string }) => void
      ) => subscribe(updaterListeners.error, callback),
      onDownloadProgress: (
        callback: (progress: {
          percent: number;
          transferred: number;
          total: number;
          bytesPerSecond: number;
        }) => void
      ) => subscribe(updaterListeners.progress, callback),
      onUpdateDownloaded: (
        callback: (info: { version: string }) => void
      ) => subscribe(updaterListeners.downloaded, callback),
    };
  });
}

async function getTrackedEvents(page: Page): Promise<AnalyticsEvent[]> {
  return page.evaluate(() => {
    const bridge = (
      window as Window & {
        __e2eDesktopBridge?: {
          getAnalyticsEvents?: () => AnalyticsEvent[];
        };
      }
    ).__e2eDesktopBridge;

    return bridge?.getAnalyticsEvents?.() ?? [];
  });
}

async function clearTrackedEvents(page: Page): Promise<void> {
  await page.evaluate(() => {
    (
      window as Window & {
        __e2eDesktopBridge?: {
          clearAnalyticsEvents?: () => void;
        };
      }
    ).__e2eDesktopBridge?.clearAnalyticsEvents?.();
  });
}

async function waitForTrackedEvent(
  page: Page,
  eventName: string,
  matcher: (event: AnalyticsEvent) => boolean = () => true
): Promise<AnalyticsEvent> {
  let matchedEvent: AnalyticsEvent | undefined;

  await expect
    .poll(
      async () => {
        const events = await getTrackedEvents(page);
        matchedEvent = events.find(
          (event) => event.eventName === eventName && matcher(event)
        );
        return Boolean(matchedEvent);
      },
      {
        timeout: 15_000,
      }
    )
    .toBe(true);

  if (!matchedEvent) {
    throw new Error(`Analytics event not captured: ${eventName}`);
  }

  return matchedEvent;
}

async function setDiagnosticBundleResult(
  page: Page,
  result: DiagnosticBundleResult
): Promise<void> {
  await page.evaluate((nextResult) => {
    (
      window as Window & {
        __e2eDesktopBridge?: {
          setDiagnosticBundleResult?: (
            result: DiagnosticBundleResult
          ) => void;
        };
      }
    ).__e2eDesktopBridge?.setDiagnosticBundleResult?.(nextResult);
  }, result);
}

async function setAvailableUpdate(
  page: Page,
  update: UpdateInfo | null
): Promise<void> {
  await page.evaluate((nextUpdate) => {
    (
      window as Window & {
        __e2eDesktopBridge?: {
          setAvailableUpdate?: (update: UpdateInfo | null) => void;
        };
      }
    ).__e2eDesktopBridge?.setAvailableUpdate?.(nextUpdate);
  }, update);
}

async function setJsonResponse(
  page: Page,
  method: string,
  path: string,
  payload: unknown
): Promise<void> {
  await page.evaluate(
    ({ nextMethod, nextPath, nextPayload }) => {
      (
        window as Window & {
          __e2eDesktopBridge?: {
            setJsonResponse?: (
              method: string,
              path: string,
              payload: unknown
            ) => void;
          };
        }
      ).__e2eDesktopBridge?.setJsonResponse?.(
        nextMethod,
        nextPath,
        nextPayload
      );
    },
    {
      nextMethod: method,
      nextPath: path,
      nextPayload: payload,
    }
  );
}

function createProjectsPayload() {
  const now = new Date().toISOString();
  return [
    {
      id: 'proj_abc123',
      name: 'vibesmith',
      path: '/Users/user/Projects/vibesmith',
      is_global: false,
      component_count: 12,
      last_scanned_at: now,
      dir_exists: true,
      platforms: ['claude_code', 'cursor'],
      has_claude_dir: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'proj_global',
      name: 'global',
      path: '/Users/user/.claude',
      is_global: true,
      component_count: 5,
      last_scanned_at: now,
      dir_exists: true,
      platforms: ['claude_code'],
      has_claude_dir: true,
      created_at: now,
      updated_at: now,
    },
  ];
}

function createComponentsPayload(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `comp_${index + 1}`,
    type: 'skill',
    name: `component-${index + 1}`,
    description: `Component ${index + 1}`,
    enabled: true,
    tags: ['analytics'],
    project_id: 'proj_abc123',
    project_name: 'vibesmith',
    path: `/Users/user/Projects/vibesmith/.claude/skills/component-${index + 1}/SKILL.md`,
    created_at: '2026-03-20T09:00:00Z',
    updated_at: '2026-03-20T10:00:00Z',
    platform: 'claude_code',
  }));
}

test.beforeEach(async ({ page }) => {
  await installDesktopAnalyticsHarness(page);
});

test.describe('PostHog analytics', () => {
  test('captures native $pageview when entering settings', async ({ page }) => {
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();

    const pageviewEvent = await waitForTrackedEvent(
      page,
      '$pageview',
      (event) =>
        event.properties.route === '/settings' &&
        event.properties.navigation_type === 'initial_load'
    );

    expect(pageviewEvent.properties.route).toBe('/settings');
  });

  test('captures project_created and first_value_reached when adding a workspace path', async ({
    page,
  }) => {
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await clearTrackedEvents(page);

    await settingsPage.addWorkspacePath('/Users/user/Developer/posthog-e2e');

    const projectCreatedEvent = await waitForTrackedEvent(
      page,
      'project_created',
      (event) => event.properties.source === 'settings_root_path_add'
    );
    const firstValueEvent = await waitForTrackedEvent(
      page,
      'first_value_reached',
      (event) => event.properties.value_source === 'project_created'
    );

    expect(projectCreatedEvent.properties.source).toBe(
      'settings_root_path_add'
    );
    expect(firstValueEvent.properties.project_create_source).toBe(
      'settings_root_path_add'
    );
  });

  test('captures sync lifecycle events from the settings sync action', async ({
    page,
  }) => {
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await setJsonResponse(page, 'GET', '/api/projects', createProjectsPayload());
    await setJsonResponse(
      page,
      'GET',
      '/api/components',
      createComponentsPayload(17)
    );
    await clearTrackedEvents(page);

    await settingsPage.clickRescan();

    const featureUsedEvent = await waitForTrackedEvent(
      page,
      'feature_used',
      (event) =>
        event.properties.feature_name === 'sync_action' &&
        event.properties.source === 'scan_button'
    );
    const syncCompletedEvent = await waitForTrackedEvent(
      page,
      'project_sync_completed',
      (event) =>
        event.properties.sync_mode === 'quick_refresh' &&
        event.properties.summary_source === 'live_fetch'
    );
    const firstValueEvent = await waitForTrackedEvent(
      page,
      'first_value_reached',
      (event) => event.properties.value_source === 'project_sync_completed'
    );

    expect(featureUsedEvent.properties.source).toBe('scan_button');
    expect(syncCompletedEvent.properties.project_count).toBe(2);
    expect(syncCompletedEvent.properties.component_count).toBe(17);
    expect(firstValueEvent.properties.sync_mode).toBe('quick_refresh');
  });

  test('captures diagnostic bundle success events', async ({ page }) => {
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await setDiagnosticBundleResult(page, {
      success: true,
      path: '/tmp/vibesmith-diagnostic-success.zip',
      sizeBytes: 8192,
      fileCount: 6,
    });
    await clearTrackedEvents(page);

    await settingsPage.exportDiagnosticBundleButton.click();

    const diagnosticEvent = await waitForTrackedEvent(
      page,
      'diagnostic_bundle_created',
      (event) => event.properties.source === 'settings_page'
    );

    expect(diagnosticEvent.properties.file_count).toBe(6);
    expect(diagnosticEvent.properties.size_bytes).toBe(8192);
  });

  test('captures diagnostic bundle cancelled and failed events', async ({
    page,
  }) => {
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await clearTrackedEvents(page);

    await setDiagnosticBundleResult(page, {
      success: false,
      canceled: true,
    });
    await settingsPage.exportDiagnosticBundleButton.click();

    const cancelledEvent = await waitForTrackedEvent(
      page,
      'diagnostic_bundle_cancelled',
      (event) => event.properties.source === 'settings_page'
    );
    expect(cancelledEvent.properties.source).toBe('settings_page');

    await setDiagnosticBundleResult(page, {
      success: false,
      canceled: false,
      error: 'bundle_failed',
    });
    await settingsPage.exportDiagnosticBundleButton.click();

    const failedEvent = await waitForTrackedEvent(
      page,
      'diagnostic_bundle_failed',
      (event) => event.properties.message === 'bundle_failed'
    );
    expect(failedEvent.properties.source).toBe('settings_page');
  });

  test('captures updater analytics from check, download, and install actions', async ({
    page,
  }) => {
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await setAvailableUpdate(page, {
      version: '0.5.4-alpha.12',
      releaseDate: '2026-03-20T00:00:00Z',
      releaseNotes: '## Highlights\n\n- Updated analytics dashboard queries',
    });
    await clearTrackedEvents(page);

    await settingsPage.checkForUpdatesButton.click();

    await waitForTrackedEvent(
      page,
      'update_check_requested',
      (event) => event.properties.source === 'electron_updater'
    );
    await waitForTrackedEvent(page, 'update_check_started');
    await waitForTrackedEvent(
      page,
      'update_available',
      (event) => event.properties.version === '0.5.4-alpha.12'
    );

    await expect(settingsPage.downloadNowButton).toBeVisible();
    await settingsPage.downloadNowButton.click();
    await expect(settingsPage.releaseNotesDialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(settingsPage.releaseNotesDialog).toBeHidden();

    await settingsPage.downloadNowButton.click();

    await waitForTrackedEvent(
      page,
      'update_download_requested',
      (event) => event.properties.version === '0.5.4-alpha.12'
    );
    await waitForTrackedEvent(
      page,
      'update_downloaded',
      (event) => event.properties.version === '0.5.4-alpha.12'
    );

    await expect(settingsPage.restartNowButton).toBeVisible();
    await settingsPage.restartNowButton.click();

    const installEvent = await waitForTrackedEvent(
      page,
      'update_install_requested',
      (event) => event.properties.version === '0.5.4-alpha.12'
    );

    expect(installEvent.properties.source).toBe('electron_updater');
  });
});
