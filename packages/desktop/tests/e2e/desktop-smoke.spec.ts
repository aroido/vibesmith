import {
  expect,
  test,
  _electron as electron,
  type ElectronApplication,
  type Page,
  type Request,
} from '@playwright/test';
import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync, mkdtempSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DESKTOP_ROOT = resolve(__dirname, '../..');
const API_EXECUTABLE_PATH = resolve(DESKTOP_ROOT, '../api/dist/vibesmith-api');
const ELECTRON_MAIN_ENTRY = resolve(DESKTOP_ROOT, 'out/main/main.js');
const TMP_DIR = resolve(DESKTOP_ROOT, '.tmp-e2e');
const DB_PATH = join(TMP_DIR, 'vibesmith-e2e.db');
const API_HEALTH_URL = 'http://127.0.0.1:8000/api/health';

let apiProcess: ChildProcess | null = null;
let ownsApiProcess = false;
const apiStdout: string[] = [];
const apiStderr: string[] = [];

type DesktopLaunch = {
  electronApp: ElectronApplication;
  userDataDir: string;
};

function createCleanEnv(overrides: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...overrides,
  };
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

function slugifyTestName(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'desktop-smoke';
}

function createIsolatedUserDataDir(testName: string): string {
  mkdirSync(TMP_DIR, { recursive: true });
  return mkdtempSync(join(TMP_DIR, `${slugifyTestName(testName)}-userdata-`));
}

async function launchDesktopApp(
  testName: string,
  envOverrides: Record<string, string> = {}
): Promise<DesktopLaunch> {
  const userDataDir = createIsolatedUserDataDir(testName);
  const electronApp = await electron.launch({
    args: [ELECTRON_MAIN_ENTRY],
    env: createCleanEnv({
      VIBESMITH_BUILD_FLAVOR: 'internal',
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      VIBESMITH_USER_DATA_DIR: userDataDir,
      ...envOverrides,
    }),
  });

  return { electronApp, userDataDir };
}

async function expectUserDataOverrideApplied(
  electronApp: ElectronApplication,
  userDataDir: string
): Promise<void> {
  const runtimePaths = await electronApp.evaluate(({ app }) => {
    return {
      userData: app.getPath('userData'),
      sessionData: app.getPath('sessionData'),
      logs: app.getPath('logs'),
    };
  });

  expect(runtimePaths).toEqual({
    userData: userDataDir,
    sessionData: join(userDataDir, 'session-data'),
    logs: join(userDataDir, 'logs'),
  });
}

function assertRequiredArtifacts(): void {
  if (!existsSync(ELECTRON_MAIN_ENTRY)) {
    throw new Error(
      `Desktop build artifact missing: ${ELECTRON_MAIN_ENTRY}\n` +
        'Run `npm run build` in packages/desktop before executing E2E tests.'
    );
  }
}

async function waitForApiReady(timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  let lastError: unknown = null;

  while (Date.now() - startedAt < timeoutMs) {
    if (apiProcess && apiProcess.exitCode !== null) {
      const recheck = await isApiReadyOnce();
      if (recheck.ready) {
        return;
      }
      throw new Error(
        `API process exited early (code=${apiProcess.exitCode}, signal=${apiProcess.signalCode}).\n` +
          `${buildApiFailureDetails(recheck.error)}`
      );
    }

    const readiness = await isApiReadyOnce();
    if (readiness.ready) {
      return;
    }
    lastError = readiness.error;

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 400));
  }
  throw new Error(`Timed out waiting for API readiness at ${API_HEALTH_URL}. ${buildApiFailureDetails(lastError)}`);
}

function buildApiFailureDetails(lastError: unknown): string {
  const recentStdout = apiStdout.slice(-20).join('\n').trim();
  const recentStderr = apiStderr.slice(-20).join('\n').trim();
  const combinedLogs = `${recentStdout}\n${recentStderr}`.toLowerCase();
  const portHint = combinedLogs.includes('address already in use')
    ? 'Hint: Port 8000 is already in use. Stop existing API process or reuse running API.'
    : null;

  return (
    `Last error: ${String(lastError)}\n` +
    `Recent API stdout:\n${recentStdout || '(empty)'}\n` +
    `Recent API stderr:\n${recentStderr || '(empty)'}\n` +
    `${portHint ? `${portHint}\n` : ''}`
  );
}

