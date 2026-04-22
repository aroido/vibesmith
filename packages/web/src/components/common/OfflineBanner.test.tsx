import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import i18n from '@/i18n';
import { OfflineBanner } from './OfflineBanner';
import * as useNetworkStatusModule from '@hooks/useNetworkStatus';

// useNetworkStatus mock
vi.mock('@hooks/useNetworkStatus');

describe('OfflineBanner', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('ko');
  });

  it('온라인 상태에서는 아무것도 렌더링하지 않는다', () => {
    vi.spyOn(useNetworkStatusModule, 'useNetworkStatus').mockReturnValue({
      isOnline: true,
      isOffline: false,
      lastOnlineAt: null,
      lastOfflineAt: null,
    });

    const { container } = render(<OfflineBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('오프라인 상태에서 배너를 표시한다', () => {
    vi.spyOn(useNetworkStatusModule, 'useNetworkStatus').mockReturnValue({
      isOnline: false,
      isOffline: true,
      lastOnlineAt: null,
      lastOfflineAt: new Date(),
    });

    render(<OfflineBanner />);

    expect(
      screen.getByText(i18n.t('common:offlineMessage'))
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('오프라인 배너에 적절한 아이콘이 표시된다', () => {
    vi.spyOn(useNetworkStatusModule, 'useNetworkStatus').mockReturnValue({
      isOnline: false,
      isOffline: true,
      lastOnlineAt: null,
      lastOfflineAt: new Date(),
    });

    render(<OfflineBanner />);

    const icon = screen.getByRole('alert').querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('재연결 시 성공 메시지를 표시한다', async () => {
    const mockUseNetworkStatus = vi.spyOn(
      useNetworkStatusModule,
      'useNetworkStatus'
    );

    // 초기: 오프라인
    mockUseNetworkStatus.mockReturnValue({
      isOnline: false,
      isOffline: true,
      lastOnlineAt: null,
      lastOfflineAt: new Date(),
    });

    const { rerender } = render(<OfflineBanner />);

    expect(
      screen.getByText(i18n.t('common:offlineMessage'))
    ).toBeInTheDocument();

    // 재연결: 온라인
    mockUseNetworkStatus.mockReturnValue({
      isOnline: true,
      isOffline: false,
      lastOnlineAt: new Date(),
      lastOfflineAt: new Date(Date.now() - 5000),
    });

    rerender(<OfflineBanner />);

    await waitFor(() => {
      expect(
        screen.getByText(i18n.t('common:reconnectedMessage'))
      ).toBeInTheDocument();
    });
  });

  it.skip('재연결 메시지는 3초 후 자동으로 숨겨진다', async () => {
    vi.useFakeTimers();

    const mockUseNetworkStatus = vi.spyOn(
      useNetworkStatusModule,
      'useNetworkStatus'
    );

    // 초기: 오프라인
    mockUseNetworkStatus.mockReturnValue({
      isOnline: false,
      isOffline: true,
      lastOnlineAt: null,
      lastOfflineAt: new Date(),
    });

    const { rerender } = render(<OfflineBanner />);

    // 재연결: 온라인
    mockUseNetworkStatus.mockReturnValue({
      isOnline: true,
      isOffline: false,
      lastOnlineAt: new Date(),
      lastOfflineAt: new Date(Date.now() - 5000),
    });

    rerender(<OfflineBanner />);

    // 재연결 메시지 표시 확인
    expect(
      screen.getByText(i18n.t('common:reconnectedMessage'))
    ).toBeInTheDocument();

    // 3초 경과
    vi.advanceTimersByTime(3000);

    // 상태 변경 후 rerender
    rerender(<OfflineBanner />);

    // 메시지가 숨겨졌는지 확인
    expect(
      screen.queryByText(i18n.t('common:reconnectedMessage'))
    ).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('접근성 속성이 올바르게 설정된다', () => {
    vi.spyOn(useNetworkStatusModule, 'useNetworkStatus').mockReturnValue({
      isOnline: false,
      isOffline: true,
      lastOnlineAt: null,
      lastOfflineAt: new Date(),
    });

    render(<OfflineBanner />);

    const banner = screen.getByRole('alert');
    expect(banner).toHaveAttribute('aria-live', 'assertive');
  });
});
