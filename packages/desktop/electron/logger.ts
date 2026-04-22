import { randomUUID } from 'crypto';
import { app } from 'electron';
import log from 'electron-log';
import path from 'path';

type LoggerLevel = 'error' | 'warn' | 'info' | 'verbose' | 'debug' | 'silly';
type LoggerProcess = 'main' | 'renderer' | 'api' | 'updater';
export type BuildFlavor = 'internal' | 'release';

type SerializableRecord = Record<string, unknown>;

interface SessionContext {
  session_id: string;
  trace_id?: string;
  request_id?: string;
}

interface StructuredLogError {
  code?: string;
  message: string;
  name?: string;
  stack?: string;
}

interface StructuredLogEntry extends SessionContext {
  timestamp: string;
  level: LoggerLevel;
  service: string;
  process: string;
  event_name: string;
  duration_ms?: number;
  error?: StructuredLogError;
  attrs: SerializableRecord;
}

interface InitializeLoggerOptions {
  debugMode?: boolean;
  service?: string;
  process?: LoggerProcess;
  fileLevel?: LoggerLevel;
  buildFlavor?: BuildFlavor;
}

interface LogEventOptions {
  traceId?: string;
  requestId?: string;
  durationMs?: number;
  error?: unknown;
  service?: string;
  process?: LoggerProcess;
}

const sessionId = randomUUID();
let serviceName = 'desktop-main';
let processName: LoggerProcess = 'main';
let debugModeEnabled = false;
let buildFlavor: BuildFlavor = 'release';

function parseBooleanLike(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

export function resolveBuildFlavorFromEnv(env: NodeJS.ProcessEnv = process.env): BuildFlavor {
  const explicit = env.VIBESMITH_BUILD_FLAVOR?.trim().toLowerCase();

  if (explicit === 'internal') {
    return 'internal';
  }

  if (explicit === 'release') {
    return 'release';
  }

  if (parseBooleanLike(env.VIBESMITH_INTERNAL_BUILD)) {
    return 'internal';
  }

  return 'release';
}

function sanitizeValue(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      code:
        typeof (value as { code?: unknown }).code === 'string' ||
        typeof (value as { code?: unknown }).code === 'number'
          ? String((value as { code?: unknown }).code)
          : undefined,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]';
    }

    seen.add(value);
    const result: SerializableRecord = {};
    for (const [key, item] of Object.entries(value as SerializableRecord)) {
      const sanitized = sanitizeValue(item, seen);
      if (sanitized !== undefined) {
        result[key] = sanitized;
      }
    }
    return result;
  }

  return value;
}

