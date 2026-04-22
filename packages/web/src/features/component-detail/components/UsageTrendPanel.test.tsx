import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../../i18n';
import { UsageTrendPanel } from './UsageTrendPanel';
import type { ComponentUsageTimelineEntry } from '../types';

const activeTimeline: ComponentUsageTimelineEntry[] = [
  { date: '2026-02-26', count: 6, intensity: 1.0 },
  { date: '2026-02-25', count: 3, intensity: 0.5 },
  { date: '2026-02-24', count: 0, intensity: 0.0 },
  { date: '2026-02-23', count: 2, intensity: 0.33 },
  { date: '2026-02-22', count: 1, intensity: 0.16 },
  { date: '2026-02-21', count: 0, intensity: 0.0 },
  { date: '2026-02-20', count: 4, intensity: 0.66 },
];

const zeroTimeline: ComponentUsageTimelineEntry[] = [
  { date: '2026-02-26', count: 0, intensity: 0.0 },
  { date: '2026-02-25', count: 0, intensity: 0.0 },
  { date: '2026-02-24', count: 0, intensity: 0.0 },
];

const sparseTimeline: ComponentUsageTimelineEntry[] = [
  { date: '2026-02-26', count: 20, intensity: 1.0 },
  { date: '2026-02-19', count: 0, intensity: 0.0 },
  { date: '2026-02-12', count: 0, intensity: 0.0 },
];

describe('UsageTrendPanel', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ko');
  });

  it('renders integrated split view with daily heatmap and weekly bars', () => {
    render(
      <UsageTrendPanel
        usageList={activeTimeline}
        locale="ko"
        usageLoading={false}
        isUsageError={false}
        onRetry={() => {}}
      />
    );

    expect(screen.getByText(/총 사용량|Total uses/i)).toBeInTheDocument();
    expect(screen.getByText(/활성 일수|Active days/i)).toBeInTheDocument();
    expect(screen.getByText(/일별 패턴|Daily pattern/i)).toBeInTheDocument();
    expect(screen.getByText(/주간 비교|Weekly comparison/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/사용 추이 히트맵|Usage trend heatmap/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/주간 사용량 비교 막대|Weekly usage comparison bars/i)
    ).toBeInTheDocument();
  });

  it('renders zero-activity summary when all values are zero', () => {
    render(
      <UsageTrendPanel
        usageList={zeroTimeline}
        locale="ko"
        usageLoading={false}
        isUsageError={false}
        onRetry={() => {}}
      />
    );

    expect(screen.getByText(/기록 없음|No record/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/사용 추이 히트맵|Usage trend heatmap/i)).toBeInTheDocument();
    expect(screen.getByText(/활성 주 0 \/ 12|Active weeks 0 \/ 12/i)).toBeInTheDocument();
  });

  it('keeps zero-use weeks in weekly bars with range index and summary', () => {
    render(
      <UsageTrendPanel
        usageList={sparseTimeline}
        locale="ko"
        usageLoading={false}
        isUsageError={false}
        onRetry={() => {}}
      />
    );

    expect(screen.getByLabelText('02.20~02.26 20회 사용')).toBeInTheDocument();
    expect(screen.getByLabelText('02.13~02.19 0회 사용')).toBeInTheDocument();
    expect(screen.getByLabelText('02.06~02.12 0회 사용')).toBeInTheDocument();
    expect(screen.getByText('활성 주 1 / 12')).toBeInTheDocument();
  });
});
