/**
 * Electron API 타입 정의
 * 
 * window.electronAPI를 통해 Electron 네이티브 기능에 접근합니다.
 * 이 API는 Preload 스크립트에서 Context Bridge를 통해 안전하게 노출됩니다.
 */

export interface ElectronAPI {
  // 파일 시스템
  readFile: (path: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  writeFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>;
  selectFolder: () => Promise<{ success: boolean; data?: string; canceled?: boolean }>;

  // 윈도우 제어
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<void>;
  windowClose: () => Promise<void>;

  // 업데이트 (Auto-updater)
  checkForUpdates: () => Promise<{ success: boolean; version?: string; isDev?: boolean; message?: string; error?: string }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  quitAndInstall: () => void;
  getAppVersion: () => Promise<string>;
  fetchReleaseNotes: (version: string) => Promise<ElectronReleaseNotesFetchResult>;
  
  // 업데이트 이벤트 리스너
  onUpdateChecking: (callback: () => void) => () => void;
  onUpdateAvailable: (callback: (info: { version: string; releaseDate: string; releaseNotes: ElectronReleaseNotesPayload }) => void) => () => void;
  onUpdateNotAvailable: (callback: (info: { version: string }) => void) => () => void;
  onUpdateError: (callback: (error: { message: string }) => void) => () => void;
  onDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number; bytesPerSecond: number }) => void) => () => void;
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => () => void;

  // 테마
  setTheme: (theme: 'light' | 'dark' | 'system') => Promise<{ success: boolean }>;
  getTheme: () => Promise<{ success: boolean; data?: string }>;

  // 이벤트 리스너
  on: (channel: string, callback: (...args: unknown[]) => void) => void;
  off: (channel: string, callback: (...args: unknown[]) => void) => void;
}

export type DesktopRendererLogEvent = {
  event_name: string;
  level?: 'error' | 'warn' | 'info' | 'debug';
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

export type DesktopDebugSettings = {
  enabled: boolean;
  level: 'info' | 'debug';
  expireAt: string | null;
  updatedAt: string;
};

export type DesktopDiagnosticBundleResult = {
  success: boolean;
  canceled?: boolean;
  path?: string;
  error?: string;
  sizeBytes?: number;
  fileCount?: number;
  includedFiles?: string[];
};

export type ElectronReleaseNoteItem = {
  version?: string;
  note?: string;
};

export type ElectronReleaseNotesPayload = string | ElectronReleaseNoteItem[];

export type ElectronReleaseNotesFetchResult = {
  success: boolean;
  version: string;
  releaseNotes?: string;
  source?: 'github-release-api';
  error?: string;
};

export type DesktopAnalyticsIdentity = {
  distinctId: string;
  scope: 'installation';
};

export type DesktopAnalyticsMainProcessExceptionPayload = {
  source: string;
  name?: string;
  message: string;
  stack?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

export interface DesktopApiBridge {
  ping?: () => void;
  getApiUrl?: () => Promise<string>;
  getAnalyticsIdentity?: () => Promise<DesktopAnalyticsIdentity>;
  onAnalyticsMainProcessException?: (
    callback: (payload: DesktopAnalyticsMainProcessExceptionPayload) => void
  ) => () => void;
  log?: (event: DesktopRendererLogEvent) => void;
  getDebugSettings?: () => Promise<DesktopDebugSettings>;
  setDebugSettings?: (patch: {
    enabled?: boolean;
    level?: 'info' | 'debug';
    expireAt?: string | null;
    ttlHours?: number;
  }) => Promise<DesktopDebugSettings>;
  createDiagnosticBundle?: (options?: {
    anonymizePaths?: boolean;
    maxBundleSizeMb?: number;
  }) => Promise<DesktopDiagnosticBundleResult>;

  checkForUpdates?: () => Promise<{ success: boolean; version?: string; isDev?: boolean; message?: string; error?: string }>;
  downloadUpdate?: () => Promise<{ success: boolean; error?: string }>;
  quitAndInstall?: () => void;
  getAppVersion?: () => Promise<string>;
  fetchReleaseNotes?: (version: string) => Promise<ElectronReleaseNotesFetchResult>;

  onUpdateChecking?: (callback: () => void) => () => void;
  onUpdateAvailable?: (callback: (info: { version: string; releaseDate: string; releaseNotes: ElectronReleaseNotesPayload }) => void) => () => void;
  onUpdateNotAvailable?: (callback: (info: { version: string }) => void) => () => void;
  onUpdateError?: (callback: (error: { message: string }) => void) => () => void;
  onDownloadProgress?: (callback: (progress: { percent: number; transferred: number; total: number; bytesPerSecond: number }) => void) => () => void;
  onUpdateDownloaded?: (callback: (info: { version: string }) => void) => () => void;

  updater?: {
    checkForUpdates: () => Promise<unknown>;
    downloadUpdate?: () => Promise<unknown>;
    quitAndInstall?: () => void;
    getAppVersion?: () => Promise<string>;
    fetchReleaseNotes?: (version: string) => Promise<ElectronReleaseNotesFetchResult>;
    onUpdateChecking?: (callback: () => void) => () => void;
    onUpdateAvailable?: (callback: (info: { version: string; releaseDate: string; releaseNotes: ElectronReleaseNotesPayload }) => void) => () => void;
    onUpdateNotAvailable?: (callback: (info: { version: string }) => void) => () => void;
    onUpdateError?: (callback: (error: { message: string }) => void) => () => void;
    onDownloadProgress?: (callback: (progress: { percent: number; transferred: number; total: number; bytesPerSecond: number }) => void) => () => void;
    onUpdateDownloaded?: (callback: (info: { version: string }) => void) => () => void;
  };

  menuShortcut?: {
    onMenuCheckUpdates: (cb: () => void) => () => void;
    onMenuNewComponent: (cb: () => void) => () => void;
    onShortcutOpenSettings: (cb: () => void) => () => void;
    onShortcutNewComponent: (cb: () => void) => () => void;
    onShortcutSearch: (cb: () => void) => () => void;
    onShortcutCommandPalette: (cb: () => void) => () => void;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    api?: DesktopApiBridge;
    __vibesmithAnalytics?: {
      track: (eventName: string, properties?: Record<string, string | number | boolean | null>) => void;
      isEnabled: () => boolean;
      refreshStatus?: () => {
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
      getStatus?: () => {
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
      forceFlush?: () => Promise<{
        success: boolean;
        eventRequestsFlushed: number;
        replayRequestsFlushed: number;
        error?: string;
      }>;
      runSelfTest?: (
        type: 'event' | 'exception'
      ) => Promise<{ success: boolean; type: 'event' | 'exception'; error?: string }>;
      captureException?: (
        error: unknown,
        additionalProperties?: Record<string, string | number | boolean | null>
      ) => void;
    };
  }
}

/**
 * Electron 환경인지 확인하는 유틸리티
 */
export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && window.electronAPI !== undefined;
};

/**
 * Electron API 안전하게 가져오기
 */
export const getElectronAPI = (): ElectronAPI | null => {
  if (isElectron()) {
    return window.electronAPI!;
  }
  return null;
};
