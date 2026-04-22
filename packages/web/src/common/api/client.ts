/**
 * 공통 API 클라이언트
 *
 * 모든 feature의 API 호출에서 사용하는 공통 fetch 래퍼입니다.
 * - API base URL 자동 처리
 * - Content-Type: application/json 기본 적용
 * - Accept-Language, X-Locale 헤더 자동 추가 (i18n)
 * - 에러 시 ApiError (extends AppError) throw → 기존 handleError/showErrorToast와 호환
 */

import i18n from '../../i18n';
import { ApiError } from './errors';
import { getCurrentLocale } from '@/i18n';

/** API base URL (환경 변수 또는 런타임 감지) */
const DEFAULT_DESKTOP_API = 'http://localhost:8000';
let desktopApiBasePromise: Promise<string> | null = null;

function normalizeApiBase(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function isDesktopFileProtocol(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.location?.protocol === 'file:'
  );
}

async function resolveDesktopApiBase(): Promise<string> {
  if (!isDesktopFileProtocol()) {
    return DEFAULT_DESKTOP_API;
  }

  if (typeof window.api?.getApiUrl !== 'function') {
    return DEFAULT_DESKTOP_API;
  }

  try {
    const runtimeApiUrl = await window.api.getApiUrl();
    if (typeof runtimeApiUrl === 'string' && runtimeApiUrl.trim().length > 0) {
      return normalizeApiBase(runtimeApiUrl.trim());
    }
  } catch {
    // IPC 실패 시 기본 포트 fallback
  }

  return DEFAULT_DESKTOP_API;
}

async function getApiBase(): Promise<string> {
  const env = import.meta.env.VITE_API_URL as string;
  if (env) return normalizeApiBase(env);
  if (import.meta.env.MODE === 'test') return DEFAULT_DESKTOP_API;
  // file:// (Electron Desktop) 환경: 상대 경로가 file:///api로 해석되므로 절대 URL 필요
  if (isDesktopFileProtocol()) {
    if (!desktopApiBasePromise) {
      desktopApiBasePromise = resolveDesktopApiBase();
    }
    return desktopApiBasePromise;
  }
  return '';
}

/** locale 헤더 반환 (i18n 초기화 전에는 기본값) */
function getLocaleHeaders(): Record<string, string> {
  try {
    const locale = getCurrentLocale();
    return {
      'Accept-Language': `${locale}, en;q=0.9`,
      'X-Locale': locale,
    };
  } catch {
    return { 'Accept-Language': 'ko, en;q=0.9', 'X-Locale': 'ko' };
  }
}

/** HTTP 상태별 기본 에러 메시지 (i18n) */
function getErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return i18n.t('common:errors.api.badRequest');
    case 404:
      return i18n.t('common:errors.api.notFound');
    case 409:
      return i18n.t('common:errors.api.conflict');
    case 422:
      return i18n.t('common:errors.api.validationError');
    case 500:
      return i18n.t('common:errors.api.serverError');
    default:
      return i18n.t('common:errors.api.defaultError');
  }
}

/**
 * 공통 fetch 래퍼 (Response 반환)
 *
 * API 경로를 받아 fetch를 수행합니다.
 * 에러 시 ApiError를 throw합니다.
 *
 * @param path - API 경로 (예: '/api/components')
 * @param options - RequestInit 옵션
 * @returns Response 객체
 */
export async function apiFetch(
  path: string,
  options?: RequestInit
): Promise<Response> {
  const base = await getApiBase();
  const url = base ? `${base}${path}` : path;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getLocaleHeaders(),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const message = getErrorMessage(response.status);
    let detail: string | undefined;
    let messageKey: string | undefined;
    try {
      const body: unknown = await response.json();
      // 타입 가드를 사용한 안전한 파싱
      if (typeof body === 'object' && body !== null) {
        const obj = body as Record<string, unknown>;
        if (typeof obj.message_key === 'string') {
          messageKey = obj.message_key;
        }
        if (typeof obj.message === 'string' && obj.message.trim().length > 0) {
          detail = obj.message;
        } else if (typeof obj.detail === 'string') {
          detail = obj.detail;
        } else if (typeof obj.detail === 'object' && obj.detail !== null) {
          const detailObj = obj.detail as Record<string, unknown>;
          detail = typeof detailObj.msg === 'string' ? detailObj.msg : undefined;
        } else if (typeof obj.message === 'string') {
          detail = obj.message;
        } else if (obj.detail !== undefined) {
          detail = JSON.stringify(obj.detail);
        }
      }
    } catch {
      try {
        detail = await response.text();
      } catch {
        // ignore
      }
    }
    throw new ApiError(detail ?? message, response.status, detail, messageKey);
  }

  return response;
}

/**
 * 공통 API 클라이언트 (JSON 자동 파싱)
 *
 * @param path - API 경로
 * @param options - RequestInit 옵션
 * @returns 파싱된 JSON 데이터
 */
export async function apiClient<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await apiFetch(path, options);
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(i18n.t('common:errors.api.parseError'), response.status);
  }
}
