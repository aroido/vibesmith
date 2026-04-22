import { toast } from 'sonner';
import i18n from '../../i18n';
import { captureAnalyticsException } from '../analytics/desktopAnalyticsBridge';
import { AppError, ErrorType, type UserFriendlyError } from '../types/error';

type RendererLogLevel = 'error' | 'warn' | 'info' | 'debug';

type RendererLogPayload = {
  event_name: string;
  level?: RendererLogLevel;
  attrs?: Record<string, unknown>;
  request_id?: string;
  trace_id?: string;
  error?: {
    message?: string;
    code?: string;
    name?: string;
    stack?: string;
  };
};

type HandleErrorOptions = {
  silent?: boolean;
  requestId?: string;
  traceId?: string;
  eventName?: string;
  context?: Record<string, unknown>;
};

function generateCorrelationId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function getCorrelationIdFromDetails(
  details: Record<string, unknown> | undefined,
  key: 'request_id' | 'trace_id'
): string | undefined {
  if (!details) {
    return undefined;
  }

  const value = details[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function toRendererLogError(error: unknown): RendererLogPayload['error'] | undefined {
  if (error instanceof Error) {
    const codeCandidate = (error as { code?: unknown }).code;
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
      code:
        typeof codeCandidate === 'string' || typeof codeCandidate === 'number'
          ? String(codeCandidate)
          : undefined,
    };
  }

  if (typeof error === 'object' && error !== null) {
    const candidate = error as Record<string, unknown>;
    return {
      message: typeof candidate.message === 'string' ? candidate.message : JSON.stringify(candidate),
      name: typeof candidate.name === 'string' ? candidate.name : undefined,
      stack: typeof candidate.stack === 'string' ? candidate.stack : undefined,
      code:
        typeof candidate.code === 'string' || typeof candidate.code === 'number'
          ? String(candidate.code)
          : undefined,
    };
  }

  if (error === undefined || error === null) {
    return undefined;
  }

  return {
    message: String(error),
  };
}

function sendRendererLog(payload: RendererLogPayload): void {
  if (typeof window === 'undefined') {
    return;
  }

  const win = window as Window & {
    api?: {
      log?: (event: RendererLogPayload) => void;
    };
  };

  if (typeof win.api?.log !== 'function') {
    return;
  }

  try {
    win.api.log(payload);
  } catch (bridgeError) {
    if (import.meta.env.DEV) {
      console.warn('[RendererLog] Failed to send renderer log event:', bridgeError);
    }
  }
}

/**
 * HTTP 상태 코드를 ErrorType으로 변환
 */
export function getErrorTypeFromStatus(status: number): ErrorType {
  if (status === 401) return ErrorType.UNAUTHORIZED;
  if (status === 403) return ErrorType.FORBIDDEN;
  if (status === 404) return ErrorType.NOT_FOUND;
  if (status >= 400 && status < 500) return ErrorType.VALIDATION;
  if (status >= 500 && status < 600) return ErrorType.SERVER;
  return ErrorType.UNKNOWN;
}

/**
 * 에러를 사용자 친화적 메시지로 변환
 */
export function getUserFriendlyError(error: unknown): UserFriendlyError {
  // AppError인 경우
  if (error instanceof AppError) {
    return getMessageByErrorType(error.type, error.message);
  }

  // 네트워크 에러인 경우
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return {
      type: ErrorType.NETWORK,
      title: i18n.t('common:errors.network.title'),
      message: i18n.t('common:errors.network.message'),
      action: i18n.t('common:errors.network.action'),
    };
  }

  // 일반 Error인 경우
  if (error instanceof Error) {
    return {
      type: ErrorType.UNKNOWN,
      title: i18n.t('common:errors.unknown.title'),
      message: error.message || i18n.t('common:errors.unknown.message'),
      action: i18n.t('common:errors.unknown.action'),
    };
  }

  // 그 외의 경우
  return {
    type: ErrorType.UNKNOWN,
    title: i18n.t('common:errors.unknown.title'),
    message: i18n.t('common:errors.unknown.message'),
    action: i18n.t('common:errors.unknown.action'),
  };
}

/**
 * ErrorType에 따른 사용자 친화적 메시지 반환
 */
