/**
 * Electron Preload Script
 * Security bridge between main and renderer processes
 */

import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

type RendererLogLevel = 'error' | 'warn' | 'info' | 'debug';

type RendererLogEventPayload = {
  event_name: string;
  level?: RendererLogLevel;
  attrs?: Record<string, unknown>;
  request_id?: string;
  trace_id?: string;
  error?: {
    code?: string;
    message?: string;
    name?: string;
    stack?: string;
  };
};

type DebugSettingsPayload = {
  enabled: boolean;
  level: 'info' | 'debug';
  expireAt: string | null;
  updatedAt: string;
};

type DebugSettingsPatchPayload = {
  enabled?: boolean;
  level?: 'info' | 'debug';
  expireAt?: string | null;
  ttlHours?: number;
};

type DiagnosticBundlePayload = {
  success: boolean;
  canceled?: boolean;
  path?: string;
  error?: string;
  sizeBytes?: number;
  fileCount?: number;
  includedFiles?: string[];
};

type ReleaseNoteItemPayload = {
  version?: string;
  note?: string;
};

type ReleaseNotesPayload = string | ReleaseNoteItemPayload[];

type AnalyticsIdentityPayload = {
  distinctId: string;
  scope: 'installation';
};

type AnalyticsMainProcessExceptionPayload = {
  source: string;
  name?: string;
  message: string;
  stack?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

const ANALYTICS_MAIN_PROCESS_EXCEPTION_CHANNEL =
  'analytics-main-process-exception';
const MAX_PENDING_ANALYTICS_MAIN_PROCESS_EXCEPTIONS = 20;
const analyticsMainProcessExceptionListeners = new Set<
  (payload: AnalyticsMainProcessExceptionPayload) => void
>();
const pendingAnalyticsMainProcessExceptions:
  AnalyticsMainProcessExceptionPayload[] = [];

function queueAnalyticsMainProcessException(
  payload: AnalyticsMainProcessExceptionPayload
): void {
  pendingAnalyticsMainProcessExceptions.push(payload);
  if (
    pendingAnalyticsMainProcessExceptions.length >
    MAX_PENDING_ANALYTICS_MAIN_PROCESS_EXCEPTIONS
  ) {
    pendingAnalyticsMainProcessExceptions.splice(
      0,
      pendingAnalyticsMainProcessExceptions.length -
        MAX_PENDING_ANALYTICS_MAIN_PROCESS_EXCEPTIONS
    );
  }
}

function dispatchAnalyticsMainProcessException(
  payload: AnalyticsMainProcessExceptionPayload
): void {
  if (analyticsMainProcessExceptionListeners.size === 0) {
    queueAnalyticsMainProcessException(payload);
    return;
  }

  analyticsMainProcessExceptionListeners.forEach((listener) => {
    listener(payload);
  });
}

function normalizeRendererLogPayload(payload: RendererLogEventPayload): RendererLogEventPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if (typeof payload.event_name !== 'string' || payload.event_name.trim().length === 0) {
    return null;
  }

  return {
    event_name: payload.event_name.trim(),
    level: payload.level,
    attrs: payload.attrs && typeof payload.attrs === 'object' ? payload.attrs : {},
    request_id: typeof payload.request_id === 'string' ? payload.request_id : undefined,
    trace_id: typeof payload.trace_id === 'string' ? payload.trace_id : undefined,
    error: payload.error && typeof payload.error === 'object' ? payload.error : undefined,
  };
}

function normalizeAnalyticsMainProcessExceptionPayload(
  payload: unknown
): AnalyticsMainProcessExceptionPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as Partial<AnalyticsMainProcessExceptionPayload>;
  if (typeof candidate.message !== 'string' || candidate.message.trim().length === 0) {
    return null;
  }

  return {
    source:
      typeof candidate.source === 'string' && candidate.source.trim().length > 0
        ? candidate.source.trim()
        : 'main_process',
    name:
      typeof candidate.name === 'string' && candidate.name.trim().length > 0
        ? candidate.name.trim()
        : undefined,
    message: candidate.message.trim(),
    stack:
      typeof candidate.stack === 'string' && candidate.stack.trim().length > 0
        ? candidate.stack
        : null,
    metadata:
      candidate.metadata && typeof candidate.metadata === 'object'
        ? candidate.metadata
        : undefined,
  };
}

ipcRenderer.on(
  ANALYTICS_MAIN_PROCESS_EXCEPTION_CHANNEL,
  (_event, payload: unknown) => {
    const normalized = normalizeAnalyticsMainProcessExceptionPayload(payload);
    if (!normalized) {
      return;
    }

    dispatchAnalyticsMainProcessException(normalized);
  }
);

