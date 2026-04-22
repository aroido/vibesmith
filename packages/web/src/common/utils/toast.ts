/**
 * Toast 알림 유틸리티
 * sonner 라이브러리 래핑
 */

import { toast as sonnerToast } from 'sonner';

const NOTIFICATION_ENABLED_KEY = 'vibesmith-notification-enabled';
const NOTIFICATION_TYPES_KEY = 'vibesmith-notification-types';

function isNotificationAllowed(type: 'success' | 'error' | 'info' | 'warning'): boolean {
  try {
    const enabled = localStorage.getItem(NOTIFICATION_ENABLED_KEY);
    if (enabled === 'false') return false;
    const typesRaw = localStorage.getItem(NOTIFICATION_TYPES_KEY);
    if (!typesRaw) return true;
    const types = JSON.parse(typesRaw) as Record<string, boolean>;
    return types[type] !== false;
  } catch {
    return true;
  }
}

/**
 * Toast 옵션
 */
export interface ToastOptions {
  /** 액션 버튼 라벨 */
  actionLabel?: string;
  /** 액션 버튼 클릭 핸들러 */
  onAction?: () => void;
  /** Toast 지속 시간 (ms) */
  duration?: number;
}

/**
 * 성공 Toast
 */
export function showSuccessToast(message: string, options?: ToastOptions) {
  if (!isNotificationAllowed('success')) return;
  return sonnerToast.success(message, {
    duration: options?.duration ?? 3000,
    action:
      options?.actionLabel && options.onAction
        ? {
            label: options.actionLabel,
            onClick: options.onAction,
          }
        : undefined,
  });
}

/**
 * 에러 Toast
 */
export function showErrorToast(message: string, options?: ToastOptions) {
  if (!isNotificationAllowed('error')) return;
  return sonnerToast.error(message, {
    duration: options?.duration ?? 5000,
    action:
      options?.actionLabel && options.onAction
        ? {
            label: options.actionLabel,
            onClick: options.onAction,
          }
        : undefined,
  });
}

/**
 * 경고 Toast
 */
export function showWarningToast(message: string, options?: ToastOptions) {
  if (!isNotificationAllowed('warning')) return;
  return sonnerToast.warning(message, {
    duration: options?.duration ?? 4000,
    action:
      options?.actionLabel && options.onAction
        ? {
            label: options.actionLabel,
            onClick: options.onAction,
          }
        : undefined,
  });
}

/**
 * 정보 Toast
 */
export function showInfoToast(message: string, options?: ToastOptions) {
  if (!isNotificationAllowed('info')) return;
  return sonnerToast.info(message, {
    duration: options?.duration ?? 3000,
    action:
      options?.actionLabel && options.onAction
        ? {
            label: options.actionLabel,
            onClick: options.onAction,
          }
        : undefined,
  });
}

/**
 * 로딩 Toast
 */
export function showLoadingToast(message: string) {
  return sonnerToast.loading(message);
}

/**
 * Toast 닫기
 */
export function dismissToast(toastId: string | number) {
  sonnerToast.dismiss(toastId);
}

/**
 * 모든 Toast 닫기
 */
export function dismissAllToasts() {
  sonnerToast.dismiss();
}

/**
 * Toast Promise 래퍼
 * 비동기 작업의 로딩/성공/실패를 자동으로 Toast로 표시
 */
export function toastPromise<T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: Error) => string);
  }
) {
  return sonnerToast.promise(promise, messages);
}

// Re-export sonner toast for advanced usage
export { toast } from 'sonner';
