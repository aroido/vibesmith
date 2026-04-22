/**
 * API 에러 응답 타입
 */
export type ApiErrorResponse = {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
};

/**
 * 에러 타입 분류
 */
export enum ErrorType {
  /** 네트워크 연결 오류 */
  NETWORK = 'NETWORK',
  /** 인증 오류 (401) */
  UNAUTHORIZED = 'UNAUTHORIZED',
  /** 권한 오류 (403) */
  FORBIDDEN = 'FORBIDDEN',
  /** 리소스 없음 (404) */
  NOT_FOUND = 'NOT_FOUND',
  /** 서버 오류 (500) */
  SERVER = 'SERVER',
  /** 유효성 검증 오류 (400) */
  VALIDATION = 'VALIDATION',
  /** 알 수 없는 오류 */
  UNKNOWN = 'UNKNOWN',
}

/**
 * 사용자 친화적 에러 메시지
 */
export type UserFriendlyError = {
  type: ErrorType;
  title: string;
  message: string;
  action?: string;
};

/**
 * 커스텀 에러 클래스
 */
export class AppError extends Error {
  type: ErrorType;
  statusCode?: number;
  details?: Record<string, unknown>;

  constructor(
    type: ErrorType,
    message: string,
    statusCode?: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.statusCode = statusCode;
    this.details = details;
  }
}