async function isApiReadyOnce(): Promise<{ ready: true } | { ready: false; error: unknown }> {
  try {
    const response = await fetch(API_HEALTH_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) {
      return {
        ready: false,
        error: new Error(`Unexpected status: ${response.status}`),
      };
    }
    const payload = (await response.json()) as { status?: string; service?: string };
    if (payload.status !== 'ok' || payload.service !== 'vibesmith-api') {
      return {
        ready: false,
        error: new Error(`Unexpected health payload: ${JSON.stringify(payload)}`),
      };
    }
    return { ready: true };
  } catch (error) {
    return { ready: false, error };
  }
}

async function stopApiProcess(): Promise<void> {
  if (!apiProcess) return;

  const processToStop = apiProcess;
  apiProcess = null;

  if (processToStop.exitCode !== null || processToStop.signalCode !== null) {
    return;
  }

  processToStop.kill('SIGTERM');

  await new Promise<void>((resolveStop) => {
    const timer = setTimeout(() => {
      if (processToStop.exitCode === null && processToStop.signalCode === null) {
        processToStop.kill('SIGKILL');
      }
      resolveStop();
    }, 5_000);

    processToStop.once('exit', () => {
      clearTimeout(timer);
      resolveStop();
    });
  });
}

async function dismissOnboardingPopupIfNeeded(page: import('@playwright/test').Page): Promise<void> {
  const closeButton = page.locator('.driver-popover-close-btn').first();
  const visible = await closeButton.isVisible({ timeout: 3_000 }).catch(() => false);
  if (visible) {
    await closeButton.click({ force: true });
    await expect(closeButton).toBeHidden({ timeout: 5_000 });
  }
}

function isMainWindowUrl(url: string): boolean {
  if (!url) {
    return false;
  }
  if (url.includes('splash.html')) {
    return false;
  }
  return url.includes('index.html') || url.includes('#/');
}

type PostHogEventRequest = {
  eventName: string;
  properties: Record<string, unknown>;
};

function isPostHogEventEndpoint(url: string): boolean {
  if (!url.includes('posthog.com')) {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    return (
      parsedUrl.pathname.includes('/i/v0/e/') ||
      parsedUrl.pathname.includes('/e/')
    );
  } catch {
    return false;
  }
}

function parsePostHogEventRequest(request: Request): PostHogEventRequest | null {
  if (!isPostHogEventEndpoint(request.url())) {
    return null;
  }

  const postData = request.postData();
  if (!postData) {
    return null;
  }

  try {
    const payload = JSON.parse(postData) as {
      event?: unknown;
      properties?: unknown;
    };

    if (
      typeof payload.event !== 'string' ||
      !payload.properties ||
      typeof payload.properties !== 'object'
    ) {
      return null;
    }

    return {
      eventName: payload.event,
      properties: payload.properties as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}

async function waitForPostHogEventRequest(
  page: Page,
  eventName: string,
  matcher: (properties: Record<string, unknown>) => boolean = () => true
): Promise<PostHogEventRequest> {
  const request = await page.waitForRequest(
    (nextRequest) => {
      const parsed = parsePostHogEventRequest(nextRequest);
      return (
        parsed?.eventName === eventName && matcher(parsed.properties)
      );
    },
    {
      timeout: 15_000,
    }
  );

  const parsed = parsePostHogEventRequest(request);
  if (!parsed) {
    throw new Error(`Failed to parse PostHog event request for ${eventName}`);
  }

  return parsed;
}

async function waitForAnalyticsReady(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        const status = await page.evaluate(() => {
          return window.__vibesmithAnalytics?.getStatus?.() ?? null;
        });

        return {
          configured: status?.configured === true,
          ready: status?.ready === true,
          enabled: status?.enabled === true,
        };
      },
      {
        timeout: 20_000,
        intervals: [500, 1_000, 2_000],
      }
    )
    .toEqual({
      configured: true,
      ready: true,
      enabled: true,
    });
}

