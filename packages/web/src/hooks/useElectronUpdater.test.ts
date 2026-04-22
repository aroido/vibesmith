import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  captureAnalyticsException,
  trackAnalyticsEvent,
} from '@/common/analytics/desktopAnalyticsBridge';
import { getElectronAPI, isElectron } from '@/types/electron.d';
import { useElectronUpdater } from './useElectronUpdater';

vi.mock('@/common/analytics/desktopAnalyticsBridge', () => ({
  trackAnalyticsEvent: vi.fn(),
  captureAnalyticsException: vi.fn(),
}));

vi.mock('@/types/electron.d', () => ({
  isElectron: vi.fn(() => true),
  getElectronAPI: vi.fn(() => null),
}));

type UpdaterAPI = {
  checkForUpdates: ReturnType<typeof vi.fn>;
  downloadUpdate: ReturnType<typeof vi.fn>;
  quitAndInstall: ReturnType<typeof vi.fn>;
  getAppVersion: ReturnType<typeof vi.fn>;
  fetchReleaseNotes: ReturnType<typeof vi.fn>;
  onUpdateChecking: ReturnType<typeof vi.fn>;
  onUpdateAvailable: ReturnType<typeof vi.fn>;
  onUpdateNotAvailable: ReturnType<typeof vi.fn>;
  onUpdateError: ReturnType<typeof vi.fn>;
  onDownloadProgress: ReturnType<typeof vi.fn>;
  onUpdateDownloaded: ReturnType<typeof vi.fn>;
};

function createUpdaterAPI(version = '1.2.3'): UpdaterAPI {
  const createUnsubscribe = () => vi.fn();

  return {
    checkForUpdates: vi.fn().mockResolvedValue({ success: true }),
    downloadUpdate: vi.fn().mockResolvedValue({ success: true }),
    quitAndInstall: vi.fn(),
    getAppVersion: vi.fn().mockResolvedValue(version),
    fetchReleaseNotes: vi.fn().mockResolvedValue({
      success: false,
      version,
      error: 'not available',
    }),
    onUpdateChecking: vi.fn().mockImplementation(createUnsubscribe),
    onUpdateAvailable: vi.fn().mockImplementation(createUnsubscribe),
    onUpdateNotAvailable: vi.fn().mockImplementation(createUnsubscribe),
    onUpdateError: vi.fn().mockImplementation(createUnsubscribe),
    onDownloadProgress: vi.fn().mockImplementation(createUnsubscribe),
    onUpdateDownloaded: vi.fn().mockImplementation(createUnsubscribe),
  };
}

