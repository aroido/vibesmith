import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';

import { useElectronUpdater } from '@/hooks/useElectronUpdater';
import { UpdateNotification } from './UpdateNotification';
import { RELEASE_NOTES_REQUEST_VERSION_KEY } from './releaseNotesBridge';

vi.mock('@/hooks/useElectronUpdater', () => ({
  useElectronUpdater: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}));

const mockedUseElectronUpdater = vi.mocked(useElectronUpdater);

function mockUpdaterState(
  overrides: Partial<ReturnType<typeof useElectronUpdater>> = {}
): ReturnType<typeof useElectronUpdater> {
  return {
    isElectronEnv: true,
    status: 'idle',
    currentVersion: '0.3.0',
    updateInfo: null,
    downloadProgress: null,
    pendingInstallVersion: null,
    installingSince: null,
    justUpdatedVersion: null,
    error: null,
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
    acknowledgeUpdateCompletion: vi.fn(),
    reset: vi.fn(),
    isChecking: false,
    isAvailable: false,
    isDownloading: false,
    isDownloaded: false,
    isInstalling: false,
    hasError: false,
    ...overrides,
  };
}

describe('UpdateNotification release notes action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.location.hash = '';
  });

  it('업데이트 가능 토스트에서 변경 사항 보기 액션이 Settings 이동 및 릴리즈 노트 오픈 요청을 전달한다', () => {
    const downloadUpdate = vi.fn();

    mockedUseElectronUpdater.mockReturnValue(
      mockUpdaterState({
        status: 'available',
        updateInfo: {
          version: '0.3.1',
          releaseDate: '2026-02-25T00:00:00Z',
          releaseNotes: '## Highlights\\n\\n- Added release notes bridge',
        },
        isAvailable: true,
        downloadUpdate,
      })
    );

    render(<UpdateNotification />);

    expect(toast.info).toHaveBeenCalledTimes(1);
    const options = vi.mocked(toast.info).mock.calls[0]?.[1] as
      | {
          action?: { onClick: () => void };
          cancel?: { onClick: () => void };
        }
      | undefined;

    expect(options?.action).toBeDefined();
    expect(options?.cancel).toBeDefined();

    options?.action?.onClick();
    expect(downloadUpdate).toHaveBeenCalledTimes(1);

    options?.cancel?.onClick();
    expect(window.sessionStorage.getItem(RELEASE_NOTES_REQUEST_VERSION_KEY)).toBe(
      '0.3.1'
    );
    expect(window.location.hash).toBe('#/settings');
    expect(toast.dismiss).toHaveBeenCalledWith('update-available');
  });
});
