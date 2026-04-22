/**
 * MonitoringSettings tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MonitoringSettings } from '../components/MonitoringSettings';
import type { AnalyticsBridgeStatus } from '@/common/analytics/desktopAnalyticsBridge';
import { STORAGE_KEYS } from '../types';

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
    appVersion: '0.5.4-alpha.8',
    releaseChannel: 'alpha',
    identityScope: 'installation',
    identityReady: true,
    maskedDistinctId: 'ph_disti..._123',
    degradedReason: null,
    captureExceptions: true,
    captureConsoleLogs: true,
    capturePerformance: true,
    sessionRecording: true,
    replayUrl: 'https://app.posthog.com/project/1/replay/example',
    lastSelfTestAt: null,
    lastSelfTestError: null,
    lastEventCaptureAt: '2026-03-20T10:00:00.000Z',
    lastEventName: 'app_opened',
    lastExceptionCaptureAt: null,
    eventTransportSeen: true,
    replayTransportSeen: true,
    lastEventTransportAt: '2026-03-20T10:00:01.000Z',
    lastReplayTransportAt: '2026-03-20T10:00:02.000Z',
    lastTransportMethod: 'fetch',
    lastTransportStatus: 200,
    lastTransportError: null,
    lastInternalRequestUrl: 'https://us.i.posthog.com/i/v0/e/',
    lastInternalRequestBatchKey: 'events',
    lastInternalRequestKind: 'event',
    lastQueuedRequestUrl: 'https://us.i.posthog.com/s/',
    lastQueuedRequestBatchKey: 'recordings',
    lastQueuedRequestKind: 'replay',
    lastInternalCaptureEvent: 'app_opened',
    replayRecordingStatus: 'active',
    replayInternalBufferLength: 1,
    replayInternalBufferSize: 256,
    replayFlushedSize: 256,
    replayRetryQueueSize: 0,
    replayRequestQueueLength: 0,
    replayRequestQueuePaused: false,
    droppedMalformedPageviews: 2,
    lastDroppedMalformedPageviewAt: '2026-03-21T02:00:00.000Z',
    lastDroppedMalformedPageviewReason: 'missing_route',
    serverRemoteConfigLoaded: true,
    serverRemoteConfigError: null,
    serverSessionRecording: true,
    serverExceptionAutocapture: true,
    serverConsoleLogCapture: true,
    serverNetworkCapture: true,
    ...overrides,
  };
}

describe('MonitoringSettings', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    delete window.__vibesmithAnalytics;
  });

  it('renders monitoring section with crash reporting, performance, and analytics toggles', () => {
    const { getByRole, getByText } = render(<MonitoringSettings />);
    expect(
      getByRole('heading', {
        name: /개인정보 및 진단|Privacy and diagnostics/i,
      })
    ).toBeInTheDocument();
    expect(
      getByText(
        /모든 항목은 언제든지 끌 수 있습니다|You can turn all of these off at any time/i
      )
    ).toBeInTheDocument();
    const crashCheckbox = getByRole('checkbox', {
      name: /문제 리포트|Crash reports/i,
    });
    expect(crashCheckbox).toBeInTheDocument();
    expect(crashCheckbox).toBeChecked();
    const perfCheckbox = getByRole('checkbox', {
      name: /성능 진단 데이터|Performance diagnostics/i,
    });
    expect(perfCheckbox).toBeInTheDocument();
    expect(perfCheckbox).toBeChecked();
    const analyticsCheckbox = getByRole('checkbox', {
      name: /사용 통계|Usage analytics/i,
    });
    expect(analyticsCheckbox).toBeInTheDocument();
    expect(analyticsCheckbox).toBeChecked();
  });

  it('toggles crash reporting and persists to localStorage', async () => {
    const user = userEvent.setup();
    const { getByRole } = render(<MonitoringSettings />);
    const checkbox = getByRole('checkbox', {
      name: /문제 리포트|Crash reports/i,
    });
    await user.click(checkbox);
    expect(localStorage.getItem(STORAGE_KEYS.monitoringCrashReporting)).toBe(
      'false'
    );
    await user.click(checkbox);
    expect(localStorage.getItem(STORAGE_KEYS.monitoringCrashReporting)).toBe(
      'true'
    );
  });

  it('toggles performance monitoring and persists to localStorage', async () => {
    const user = userEvent.setup();
    const { getByRole } = render(<MonitoringSettings />);
    const checkbox = getByRole('checkbox', {
      name: /성능 진단 데이터|Performance diagnostics/i,
    });
    await user.click(checkbox);
    expect(localStorage.getItem(STORAGE_KEYS.monitoringPerformance)).toBe(
      'false'
    );
  });

  it('toggles usage analytics and persists to localStorage', async () => {
    const user = userEvent.setup();
    const { getByRole } = render(<MonitoringSettings />);
    const checkbox = getByRole('checkbox', {
      name: /사용 통계|Usage analytics/i,
    });
    await user.click(checkbox);
    expect(localStorage.getItem(STORAGE_KEYS.monitoringAnalytics)).toBe('false');
    await user.click(checkbox);
    expect(localStorage.getItem(STORAGE_KEYS.monitoringAnalytics)).toBe('true');
  });

  it('renders read-only PostHog desktop status in Electron mode without self-test controls', () => {
    const analyticsStatus = createAnalyticsStatus();

    const { getByText, getByRole, queryByRole } = render(
      <MonitoringSettings
        analyticsStatus={analyticsStatus}
        isElectronEnv
      />
    );

    expect(
      getByText(/PostHog 데스크톱 상태|PostHog Desktop Status/i)
    ).toBeInTheDocument();
    expect(getByText('ph_disti..._123')).toBeInTheDocument();
    expect(
      getByRole('link', {
        name: /현재 리플레이 열기|Open current replay/i,
      })
    ).toHaveAttribute(
      'href',
      'https://app.posthog.com/project/1/replay/example'
    );
    expect(getByText('app_opened')).toBeInTheDocument();
    expect(getByText('2')).toBeInTheDocument();
    expect(
      getByText(/route 속성이 없습니다|Missing route property/i)
    ).toBeInTheDocument();
    expect(getByText(/2026|3\/21\/2026|21\/3\/2026/)).toBeInTheDocument();
    expect(
      queryByRole('button', {
        name: /테스트 이벤트 보내기|Send test event/i,
      })
    ).not.toBeInTheDocument();
    expect(
      queryByRole('button', {
        name: /테스트 예외 보내기|Send test exception/i,
      })
    ).not.toBeInTheDocument();
  });

  it('fails closed when monitoring storage is unavailable', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage_unavailable');
    });

    const { getByRole } = render(<MonitoringSettings />);

    expect(
      getByRole('checkbox', {
        name: /문제 리포트|Crash reports/i,
      })
    ).not.toBeChecked();
    expect(
      getByRole('checkbox', {
        name: /성능 진단 데이터|Performance diagnostics/i,
      })
    ).not.toBeChecked();
    expect(
      getByRole('checkbox', {
        name: /사용 통계|Usage analytics/i,
      })
    ).not.toBeChecked();
  });
});
