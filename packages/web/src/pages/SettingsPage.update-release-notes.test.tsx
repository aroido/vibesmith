import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import { ThemeProvider } from '@/contexts/ThemeContext';
import { useElectronUpdater } from '@/hooks/useElectronUpdater';
import { useDesktopAnalyticsStatus } from '@/hooks/useDesktopAnalyticsStatus';
import { getConfig, removeRootPath } from '@/services/configApi';
import type { AnalyticsBridgeStatus } from '@/common/analytics/desktopAnalyticsBridge';
import { useSystemStatus } from '../features/dashboard/hooks/useDashboardData';
import { TourProvider } from '../features/onboarding';
import { SettingsPage } from './SettingsPage';

vi.mock('@/hooks/useElectronUpdater', () => ({
  useElectronUpdater: vi.fn(),
}));

vi.mock('@/hooks/useDesktopAnalyticsStatus', () => ({
  useDesktopAnalyticsStatus: vi.fn(),
}));

vi.mock('../features/dashboard/hooks/useDashboardData', () => ({
  useSystemStatus: vi.fn(),
}));

vi.mock('@/services/configApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/configApi')>();
  return {
    ...actual,
    getConfig: vi.fn(),
    removeRootPath: vi.fn(),
  };
});

const mockedUseElectronUpdater = vi.mocked(useElectronUpdater);
const mockedUseDesktopAnalyticsStatus = vi.mocked(useDesktopAnalyticsStatus);
const mockedUseSystemStatus = vi.mocked(useSystemStatus);
const mockedGetConfig = vi.mocked(getConfig);
const mockedRemoveRootPath = vi.mocked(removeRootPath);

function createAnalyticsStatus(
  overrides: Partial<AnalyticsBridgeStatus> = {}
): AnalyticsBridgeStatus {
  return {
    configured: true,
    ready: true,
    enabled: true,
    sdkCapturing: true,
    sdkOptedIn: true,
    sdkOptedOut: false,
    sdkOptOutUseragentFilter: true,
    host: 'https://us.i.posthog.com',
    appVersion: '0.5.4-alpha.11',
    releaseChannel: 'alpha',
    identityScope: 'installation',
    identityReady: true,
    maskedDistinctId: 'vbs-inst...1234',
    degradedReason: null,
    captureExceptions: true,
    captureConsoleLogs: true,
    capturePerformance: true,
    sessionRecording: true,
    replayUrl: null,
    lastSelfTestAt: null,
    lastSelfTestError: null,
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
    replayRecordingStatus: null,
    replayInternalBufferLength: null,
    replayInternalBufferSize: null,
    replayFlushedSize: null,
    replayRetryQueueSize: null,
    replayRequestQueueLength: null,
    replayRequestQueuePaused: null,
    droppedMalformedPageviews: 0,
    lastDroppedMalformedPageviewAt: null,
    lastDroppedMalformedPageviewReason: null,
    serverRemoteConfigLoaded: true,
    serverRemoteConfigError: null,
    serverSessionRecording: true,
    serverExceptionAutocapture: true,
    serverConsoleLogCapture: true,
    serverNetworkCapture: true,
    ...overrides,
  };
}

function renderSettingsPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TourProvider>
          <MemoryRouter>
            <SettingsPage />
          </MemoryRouter>
        </TourProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