function getMessageByErrorType(type: ErrorType, originalMessage?: string): UserFriendlyError {
  switch (type) {
    case ErrorType.NETWORK:
      return {
        type,
        title: i18n.t('common:errors.network.title'),
        message: i18n.t('common:errors.network.message'),
        action: i18n.t('common:errors.network.action'),
      };

    case ErrorType.UNAUTHORIZED:
      return {
        type,
        title: i18n.t('common:errors.unauthorized.title'),
        message: i18n.t('common:errors.unauthorized.message'),
        action: i18n.t('common:errors.unauthorized.action'),
      };

    case ErrorType.FORBIDDEN:
      return {
        type,
        title: i18n.t('common:errors.forbidden.title'),
        message: i18n.t('common:errors.forbidden.message'),
        action: i18n.t('common:errors.forbidden.action'),
      };

    case ErrorType.NOT_FOUND:
      return {
        type,
        title: i18n.t('common:errors.notFound.title'),
        message: i18n.t('common:errors.notFound.message'),
        action: i18n.t('common:errors.notFound.action'),
      };

    case ErrorType.VALIDATION:
      return {
        type,
        title: i18n.t('common:errors.validation.title'),
        message: originalMessage || i18n.t('common:errors.validation.message'),
        action: i18n.t('common:errors.validation.action'),
      };

    case ErrorType.SERVER:
      return {
        type,
        title: i18n.t('common:errors.server.title'),
        message: i18n.t('common:errors.server.message'),
        action: i18n.t('common:errors.server.action'),
      };

    case ErrorType.UNKNOWN:
    default:
      return {
        type: ErrorType.UNKNOWN,
        title: i18n.t('common:errors.unknown.title'),
        message: originalMessage || i18n.t('common:errors.unknown.message'),
        action: i18n.t('common:errors.unknown.action'),
      };
  }
}

/**
 * 에러를 Toast로 표시
 */
export function showErrorToast(error: unknown): void {
  const friendlyError = getUserFriendlyError(error);

  toast.error(friendlyError.title, {
    description: friendlyError.message,
    duration: 5000,
  });
}

/**
 * 전역 에러 핸들러
 * 
 * React Query의 onError, API 호출 catch 블록 등에서 사용
 * 
 * @example
 * ```ts
 * try {
 *   await api.updateComponent(id, data);
 * } catch (error) {
 *   handleError(error);
 * }
 * ```
 */
export function handleError(error: unknown, options?: HandleErrorOptions): void {
  const details = error instanceof AppError ? error.details : undefined;
  const requestId =
    options?.requestId ??
    getCorrelationIdFromDetails(details, 'request_id') ??
    generateCorrelationId('renderer-request');
  const traceId =
    options?.traceId ??
    getCorrelationIdFromDetails(details, 'trace_id') ??
    generateCorrelationId('renderer-trace');

  const friendlyError = getUserFriendlyError(error);
  const eventName = options?.eventName ?? 'renderer.error.captured';

  sendRendererLog({
    event_name: eventName,
    level: 'error',
    request_id: requestId,
    trace_id: traceId,
    attrs: {
      error_type: friendlyError.type,
      status_code: error instanceof AppError ? error.statusCode : undefined,
      location:
        typeof window !== 'undefined'
          ? {
              pathname: window.location.pathname,
              href: window.location.href,
            }
          : undefined,
      context: options?.context ?? {},
      silent: Boolean(options?.silent),
      user_message: {
        title: friendlyError.title,
        description: friendlyError.message,
        action: friendlyError.action,
      },
    },
    error: toRendererLogError(error),
  });

  // 에러 로깅 (개발 환경)
  if (import.meta.env.DEV) {
    console.error('Error caught by global handler:', error);
  }

  captureAnalyticsException(error, {
    handled_by: 'handleError',
    error_type: friendlyError.type,
    status_code: error instanceof AppError ? error.statusCode ?? null : null,
    request_id: requestId,
    trace_id: traceId,
    silent: Boolean(options?.silent),
    pathname: typeof window !== 'undefined' ? window.location.pathname : null,
  });

  // Toast 표시 (silent 옵션이 false인 경우)
  if (!options?.silent) {
    sendRendererLog({
      event_name: 'renderer.error.toast-shown',
      level: 'info',
      request_id: requestId,
      trace_id: traceId,
      attrs: {
        error_type: friendlyError.type,
        title: friendlyError.title,
      },
    });
    showErrorToast(error);
  }
}

/**
 * API 응답 에러를 AppError로 변환
 */
export function parseApiError(response: Response, data?: unknown): AppError {
  const type = getErrorTypeFromStatus(response.status);

  // API 에러 응답 파싱
  let message = i18n.t('common:errors.unknown.message');
  let details: Record<string, unknown> | undefined;

  if (data && typeof data === 'object' && 'message' in data) {
    message = String(data.message);
    if ('details' in data) {
      details = data.details as Record<string, unknown>;
    }
  }

  return new AppError(type, message, response.status, details);
}

/**
 * fetch 요청 래퍼 (에러 처리 포함)
 */
export async function fetchWithErrorHandling<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const data: unknown = await response.json().catch(() => null);
      throw parseApiError(response, data);
    }

    return (await response.json()) as T;
  } catch (error) {
    // 네트워크 에러 처리
    if (error instanceof TypeError) {
      throw new AppError(ErrorType.NETWORK, i18n.t('common:errors.network.message'));
    }

    // 이미 AppError인 경우 그대로 throw
    if (error instanceof AppError) {
      throw error;
    }

    // 그 외의 경우
    throw new AppError(
      ErrorType.UNKNOWN,
      error instanceof Error ? error.message : i18n.t('common:errors.unknown.message')
    );
  }
}