describe('useElectronUpdater', () => {
  const mockedIsElectron = vi.mocked(isElectron);
  const mockedGetElectronAPI = vi.mocked(getElectronAPI);
  const mockedTrackAnalyticsEvent = vi.mocked(trackAnalyticsEvent);
  const mockedCaptureAnalyticsException = vi.mocked(captureAnalyticsException);
  const globalWindow = window as unknown as { api?: unknown };

  beforeEach(() => {
    mockedIsElectron.mockReturnValue(true);
    mockedGetElectronAPI.mockReturnValue(null);
    delete globalWindow.api;
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete globalWindow.api;
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('window.api.updater 중첩 구조에서도 업데이트 API를 사용한다', async () => {
    const updater = createUpdaterAPI('2.0.0');
    globalWindow.api = { updater };

    const { result } = renderHook(() => useElectronUpdater());

    await waitFor(() => {
      expect(result.current.currentVersion).toBe('2.0.0');
    });

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
    expect(mockedTrackAnalyticsEvent).toHaveBeenCalledWith(
      'update_check_requested',
      expect.objectContaining({ source: 'electron_updater' })
    );
    expect(updater.onUpdateChecking).toHaveBeenCalledTimes(1);
    expect(updater.onUpdateAvailable).toHaveBeenCalledTimes(1);
    expect(updater.onUpdateNotAvailable).toHaveBeenCalledTimes(1);
    expect(updater.onUpdateError).toHaveBeenCalledTimes(1);
    expect(updater.onDownloadProgress).toHaveBeenCalledTimes(1);
    expect(updater.onUpdateDownloaded).toHaveBeenCalledTimes(1);
  });

  it('window.api 직접 노출 구조에서도 업데이트 API를 사용한다', async () => {
    const updater = createUpdaterAPI('3.1.4');
    globalWindow.api = updater;

    const { result } = renderHook(() => useElectronUpdater());

    await waitFor(() => {
      expect(result.current.currentVersion).toBe('3.1.4');
    });

    await act(async () => {
      await result.current.downloadUpdate();
    });

    expect(updater.downloadUpdate).toHaveBeenCalledTimes(1);
  });

  it('window.api가 없어도 legacy electronAPI로 폴백한다', async () => {
    const legacyUpdater = createUpdaterAPI('4.0.1');
    mockedGetElectronAPI.mockReturnValue(legacyUpdater as unknown as ReturnType<typeof getElectronAPI>);

    const { result } = renderHook(() => useElectronUpdater());

    await waitFor(() => {
      expect(result.current.currentVersion).toBe('4.0.1');
    });

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(legacyUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('updater error 이벤트를 analytics와 exception capture로 전달한다', async () => {
    const updater = createUpdaterAPI('4.2.0');
    globalWindow.api = updater;

    const { result } = renderHook(() => useElectronUpdater());

    await waitFor(() => {
      expect(result.current.currentVersion).toBe('4.2.0');
    });

    const onError = updater.onUpdateError.mock.calls[0]?.[0] as
      | ((error: { message: string }) => void)
      | undefined;

    act(() => {
      onError?.({ message: 'network timeout' });
    });

    expect(mockedTrackAnalyticsEvent).toHaveBeenCalledWith(
      'update_error',
      expect.objectContaining({
        source: 'electron_updater',
        message: 'network timeout',
      })
    );
    expect(mockedCaptureAnalyticsException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        handled_by: 'electron_updater',
        updater_stage: 'event',
      })
    );
  });

  it('quitAndInstall 호출 시 installing 상태와 pending 버전을 기록한다', async () => {
    const updater = createUpdaterAPI('5.0.0');
    globalWindow.api = updater;

    const { result } = renderHook(() => useElectronUpdater());

    await waitFor(() => {
      expect(result.current.currentVersion).toBe('5.0.0');
    });

    const onDownloaded = updater.onUpdateDownloaded.mock.calls[0]?.[0] as
      | ((info: { version: string }) => void)
      | undefined;
    expect(onDownloaded).toBeTypeOf('function');

    act(() => {
      onDownloaded?.({ version: '5.1.0' });
    });

    await act(async () => {
      await result.current.quitAndInstall();
    });

    expect(result.current.status).toBe('installing');
    expect(result.current.pendingInstallVersion).toBe('5.1.0');
    expect(window.localStorage.getItem('vibesmith.updater.pendingInstallVersion')).toBe('5.1.0');
    expect(updater.quitAndInstall).toHaveBeenCalledTimes(1);
  });

  it('재실행 후 pending 버전과 현재 버전이 같으면 완료 상태를 1회 노출한다', async () => {
    window.localStorage.setItem('vibesmith.updater.pendingInstallVersion', '6.0.0');
    window.localStorage.setItem('vibesmith.updater.pendingInstallStartedAt', String(Date.now()));

    const updater = createUpdaterAPI('6.0.0');
    globalWindow.api = updater;

    const { result } = renderHook(() => useElectronUpdater());

    await waitFor(() => {
      expect(result.current.justUpdatedVersion).toBe('6.0.0');
    });

    expect(result.current.pendingInstallVersion).toBeNull();
    expect(window.localStorage.getItem('vibesmith.updater.pendingInstallVersion')).toBeNull();
  });

  it('재실행 후 pending 버전이 일치하지 않으면 stale 상태를 정리한다', async () => {
    window.localStorage.setItem('vibesmith.updater.pendingInstallVersion', '6.1.0');
    window.localStorage.setItem('vibesmith.updater.pendingInstallStartedAt', String(Date.now()));

    const updater = createUpdaterAPI('6.0.0');
    globalWindow.api = updater;

    const { result } = renderHook(() => useElectronUpdater());

    await waitFor(() => {
      expect(result.current.pendingInstallVersion).toBeNull();
    });

    expect(result.current.justUpdatedVersion).toBeNull();
    expect(result.current.isInstalling).toBe(false);
    expect(window.localStorage.getItem('vibesmith.updater.pendingInstallVersion')).toBeNull();
  });

  it('update-available 이벤트의 배열형 releaseNotes를 문자열로 정규화한다', async () => {
    const updater = createUpdaterAPI('7.0.0');
    globalWindow.api = updater;

    const { result } = renderHook(() => useElectronUpdater());

    await waitFor(() => {
      expect(result.current.currentVersion).toBe('7.0.0');
    });

    const onAvailable = updater.onUpdateAvailable.mock.calls[0]?.[0] as
      | ((info: {
          version: string;
          releaseDate: string;
          releaseNotes: Array<{ version?: string; note?: string }>;
        }) => void)
      | undefined;

    act(() => {
      onAvailable?.({
        version: '7.1.0',
        releaseDate: '2026-02-24T00:00:00Z',
        releaseNotes: [
          { version: '7.1.0', note: '- Added in-app release notes modal' },
          { note: '- Improved updater payload normalization' },
        ],
      });
    });

    expect(result.current.status).toBe('available');
    expect(result.current.updateInfo?.version).toBe('7.1.0');
    expect(result.current.updateInfo?.releaseNotes).toContain('### 7.1.0');
    expect(result.current.updateInfo?.releaseNotes).toContain('- Added in-app release notes modal');
    expect(result.current.updateInfo?.releaseNotes).toContain(
      '- Improved updater payload normalization'
    );
  });

  it('세션 캐시에 저장된 updateInfo를 새 훅 인스턴스에서 복원한다', async () => {
    window.sessionStorage.setItem(
      'vibesmith.updater.availableUpdate',
      JSON.stringify({
        version: '8.1.0',
        releaseDate: '2026-02-25T00:00:00Z',
        releaseNotes: '## Highlights\n\n- Cached update metadata restore',
      })
    );

    const updater = createUpdaterAPI('8.0.0');
    globalWindow.api = updater;

    const { result } = renderHook(() => useElectronUpdater());

    await waitFor(() => {
      expect(result.current.status).toBe('available');
    });

    expect(result.current.updateInfo?.version).toBe('8.1.0');
    expect(result.current.updateInfo?.releaseNotes).toContain(
      'Cached update metadata restore'
    );
  });

  it('update-available 이벤트에서 releaseNotes가 비어있으면 fetchReleaseNotes 폴백을 사용한다', async () => {
    const updater = createUpdaterAPI('9.0.0');
    updater.fetchReleaseNotes.mockResolvedValue({
      success: true,
      version: 'v9.1.0-alpha.3',
      source: 'github-release-api',
      releaseNotes: '## Highlights\n\n- Pulled from GitHub releases API',
    });
    globalWindow.api = updater;

    const { result } = renderHook(() => useElectronUpdater());

    await waitFor(() => {
      expect(result.current.currentVersion).toBe('9.0.0');
    });

    const onAvailable = updater.onUpdateAvailable.mock.calls[0]?.[0] as
      | ((info: {
          version: string;
          releaseDate: string;
          releaseNotes: string;
        }) => void)
      | undefined;

    act(() => {
      onAvailable?.({
        version: '9.1.0',
        releaseDate: '2026-03-08T00:00:00Z',
        releaseNotes: '',
      });
    });

    await waitFor(() => {
      expect(updater.fetchReleaseNotes).toHaveBeenCalledWith('9.1.0');
      expect(result.current.updateInfo?.version).toBe('9.1.0-alpha.3');
      expect(result.current.updateInfo?.releaseNotes).toContain(
        'Pulled from GitHub releases API'
      );
    });
  });
});
