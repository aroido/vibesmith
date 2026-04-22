/**
 * OnboardingTour 테스트
 * driver.js 기반 구현에 맞춘 동작 검증
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingTour } from './OnboardingTour';
import { TourProvider } from '../contexts/TourContext';

// driver.js가 렌더하는 DOM 구조
const DRIVER_POPOVER_SELECTOR = '.driver-popover';
const DRIVER_POPOVER_TITLE = '.driver-popover-title';

// driver.js mock - onDestroyed 콜백 캡처 및 트리거
let mockGetActiveIndex: () => number = () => 0;

vi.mock('driver.js', () => ({
  driver: (config: { onDestroyed?: () => void; [key: string]: unknown }) => {
    return {
      drive: () => {
        // drive 호출 시 popover와 유사한 DOM 생성 (실제 driver는 body에 주입)
        const popover = document.createElement('div');
        popover.className = 'driver-popover vibesmith-tour-popover';
        popover.id = 'driver-popover-content';
        const title = document.createElement('div');
        title.className = 'driver-popover-title';
        title.textContent = 'VibeSmith에 오신 것을 환영합니다!';
        popover.appendChild(title);
        const progress = document.createElement('span');
        progress.className = 'driver-popover-progress-text';
        progress.textContent = '1/5';
        popover.appendChild(progress);
        const closeBtn = document.createElement('button');
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.className = 'driver-popover-close-btn';
        closeBtn.addEventListener('click', () => {
          config.onDestroyed?.();
        });
        popover.appendChild(closeBtn);
        const nextBtn = document.createElement('button');
        nextBtn.className = 'driver-popover-next-btn';
        nextBtn.textContent = '다음';
        popover.appendChild(nextBtn);
        document.body.appendChild(popover);
      },
      destroy: () => {
        config.onDestroyed?.();
        document.querySelectorAll('.driver-popover').forEach((el) => el.remove());
      },
      getActiveIndex: () => mockGetActiveIndex(),
    };
  },
}));

// CSS import 무시
vi.mock('driver.js/dist/driver.css', () => ({}));

describe('OnboardingTour', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockGetActiveIndex = () => 0;
  });

  it('should display tour popover on first visit', async () => {
    render(
      <TourProvider>
        <OnboardingTour />
      </TourProvider>
    );

    await waitFor(() => {
      expect(document.querySelector(DRIVER_POPOVER_SELECTOR)).toBeInTheDocument();
    });

    expect(document.querySelector(DRIVER_POPOVER_TITLE)).toHaveTextContent(
      'VibeSmith에 오신 것을 환영합니다!'
    );
    expect(screen.getByText(/1\/5/)).toBeInTheDocument();
  });

  it('should not display tour when already completed', async () => {
    localStorage.setItem(
      'vibesmith_onboarding_status',
      JSON.stringify({
        completed: true,
        completedAt: new Date().toISOString(),
        skipped: false,
      })
    );

    render(
      <TourProvider>
        <OnboardingTour />
      </TourProvider>
    );

    await waitFor(() => {
      expect(document.querySelector(DRIVER_POPOVER_SELECTOR)).toBeNull();
    });
  });

  it('should not display tour when skipped', async () => {
    localStorage.setItem(
      'vibesmith_onboarding_status',
      JSON.stringify({
        completed: false,
        skipped: true,
        skippedAt: new Date().toISOString(),
      })
    );

    render(
      <TourProvider>
        <OnboardingTour />
      </TourProvider>
    );

    await waitFor(() => {
      expect(document.querySelector(DRIVER_POPOVER_SELECTOR)).toBeNull();
    });
  });

  it('should call skip when close button clicked on non-final step', async () => {
    const user = userEvent.setup();
    mockGetActiveIndex = () => 0; // 첫 단계에서 닫기

    render(
      <TourProvider>
        <OnboardingTour />
      </TourProvider>
    );

    await waitFor(() => {
      expect(document.querySelector(DRIVER_POPOVER_SELECTOR)).toBeInTheDocument();
    });

    const closeBtn = screen.getByRole('button', { name: /close/i });
    await user.click(closeBtn);

    await waitFor(() => {
      const status = JSON.parse(localStorage.getItem('vibesmith_onboarding_status') ?? '{}');
      expect(status.skipped).toBe(true);
      expect(status.completed).toBe(false);
    });
  });

  it('should call complete when close/done on final step', async () => {
    const user = userEvent.setup();
    mockGetActiveIndex = () => 4; // 마지막 단계 (5단계, index 4)

    render(
      <TourProvider>
        <OnboardingTour />
      </TourProvider>
    );

    await waitFor(() => {
      expect(document.querySelector(DRIVER_POPOVER_SELECTOR)).toBeInTheDocument();
    });

    // mock의 close 버튼 클릭 시 onDestroyed 호출
    const closeBtn = screen.getByRole('button', { name: /close/i });
    await user.click(closeBtn);

    await waitFor(() => {
      const status = JSON.parse(localStorage.getItem('vibesmith_onboarding_status') ?? '{}');
      expect(status.completed).toBe(true);
      expect(status.skipped).toBe(false);
    });
  });
});