async function waitForMainWindow(app: ElectronApplication, timeoutMs = 20_000): Promise<Page> {
  const startedAt = Date.now();
  const seenUrls = new Set<string>();

  while (Date.now() - startedAt < timeoutMs) {
    const windows = app.windows();
    for (const windowPage of windows) {
      const url = windowPage.url();
      if (url) {
        seenUrls.add(url);
      }
      if (isMainWindowUrl(url)) {
        return windowPage;
      }
    }

    const remainingMs = timeoutMs - (Date.now() - startedAt);
    if (remainingMs <= 0) {
      break;
    }

    const nextWindow = await app
      .waitForEvent('window', { timeout: Math.min(2_000, remainingMs) })
      .catch(() => null);

    if (nextWindow) {
      const nextUrl = nextWindow.url();
      if (nextUrl) {
        seenUrls.add(nextUrl);
      }
      if (isMainWindowUrl(nextUrl)) {
        return nextWindow;
      }
    }
  }

  throw new Error(
    `Main window was not found within ${timeoutMs}ms. Seen URLs: ${Array.from(seenUrls).join(', ') || '(none)'}`
  );
}

test.beforeAll(async () => {
  assertRequiredArtifacts();
  mkdirSync(TMP_DIR, { recursive: true });

  apiStdout.length = 0;
  apiStderr.length = 0;
  ownsApiProcess = false;

  const existingApi = await isApiReadyOnce();
  if (existingApi.ready) {
    return;
  }

  if (!existsSync(API_EXECUTABLE_PATH)) {
    throw new Error(
      `API executable missing: ${API_EXECUTABLE_PATH}\n` +
        'Run `npm run build:api-executable` in packages/desktop before executing E2E tests, or start the API on port 8000 before running.'
    );
  }

  apiProcess = spawn(API_EXECUTABLE_PATH, [], {
    env: createCleanEnv({
      PORT: '8000',
      VIBESMITH_DB_PATH: DB_PATH,
      VIBESMITH_TEST_MODE: '1',
    }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  ownsApiProcess = true;

  apiProcess.stdout?.on('data', (chunk: Buffer) => {
    apiStdout.push(chunk.toString());
  });
  apiProcess.stderr?.on('data', (chunk: Buffer) => {
    apiStderr.push(chunk.toString());
  });
  apiProcess.on('error', (error) => {
    apiStderr.push(`[spawn-error] ${error.message}`);
  });

  await waitForApiReady(30_000);
});

test.afterAll(async () => {
  if (ownsApiProcess) {
    await stopApiProcess();
  }
});

test('uses isolated userData and shows onboarding on a clean launch', async () => {
  const { electronApp, userDataDir } = await launchDesktopApp('clean-onboarding', {
    VIBESMITH_POSTHOG_ALLOW_WEBDRIVER: 'true',
  });

  try {
    await expectUserDataOverrideApplied(electronApp, userDataDir);

    const page = await waitForMainWindow(electronApp);
    await page.waitForLoadState('domcontentloaded');

    const onboardingPopover = page.locator('.driver-popover').first();
    await expect(onboardingPopover).toBeVisible({ timeout: 15_000 });

    const onboardingState = await page.evaluate(() => {
      return {
        driverActive: document.querySelector('.driver-popover') !== null,
        onboardingStatus: window.localStorage.getItem('vibesmith_onboarding_status'),
      };
    });
    expect(onboardingState).toEqual({
      driverActive: true,
      onboardingStatus: null,
    });

    await waitForAnalyticsReady(page);

    const analyticsStatus = await page.evaluate(() => {
      return window.__vibesmithAnalytics?.getStatus?.() ?? null;
    });
    expect(analyticsStatus?.configured).toBe(true);
    expect(analyticsStatus?.ready).toBe(true);
    expect(analyticsStatus?.enabled).toBe(true);

    await dismissOnboardingPopupIfNeeded(page);
  } finally {
    await electronApp.close();
  }
});

test('launches app and navigates to settings by click', async () => {
  const { electronApp } = await launchDesktopApp('settings-navigation');

  try {
    const page = await waitForMainWindow(electronApp);
    await page.waitForLoadState('domcontentloaded');

    await dismissOnboardingPopupIfNeeded(page);

    const homeNav = page.getByTestId('nav-home-link');
    const settingsNav = page.getByTestId('nav-settings-link');

    await expect(homeNav).toBeVisible();
    await expect(settingsNav).toBeVisible();

    await settingsNav.click();

    await expect(settingsNav).toHaveAttribute('aria-current', 'page');
    await expect(page).toHaveURL(/#\/settings(?:$|[/?#])/);
  } finally {
    await electronApp.close();
  }
});

test('reports PostHog session recording as active', async () => {
  const { electronApp } = await launchDesktopApp('posthog-session-recording');

  try {
    const page = await waitForMainWindow(electronApp);
    await page.waitForLoadState('domcontentloaded');
    await dismissOnboardingPopupIfNeeded(page);

    const posthogRequests: Array<{ method: string; url: string; status: number | null }> = [];
    page.on('response', async (response) => {
      const url = response.url();
      if (!url.includes('posthog.com')) {
        return;
      }

      posthogRequests.push({
        method: response.request().method(),
        url,
        status: response.status(),
      });
    });

    const settingsNav = page.getByTestId('nav-settings-link');
    await settingsNav.click();
    await expect(page).toHaveURL(/#\/settings(?:$|[/?#])/);
    await page.mouse.move(240, 180);
    await page.mouse.click(240, 180);
    await page.waitForTimeout(1_500);

    let latestStatus: Record<string, unknown> | null = null;

    await expect
      .poll(
        async () => {
          latestStatus = await page.evaluate(() => {
            return window.__vibesmithAnalytics?.getStatus?.() ?? null;
          });

          return {
            configured: latestStatus?.configured === true,
            ready: latestStatus?.ready === true,
            enabled: latestStatus?.enabled === true,
            identityReady: latestStatus?.identityReady === true,
            remoteConfigLoaded: latestStatus?.serverRemoteConfigLoaded === true,
            remoteSessionRecording: latestStatus?.serverSessionRecording === true,
            sessionRecording: latestStatus?.sessionRecording === true,
            hasReplayUrl:
              typeof latestStatus?.replayUrl === 'string' &&
              latestStatus.replayUrl.length > 0,
          };
        },
        {
          timeout: 20_000,
          intervals: [500, 1_000, 2_000],
        }
      )
      .toEqual({
        configured: true,
        ready: true,
        enabled: true,
        identityReady: true,
        remoteConfigLoaded: true,
        remoteSessionRecording: true,
        sessionRecording: true,
        hasReplayUrl: true,
      });

    expect(latestStatus?.degradedReason ?? null).toBeNull();

    const selfTestResult = await page.evaluate(async () => {
      return window.__vibesmithAnalytics?.runSelfTest?.('event') ?? null;
    });

    expect(selfTestResult).toEqual({
      success: true,
      type: 'event',
    });

    await page.mouse.move(320, 220);
    await page.mouse.click(320, 220);
    await page.getByTestId('nav-home-link').click();
    await expect(page).toHaveURL(/#\/(?:$|[?#])/);
    await settingsNav.click();
    await expect(page).toHaveURL(/#\/settings(?:$|[/?#])/);
    await page.waitForTimeout(1_500);

    await expect
      .poll(
        async () => {
          latestStatus = await page.evaluate(() => {
            return window.__vibesmithAnalytics?.getStatus?.() ?? null;
          });

          return {
            eventTransportSeen: latestStatus?.eventTransportSeen === true,
            lastEventName:
              typeof latestStatus?.lastEventName === 'string' &&
              latestStatus.lastEventName.length > 0,
            lastTransportMethod:
              latestStatus?.lastTransportMethod === 'fetch',
            lastEventTransportAt:
              typeof latestStatus?.lastEventTransportAt === 'string' &&
              latestStatus.lastEventTransportAt.length > 0,
            sessionRecording: latestStatus?.sessionRecording === true,
            hasReplayUrl:
              typeof latestStatus?.replayUrl === 'string' &&
              latestStatus.replayUrl.length > 0,
            lastTransportError: latestStatus?.lastTransportError ?? null,
          };
        },
        {
          timeout: 20_000,
          intervals: [500, 1_000, 2_000],
        }
      )
      .toEqual({
        eventTransportSeen: true,
        lastEventName: true,
        lastTransportMethod: true,
        lastEventTransportAt: true,
        sessionRecording: true,
        hasReplayUrl: true,
        lastTransportError: null,
      });

    const flushResult = await page.evaluate(async () => {
      return window.__vibesmithAnalytics?.forceFlush?.() ?? null;
    });
    expect(flushResult).not.toBeNull();

    await expect
      .poll(
        async () => {
          latestStatus = await page.evaluate(() => {
            return window.__vibesmithAnalytics?.getStatus?.() ?? null;
          });

          return {
            replayTransportSeen: latestStatus?.replayTransportSeen === true,
            lastReplayTransportAt:
              typeof latestStatus?.lastReplayTransportAt === 'string' &&
              latestStatus.lastReplayTransportAt.length > 0,
            replayRequestObserved: posthogRequests.some((request) =>
              request.url.includes('/s/')
            ),
          };
        },
        {
          timeout: 20_000,
          intervals: [500, 1_000, 2_000],
        }
      )
      .toEqual({
        replayTransportSeen: true,
        lastReplayTransportAt: true,
        replayRequestObserved: true,
      });

  } finally {
    await electronApp.close();
  }
});

test('captures monitoring preference changes as PostHog events', async () => {
  const { electronApp } = await launchDesktopApp('monitoring-preferences');

  try {
    const page = await waitForMainWindow(electronApp);
    await page.waitForLoadState('domcontentloaded');
    await dismissOnboardingPopupIfNeeded(page);
    await waitForAnalyticsReady(page);

    const settingsNav = page.getByTestId('nav-settings-link');
    await settingsNav.click();
    await expect(page).toHaveURL(/#\/settings(?:$|[/?#])/);

    const crashReportingCheckbox = page.getByRole('checkbox', {
      name: /문제 리포트|Crash reports/i,
    });
    const performanceMonitoringCheckbox = page.getByRole('checkbox', {
      name: /성능 진단 데이터|Performance diagnostics/i,
    });
    const usageAnalyticsCheckbox = page.getByRole('checkbox', {
      name: /사용 통계|Usage analytics/i,
    });

    const nextCrashReportingState =
      !(await crashReportingCheckbox.isChecked());
    const crashReportingEventPromise = waitForPostHogEventRequest(
      page,
      'monitoring_preference_changed',
      (properties) =>
        properties.setting_name === 'crash_reporting' &&
        properties.enabled === nextCrashReportingState
    );
    await crashReportingCheckbox.click();
    const crashReportingEvent = await crashReportingEventPromise;
    expect(crashReportingEvent.properties.setting_name).toBe(
      'crash_reporting'
    );

    const nextPerformanceState =
      !(await performanceMonitoringCheckbox.isChecked());
    const performanceMonitoringEventPromise = waitForPostHogEventRequest(
      page,
      'monitoring_preference_changed',
      (properties) =>
        properties.setting_name === 'performance_monitoring' &&
        properties.enabled === nextPerformanceState
    );
    await performanceMonitoringCheckbox.click();
    const performanceMonitoringEvent = await performanceMonitoringEventPromise;
    expect(performanceMonitoringEvent.properties.setting_name).toBe(
      'performance_monitoring'
    );

    const nextUsageAnalyticsState =
      !(await usageAnalyticsCheckbox.isChecked());
    const usageAnalyticsEventPromise = waitForPostHogEventRequest(
      page,
      'monitoring_preference_changed',
      (properties) =>
        properties.setting_name === 'usage_analytics' &&
        properties.enabled === nextUsageAnalyticsState
    );
    await usageAnalyticsCheckbox.click();
    const usageAnalyticsEvent = await usageAnalyticsEventPromise;
    expect(usageAnalyticsEvent.properties.setting_name).toBe(
      'usage_analytics'
    );
  } finally {
    await electronApp.close();
  }
});
