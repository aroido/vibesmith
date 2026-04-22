/**
 * 공통 API 에러 클래스
 *
 * AppError를 확장하여 기존 handleError, showErrorToast와 호환됩니다.
 */

import { AppError, ErrorType } from '../types/error';
import { getErrorTypeFromStatus } from '../utils/error-handler';

export class ApiError extends AppError {
  public readonly detail?: string;
  public readonly messageKey?: string;

  constructor(message: string, status?: number, detail?: string, messageKey?: string) {
    const type = status ? getErrorTypeFromStatus(status) : ErrorType.UNKNOWN;
    super(type, message, status);
    this.name = 'ApiError';
    this.detail = detail;
    this.messageKey = messageKey;
  }
}
