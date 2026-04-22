import { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureAnalyticsException } from '@/common/analytics/desktopAnalyticsBridge';
import i18n from '@/i18n';

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, errorInfo: ErrorInfo) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
};

/**
 * React Error Boundary 컴포넌트
 * 
 * 자식 컴포넌트 트리에서 발생하는 JavaScript 에러를 포착하고,
 * 에러를 로깅하며, 폴백 UI를 표시합니다.
 * 
 * @example
 * ```tsx
 * <ErrorBoundary fallback={<ErrorFallback />}>
 *   <App />
 * </ErrorBoundary>
 * ```
 * 
 * @example
 * ```tsx
 * <ErrorBoundary
 *   fallback={(error, errorInfo) => (
 *     <div>
 *       <h1>오류가 발생했습니다</h1>
 *       <pre>{error.message}</pre>
 *     </div>
 *   )}
 *   onError={(error, errorInfo) => {
 *     console.error('Error caught by boundary:', error, errorInfo);
 *   }}
 * >
 *   <App />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // 다음 렌더링에서 폴백 UI를 표시하도록 상태 업데이트
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 에러 정보를 상태에 저장
    this.setState({
      error,
      errorInfo,
    });

    // 에러 로깅 (콘솔 또는 외부 서비스)
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    captureAnalyticsException(error, {
      handled_by: 'react_error_boundary',
      pathname: typeof window !== 'undefined' ? window.location.pathname : null,
      component_stack: errorInfo.componentStack || null,
    });

    // 커스텀 에러 핸들러 호출
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // 폴백 UI 렌더링
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(
          this.state.error,
          this.state.errorInfo ?? { componentStack: '' }
        );
      }

      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 기본 폴백 UI
      return (
        <div className="flex min-h-screen items-center justify-center bg-theme-canvas p-4">
          <div className="w-full max-w-md rounded-lg bg-theme-surface border border-theme p-6 shadow-lg">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full alert-theme-danger">
                <svg
                  className="h-6 w-6 text-theme-danger"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-theme-primary">
                {i18n.t('common:errorOccurred')}
              </h2>
            </div>
            <p className="mb-4 text-sm text-theme-secondary">
              {i18n.t('common:errorUnexpected')}
            </p>
            <details className="mb-4">
              <summary className="cursor-pointer text-sm font-medium text-theme-secondary">
                {i18n.t('common:errorDetails')}
              </summary>
              <div className="mt-2 rounded bg-theme-elevated border border-theme p-3">
                <p className="mb-2 text-xs font-semibold text-theme-primary">
                  {this.state.error.name}: {this.state.error.message}
                </p>
                <pre className="overflow-x-auto text-xs text-theme-secondary">
                  {this.state.errorInfo?.componentStack ?? i18n.t('common:stackTraceNotAvailable')}
                </pre>
              </div>
            </details>
            <button
              onClick={() => window.location.reload()}
              className="w-full rounded-lg btn-theme-primary-soft px-4 py-2 text-sm font-medium"
            >
              {i18n.t('common:refreshPage')}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
