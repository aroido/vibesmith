/**
 * FastAPI Server Manager
 * Electron main process에서 FastAPI 백엔드 서버를 자동으로 시작/종료합니다.
 */

import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import { app, dialog } from 'electron';
import { existsSync } from 'fs';
import { createServer } from 'net';
import { join } from 'path';
import { API_HEALTH_PATH, checkApiReadiness } from './api-readiness';
import { logger } from './logger';

let apiProcess: ChildProcess | null = null;
const API_HOST = '127.0.0.1';
const DEFAULT_API_PORT = resolvePreferredApiPort();
let runtimeApiPort = DEFAULT_API_PORT;
let runtimeApiUrl = createApiUrl(DEFAULT_API_PORT);
let runtimeApiHealthUrl = buildApiHealthUrl(runtimeApiUrl);
const API_OUTPUT_BUFFER_LIMIT = 40;
const API_OUTPUT_ERROR_CONTEXT_LINES = 12;
const apiProcessOutputBuffer: string[] = [];

type LogLevel = 'error' | 'warn' | 'info' | 'debug';
type ProcessStream = 'stdout' | 'stderr';

interface CorrelationContext {
  requestId: string;
  traceId: string;
}

interface WaitForServerOptions extends CorrelationContext {
  source: 'external' | 'bundled';
  apiUrl: string;
  healthUrl: string;
  managedProcess?: ChildProcess;
}

interface PortProbeResult {
  available: boolean;
  reason: 'available' | 'in-use' | 'probe-error';
  errorCode?: string;
  message?: string;
}

interface BundledApiPortSelection {
  port: number;
  fallbackUsed: boolean;
  reusedExisting: boolean;
  reason: 'preferred-port-available' | 'preferred-port-in-use' | 'existing-vibesmith-api';
  probe?: PortProbeResult;
}

function apiLog(
  eventName: string,
  attrs: Record<string, unknown> = {},
  level: LogLevel = 'info',
  options: {
    requestId?: string;
    traceId?: string;
    error?: unknown;
  } = {}
): void {
  logger.logEvent(eventName, attrs, level, {
    process: 'api',
    service: 'api',
    requestId: options.requestId,
    traceId: options.traceId,
    error: options.error,
  });
}

function createCorrelationContext(prefix: string): CorrelationContext {
  return {
    requestId: `${prefix}-request-${randomUUID()}`,
    traceId: `${prefix}-trace-${randomUUID()}`,
  };
}

function resetApiProcessOutputBuffer(): void {
  apiProcessOutputBuffer.length = 0;
}

function rememberApiProcessOutput(stream: ProcessStream, line: string): void {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return;
  }

  const prefix = stream === 'stderr' ? '[stderr]' : '[stdout]';
  apiProcessOutputBuffer.push(`${prefix} ${trimmed}`);

  if (apiProcessOutputBuffer.length > API_OUTPUT_BUFFER_LIMIT) {
    apiProcessOutputBuffer.splice(0, apiProcessOutputBuffer.length - API_OUTPUT_BUFFER_LIMIT);
  }
}

function formatRecentApiProcessOutput(): string {
  const recentLines = apiProcessOutputBuffer.slice(-API_OUTPUT_ERROR_CONTEXT_LINES);
  if (recentLines.length === 0) {
    return '';
  }

  return `\nRecent API output:\n${recentLines.join('\n')}`;
}

function getStringField(
  source: Record<string, unknown>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

function resolveLogLevel(value: unknown, stream: ProcessStream): LogLevel {
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (normalized === 'debug') return 'debug';
    if (normalized === 'info') return 'info';
    if (normalized === 'warn' || normalized === 'warning') return 'warn';
    if (normalized === 'error' || normalized === 'critical') return 'error';
  }
  return stream === 'stderr' ? 'warn' : 'info';
}