function resolveError(error: unknown): StructuredLogError | undefined {
  if (!error) {
    return undefined;
  }

  if (error instanceof Error) {
    const errorCode = (error as { code?: unknown }).code;
    return {
      code: typeof errorCode === 'string' || typeof errorCode === 'number' ? String(errorCode) : undefined,
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  if (typeof error === 'object') {
    const candidate = error as { message?: unknown; code?: unknown; name?: unknown; stack?: unknown };
    return {
      code:
        typeof candidate.code === 'string' || typeof candidate.code === 'number'
          ? String(candidate.code)
          : undefined,
      message:
        typeof candidate.message === 'string' ? candidate.message : JSON.stringify(sanitizeValue(candidate)),
      name: typeof candidate.name === 'string' ? candidate.name : undefined,
      stack: typeof candidate.stack === 'string' ? candidate.stack : undefined,
    };
  }

  return { message: String(error) };
}

function resolveDefaultLogLevel(debugMode: boolean): LoggerLevel {
  if (buildFlavor === 'internal') {
    return 'debug';
  }

  if (debugMode) {
    return 'debug';
  }
  return app.isPackaged ? 'info' : 'debug';
}

function applyTransportLevels(level: LoggerLevel): void {
  log.transports.file.level = level;

  if (app.isPackaged && !debugModeEnabled && buildFlavor !== 'internal') {
    log.transports.console.level = false;
    return;
  }

  log.transports.console.level = level;
}

export function createSessionContext(context: { traceId?: string; requestId?: string } = {}): SessionContext {
  return {
    session_id: sessionId,
    trace_id: context.traceId,
    request_id: context.requestId,
  };
}

export function getSessionId(): string {
  return sessionId;
}

export function setDebugMode(enabled: boolean): void {
  debugModeEnabled = enabled;
  const level = resolveDefaultLogLevel(debugModeEnabled);
  applyTransportLevels(level);
  logEvent('logger.debug-mode.changed', { enabled, level }, 'info');
}

export function logEvent(
  eventName: string,
  attrs: SerializableRecord = {},
  level: LoggerLevel = 'info',
  options: LogEventOptions = {}
): StructuredLogEntry {
  const entry: StructuredLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    service: options.service ?? serviceName,
    process: options.process ?? processName,
    event_name: eventName,
    attrs: {},
    ...createSessionContext({
      traceId: options.traceId,
      requestId: options.requestId,
    }),
  };

  entry.attrs = sanitizeValue(attrs) as SerializableRecord;

  if (options.durationMs !== undefined) {
    entry.duration_ms = options.durationMs;
  }

  const error = resolveError(options.error);
  if (error) {
    entry.error = error;
  }

  log[level](JSON.stringify(entry));
  return entry;
}

function logLegacyMessage(level: LoggerLevel, args: unknown[]): void {
  if (args.length === 0) {
    return;
  }

  const [message, ...rest] = args;
  const attrs: SerializableRecord = {
    message: sanitizeValue(message),
  };

  if (rest.length > 0) {
    attrs.details = sanitizeValue(rest);
  }

  const firstError = args.find((arg): arg is Error => arg instanceof Error);
  logEvent('app.log', attrs, level, { error: firstError });
}

/**
 * Logger 초기화
 */
export function initializeLogger(options: InitializeLoggerOptions = {}): void {
  buildFlavor = options.buildFlavor ?? resolveBuildFlavorFromEnv();
  debugModeEnabled = options.debugMode ?? debugModeEnabled;
  serviceName = options.service ?? serviceName;
  processName = options.process ?? processName;

  log.transports.file.resolvePath = () => path.join(app.getPath('logs'), 'main.log');
  log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB
  log.transports.file.format = '{text}';

  log.transports.console.format = '{text}';

  const level = options.fileLevel ?? resolveDefaultLogLevel(debugModeEnabled);
  applyTransportLevels(level);

  log.catchErrors({
    showDialog: false,
    onError: (error) => {
      logEvent('runtime.uncaught-error', {}, 'error', { error });
    },
  });

  logEvent('app.startup', {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    log_path: log.transports.file.getFile().path,
    is_packaged: app.isPackaged,
    debug_mode: debugModeEnabled,
    build_flavor: buildFlavor,
  });
}

/**
 * 메모리 사용량 로깅
 */
export function logMemoryUsage(): void {
  const usage = process.memoryUsage();
  logEvent(
    'app.memory.usage',
    {
      rss_mb: Math.round(usage.rss / 1024 / 1024),
      heap_total_mb: Math.round(usage.heapTotal / 1024 / 1024),
      heap_used_mb: Math.round(usage.heapUsed / 1024 / 1024),
      external_mb: Math.round(usage.external / 1024 / 1024),
    },
    'debug'
  );
}

/**
 * 앱 시작 시간 측정
 */
export class PerformanceTimer {
  private readonly startTime: number;
  private readonly timerName: string;
  private readonly checkpoints: Map<string, number> = new Map();

  constructor(label: string) {
    this.timerName = label;
    this.startTime = Date.now();
    logEvent('performance.start', { timer: label });
  }

  checkpoint(label: string): void {
    const elapsed = Date.now() - this.startTime;
    this.checkpoints.set(label, elapsed);
    logEvent('performance.checkpoint', { timer: this.timerName, label }, 'info', {
      durationMs: elapsed,
    });
  }

  end(label: string): void {
    const elapsed = Date.now() - this.startTime;
    logEvent('performance.end', { timer: this.timerName, label }, 'info', {
      durationMs: elapsed,
    });

    if (this.checkpoints.size > 0) {
      logEvent('performance.summary', {
        timer: this.timerName,
        checkpoints: Object.fromEntries(this.checkpoints.entries()),
      });
    }
  }
}

export const logger = {
  debug: (...args: unknown[]) => logLegacyMessage('debug', args),
  info: (...args: unknown[]) => logLegacyMessage('info', args),
  warn: (...args: unknown[]) => logLegacyMessage('warn', args),
  error: (...args: unknown[]) => logLegacyMessage('error', args),
  logEvent,
  setDebugMode,
  createSessionContext,
  getSessionId,
  logMemoryUsage,
  PerformanceTimer,
};

export default logger;
