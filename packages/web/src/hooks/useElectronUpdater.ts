/**
 * Electron Auto-Updater Hook
 * 
 * electron-updater를 통한 자동 업데이트 관리:
 * - 업데이트 확인
 * - 다운로드 진행률 추적
 * - 업데이트 설치 및 재시작
 * 
 * @example
 * ```tsx
 * const { 
 *   checkForUpdates, 
 *   downloadUpdate, 
 *   quitAndInstall,
 *   status,
 *   updateInfo,
 *   downloadProgress 
 * } = useElectronUpdater();
 * 
 * // 업데이트 확인
 * await checkForUpdates();
 * 
 * // 다운로드
 * if (status === 'available') {
 *   await downloadUpdate();
 * }
 * 
 * // 재시작 및 설치
 * if (status === 'downloaded') {
 *   quitAndInstall();
 * }
 * ```
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  captureAnalyticsException,
  trackAnalyticsEvent,
} from '@/common/analytics/desktopAnalyticsBridge';
import {
  isElectron,
  getElectronAPI,
  type ElectronReleaseNotesFetchResult,
  type ElectronReleaseNotesPayload,
} from '@/types/electron.d';

export type UpdateStatus = 
  | 'idle'           // 초기 상태
  | 'checking'       // 업데이트 확인 중
  | 'available'      // 업데이트 사용 가능
  | 'not-available'  // 업데이트 없음
  | 'downloading'    // 다운로드 중
  | 'downloaded'     // 다운로드 완료
  | 'installing'     // 설치 진행 중
  | 'error';         // 에러 발생

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
}

export interface DownloadProgress {
  percent: number;        // 0-100
  transferred: number;    // 다운로드된 바이트
  total: number;          // 전체 바이트
  bytesPerSecond: number; // 다운로드 속도
}

type UpdaterAPI = {
  checkForUpdates: () => Promise<{ success: boolean; version?: string; isDev?: boolean; message?: string; error?: string }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  quitAndInstall: () => void | Promise<void>;
  getAppVersion: () => Promise<string>;
  fetchReleaseNotes?: (version: string) => Promise<ElectronReleaseNotesFetchResult>;
  onUpdateChecking: (callback: () => void) => () => void;
  onUpdateAvailable: (callback: (info: { version: string; releaseDate: string; releaseNotes: ElectronReleaseNotesPayload }) => void) => () => void;
  onUpdateNotAvailable: (callback: (info: { version: string }) => void) => () => void;
  onUpdateError: (callback: (error: { message: string }) => void) => () => void;
  onDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number; bytesPerSecond: number }) => void) => () => void;
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => () => void;
};

const PENDING_INSTALL_VERSION_KEY = 'vibesmith.updater.pendingInstallVersion';
const PENDING_INSTALL_STARTED_AT_KEY = 'vibesmith.updater.pendingInstallStartedAt';
const INSTALL_STATE_EVENT = 'vibesmith:updater-install-state';
const AVAILABLE_UPDATE_CACHE_KEY = 'vibesmith.updater.availableUpdate';

type InstallState = {
  pendingVersion: string | null;
  startedAt: number | null;
};

function trackUpdaterEvent(
  eventName: string,
  properties: Record<string, string | number | boolean | null> = {}
): void {
  trackAnalyticsEvent(eventName, {
    source: 'electron_updater',
    ...properties,
  });
}

function readAvailableUpdateCache(): UpdateInfo | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.sessionStorage.getItem(AVAILABLE_UPDATE_CACHE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<UpdateInfo>;
    if (typeof parsed.version !== 'string' || parsed.version.trim().length === 0) {
      return null;
    }

    return {
      version: parsed.version.trim(),
      releaseDate:
        typeof parsed.releaseDate === 'string' && parsed.releaseDate.trim().length > 0
          ? parsed.releaseDate.trim()
          : undefined,
      releaseNotes:
        typeof parsed.releaseNotes === 'string' && parsed.releaseNotes.trim().length > 0
          ? parsed.releaseNotes.trim()
          : undefined,
    };
  } catch {
    return null;
  }
}

function persistAvailableUpdateCache(info: UpdateInfo): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(
    AVAILABLE_UPDATE_CACHE_KEY,
    JSON.stringify(info)
  );
}

function clearAvailableUpdateCache(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(AVAILABLE_UPDATE_CACHE_KEY);
}

function readInstallState(): InstallState {
  if (typeof window === 'undefined') {
    return { pendingVersion: null, startedAt: null };
  }

  const pendingVersion = window.localStorage.getItem(PENDING_INSTALL_VERSION_KEY);
  const startedAtRaw = window.localStorage.getItem(PENDING_INSTALL_STARTED_AT_KEY);
  const parsedStartedAt = startedAtRaw ? Number.parseInt(startedAtRaw, 10) : Number.NaN;
  const startedAt = Number.isFinite(parsedStartedAt) ? parsedStartedAt : null;

  return {
    pendingVersion: pendingVersion || null,
    startedAt,
  };
}

function persistInstallState(state: InstallState): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (state.pendingVersion) {
    window.localStorage.setItem(PENDING_INSTALL_VERSION_KEY, state.pendingVersion);
  } else {
    window.localStorage.removeItem(PENDING_INSTALL_VERSION_KEY);
  }

  if (state.startedAt) {
    window.localStorage.setItem(PENDING_INSTALL_STARTED_AT_KEY, String(state.startedAt));
  } else {
    window.localStorage.removeItem(PENDING_INSTALL_STARTED_AT_KEY);
  }
}

function emitInstallState(state: InstallState): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<InstallState>(INSTALL_STATE_EVENT, {
      detail: state,
    })
  );
}

function isUpdaterAPI(value: unknown): value is UpdaterAPI {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<UpdaterAPI>;
  return (
    typeof candidate.checkForUpdates === 'function' &&
    typeof candidate.downloadUpdate === 'function' &&
    typeof candidate.quitAndInstall === 'function' &&
    typeof candidate.getAppVersion === 'function' &&
    typeof candidate.onUpdateChecking === 'function' &&
    typeof candidate.onUpdateAvailable === 'function' &&
    typeof candidate.onUpdateNotAvailable === 'function' &&
    typeof candidate.onUpdateError === 'function' &&
    typeof candidate.onDownloadProgress === 'function' &&
    typeof candidate.onUpdateDownloaded === 'function'
  );
}

function getUpdaterAPI(): UpdaterAPI | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const webWindow = window as Window & {
    api?: {
      updater?: unknown;
    } & Record<string, unknown>;
  };

  const customApi = webWindow.api;
  if (isUpdaterAPI(customApi)) {
    return customApi;
  }

  if (isUpdaterAPI(customApi?.updater)) {
    return customApi.updater;
  }

  const legacyAPI = getElectronAPI();
  if (isUpdaterAPI(legacyAPI)) {
    return legacyAPI;
  }

  return null;
}

function normalizeReleaseNotes(releaseNotes: ElectronReleaseNotesPayload | null | undefined): string | undefined {
  if (typeof releaseNotes === 'string') {
    const trimmed = releaseNotes.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (!Array.isArray(releaseNotes)) {
    return undefined;
  }

  const normalized = releaseNotes
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return '';
      }

      const version = typeof entry.version === 'string' ? entry.version.trim() : '';
      const note = typeof entry.note === 'string' ? entry.note.trim() : '';

      if (!note) {
        return '';
      }

      return version ? `### ${version}\n\n${note}` : note;
    })
    .filter((entry) => entry.length > 0)
    .join('\n\n');

  const trimmed = normalized.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function useElectronUpdater() {
  const [isElectronEnv, setIsElectronEnv] = useState(false);
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [pendingInstallVersion, setPendingInstallVersion] = useState<string | null>(null);
  const [installingSince, setInstallingSince] = useState<number | null>(null);
  const [justUpdatedVersion, setJustUpdatedVersion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const installRequestedInSessionRef = useRef(false);
  const releaseNotesFetchInFlightVersionsRef = useRef<Set<string>>(new Set());

  const applyInstallState = useCallback((state: InstallState) => {
    setPendingInstallVersion(state.pendingVersion);
    setInstallingSince(state.startedAt);

    const pendingVersion = state.pendingVersion;
    if (pendingVersion) {
      setStatus('installing');
      setUpdateInfo((prev) => {
        if (!prev) {
          return { version: pendingVersion };
        }
        if (prev.version === pendingVersion) {
          return prev;
        }
        return { ...prev, version: pendingVersion };
      });
      return;
    }

    setStatus((prev) => (prev === 'installing' ? 'idle' : prev));
  }, []);

  const clearInstallState = useCallback(() => {
    const clearedState: InstallState = { pendingVersion: null, startedAt: null };
    persistInstallState(clearedState);
    emitInstallState(clearedState);
    applyInstallState(clearedState);
  }, [applyInstallState]);

  const fetchReleaseNotesFallback = useCallback(
    async (api: UpdaterAPI, version: string, releaseDate?: string) => {
      if (typeof api.fetchReleaseNotes !== 'function') {
        return;
      }

      const normalizedVersion = version.trim();
      if (!normalizedVersion) {
        return;
      }

      if (releaseNotesFetchInFlightVersionsRef.current.has(normalizedVersion)) {
        return;
      }
      releaseNotesFetchInFlightVersionsRef.current.add(normalizedVersion);

      try {
        const result = await api.fetchReleaseNotes(normalizedVersion);
        if (!result.success) {
          return;
        }

        const resolvedVersionRaw =
          typeof result.version === 'string' ? result.version.trim() : '';
        const resolvedVersion =
          resolvedVersionRaw.length > 0
            ? resolvedVersionRaw.replace(/^v/i, '')
            : normalizedVersion;
        const releaseNotes =
          typeof result.releaseNotes === 'string' ? result.releaseNotes.trim() : '';
        if (!releaseNotes) {
          return;
        }

        setUpdateInfo((prev) => {
          if (
            prev &&
            prev.version !== normalizedVersion &&
            prev.version !== resolvedVersion
          ) {
            return prev;
          }

          const nextUpdateInfo: UpdateInfo = {
            version: resolvedVersion,
            releaseDate: prev?.releaseDate ?? releaseDate,
            releaseNotes,
          };
          persistAvailableUpdateCache(nextUpdateInfo);
          return nextUpdateInfo;
        });
      } catch (err) {
        console.warn('[Updater] Failed to fetch fallback release notes:', err);
      } finally {
        releaseNotesFetchInFlightVersionsRef.current.delete(normalizedVersion);
      }
    },
    []
  );

  // Electron 환경 확인 및 현재 버전 가져오기
  useEffect(() => {
    const checkEnvironment = async () => {
      const isElectronEnvironment = isElectron();
      setIsElectronEnv(isElectronEnvironment);

      if (isElectronEnvironment) {
        const api = getUpdaterAPI();
        if (api) {
          try {
            const version = await api.getAppVersion();
            setCurrentVersion(version);
          } catch (err) {
            console.error('[Updater] Failed to get app version:', err);
          }
        }
      }
    };

    void checkEnvironment();
  }, []);

  useEffect(() => {
    if (!isElectronEnv || typeof window === 'undefined') {
      return;
    }

    const persistedState = readInstallState();
    if (persistedState.pendingVersion) {
      applyInstallState(persistedState);
    }

    const onInstallState = (event: Event) => {
      const customEvent = event as CustomEvent<InstallState>;
      if (!customEvent.detail) {
        return;
      }
      applyInstallState(customEvent.detail);
    };

    const onStorage = (event: StorageEvent) => {
      if (
        event.key !== PENDING_INSTALL_VERSION_KEY &&
        event.key !== PENDING_INSTALL_STARTED_AT_KEY
      ) {
        return;
      }

      applyInstallState(readInstallState());
    };

    window.addEventListener(INSTALL_STATE_EVENT, onInstallState as EventListener);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener(INSTALL_STATE_EVENT, onInstallState as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, [isElectronEnv, applyInstallState]);

  useEffect(() => {
    if (!pendingInstallVersion || !currentVersion) {
      return;
    }

    if (pendingInstallVersion === currentVersion) {
      installRequestedInSessionRef.current = false;
      clearInstallState();
      setJustUpdatedVersion(currentVersion);
      setError(null);
      return;
    }

    // 재실행 후 버전이 일치하지 않으면 stale 상태로 간주하고 정리
    if (!installRequestedInSessionRef.current) {
      clearInstallState();
    }
  }, [pendingInstallVersion, currentVersion, clearInstallState]);

  useEffect(() => {
    if (!isElectronEnv || !updateInfo || updateInfo.releaseNotes) {
      return;
    }

    const api = getUpdaterAPI();
    if (!api) {
      return;
    }

    void fetchReleaseNotesFallback(api, updateInfo.version, updateInfo.releaseDate);
  }, [isElectronEnv, updateInfo, fetchReleaseNotesFallback]);

  useEffect(() => {
    if (!isElectronEnv || !currentVersion) {
      return;
    }

    const cached = readAvailableUpdateCache();
    if (!cached) {
      return;
    }

    if (cached.version === currentVersion) {
      clearAvailableUpdateCache();
      return;
    }

    setUpdateInfo((prev) => prev ?? cached);
    setStatus((prev) => (prev === 'idle' ? 'available' : prev));
  }, [isElectronEnv, currentVersion]);

  // Auto-updater 이벤트 리스너 등록
  useEffect(() => {
    if (!isElectronEnv) return;

    const api = getUpdaterAPI();
    if (!api) return;

    // 업데이트 확인 중
    const unsubscribeChecking = api.onUpdateChecking(() => {
      setStatus('checking');
      setError(null);
      trackUpdaterEvent('update_check_started');
    });

    // 업데이트 사용 가능
    const unsubscribeAvailable = api.onUpdateAvailable((info) => {
      const normalizedReleaseNotes = normalizeReleaseNotes(info.releaseNotes);
      const nextUpdateInfo: UpdateInfo = {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: normalizedReleaseNotes,
      };

      setStatus('available');
      setUpdateInfo(nextUpdateInfo);
      setError(null);
      persistAvailableUpdateCache(nextUpdateInfo);
      trackUpdaterEvent('update_available', {
        version: info.version,
        release_date: info.releaseDate ?? null,
      });

      if (!normalizedReleaseNotes) {
        void fetchReleaseNotesFallback(api, info.version, info.releaseDate);
      }
    });

    // 업데이트 없음
    const unsubscribeNotAvailable = api.onUpdateNotAvailable((info) => {
      setStatus('not-available');
      setUpdateInfo({ version: info.version });
      setError(null);
      clearAvailableUpdateCache();
      trackUpdaterEvent('update_not_available', {
        version: info.version,
      });
    });

    // 업데이트 에러
    const unsubscribeError = api.onUpdateError((err) => {
      setStatus('error');
      setError(err.message);
      trackUpdaterEvent('update_error', {
        message: err.message,
      });
      captureAnalyticsException(new Error(`[Updater] ${err.message}`), {
        handled_by: 'electron_updater',
        updater_stage: 'event',
      });
    });

    // 다운로드 진행률
    const unsubscribeProgress = api.onDownloadProgress((progress) => {
      setStatus('downloading');
      setDownloadProgress(progress);
      setError(null);
    });

    // 다운로드 완료
    const unsubscribeDownloaded = api.onUpdateDownloaded((info) => {
      setStatus('downloaded');
      setUpdateInfo(prev => prev ? { ...prev, version: info.version } : { version: info.version });
      setDownloadProgress(null);
      setError(null);
      trackUpdaterEvent('update_downloaded', {
        version: info.version,
      });
    });

    // Cleanup
    return () => {
      unsubscribeChecking();
      unsubscribeAvailable();
      unsubscribeNotAvailable();
      unsubscribeError();
      unsubscribeProgress();
      unsubscribeDownloaded();
    };
  }, [isElectronEnv, fetchReleaseNotesFallback]);

  /**
   * 업데이트 확인
   */
  const checkForUpdates = useCallback(async () => {
    if (!isElectronEnv) {
      console.warn('[Updater] Not in Electron environment');
      return;
    }
    if (status === 'installing') {
      return;
    }

    const api = getUpdaterAPI();
    if (!api) {
      console.error('[Updater] Updater API not available');
      return;
    }

    try {
      setStatus('checking');
      setError(null);
      trackUpdaterEvent('update_check_requested');
      
      const result = await api.checkForUpdates();
      
      if (!result.success) {
        if (result.isDev) {
          // 개발 모드에서는 에러로 처리하지 않음
          setStatus('idle');
        } else {
          setStatus('error');
          setError(result.error || 'Failed to check for updates');
          trackUpdaterEvent('update_check_failed', {
            message: result.error || 'Failed to check for updates',
          });
        }
      }
      // 이벤트 리스너에서 상태 업데이트 처리
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
      trackUpdaterEvent('update_check_failed', {
        message: err instanceof Error ? err.message : 'Unknown error',
      });
      captureAnalyticsException(err, {
        handled_by: 'electron_updater',
        updater_stage: 'check',
      });
    }
  }, [isElectronEnv, status]);

  /**
   * 업데이트 다운로드
   */
  const downloadUpdate = useCallback(async () => {
    if (!isElectronEnv) {
      console.warn('[Updater] Not in Electron environment');
      return;
    }
    if (status === 'installing') {
      return;
    }

    const api = getUpdaterAPI();
    if (!api) {
      console.error('[Updater] Updater API not available');
      return;
    }

    try {
      setStatus('downloading');
      setError(null);
      setDownloadProgress({ percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 });
      trackUpdaterEvent('update_download_requested', {
        version: updateInfo?.version ?? null,
      });
      
      const result = await api.downloadUpdate();
      
      if (!result.success) {
        setStatus('error');
        setError(result.error || 'Failed to download update');
        trackUpdaterEvent('update_download_failed', {
          version: updateInfo?.version ?? null,
          message: result.error || 'Failed to download update',
        });
      }
      // 이벤트 리스너에서 상태 업데이트 처리
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
      trackUpdaterEvent('update_download_failed', {
        version: updateInfo?.version ?? null,
        message: err instanceof Error ? err.message : 'Unknown error',
      });
      captureAnalyticsException(err, {
        handled_by: 'electron_updater',
        updater_stage: 'download',
        version: updateInfo?.version ?? null,
      });
    }
  }, [isElectronEnv, status, updateInfo?.version]);

  /**
   * 앱 재시작 및 업데이트 설치
   */
  const quitAndInstall = useCallback(async () => {
    if (!isElectronEnv) {
      console.warn('[Updater] Not in Electron environment');
      return;
    }

    const api = getUpdaterAPI();
    if (!api) {
      console.error('[Updater] Updater API not available');
      return;
    }

    const installState: InstallState = {
      pendingVersion: updateInfo?.version ?? pendingInstallVersion,
      startedAt: Date.now(),
    };

    try {
      installRequestedInSessionRef.current = true;
      persistInstallState(installState);
      emitInstallState(installState);
      applyInstallState(installState);
      setError(null);
      trackUpdaterEvent('update_install_requested', {
        version: installState.pendingVersion,
      });

      await Promise.resolve(api.quitAndInstall());
    } catch (err) {
      installRequestedInSessionRef.current = false;
      clearInstallState();
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to quit and install');
      trackUpdaterEvent('update_install_failed', {
        version: installState.pendingVersion,
        message: err instanceof Error ? err.message : 'Failed to quit and install',
      });
      captureAnalyticsException(err, {
        handled_by: 'electron_updater',
        updater_stage: 'install',
        version: installState.pendingVersion,
      });
    }
  }, [isElectronEnv, updateInfo, pendingInstallVersion, applyInstallState, clearInstallState]);

  const acknowledgeUpdateCompletion = useCallback(() => {
    setJustUpdatedVersion(null);
  }, []);

  /**
   * 상태 초기화
   */
  const reset = useCallback(() => {
    installRequestedInSessionRef.current = false;
    releaseNotesFetchInFlightVersionsRef.current.clear();
    setStatus('idle');
    setUpdateInfo(null);
    setDownloadProgress(null);
    setPendingInstallVersion(null);
    setInstallingSince(null);
    setJustUpdatedVersion(null);
    setError(null);
    clearInstallState();
    clearAvailableUpdateCache();
  }, [clearInstallState]);

  return {
    // 상태
    isElectronEnv,
    status,
    currentVersion,
    updateInfo,
    downloadProgress,
    pendingInstallVersion,
    installingSince,
    justUpdatedVersion,
    error,

    // 액션
    checkForUpdates,
    downloadUpdate,
    quitAndInstall,
    acknowledgeUpdateCompletion,
    reset,

    // 헬퍼
    isChecking: status === 'checking',
    isAvailable: status === 'available',
    isDownloading: status === 'downloading',
    isDownloaded: status === 'downloaded',
    isInstalling: status === 'installing',
    hasError: status === 'error',
  };
}