function parseProcessOutputLine(
  line: string,
  stream: ProcessStream
): {
  attrs: Record<string, unknown>;
  level: LogLevel;
  requestId?: string;
  traceId?: string;
} {
  const trimmed = line.trim();

  if (trimmed.length === 0) {
    return {
      attrs: {},
      level: stream === 'stderr' ? 'warn' : 'debug',
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === 'object') {
      const payload = parsed as Record<string, unknown>;
      return {
        attrs: {
          raw_line: trimmed,
          payload,
        },
        level: resolveLogLevel(payload.level, stream),
        requestId: getStringField(payload, ['request_id', 'requestId']),
        traceId: getStringField(payload, ['trace_id', 'traceId']),
      };
    }
  } catch {
    // JSON 형식이 아니면 raw text로 기록
  }

  return {
    attrs: {
      raw_line: trimmed,
    },
    level: stream === 'stderr' ? 'warn' : 'info',
  };
}

function forwardProcessOutput(
  stream: ProcessStream,
  data: Buffer,
  context: CorrelationContext
): void {
  const text = data.toString();
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);

  for (const line of lines) {
    rememberApiProcessOutput(stream, line);
    const parsed = parseProcessOutputLine(line, stream);
    apiLog(
      stream === 'stdout' ? 'api.process.stdout' : 'api.process.stderr',
      parsed.attrs,
      parsed.level,
      {
        requestId: parsed.requestId ?? context.requestId,
        traceId: parsed.traceId ?? context.traceId,
      }
    );
  }
}

function hasProcessExited(processToCheck?: ChildProcess): boolean {
  if (!processToCheck) {
    return false;
  }
  return processToCheck.exitCode !== null || processToCheck.signalCode !== null;
}

function createProcessExitedError(processToCheck: ChildProcess): Error {
  const recentOutput = formatRecentApiProcessOutput();
  return new Error(
    `API process exited before server became ready (code: ${String(processToCheck.exitCode)}, signal: ${String(
      processToCheck.signalCode
    )})${recentOutput}`
  );
}

function resolvePreferredApiPort(): number {
  const rawPort = process.env.VIBESMITH_API_PORT ?? '8000';
  const parsed = Number.parseInt(rawPort, 10);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535) {
    return parsed;
  }
  return 8000;
}

function createApiUrl(port: number): string {
  return `http://${API_HOST}:${port}`;
}

