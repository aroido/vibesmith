/**
 * Electron Main Process
 * VibeSmith Desktop App
 */

import { app, BrowserWindow, shell, ipcMain, Menu, dialog } from 'electron';
import { mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { autoUpdater } from 'electron-updater';
import { startApiServer, stopApiServer, getApiUrl } from './api-server';
import { initializeLogger, logger, PerformanceTimer, resolveBuildFlavorFromEnv } from './logger';
import type { BuildFlavor } from './logger';
import { resolveResourcePath } from './resource-path';
import { createTray, destroyTray } from './tray';
import { getAnalyticsIdentity } from './analytics-identity';
import { getDebugSettings, updateDebugSettings } from './debug-settings';
import { createDiagnosticBundle } from './diagnostic-bundle';

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let isQuitting = false;
let runtimeBuildFlavor: BuildFlavor = 'release';
let runtimeUserDataOverride: string | null = null;
let runtimeUserDataOverrideSource: 'env' | 'cli' | null = null;

type RendererLogLevel = 'error' | 'warn' | 'info' | 'debug';

interface RendererLogPayload {
  event_name: string;
  level?: RendererLogLevel;
  attrs?: Record<string, unknown>;
  request_id?: string;
  trace_id?: string;
  error?: unknown;
}

interface DebugSettingsPatchPayload {
  enabled?: boolean;
  level?: 'info' | 'debug';
  expireAt?: string | null;
  ttlHours?: number;
}

interface FetchReleaseNotesPayload {
  version?: string;
}

interface FetchReleaseNotesResult {
  success: boolean;
  version: string;
  releaseNotes?: string;
  source?: 'github-release-api';
  error?: string;
}

type AnalyticsScalarValue = string | number | boolean | null;

interface AnalyticsMainProcessExceptionPayload {
  source: string;
  name?: string;
  message: string;
  stack?: string | null;
  metadata?: Record<string, AnalyticsScalarValue>;
}

const ANALYTICS_MAIN_PROCESS_EXCEPTION_CHANNEL =
  'analytics-main-process-exception';
const USER_DATA_DIR_FLAG = '--user-data-dir';

function getCliFlagValue(flag: string): string | null {
  const inline = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  if (inline) {
    const value = inline.slice(flag.length + 1).trim();
    return value || null;
  }

  const index = process.argv.findIndex((arg) => arg === flag);
  if (index === -1) return null;

  const next = process.argv[index + 1]?.trim();
  return next && !next.startsWith('--') ? next : null;
}

function applyUserDataPathOverride(): void {
  const envOverride = process.env['VIBESMITH_USER_DATA_DIR']?.trim();
  const cliOverride = getCliFlagValue(USER_DATA_DIR_FLAG);
  const rawOverride = envOverride || cliOverride;

  if (!rawOverride) return;

  const overridePath = resolve(rawOverride);
  mkdirSync(overridePath, { recursive: true });
  app.setPath('userData', overridePath);
  app.setPath('sessionData', join(overridePath, 'session-data'));
  app.setPath('logs', join(overridePath, 'logs'));
  runtimeUserDataOverride = overridePath;
  runtimeUserDataOverrideSource = envOverride ? 'env' : 'cli';
}

function normalizeReleaseVersionTag(version: string): string | null {
  const trimmed = version.trim();
  if (!trimmed) return null;
  return trimmed.startsWith('v') ? trimmed : `v${trimmed}`;
}

function isBaseSemverTag(tag: string): boolean {
  return /^v\d+\.\d+\.\d+$/.test(tag);
}

function normalizeGitHubRepositoryPath(repository: string): string | null {
  const trimmed = repository.trim().replace(/^\/+|\/+$/g, '');
  const parts = trimmed.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }

  return `${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}`;
}

function getGitHubApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'VibeSmith Desktop',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const token =
    process.env.VIBESMITH_RELEASE_NOTES_TOKEN || process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function fetchReleaseNotesFromGitHub(version: string): Promise<FetchReleaseNotesResult> {
  const normalizedTag = normalizeReleaseVersionTag(version);
  if (!normalizedTag) {
    return {
      success: false,
      version: version.trim(),
      error: 'version is required',
    };
  }

  const releaseRepo =
    process.env.VIBESMITH_RELEASE_NOTES_REPOSITORY || 'aroido/vibesmith';
  const encodedRepo = normalizeGitHubRepositoryPath(releaseRepo);
  if (!encodedRepo) {
    return {
      success: false,
      version: normalizedTag,
      error: 'Invalid release notes repository configuration',
    };
  }
  const headers = getGitHubApiHeaders();

  const fetchReleaseByTag = async (tag: string): Promise<Response> => {
    const encodedTag = encodeURIComponent(tag);
    const endpoint = `https://api.github.com/repos/${encodedRepo}/releases/tags/${encodedTag}`;
    return fetch(endpoint, {
      headers,
    });
  };

  const fetchPrefixMatchedRelease = async (
    baseTag: string
  ): Promise<{ tagName: string; releaseNotes: string } | null> => {
    const releasesEndpoint = `https://api.github.com/repos/${encodedRepo}/releases?per_page=20`;
    const response = await fetch(releasesEndpoint, {
      headers,
    });

    if (!response.ok) {
      logger.logEvent(
        'updater.release-notes.fetch.fallback-prefix.error',
        {
          version: baseTag,
          repo: releaseRepo,
          status: response.status,
          status_text: response.statusText,
        },
        'warn',
        { process: 'updater' }
      );
      return null;
    }

    const payload = (await response.json()) as Array<{
      tag_name?: unknown;
      body?: unknown;
    }>;

    const prefix = `${baseTag}-`;
    const matchedRelease = payload.find((release) => {
      if (typeof release.tag_name !== 'string') return false;
      return release.tag_name.trim().startsWith(prefix);
    });

    if (!matchedRelease || typeof matchedRelease.tag_name !== 'string') {
      return null;
    }

    const resolvedTag = matchedRelease.tag_name.trim();
    const releaseNotes =
      typeof matchedRelease.body === 'string'
        ? matchedRelease.body.trim()
        : '';
    if (!releaseNotes) {
      return null;
    }

    return {
      tagName: resolvedTag,
      releaseNotes,
    };
  };

  try {
    logger.logEvent(
      'updater.release-notes.fetch.start',
      {
        version: normalizedTag,
        repo: releaseRepo,
      },
      'info',
      { process: 'updater' }
    );

    const response = await fetchReleaseByTag(normalizedTag);

    if (!response.ok) {
      if (response.status === 404 && isBaseSemverTag(normalizedTag)) {
        const fallbackRelease = await fetchPrefixMatchedRelease(normalizedTag);
        if (fallbackRelease) {
          logger.logEvent(
            'updater.release-notes.fetch.fallback-prefix.success',
            {
              requested_version: normalizedTag,
              resolved_version: fallbackRelease.tagName,
              repo: releaseRepo,
              length: fallbackRelease.releaseNotes.length,
            },
            'info',
            { process: 'updater' }
          );

          return {
            success: true,
            version: fallbackRelease.tagName,
            releaseNotes: fallbackRelease.releaseNotes,
            source: 'github-release-api',
          };
        }
      }

      logger.logEvent(
        'updater.release-notes.fetch.error',
        {
          version: normalizedTag,
          repo: releaseRepo,
          status: response.status,
          status_text: response.statusText,
        },
        'warn',
        { process: 'updater' }
      );
      return {
        success: false,
        version: normalizedTag,
        error: `Release notes request failed (${response.status})`,
      };
    }

    const payload = (await response.json()) as {
      tag_name?: unknown;
      body?: unknown;
    };
    const resolvedTag =
      typeof payload.tag_name === 'string' && payload.tag_name.trim().length > 0
        ? payload.tag_name.trim()
        : normalizedTag;
    const releaseNotes =
      typeof payload.body === 'string' ? payload.body.trim() : '';

    if (!releaseNotes) {
      logger.logEvent(
        'updater.release-notes.fetch.empty',
        {
          version: resolvedTag,
          repo: releaseRepo,
        },
        'warn',
        { process: 'updater' }
      );
      return {
        success: false,
        version: resolvedTag,
        error: 'Release notes not available',
      };
    }

    logger.logEvent(
      'updater.release-notes.fetch.success',
      {
        version: resolvedTag,
        repo: releaseRepo,
        length: releaseNotes.length,
      },
      'info',
      { process: 'updater' }
    );

    return {
      success: true,
      version: resolvedTag,
      releaseNotes,
      source: 'github-release-api',
    };
  } catch (error) {
    logger.logEvent(
      'updater.release-notes.fetch.error',
      {
        version: normalizedTag,
        repo: releaseRepo,
      },
      'error',
      { error, process: 'updater' }
    );
    return {
      success: false,
      version: normalizedTag,
      error: error instanceof Error ? error.message : 'Unknown release notes fetch error',
    };
  }
}

