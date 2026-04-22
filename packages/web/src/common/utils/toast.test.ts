/**
 * Toast 유틸리티 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';
import {
  showSuccessToast,
  showErrorToast,
  showWarningToast,
  showInfoToast,
  showLoadingToast,
  dismissToast,
  dismissAllToasts,
  toastPromise,
} from './toast';

// sonner mock
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    promise: vi.fn(),
  },
}));

describe('Toast Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('showSuccessToast', () => {
    it('기본 성공 Toast를 표시한다', () => {
      showSuccessToast('저장되었습니다');

      expect(toast.success).toHaveBeenCalledWith('저장되었습니다', {
        duration: 3000,
        action: undefined,
      });
    });

    it('액션 버튼이 있는 성공 Toast를 표시한다', () => {
      const onAction = vi.fn();
      showSuccessToast('저장되었습니다', {
        actionLabel: '되돌리기',
        onAction,
      });

      expect(toast.success).toHaveBeenCalledWith('저장되었습니다', {
        duration: 3000,
        action: {
          label: '되돌리기',
          onClick: onAction,
        },
      });
    });

    it('커스텀 duration을 사용한다', () => {
      showSuccessToast('저장되었습니다', { duration: 5000 });

      expect(toast.success).toHaveBeenCalledWith('저장되었습니다', {
        duration: 5000,
        action: undefined,
      });
    });
  });

  describe('showErrorToast', () => {
    it('기본 에러 Toast를 표시한다', () => {
      showErrorToast('저장에 실패했습니다');

      expect(toast.error).toHaveBeenCalledWith('저장에 실패했습니다', {
        duration: 5000,
        action: undefined,
      });
    });

    it('액션 버튼이 있는 에러 Toast를 표시한다', () => {
      const onAction = vi.fn();
      showErrorToast('저장에 실패했습니다', {
        actionLabel: '재시도',
        onAction,
      });

      expect(toast.error).toHaveBeenCalledWith('저장에 실패했습니다', {
        duration: 5000,
        action: {
          label: '재시도',
          onClick: onAction,
        },
      });
    });
  });

  describe('showWarningToast', () => {
    it('경고 Toast를 표시한다', () => {
      showWarningToast('이 작업은 되돌릴 수 없습니다');

      expect(toast.warning).toHaveBeenCalledWith(
        '이 작업은 되돌릴 수 없습니다',
        {
          duration: 4000,
          action: undefined,
        }
      );
    });
  });

  describe('showInfoToast', () => {
    it('정보 Toast를 표시한다', () => {
      showInfoToast('스캔이 시작되었습니다');

      expect(toast.info).toHaveBeenCalledWith('스캔이 시작되었습니다', {
        duration: 3000,
        action: undefined,
      });
    });
  });

  describe('showLoadingToast', () => {
    it('로딩 Toast를 표시한다', () => {
      showLoadingToast('로딩 중...');

      expect(toast.loading).toHaveBeenCalledWith('로딩 중...');
    });
  });

  describe('dismissToast', () => {
    it('특정 Toast를 닫는다', () => {
      dismissToast('toast-1');

      expect(toast.dismiss).toHaveBeenCalledWith('toast-1');
    });
  });

  describe('dismissAllToasts', () => {
    it('모든 Toast를 닫는다', () => {
      dismissAllToasts();

      expect(toast.dismiss).toHaveBeenCalledWith();
    });
  });

  describe('toastPromise', () => {
    it('Promise의 로딩/성공/실패를 Toast로 표시한다', () => {
      const promise = Promise.resolve('success');
      const messages = {
        loading: '로딩 중...',
        success: '성공했습니다',
        error: '실패했습니다',
      };

      toastPromise(promise, messages);

      expect(toast.promise).toHaveBeenCalledWith(promise, messages);
    });
  });
});
