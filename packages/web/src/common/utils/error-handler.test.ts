import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';
import {
  getErrorTypeFromStatus,
  getUserFriendlyError,
  showErrorToast,
  handleError,
  parseApiError,
} from './error-handler';
import { AppError, ErrorType } from '../types/error';

const mocks = vi.hoisted(() => ({
  captureAnalyticsException: vi.fn(),
}));

vi.mock('../analytics/desktopAnalyticsBridge', () => ({
  captureAnalyticsException: mocks.captureAnalyticsException,
}));

// sonner mock
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe('error-handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getErrorTypeFromStatus', () => {
    it('401 상태 코드는 UNAUTHORIZED를 반환한다', () => {
      expect(getErrorTypeFromStatus(401)).toBe(ErrorType.UNAUTHORIZED);
    });

    it('403 상태 코드는 FORBIDDEN을 반환한다', () => {
      expect(getErrorTypeFromStatus(403)).toBe(ErrorType.FORBIDDEN);
    });

    it('404 상태 코드는 NOT_FOUND를 반환한다', () => {
      expect(getErrorTypeFromStatus(404)).toBe(ErrorType.NOT_FOUND);
    });

    it('400-499 상태 코드는 VALIDATION을 반환한다', () => {
      expect(getErrorTypeFromStatus(400)).toBe(ErrorType.VALIDATION);
      expect(getErrorTypeFromStatus(422)).toBe(ErrorType.VALIDATION);
    });

    it('500+ 상태 코드는 SERVER를 반환한다', () => {
      expect(getErrorTypeFromStatus(500)).toBe(ErrorType.SERVER);
      expect(getErrorTypeFromStatus(503)).toBe(ErrorType.SERVER);
    });

    it('알 수 없는 상태 코드는 UNKNOWN을 반환한다', () => {
      expect(getErrorTypeFromStatus(999)).toBe(ErrorType.UNKNOWN);
    });
  });

  describe('getUserFriendlyError', () => {
    it('AppError를 사용자 친화적 메시지로 변환한다', () => {
      const error = new AppError(ErrorType.NOT_FOUND, 'Resource not found');
      const result = getUserFriendlyError(error);

      expect(result.type).toBe(ErrorType.NOT_FOUND);
      expect(result.title).toBe('리소스 없음');
      expect(result.message).toBe('요청하신 리소스를 찾을 수 없습니다.');
    });

    it('네트워크 에러를 감지한다', () => {
      const error = new TypeError('Failed to fetch');
      const result = getUserFriendlyError(error);

      expect(result.type).toBe(ErrorType.NETWORK);
      expect(result.title).toBe('네트워크 오류');
      expect(result.message).toContain('서버에 연결할 수 없습니다');
    });

    it('일반 Error를 처리한다', () => {
      const error = new Error('Something went wrong');
      const result = getUserFriendlyError(error);

      expect(result.type).toBe(ErrorType.UNKNOWN);
      expect(result.message).toBe('Something went wrong');
    });

    it('알 수 없는 에러 타입을 처리한다', () => {
      const error = 'string error';
      const result = getUserFriendlyError(error);

      expect(result.type).toBe(ErrorType.UNKNOWN);
      expect(result.message).toBe('알 수 없는 오류가 발생했습니다.');
    });
  });

  describe('showErrorToast', () => {
    it('에러를 Toast로 표시한다', () => {
      const error = new AppError(ErrorType.VALIDATION, 'Invalid input');
      showErrorToast(error);

      expect(toast.error).toHaveBeenCalledWith(
        '입력 오류',
        expect.objectContaining({
          description: 'Invalid input',
          duration: 5000,
        })
      );
    });
  });

  describe('handleError', () => {
    it('에러를 처리하고 Toast를 표시한다', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Test error');
      handleError(error);

      expect(toast.error).toHaveBeenCalled();
      expect(mocks.captureAnalyticsException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          handled_by: 'handleError',
          error_type: ErrorType.UNKNOWN,
        })
      );
      consoleSpy.mockRestore();
    });

    it('silent 옵션이 true면 Toast를 표시하지 않는다', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Test error');
      handleError(error, { silent: true });

      expect(toast.error).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('개발 환경에서는 콘솔에 에러를 출력한다', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Test error');

      handleError(error);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error caught by global handler:',
        error
      );

      consoleSpy.mockRestore();
    });
  });

  describe('parseApiError', () => {
    it('API 응답을 AppError로 변환한다', () => {
      const response = new Response(null, { status: 404 });
      const data = { message: 'Not found', details: { id: 123 } };

      const error = parseApiError(response, data);

      expect(error).toBeInstanceOf(AppError);
      expect(error.type).toBe(ErrorType.NOT_FOUND);
      expect(error.message).toBe('Not found');
      expect(error.statusCode).toBe(404);
      expect(error.details).toEqual({ id: 123 });
    });

    it('data가 없으면 기본 메시지를 사용한다', () => {
      const response = new Response(null, { status: 500 });

      const error = parseApiError(response);

      expect(error.message).toBe('알 수 없는 오류가 발생했습니다.');
    });
  });
});
