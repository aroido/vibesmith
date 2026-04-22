import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

const mocks = vi.hoisted(() => ({
  captureAnalyticsException: vi.fn(),
}));

vi.mock('@/common/analytics/desktopAnalyticsBridge', () => ({
  captureAnalyticsException: mocks.captureAnalyticsException,
}));

function ThrowError(): null {
  throw new Error('Boundary boom');
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    mocks.captureAnalyticsException.mockClear();
  });

  it('에러가 없을 때 자식 컴포넌트를 정상적으로 렌더링한다', () => {
    render(
      <ErrorBoundary>
        <div>No error</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('커스텀 폴백 컴포넌트를 렌더링한다', () => {
    const CustomFallback = () => <div>Custom error message</div>;

    render(
      <ErrorBoundary fallback={<CustomFallback />}>
        <div>Content</div>
      </ErrorBoundary>
    );

    // 에러가 없을 때는 자식 컴포넌트가 렌더링됨
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('폴백 함수를 prop으로 받을 수 있다', () => {
    const fallbackFn = () => <div>Fallback from function</div>;

    render(
      <ErrorBoundary fallback={fallbackFn}>
        <div>Content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('포착한 렌더링 에러를 analytics 브리지로 전달한다', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('오류가 발생했습니다')).toBeInTheDocument();
    expect(mocks.captureAnalyticsException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        handled_by: 'react_error_boundary',
      })
    );

    consoleSpy.mockRestore();
  });
});