// Configure auto-updater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
// We distribute alpha tags (vX.Y.Z-alpha.N) through the default feed.
// Keep this enabled so stable installs can discover pre-release updates.
autoUpdater.allowPrerelease = true;

function isInternalBuildFlavor(flavor: BuildFlavor): boolean {
  return flavor === 'internal';
}

function logInternalStartupDiagnostics(buildFlavor: BuildFlavor): void {
  const splashResource = resolveResourcePath('splash.html');
  const trayTemplateResource = resolveResourcePath('tray-icon-Template.png');
  const trayFallbackResource = resolveResourcePath('icon.png');
  const apiExecutablePath = join(process.resourcesPath, 'api', 'vibesmith-api');

  logger.logEvent(
    'startup.diagnostics.context',
    {
      build_flavor: buildFlavor,
      is_packaged: app.isPackaged,
      app_path: app.getAppPath(),
      resources_path: process.resourcesPath,
      user_data_path: app.getPath('userData'),
      logs_path: app.getPath('logs'),
      cwd: process.cwd(),
      pid: process.pid,
    },
    'debug',
    { process: 'main' }
  );

  logger.logEvent(
    'startup.diagnostics.resources',
    {
      splash_path: splashResource.path,
      splash_exists: splashResource.source === 'resolved',
      splash_checked_paths: splashResource.checkedPaths,
      tray_template_path: trayTemplateResource.path,
      tray_template_exists: trayTemplateResource.source === 'resolved',
      tray_template_checked_paths: trayTemplateResource.checkedPaths,
      tray_fallback_path: trayFallbackResource.path,
      tray_fallback_exists: trayFallbackResource.source === 'resolved',
      tray_fallback_checked_paths: trayFallbackResource.checkedPaths,
      api_executable_path: apiExecutablePath,
      api_executable_exists:
        resolveResourcePath('api/vibesmith-api').source === 'resolved' ||
        resolveResourcePath('vibesmith-api').source === 'resolved',
    },
    'debug',
    { process: 'main' }
  );
}

function toAnalyticsScalarValue(value: unknown): AnalyticsScalarValue {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : String(value);
  }

  if (typeof value === 'boolean') {
    return value;
  }

  return value == null ? null : String(value);
}

function normalizeAnalyticsMetadata(
  metadata: Record<string, unknown> = {}
): Record<string, AnalyticsScalarValue> {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key,
      toAnalyticsScalarValue(value),
    ])
  );
}

function normalizeExceptionForAnalytics(
  error: unknown
): Pick<AnalyticsMainProcessExceptionPayload, 'name' | 'message' | 'stack'> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message || 'Unknown error',
      stack: error.stack ?? null,
    };
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return {
      message: error.trim(),
      stack: null,
    };
  }

  return {
    message: 'Unknown error',
    stack: null,
  };
}