// Auto-updater API
const updaterAPI = {
  // Check for updates
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  
  // Download update
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  
  // Quit and install
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  
  // Get app version
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Fetch release notes markdown for a target version (GitHub Releases API fallback)
  fetchReleaseNotes: (version: string) =>
    ipcRenderer.invoke('fetch-release-notes', { version }) as Promise<{
      success: boolean;
      version: string;
      releaseNotes?: string;
      source?: 'github-release-api';
      error?: string;
    }>,
  
  // Event listeners
  // NOTE: 리스너를 변수에 저장해 removeListener 시 동일 참조로 제거 (이슈 #342)
  onUpdateChecking: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('update-checking', listener);
    return () => ipcRenderer.removeListener('update-checking', listener);
  },
  
  onUpdateAvailable: (callback: (info: { version: string; releaseDate: string; releaseNotes: ReleaseNotesPayload }) => void) => {
    const listener: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void = (_event, info) =>
      callback(info as { version: string; releaseDate: string; releaseNotes: ReleaseNotesPayload });
    ipcRenderer.on('update-available', listener);
    return () => ipcRenderer.removeListener('update-available', listener);
  },

  onUpdateNotAvailable: (callback: (info: { version: string }) => void) => {
    const listener: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void = (_event, info) => callback(info as { version: string });
    ipcRenderer.on('update-not-available', listener);
    return () => ipcRenderer.removeListener('update-not-available', listener);
  },

  onUpdateError: (callback: (error: { message: string }) => void) => {
    const listener: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void = (_event, error) => callback(error as { message: string });
    ipcRenderer.on('update-error', listener);
    return () => ipcRenderer.removeListener('update-error', listener);
  },

  onDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number; bytesPerSecond: number }) => void) => {
    const listener: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void = (_event, progress) => callback(progress as { percent: number; transferred: number; total: number; bytesPerSecond: number });
    ipcRenderer.on('update-download-progress', listener);
    return () => ipcRenderer.removeListener('update-download-progress', listener);
  },

  onUpdateDownloaded: (callback: (info: { version: string }) => void) => {
    const listener: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void = (_event, info) => callback(info as { version: string });
    ipcRenderer.on('update-downloaded', listener);
    return () => ipcRenderer.removeListener('update-downloaded', listener);
  },
};

// Menu & shortcut IPC listeners (from main process)
const createIpcListener = (channel: string) => {
  return (callback: () => void) => {
    ipcRenderer.on(channel, callback);
    return () => ipcRenderer.removeListener(channel, callback);
  };
};

const menuShortcutAPI = {
  onMenuCheckUpdates: createIpcListener('menu-check-updates'),
  onMenuNewComponent: createIpcListener('menu-new-component'),
  onShortcutOpenSettings: createIpcListener('shortcut-open-settings'),
  onShortcutNewComponent: createIpcListener('shortcut-new-component'),
  onShortcutSearch: createIpcListener('shortcut-search'),
  onShortcutCommandPalette: createIpcListener('shortcut-command-palette'),
};

// Custom APIs for renderer
const api = {
  // Example: ping pong
  ping: () => ipcRenderer.send('ping'),

  // API server
  getApiUrl: () => ipcRenderer.invoke('get-api-url'),
  getAnalyticsIdentity: () =>
    ipcRenderer.invoke('get-analytics-identity') as Promise<AnalyticsIdentityPayload>,
  onAnalyticsMainProcessException: (
    callback: (payload: AnalyticsMainProcessExceptionPayload) => void
  ) => {
    analyticsMainProcessExceptionListeners.add(callback);
    pendingAnalyticsMainProcessExceptions.splice(0).forEach((payload) => {
      callback(payload);
    });
    return () => {
      analyticsMainProcessExceptionListeners.delete(callback);
    };
  },
  getDebugSettings: () => ipcRenderer.invoke('get-debug-settings') as Promise<DebugSettingsPayload>,
  setDebugSettings: (payload: DebugSettingsPatchPayload) =>
    ipcRenderer.invoke('set-debug-settings', payload) as Promise<DebugSettingsPayload>,
  createDiagnosticBundle: (options?: {
    anonymizePaths?: boolean;
    maxBundleSizeMb?: number;
  }) =>
    ipcRenderer.invoke('create-diagnostic-bundle', options) as Promise<DiagnosticBundlePayload>,

  // Renderer -> Main structured logging bridge
  log: (payload: RendererLogEventPayload) => {
    const normalized = normalizeRendererLogPayload(payload);
    if (!normalized) {
      return;
    }
    ipcRenderer.send('renderer-log-event', normalized);
  },

  // Auto-updater
  ...updaterAPI,
  // Backward compatibility for callers still using api.updater.*
  updater: updaterAPI,

  // Menu & shortcut IPC (renderer에서 subscribe)
  menuShortcut: menuShortcutAPI,
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
} else {
  const legacyWindow = window as Window & {
    electronAPI?: typeof electronAPI;
    api?: typeof api;
  };
  legacyWindow.electronAPI = electronAPI;
  legacyWindow.api = api;
}
