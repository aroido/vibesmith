export const API_HEALTH_PATH = '/api/health';
export const VIBESMITH_API_SERVICE = 'vibesmith-api';

export interface VibeSmithHealthPayload {
  status: 'ok';
  service: typeof VIBESMITH_API_SERVICE;
  version?: string;
}

export type ApiReadinessFailureReason =
  | 'http-error'
  | 'invalid-json'
  | 'unexpected-payload'
  | 'request-failed';

export type ApiReadinessResult =
  | {
      ready: true;
      status: number;
      healthUrl: string;
      payload: VibeSmithHealthPayload;
    }
  | {
      ready: false;
      status?: number;
      healthUrl: string;
      reason: ApiReadinessFailureReason;
      error?: Error;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

function buildHealthUrl(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const healthPath = API_HEALTH_PATH.startsWith('/')
    ? API_HEALTH_PATH.slice(1)
    : API_HEALTH_PATH;
  return new URL(healthPath, normalizedBaseUrl).toString();
}

export function isVibeSmithHealthPayload(payload: unknown): payload is VibeSmithHealthPayload {
  if (!isRecord(payload)) {
    return false;
  }

  return payload.status === 'ok' && payload.service === VIBESMITH_API_SERVICE;
}

export async function checkApiReadiness(baseUrl: string, timeoutMs = 2000): Promise<ApiReadinessResult> {
  const healthUrl = buildHealthUrl(baseUrl);

  try {
    const response = await fetch(healthUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      return {
        ready: false,
        status: response.status,
        healthUrl,
        reason: 'http-error',
      };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      return {
        ready: false,
        status: response.status,
        healthUrl,
        reason: 'invalid-json',
        error: toError(error),
      };
    }

    if (!isVibeSmithHealthPayload(payload)) {
      return {
        ready: false,
        status: response.status,
        healthUrl,
        reason: 'unexpected-payload',
      };
    }

    return {
      ready: true,
      status: response.status,
      healthUrl,
      payload,
    };
  } catch (error) {
    return {
      ready: false,
      healthUrl,
      reason: 'request-failed',
      error: toError(error),
    };
  }
}