function forwardAnalyticsMainProcessException(
  payload: AnalyticsMainProcessExceptionPayload
): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  try {
    mainWindow.webContents.send(
      ANALYTICS_MAIN_PROCESS_EXCEPTION_CHANNEL,
      payload
    );
  } catch (sendError) {
    logger.logEvent(
      'analytics.main-process.exception.forward_failed',
      {
        source: payload.source,
      },
      'warn',
      { error: sendError, process: 'main' }
    );
  }
}

function reportMainProcessException(
  source: string,
  error: unknown,
  metadata: Record<string, unknown> = {}
): void {
  const normalizedError = normalizeExceptionForAnalytics(error);
  const normalizedMetadata = normalizeAnalyticsMetadata(metadata);

  logger.logEvent(
    'analytics.main-process.exception',
    {
      source,
      error_name: normalizedError.name ?? 'Error',
      ...normalizedMetadata,
    },
    'error',
    { error: error instanceof Error ? error : undefined, process: 'main' }
  );

  forwardAnalyticsMainProcessException({
    source,
    ...normalizedError,
    metadata: normalizedMetadata,
  });
}

function registerMainProcessExceptionHandlers(): void {
  process.on('uncaughtExceptionMonitor', (error, origin) => {
    reportMainProcessException('uncaught_exception', error, {
      origin,
    });
  });

  process.on('unhandledRejection', (reason) => {
    reportMainProcessException('unhandled_rejection', reason);
  });

  app.on('child-process-gone', (_event, details) => {
    reportMainProcessException(
      'child_process_gone',
      new Error(
        `Child process exited: ${details.type} (${details.reason})`
      ),
      {
        child_process_name: details.name,
        child_process_type: details.type,
        exit_code: details.exitCode,
        reason: details.reason,
      }
    );
  });
}

/**
 * Create splash screen
 */