function buildApiHealthUrl(apiUrl: string): string {
  const normalizedBaseUrl = apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`;
  const healthPath = API_HEALTH_PATH.startsWith('/')
    ? API_HEALTH_PATH.slice(1)
    : API_HEALTH_PATH;
  return new URL(healthPath, normalizedBaseUrl).toString();
}

function setRuntimeApiEndpoint(apiUrl: string): void {
  runtimeApiUrl = apiUrl;
  runtimeApiHealthUrl = buildApiHealthUrl(apiUrl);
  try {
    const parsed = new URL(apiUrl);
    const parsedPort = parsed.port
      ? Number.parseInt(parsed.port, 10)
      : parsed.protocol === 'https:'
        ? 443
        : 80;
    if (Number.isInteger(parsedPort) && parsedPort > 0) {
      runtimeApiPort = parsedPort;
    }
  } catch {
    runtimeApiPort = DEFAULT_API_PORT;
  }
}

function resolveDevelopmentApiUrl(): string {
  const fromEnv = process.env.VIBESMITH_DEV_API_URL?.trim();
  if (!fromEnv) {
    return createApiUrl(DEFAULT_API_PORT);
  }
  return fromEnv.endsWith('/') ? fromEnv.slice(0, -1) : fromEnv;
}

async function probePortAvailability(port: number): Promise<PortProbeResult> {
  return new Promise((resolve) => {
    const probeServer = createServer();
    probeServer.unref();

    probeServer.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        resolve({
          available: false,
          reason: 'in-use',
          errorCode: error.code,
          message: error.message,
        });
        return;
      }

      resolve({
        available: false,
        reason: 'probe-error',
        errorCode: error.code,
        message: error.message,
      });
    });

    probeServer.listen({ port, host: API_HOST, exclusive: true }, () => {
      probeServer.close((closeError) => {
        if (closeError) {
          resolve({
            available: false,
            reason: 'probe-error',
            message: closeError.message,
          });
          return;
        }

        resolve({
          available: true,
          reason: 'available',
        });
      });
    });
  });
}

async function reserveAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const reservationServer = createServer();
    reservationServer.unref();

    reservationServer.once('error', (error) => {
      reject(error);
    });

    reservationServer.listen({ port: 0, host: API_HOST, exclusive: true }, () => {
      const address = reservationServer.address();

      if (!address || typeof address === 'string') {
        reservationServer.close(() => {
          reject(new Error('Failed to reserve an ephemeral API port.'));
        });
        return;
      }

      const reservedPort = address.port;
      reservationServer.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(reservedPort);
      });
    });
  });
}

async function selectBundledApiPort(
  context: CorrelationContext
): Promise<BundledApiPortSelection> {
  const preferredApiUrl = createApiUrl(DEFAULT_API_PORT);
  const existingApiReadiness = await checkApiReadiness(preferredApiUrl, 1200);

  if (existingApiReadiness.ready) {
    return {
      port: DEFAULT_API_PORT,
      fallbackUsed: false,
      reusedExisting: true,
      reason: 'existing-vibesmith-api',
    };
  }

  const probe = await probePortAvailability(DEFAULT_API_PORT);
  if (probe.available) {
    return {
      port: DEFAULT_API_PORT,
      fallbackUsed: false,
      reusedExisting: false,
      reason: 'preferred-port-available',
      probe,
    };
  }

  const fallbackPort = await reserveAvailablePort();
  apiLog(
    'api.port.selection.fallback',
    {
      preferred_port: DEFAULT_API_PORT,
      fallback_port: fallbackPort,
      probe_reason: probe.reason,
      probe_error_code: probe.errorCode ?? null,
      probe_message: probe.message ?? null,
    },
    'warn',
    context
  );

  return {
    port: fallbackPort,
    fallbackUsed: true,
    reusedExisting: false,
    reason: 'preferred-port-in-use',
    probe,
  };
}

/**
 * FastAPI 서버 시작
 */
export async function startApiServer(): Promise<void> {
  const startupContext = createCorrelationContext('api-startup');

  // 개발 모드: 외부에서 실행 중인 서버 사용
  if (!app.isPackaged) {
    const devApiUrl = resolveDevelopmentApiUrl();
    setRuntimeApiEndpoint(devApiUrl);

    apiLog(
      'api.process.external-server.mode',
      {
        mode: 'development',
        api_url: runtimeApiUrl,
        health_url: runtimeApiHealthUrl,
      },
      'info',
      startupContext
    );
    await waitForServer(30000, {
      ...startupContext,
      source: 'external',
      apiUrl: runtimeApiUrl,
      healthUrl: runtimeApiHealthUrl,
    });
    return;
  }

  // 프로덕션: 번들된 API 서버 실행
  const apiPath = join(process.resourcesPath, 'api', 'vibesmith-api');
  const dbPath = join(app.getPath('userData'), 'vibesmith.db');

  apiLog(
    'api.process.start.requested',
    {
      api_path: apiPath,
      db_path: dbPath,
      preferred_port: DEFAULT_API_PORT,
    },
    'info',
    startupContext
  );

  // API 실행 파일 존재 여부 확인
  if (!existsSync(apiPath)) {
    const error = new Error(`API executable not found: ${apiPath}`);
    apiLog(
      'api.process.start.executable-missing',
      {
        api_path: apiPath,
      },
      'error',
      {
        ...startupContext,
        error,
      }
    );
    throw error;
  }

  const selectedPort = await selectBundledApiPort(startupContext);
  setRuntimeApiEndpoint(createApiUrl(selectedPort.port));

  apiLog(
    'api.port.selection.resolved',
    {
      preferred_port: DEFAULT_API_PORT,
      selected_port: runtimeApiPort,
      selected_api_url: runtimeApiUrl,
      selected_health_url: runtimeApiHealthUrl,
      fallback_used: selectedPort.fallbackUsed,
      reused_existing_server: selectedPort.reusedExisting,
      reason: selectedPort.reason,
      probe_reason: selectedPort.probe?.reason ?? null,
      probe_error_code: selectedPort.probe?.errorCode ?? null,
    },
    selectedPort.fallbackUsed ? 'warn' : 'info',
    startupContext
  );

  if (selectedPort.reusedExisting) {
    apiLog(
      'api.process.reuse-existing',
      {
        selected_api_url: runtimeApiUrl,
      },
      'warn',
      startupContext
    );

    await waitForServer(30000, {
      ...startupContext,
      source: 'bundled',
      apiUrl: runtimeApiUrl,
      healthUrl: runtimeApiHealthUrl,
    });

    apiLog(
      'api.process.ready',
      {
        api_url: runtimeApiUrl,
        health_url: runtimeApiHealthUrl,
        reused_existing_server: true,
      },
      'info',
      startupContext
    );
    return;
  }

  resetApiProcessOutputBuffer();

  apiProcess = spawn(apiPath, [], {
    env: {
      ...process.env,
      VIBESMITH_DB_PATH: dbPath,
      PORT: String(runtimeApiPort),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  apiLog(
    'api.process.spawned',
    {
      pid: apiProcess.pid ?? null,
    },
    'info',
    startupContext
  );

  // stdout/stderr 로그 수집
  apiProcess.stdout?.on('data', (data: Buffer) => {
    forwardProcessOutput('stdout', data, startupContext);
  });

  apiProcess.stderr?.on('data', (data: Buffer) => {
    forwardProcessOutput('stderr', data, startupContext);
  });

  apiProcess.on('error', (error) => {
    apiLog(
      'api.process.error',
      {
        stage: 'process-error',
      },
      'error',
      {
        ...startupContext,
        error,
      }
    );
    showApiError('API 서버 시작 실패', error.message);
  });

  apiProcess.on('exit', (code, signal) => {
    const unexpectedExit = code !== 0 && code !== null;
    apiLog(
      'api.process.exit',
      {
        code,
        signal,
        unexpected_exit: unexpectedExit,
      },
      unexpectedExit ? 'error' : 'info',
      startupContext
    );
    apiProcess = null;
  });

  // 서버 준비 대기 (헬스 체크)
  try {
    await waitForServer(30000, {
      ...startupContext,
      source: 'bundled',
      apiUrl: runtimeApiUrl,
      healthUrl: runtimeApiHealthUrl,
      managedProcess: apiProcess,
    });
    apiLog(
      'api.process.ready',
      {
        api_url: runtimeApiUrl,
        health_url: runtimeApiHealthUrl,
        reused_existing_server: false,
      },
      'info',
      startupContext
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    apiLog(
      'api.process.start.failed',
      {
        message,
      },
      'error',
      {
        ...startupContext,
        error,
      }
    );
    showApiError('API 서버 시작 실패', message);
    throw error;
  }
}

/**
 * 헬스 체크 및 대기
 * @param timeout - 타임아웃 (밀리초)
 */
async function waitForServer(
  timeout: number,
  options: WaitForServerOptions
): Promise<void> {
  const startTime = Date.now();
  const interval = 500; // 500ms마다 체크
  let attempts = 0;
  let lastError: Error | null = null;

  apiLog(
    'api.health.check.start',
    {
      url: options.healthUrl,
      timeout_ms: timeout,
      source: options.source,
    },
    'info',
    options
  );

  while (Date.now() - startTime < timeout) {
    const managedProcess = options.managedProcess;
    if (managedProcess && hasProcessExited(managedProcess)) {
      const exitError = createProcessExitedError(managedProcess);
      apiLog(
        'api.health.check.process-exit-before-ready',
        {
          attempts,
          source: options.source,
          duration_ms: Date.now() - startTime,
          code: managedProcess.exitCode ?? null,
          signal: managedProcess.signalCode ?? null,
        },
        'error',
        {
          ...options,
          error: exitError,
        }
      );
      throw exitError;
    }

    attempts += 1;
    const readiness = await checkApiReadiness(options.apiUrl, 2000);

    if (readiness.ready) {
      apiLog(
        'api.health.check.ready',
        {
          status: readiness.status,
          attempts,
          source: options.source,
          duration_ms: Date.now() - startTime,
          health_url: readiness.healthUrl,
          service: readiness.payload.service,
        },
        'info',
        options
      );
      return;
    }

    lastError =
      readiness.error ??
      new Error(
        `Readiness check failed (${readiness.reason}) with status ${String(readiness.status ?? 'unknown')}`
      );

    if (attempts === 1 || attempts % 5 === 0) {
      apiLog(
        'api.health.check.retry',
        {
          attempts,
          source: options.source,
          reason: readiness.reason,
          status: readiness.status ?? null,
          health_url: readiness.healthUrl,
        },
        'debug',
        {
          ...options,
          error: readiness.error,
        }
      );
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  apiLog(
    'api.health.check.timeout',
    {
      timeout_ms: timeout,
      attempts,
      source: options.source,
      health_url: options.healthUrl,
    },
    'error',
    {
      ...options,
      error: lastError ?? new Error('health-check-timeout'),
    }
  );

  throw new Error(
    `API server did not become ready within ${timeout}ms. Last error: ${lastError?.message || 'unknown'}`
  );
}

/**
 * FastAPI 서버 종료
 */
export function stopApiServer(): void {
  if (!apiProcess) {
    apiLog('api.process.stop.skipped', { reason: 'not-running' }, 'info');
    return;
  }

  const stopContext = createCorrelationContext('api-stop');
  const processToStop = apiProcess;

  apiLog(
    'api.process.stop.requested',
    {
      pid: processToStop.pid ?? null,
    },
    'info',
    stopContext
  );

  // SIGTERM 전송 (정상 종료)
  processToStop.kill('SIGTERM');

  // 5초 후 강제 종료
  setTimeout(() => {
    if (!processToStop.killed) {
      apiLog(
        'api.process.stop.force-kill',
        {
          pid: processToStop.pid ?? null,
        },
        'warn',
        stopContext
      );
      processToStop.kill('SIGKILL');
    }
  }, 5000);

  apiProcess = null;
}

/**
 * 포트가 이미 사용 중인지 확인
 */
export async function isPortInUse(port: number): Promise<boolean> {
  const probe = await probePortAvailability(port);
  return !probe.available;
}

/**
 * 에러 다이얼로그 표시
 */
function showApiError(title: string, message: string): void {
  const recentOutput =
    !message.includes('Recent API output:') && apiProcessOutputBuffer.length > 0
      ? formatRecentApiProcessOutput()
      : '';
  const logPath = join(app.getPath('logs'), 'main.log');

  apiLog(
    'api.process.fatal-dialog',
    {
      title,
      message,
      log_path: logPath,
    },
    'error'
  );
  dialog.showErrorBox(
    title,
    `${message}${recentOutput}\n\n로그 파일: ${logPath}\n\n앱을 종료하고 다시 시도해주세요.`
  );
  app.quit();
}

/**
 * API 서버 상태 확인
 */
export function isApiServerRunning(): boolean {
  return apiProcess !== null && !apiProcess.killed;
}

/**
 * API 서버 URL 반환
 */
export function getApiUrl(): string {
  return runtimeApiUrl;
}