describe('SettingsPage update release notes', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    delete window.api;

    mockedUseSystemStatus.mockReturnValue({
      data: {
        isLive: true,
        lastScanAt: new Date('2026-02-24T00:00:00Z'),
        activeWorkers: { watcher: true, usageScanner: true },
        healthScore: 99,
      },
    } as unknown as ReturnType<typeof useSystemStatus>);

    mockedGetConfig.mockResolvedValue({
      home_path: '~/.claude',
      cursor_global_path: '~/.cursor',
      root_paths: [],
    });
    mockedRemoveRootPath.mockResolvedValue({ root_paths: [] });
    mockedUseDesktopAnalyticsStatus.mockReturnValue({
      status: createAnalyticsStatus(),
      refreshStatus: vi.fn(),
      runSelfTest: vi.fn().mockResolvedValue({ success: true, type: 'event' }),
      isAvailable: true,
    });
  });

  it('글로벌 설정 섹션에서 Claude/Cursor 경로 입력이 모두 표시된다', async () => {
    mockedUseElectronUpdater.mockReturnValue({
      isElectronEnv: false,
      status: 'idle',
      currentVersion: '',
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
    });

    renderSettingsPage();

    await screen.findByRole('heading', {
      name: /글로벌 설정|Global Settings/i,
    });

    expect(screen.getByLabelText(/^글로벌 경로$|^Global Path$/i)).toHaveValue('~/.claude');
    expect(screen.getByLabelText(/Cursor 글로벌 경로|Cursor Global Path/i)).toHaveValue('~/.cursor');
  });

  it('라이선스/결제 섹션은 Coming Soon 상태로 CTA가 비활성화된다', async () => {
    mockedUseElectronUpdater.mockReturnValue({
      isElectronEnv: false,
      status: 'idle',
      currentVersion: '',
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
    });

    renderSettingsPage();

    expect(
      await screen.findByRole('heading', {
        name: /라이선스 및 결제|License & Billing/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/Coming Soon/i)).toBeInTheDocument();

    const manageButton = screen.getByRole('button', {
      name: /라이선스 관리|Manage license/i,
    });
    const pricingButton = screen.getByRole('button', {
      name: /플랜 보기|View plans/i,
    });

    expect(manageButton).toBeDisabled();
    expect(pricingButton).toBeDisabled();

    expect(
      screen.queryByRole('link', {
        name: /라이선스 관리|Manage license/i,
      })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', {
        name: /플랜 보기|View plans/i,
      })
    ).not.toBeInTheDocument();
  });

  it('Debug Mode가 켜져 있으면 PostHog self-test 버튼을 노출한다', async () => {
    const user = userEvent.setup();
    const runSelfTest = vi.fn().mockResolvedValue({ success: true, type: 'event' });
    mockedUseDesktopAnalyticsStatus.mockReturnValue({
      status: createAnalyticsStatus(),
      refreshStatus: vi.fn(),
      runSelfTest,
      isAvailable: true,
    });
    mockedUseElectronUpdater.mockReturnValue({
      isElectronEnv: true,
      status: 'idle',
      currentVersion: '0.5.4-alpha.11',
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
    });
    window.api = {
      getDebugSettings: vi.fn().mockResolvedValue({
        enabled: true,
        level: 'debug',
        expireAt: '2026-02-25T00:00:00Z',
        updatedAt: '2026-02-24T00:00:00Z',
      }),
    };

    renderSettingsPage();

    const sendTestEventButton = await screen.findByRole('button', {
      name: /테스트 이벤트 보내기|Send test event/i,
    });
    const sendTestExceptionButton = screen.getByRole('button', {
      name: /테스트 예외 보내기|Send test exception/i,
    });

    expect(sendTestEventButton).toBeEnabled();
    expect(sendTestExceptionButton).toBeEnabled();

    await user.click(sendTestEventButton);

    await waitFor(() => {
      expect(runSelfTest).toHaveBeenCalledWith('event');
    });
  });

  it('업데이트가 없어도 릴리즈 노트 버튼이 항상 보이고 릴리즈 페이지 폴백으로 연결된다', async () => {
    const user = userEvent.setup();

    mockedUseElectronUpdater.mockReturnValue({
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
    });

    renderSettingsPage();

    const releaseNotesButton = await screen.findByRole('button', {
      name: /변경 사항 보기|Release notes/i,
    });
    await user.click(releaseNotesButton);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByText(
        /릴리즈 노트를 불러오지 못했습니다|Release notes are not available for this version/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: /릴리즈 페이지 열기|Open release page/i,
      })
    ).toHaveAttribute(
      'href',
      'https://github.com/aroido/vibesmith/releases'
    );
  });

  it('업데이트 가능 상태에서 릴리즈 노트 모달을 열어 markdown 내용을 보여준다', async () => {
    const user = userEvent.setup();

    mockedUseElectronUpdater.mockReturnValue({
      isElectronEnv: true,
      status: 'available',
      currentVersion: '0.1.35',
      updateInfo: {
        version: '0.1.36',
        releaseDate: '2026-02-24T00:00:00Z',
        releaseNotes: '## Highlights\n\n- Added in-app release notes modal',
      },
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
      isAvailable: true,
      isDownloading: false,
      isDownloaded: false,
      isInstalling: false,
      hasError: false,
    });

    renderSettingsPage();

    const releaseNotesButton = await screen.findByRole('button', {
      name: /변경 사항 보기|Release notes/i,
    });

    await user.click(releaseNotesButton);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Added in-app release notes modal/i)).toBeInTheDocument();
  });

  it('릴리즈 노트가 비어있으면 릴리즈 페이지 링크를 폴백으로 노출한다', async () => {
    const user = userEvent.setup();

    mockedUseElectronUpdater.mockReturnValue({
      isElectronEnv: true,
      status: 'available',
      currentVersion: '0.1.35',
      updateInfo: {
        version: '0.1.36',
      },
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
      isAvailable: true,
      isDownloading: false,
      isDownloaded: false,
      isInstalling: false,
      hasError: false,
    });

    renderSettingsPage();

    await user.click(
      await screen.findByRole('button', {
        name: /변경 사항 보기|Release notes/i,
      })
    );

    expect(
      await screen.findByText(
        /릴리즈 노트를 불러오지 못했습니다|Release notes are not available for this version/i
      )
    ).toBeInTheDocument();

    const releaseLink = screen.getByRole('link', {
      name: /릴리즈 페이지 열기|Open release page/i,
    });
    expect(releaseLink).toHaveAttribute(
      'href',
      'https://github.com/aroido/vibesmith/releases/tag/v0.1.36'
    );
  });

  it('릴리즈 버전에 v-prefix/alpha가 포함되어도 릴리즈 페이지 링크를 정확히 생성한다', async () => {
    const user = userEvent.setup();

    mockedUseElectronUpdater.mockReturnValue({
      isElectronEnv: true,
      status: 'available',
      currentVersion: '0.5.3',
      updateInfo: {
        version: 'v0.5.3-alpha.119',
      },
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
      isAvailable: true,
      isDownloading: false,
      isDownloaded: false,
      isInstalling: false,
      hasError: false,
    });

    renderSettingsPage();

    await user.click(
      await screen.findByRole('button', {
        name: /변경 사항 보기|Release notes/i,
      })
    );

    const releaseLink = await screen.findByRole('link', {
      name: /릴리즈 페이지 열기|Open release page/i,
    });
    expect(releaseLink).toHaveAttribute(
      'href',
      'https://github.com/aroido/vibesmith/releases/tag/v0.5.3-alpha.119'
    );
  });

  it('다운로드 버튼은 동일 버전 릴리즈 노트 미확인 시 모달을 먼저 열고, 이후 재클릭에서 다운로드한다', async () => {
    const user = userEvent.setup();
    const downloadUpdate = vi.fn();

    mockedUseElectronUpdater.mockReturnValue({
      isElectronEnv: true,
      status: 'available',
      currentVersion: '0.1.35',
      updateInfo: {
        version: '0.1.36',
        releaseDate: '2026-02-24T00:00:00Z',
        releaseNotes: '## Highlights\n\n- Added in-app release notes modal',
      },
      downloadProgress: null,
      pendingInstallVersion: null,
      installingSince: null,
      justUpdatedVersion: null,
      error: null,
      checkForUpdates: vi.fn(),
      downloadUpdate,
      quitAndInstall: vi.fn(),
      acknowledgeUpdateCompletion: vi.fn(),
      reset: vi.fn(),
      isChecking: false,
      isAvailable: true,
      isDownloading: false,
      isDownloaded: false,
      isInstalling: false,
      hasError: false,
    });

    renderSettingsPage();

    const downloadButton = await screen.findByRole('button', {
      name: /지금 다운로드|Download now/i,
    });
    await user.click(downloadButton);

    expect(downloadUpdate).not.toHaveBeenCalled();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    await user.click(
      screen.getByRole('button', {
        name: /지금 다운로드|Download now/i,
      })
    );
    expect(downloadUpdate).toHaveBeenCalledTimes(1);
  });
});