function createSplashScreen(): void {
  const splashResource = resolveResourcePath('splash.html');

  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    center: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  logger.logEvent(
    'startup.splash.resource',
    {
      path: splashResource.path,
      source: splashResource.source,
      checked_paths: splashResource.checkedPaths,
    },
    splashResource.source === 'resolved' ? 'debug' : 'warn',
    { process: 'main' }
  );

  splashWindow.loadFile(splashResource.path, {
    query: {
      version: app.getVersion(),
    },
  });

  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

/**
 * Close splash screen
 */
function closeSplashScreen(): void {
  if (splashWindow) {
    splashWindow.close();
    splashWindow = null;
  }
}

function shouldEnableSplashScreen(): boolean {
  // Electron 28~35 on macOS has known accessibility-related close crashes.
  // We disable splash in packaged builds for these versions to reduce
  // close-lifecycle race conditions until runtime is upgraded.
  const electronMajor = Number.parseInt(process.versions.electron.split('.')[0] ?? '0', 10);

  if (process.platform === 'darwin' && app.isPackaged && Number.isFinite(electronMajor) && electronMajor <= 35) {
    return false;
  }

  return true;
}

function createWindow(): void {
  const useNativeTitleBar = process.platform === 'darwin';

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: useNativeTitleBar ? 'default' : undefined,
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  // macOS: 윈도우 닫기 시 백그라운드로 전환 (트레이로 유지)
  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin' && !isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      logger.info('[Main] Window hidden (background mode)');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    logger.info('[Main] Window closed');
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-fail-load', (
    _event,
    errorCode,
    errorDescription,
    validatedURL,
    isMainFrame
  ) => {
    if (!isMainFrame || errorCode === -3) {
      return;
    }

    reportMainProcessException(
      'did_fail_load',
      new Error(`Renderer failed to load: ${errorDescription}`),
      {
        error_code: errorCode,
        validated_url: validatedURL,
      }
    );
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    reportMainProcessException(
      'render_process_gone',
      new Error(`Renderer process exited: ${details.reason}`),
      {
        exit_code: details.exitCode,
        reason: details.reason,
      }
    );
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
registerMainProcessExceptionHandlers();
applyUserDataPathOverride();

app.whenReady().then(async () => {
  // Initialize logger first
  const buildFlavor = resolveBuildFlavorFromEnv();
  runtimeBuildFlavor = buildFlavor;
  const internalBuild = isInternalBuildFlavor(buildFlavor);
  const debugSettings = getDebugSettings();
  const effectiveDebugMode = internalBuild || debugSettings.enabled;
  const effectiveFileLevel = internalBuild ? 'debug' : debugSettings.level;

  initializeLogger({
    debugMode: effectiveDebugMode,
    fileLevel: effectiveFileLevel,
    buildFlavor,
  });

  logger.logEvent(
    'build.flavor.detected',
    {
      build_flavor: buildFlavor,
      source: internalBuild ? 'internal-build-flavor' : 'release-default',
      effective_debug_mode: effectiveDebugMode,
      effective_file_level: effectiveFileLevel,
    },
    'info',
    { process: 'main' }
  );

  if (runtimeUserDataOverride) {
    logger.logEvent(
      'runtime.user-data.override',
      {
        source: runtimeUserDataOverrideSource,
        user_data_path: app.getPath('userData'),
        session_data_path: app.getPath('sessionData'),
        logs_path: app.getPath('logs'),
      },
      'info',
      { process: 'main' }
    );
  }

  if (internalBuild) {
    logInternalStartupDiagnostics(buildFlavor);
  }

  logger.logEvent(
    'debug.settings.loaded',
    {
      enabled: debugSettings.enabled,
      level: debugSettings.level,
      expire_at: debugSettings.expireAt,
      effective_enabled: effectiveDebugMode,
      effective_level: effectiveFileLevel,
      build_flavor: buildFlavor,
    },
    'info',
    { process: 'main' }
  );

  const timer = new PerformanceTimer('App Startup');

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.vibesmith.app');
  timer.checkpoint('User Model ID Set');

  // 1. 스플래시 스크린 표시 (macOS Electron 28~35 패키지 빌드는 안정성을 위해 비활성화)
  const splashEnabled = shouldEnableSplashScreen();
  if (splashEnabled) {
    createSplashScreen();
    timer.checkpoint('Splash Screen Created');
  } else {
    logger.logEvent(
      'startup.splash.disabled',
      {
        reason: 'macos-electron-accessibility-crash-mitigation',
        platform: process.platform,
        is_packaged: app.isPackaged,
        electron: process.versions.electron,
      },
      'warn',
      { process: 'main' }
    );
  }

  // 2. API 서버 시작
  logger.info('[Main] Starting API server...');
  try {
    await startApiServer();
    logger.info('[Main] API server started successfully');
    timer.checkpoint('API Server Started');
  } catch (error) {
    logger.error('[Main] Failed to start API server:', error);
    closeSplashScreen();
    dialog.showErrorBox(
      'API 서버 시작 실패',
      '앱을 시작할 수 없습니다. 다시 시도해주세요.\n\n' +
        `Error: ${error instanceof Error ? error.message : String(error)}`
    );
    app.quit();
    return;
  }

  // 3. 스플래시 스크린 닫기
  if (splashEnabled) {
    closeSplashScreen();
    timer.checkpoint('Splash Screen Closed');
  }

  // 4. API 서버 준비 완료 후 메인 윈도우 생성
  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // IPC test
  ipcMain.on('ping', () => {
    logger.logEvent('ipc.ping', { message: 'pong' }, 'debug');
  });

  // IPC handler for API URL
  ipcMain.handle('get-api-url', () => getApiUrl());

  // Renderer structured log bridge
  setupRendererLogBridge();
  setupDiagnosticTools();

  // Setup menu
  setupMenu();

  // Auto-updater IPC handlers
  setupAutoUpdater();

  createWindow();
  timer.checkpoint('Main Window Created');

  // Create system tray
  createTray(mainWindow);
  timer.checkpoint('System Tray Created');

  timer.end('App Startup');

  // Log memory usage after startup
  logger.logMemoryUsage();

  // Log memory usage every 5 minutes
  setInterval(() => {
    logger.logMemoryUsage();
  }, 5 * 60 * 1000);

  app.on('activate', function () {
    // On macOS, clicking dock icon should restore hidden/minimized window
    // before considering window re-creation.
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
      mainWindow.focus();
      return;
    }

    // Fallback: if no main window is tracked, create one.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    logger.info('[Main] All windows closed, quitting app');
    app.quit();
  } else {
    logger.info('[Main] All windows closed, staying in background (macOS)');
  }
});

// macOS: Cmd+Q로 완전 종료
app.on('before-quit', () => {
  logger.info('[Main] Before quit event triggered');
  isQuitting = true;
});

// Cleanup when app quits
app.on('will-quit', () => {
  logger.info('[Main] App will quit, stopping API server...');
  stopApiServer();
  destroyTray();
  logger.info('[Main] App quit complete');
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

/**
 * Setup application menu
 */
function setupMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              {
                label: 'Check for Updates...',
                click: () => {
                  mainWindow?.webContents.send('menu-check-updates');
                },
              },
              { type: 'separator' as const },
              {
                label: 'Settings…',
                accelerator: 'CmdOrCtrl+,',
                click: () => {
                  mainWindow?.webContents.send('shortcut-open-settings');
                },
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'New Component',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow?.webContents.send('menu-new-component');
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' as const },
              { role: 'delete' as const },
              { role: 'selectAll' as const },
            ]
          : [{ role: 'delete' as const }, { type: 'separator' as const }, { role: 'selectAll' as const }]),
      ],
    },
    // View menu
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow?.reload();
          },
        },
        {
          label: 'Force Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            mainWindow?.webContents.reloadIgnoringCache();
          },
        },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        {
          label: 'Search',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            mainWindow?.webContents.send('shortcut-search');
          },
        },
        {
          label: 'Command Palette',
          accelerator: 'CmdOrCtrl+K',
          click: () => {
            mainWindow?.webContents.send('shortcut-command-palette');
          },
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' as const }, { role: 'front' as const }, { type: 'separator' as const }, { role: 'window' as const }]
          : [{ role: 'close' as const }]),
      ],
    },
    // Help menu
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            await shell.openExternal('https://github.com/aroido/vibesmith');
          },
        },
        {
          label: 'Documentation',
          click: async () => {
            await shell.openExternal('https://github.com/aroido/vibesmith/tree/main/docs');
          },
        },
        {
          label: 'Report Issue',
          click: async () => {
            await shell.openExternal('https://github.com/aroido/vibesmith/issues/new');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function normalizeRendererLogPayload(payload: unknown): RendererLogPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as Record<string, unknown>;

  if (typeof candidate.event_name !== 'string' || candidate.event_name.trim().length === 0) {
    return null;
  }

  const allowedLevels = new Set<RendererLogLevel>(['error', 'warn', 'info', 'debug']);
  const level = typeof candidate.level === 'string' && allowedLevels.has(candidate.level as RendererLogLevel)
    ? (candidate.level as RendererLogLevel)
    : 'info';

  return {
    event_name: candidate.event_name.trim(),
    level,
    attrs: candidate.attrs && typeof candidate.attrs === 'object' ? (candidate.attrs as Record<string, unknown>) : {},
    request_id: typeof candidate.request_id === 'string' ? candidate.request_id : undefined,
    trace_id: typeof candidate.trace_id === 'string' ? candidate.trace_id : undefined,
    error: candidate.error,
  };
}

function setupRendererLogBridge(): void {
  ipcMain.on('renderer-log-event', (_event, payload: unknown) => {
    const normalized = normalizeRendererLogPayload(payload);
    if (!normalized) {
      logger.logEvent(
        'renderer.log.invalid-payload',
        {
          reason: 'payload-validation-failed',
          payload_type: typeof payload,
        },
        'warn',
        {
          process: 'renderer',
          service: 'desktop-renderer',
        }
      );
      return;
    }

    logger.logEvent(normalized.event_name, normalized.attrs ?? {}, normalized.level ?? 'info', {
      process: 'renderer',
      service: 'desktop-renderer',
      requestId: normalized.request_id,
      traceId: normalized.trace_id,
      error: normalized.error,
    });
  });
}

function normalizeDebugSettingsPatchPayload(
  payload: unknown
): DebugSettingsPatchPayload {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const candidate = payload as Record<string, unknown>;
  const normalized: DebugSettingsPatchPayload = {};

  if (typeof candidate.enabled === 'boolean') {
    normalized.enabled = candidate.enabled;
  }

  if (candidate.level === 'info' || candidate.level === 'debug') {
    normalized.level = candidate.level;
  }

  if (
    candidate.expireAt === null ||
    typeof candidate.expireAt === 'string'
  ) {
    normalized.expireAt = candidate.expireAt;
  }

  if (typeof candidate.ttlHours === 'number' && Number.isFinite(candidate.ttlHours)) {
    normalized.ttlHours = candidate.ttlHours;
  }

  return normalized;
}

function normalizeDiagnosticBundleOptions(
  payload: unknown
): { anonymizePaths?: boolean; maxBundleSizeMb?: number } {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const candidate = payload as Record<string, unknown>;
  return {
    anonymizePaths:
      typeof candidate.anonymizePaths === 'boolean'
        ? candidate.anonymizePaths
        : undefined,
    maxBundleSizeMb:
      typeof candidate.maxBundleSizeMb === 'number' &&
      Number.isFinite(candidate.maxBundleSizeMb)
        ? candidate.maxBundleSizeMb
        : undefined,
  };
}

function setupDiagnosticTools(): void {
  ipcMain.handle('get-analytics-identity', () => {
    return getAnalyticsIdentity();
  });

  ipcMain.handle('get-debug-settings', () => {
    return getDebugSettings();
  });

  ipcMain.handle('set-debug-settings', (_event, payload: unknown) => {
    const patch = normalizeDebugSettingsPatchPayload(payload);
    const next = updateDebugSettings(patch);
    const effectiveDebugMode = isInternalBuildFlavor(runtimeBuildFlavor)
      ? true
      : next.enabled;

    logger.setDebugMode(effectiveDebugMode);
    logger.logEvent(
      'debug.settings.updated',
      {
        enabled: next.enabled,
        effective_enabled: effectiveDebugMode,
        level: next.level,
        expire_at: next.expireAt,
        updated_at: next.updatedAt,
        build_flavor: runtimeBuildFlavor,
      },
      'info',
      { process: 'main' }
    );

    return next;
  });

  ipcMain.handle('create-diagnostic-bundle', async (_event, payload: unknown) => {
    const options = normalizeDiagnosticBundleOptions(payload);
    return createDiagnosticBundle(options);
  });
}


/**
 * Setup auto-updater
 */
function setupAutoUpdater(): void {
  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  };

  const getUpdaterChannel = (): string | undefined => {
    const candidate = (autoUpdater as { channel?: unknown }).channel;
    return typeof candidate === 'string' && candidate.length > 0 ? candidate : undefined;
  };

  const updaterEventEmitter = autoUpdater as unknown as {
    on: (event: string, listener: () => void) => void;
  };

  // Ensure macOS "close => hide" behavior does not block updater restart flow.
  updaterEventEmitter.on('before-quit-for-update', () => {
    isQuitting = true;
    logger.logEvent('updater.install.before-quit-for-update', { source: 'auto-updater' }, 'info', {
      process: 'updater',
    });
  });

  // Auto-updater events
  autoUpdater.on('checking-for-update', () => {
    logger.logEvent(
      'updater.check.start',
      {
        channel: getUpdaterChannel(),
      },
      'info',
      { process: 'updater' }
    );
    mainWindow?.webContents.send('update-checking');
  });

  autoUpdater.on('update-available', (info) => {
    logger.logEvent(
      'updater.check.available',
      {
        version: info.version,
        release_date: info.releaseDate,
        has_release_notes: Array.isArray(info.releaseNotes)
          ? info.releaseNotes.length > 0
          : Boolean(info.releaseNotes),
        channel: getUpdaterChannel(),
      },
      'info',
      { process: 'updater' }
    );
    mainWindow?.webContents.send('update-available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    logger.logEvent(
      'updater.check.not-available',
      {
        version: info.version,
        channel: getUpdaterChannel(),
      },
      'info',
      { process: 'updater' }
    );
    mainWindow?.webContents.send('update-not-available', {
      version: info.version,
    });
  });

  autoUpdater.on('error', (error) => {
    logger.logEvent(
      'updater.error',
      {
        stage: 'event',
        channel: getUpdaterChannel(),
      },
      'error',
      { error, process: 'updater' }
    );
    mainWindow?.webContents.send('update-error', {
      message: getErrorMessage(error),
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    logger.logEvent(
      'updater.download.progress',
      {
        percent: Number(progress.percent.toFixed(2)),
        transferred: progress.transferred,
        total: progress.total,
        bytes_per_second: progress.bytesPerSecond,
      },
      'debug',
      { process: 'updater' }
    );
    mainWindow?.webContents.send('update-download-progress', {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    logger.logEvent(
      'updater.download.completed',
      {
        version: info.version,
        channel: getUpdaterChannel(),
      },
      'info',
      { process: 'updater' }
    );
    mainWindow?.webContents.send('update-downloaded', {
      version: info.version,
    });
  });

  // IPC handlers
  ipcMain.handle('check-for-updates', async () => {
    if (is.dev) {
      logger.logEvent(
        'updater.check.skipped-dev',
        {
          reason: 'development-mode',
        },
        'info',
        { process: 'updater' }
      );
      return { isDev: true, message: 'Updates are disabled in development mode' };
    }
    try {
      logger.logEvent('updater.check.requested', { source: 'ipc' }, 'info', {
        process: 'updater',
      });
      const result = await autoUpdater.checkForUpdates();
      logger.logEvent(
        'updater.check.request.success',
        {
          source: 'ipc',
          available_version: result?.updateInfo.version,
          has_update: Boolean(result?.updateInfo.version),
        },
        'info',
        { process: 'updater' }
      );
      return { success: true, version: result?.updateInfo.version };
    } catch (error) {
      logger.logEvent(
        'updater.check.request.error',
        {
          source: 'ipc',
        },
        'error',
        { error, process: 'updater' }
      );
      return { success: false, error: getErrorMessage(error) };
    }
  });

  ipcMain.handle('download-update', async () => {
    try {
      logger.logEvent('updater.download.requested', { source: 'ipc' }, 'info', {
        process: 'updater',
      });
      await autoUpdater.downloadUpdate();
      logger.logEvent('updater.download.request.success', { source: 'ipc' }, 'info', {
        process: 'updater',
      });
      return { success: true };
    } catch (error) {
      logger.logEvent(
        'updater.download.request.error',
        {
          source: 'ipc',
        },
        'error',
        { error, process: 'updater' }
      );
      return { success: false, error: getErrorMessage(error) };
    }
  });

  ipcMain.handle('quit-and-install', () => {
    isQuitting = true;
    logger.logEvent('updater.install.quit-and-install', { source: 'ipc' }, 'info', {
      process: 'updater',
    });
    // Force relaunch after install to avoid app staying terminated after update.
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('fetch-release-notes', async (_event, payload: FetchReleaseNotesPayload) => {
    const requestedVersion = typeof payload?.version === 'string' ? payload.version : '';
    return fetchReleaseNotesFromGitHub(requestedVersion);
  });

  // Check for updates on startup (production only)
  if (!is.dev) {
    // Wait 5 seconds after app starts
    logger.logEvent('updater.check.scheduled', { delay_ms: 5000 }, 'info', {
      process: 'updater',
    });
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((error) => {
        logger.logEvent(
          'updater.check.scheduled.error',
          {
            source: 'startup-timer',
          },
          'error',
          { error, process: 'updater' }
        );
      });
    }, 5000);
  }
}
