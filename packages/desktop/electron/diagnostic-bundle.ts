import { spawn } from 'child_process';
import { app, dialog } from 'electron';
import { existsSync } from 'fs';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { logger } from './logger';

export interface CreateDiagnosticBundleOptions {
  anonymizePaths?: boolean;
  maxBundleSizeMb?: number;
}

export interface CreateDiagnosticBundleResult {
  success: boolean;
  canceled?: boolean;
  path?: string;
  error?: string;
  sizeBytes?: number;
  fileCount?: number;
  includedFiles?: string[];
}

const DEFAULT_MAX_BUNDLE_MB = 25;
const SENSITIVE_KEY_PATTERNS = [
  'token',
  'authorization',
  'cookie',
  'password',
  'secret',
  'apikey',
  'api_key',
  'access_token',
  'refresh_token',
];

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function redactStringValue(value: string, anonymizePaths: boolean): string {
  let redacted = value;

  redacted = redacted.replace(/(authorization["':=\s]+)(bearer\s+)?([^\s",]+)/gi, '$1$2***');
  redacted = redacted.replace(/(token["':=\s]+)([^\s",]+)/gi, '$1***');
  redacted = redacted.replace(/(password["':=\s]+)([^\s",]+)/gi, '$1***');
  redacted = redacted.replace(/(cookie["':=\s]+)([^\s",]+)/gi, '$1***');

  if (anonymizePaths) {
    const homePath = app.getPath('home');
    if (homePath) {
      redacted = redacted.split(homePath).join('${HOME}');
    }
  }

  return redacted;
}

function redactObject(value: unknown, anonymizePaths: boolean): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return redactStringValue(value, anonymizePaths);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactObject(item, anonymizePaths));
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(key)) {
        result[key] = '***';
        continue;
      }
      result[key] = redactObject(item, anonymizePaths);
    }
    return result;
  }

  return String(value);
}

function redactLogLine(line: string, anonymizePaths: boolean): string {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const redacted = redactObject(parsed, anonymizePaths);
    return JSON.stringify(redacted);
  } catch {
    return redactStringValue(trimmed, anonymizePaths);
  }
}

async function runCommand(
  command: string,
  args: string[],
  options: { cwd?: string } = {}
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code}: ${stderr.trim()}`));
    });
  });
}

async function zipDirectory(sourceDir: string, outputZipPath: string): Promise<void> {
  if (process.platform === 'darwin') {
    await runCommand('ditto', [
      '-c',
      '-k',
      '--sequesterRsrc',
      '--keepParent',
      sourceDir,
      outputZipPath,
    ]);
    return;
  }

  if (process.platform === 'win32') {
    await runCommand('powershell', [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path "${sourceDir}\\*" -DestinationPath "${outputZipPath}" -Force`,
    ]);
    return;
  }

  await runCommand('zip', ['-r', outputZipPath, '.'], { cwd: sourceDir });
}

async function calculateDirectorySize(targetDir: string): Promise<number> {
  let total = 0;
  const entries = await readdir(targetDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(targetDir, entry.name);
    if (entry.isDirectory()) {
      total += await calculateDirectorySize(fullPath);
      continue;
    }

    if (entry.isFile()) {
      const fileStats = await stat(fullPath);
      total += fileStats.size;
    }
  }

  return total;
}

async function collectCrashDumpMeta(): Promise<Record<string, unknown>> {
  const crashDir = app.getPath('crashDumps');
  if (!existsSync(crashDir)) {
    return {
      crash_dump_dir: crashDir,
      exists: false,
      files: [],
    };
  }

  const entries = await readdir(crashDir, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const filePath = join(crashDir, entry.name);
        const fileStats = await stat(filePath);
        return {
          name: entry.name,
          size_bytes: fileStats.size,
          modified_at: fileStats.mtime.toISOString(),
        };
      })
  );

  return {
    crash_dump_dir: crashDir,
    exists: true,
    files,
  };
}

function extractProcessLines(
  lines: string[],
  processName: 'renderer' | 'api' | 'updater',
  anonymizePaths: boolean
): string[] {
  return lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => {
      try {
        const parsed = JSON.parse(line) as Record<string, unknown>;
        return parsed.process === processName;
      } catch {
        return false;
      }
    })
    .map((line) => redactLogLine(line, anonymizePaths));
}

function normalizeOutputPath(selectedPath: string): string {
  return selectedPath.endsWith('.zip') ? selectedPath : `${selectedPath}.zip`;
}

export async function createDiagnosticBundle(
  options: CreateDiagnosticBundleOptions = {}
): Promise<CreateDiagnosticBundleResult> {
  const anonymizePaths = options.anonymizePaths ?? true;
  const maxBundleSizeMb = options.maxBundleSizeMb ?? DEFAULT_MAX_BUNDLE_MB;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const defaultName = `vibesmith-diagnostic-${timestamp}.zip`;
  const saveResult = await dialog.showSaveDialog({
    title: '진단 번들 저장',
    defaultPath: join(app.getPath('downloads'), defaultName),
    filters: [{ name: 'Zip Archive', extensions: ['zip'] }],
  });

  if (saveResult.canceled || !saveResult.filePath) {
    return {
      success: false,
      canceled: true,
    };
  }

  const outputZipPath = normalizeOutputPath(saveResult.filePath);
  const bundleRootDir = await mkdtemp(join(tmpdir(), 'vibesmith-diagnostic-'));
  const includedFiles: string[] = [];

  const writeBundleFile = async (relativePath: string, content: string): Promise<void> => {
    const fullPath = join(bundleRootDir, relativePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, 'utf8');
    includedFiles.push(relativePath);
  };

  try {
    logger.logEvent(
      'diagnostic.bundle.create.start',
      {
        output_path: outputZipPath,
        anonymize_paths: anonymizePaths,
        max_bundle_size_mb: maxBundleSizeMb,
      },
      'info',
      { process: 'main' }
    );

    const mainLogPath = join(app.getPath('logs'), 'main.log');
    const rawMainLog = existsSync(mainLogPath)
      ? await readFile(mainLogPath, 'utf8')
      : '';

    const logLines = rawMainLog.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const redactedMainLines = logLines.map((line) => redactLogLine(line, anonymizePaths));

    await writeBundleFile('logs/main.log', `${redactedMainLines.join('\n')}\n`);
    await writeBundleFile(
      'logs/renderer.log',
      `${extractProcessLines(logLines, 'renderer', anonymizePaths).join('\n')}\n`
    );
    await writeBundleFile(
      'logs/api.log',
      `${extractProcessLines(logLines, 'api', anonymizePaths).join('\n')}\n`
    );
    await writeBundleFile(
      'logs/updater.log',
      `${extractProcessLines(logLines, 'updater', anonymizePaths).join('\n')}\n`
    );

    const crashMeta = await collectCrashDumpMeta();
    await writeBundleFile(
      'meta/crash-dumps-meta.json',
      `${JSON.stringify(redactObject(crashMeta, anonymizePaths), null, 2)}\n`
    );

    const systemInfo = {
      generated_at: new Date().toISOString(),
      app_version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      process_versions: process.versions,
      paths: {
        logs: app.getPath('logs'),
        user_data: app.getPath('userData'),
        crash_dumps: app.getPath('crashDumps'),
      },
    };
    await writeBundleFile(
      'meta/system-info.json',
      `${JSON.stringify(redactObject(systemInfo, anonymizePaths), null, 2)}\n`
    );

    await writeBundleFile(
      'meta/bundle-manifest.json',
      `${JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          file_count: includedFiles.length,
          files: includedFiles,
          anonymize_paths: anonymizePaths,
        },
        null,
        2
      )}\n`
    );

    const directorySize = await calculateDirectorySize(bundleRootDir);
    const maxBytes = maxBundleSizeMb * 1024 * 1024;
    if (directorySize > maxBytes) {
      throw new Error(
        `Diagnostic bundle exceeds size limit (${Math.round(directorySize / 1024 / 1024)}MB > ${maxBundleSizeMb}MB)`
      );
    }

    await zipDirectory(bundleRootDir, outputZipPath);

    const zipStats = await stat(outputZipPath);
    logger.logEvent(
      'diagnostic.bundle.create.success',
      {
        output_path: outputZipPath,
        size_bytes: zipStats.size,
        file_count: includedFiles.length,
      },
      'info',
      { process: 'main' }
    );

    return {
      success: true,
      path: outputZipPath,
      sizeBytes: zipStats.size,
      fileCount: includedFiles.length,
      includedFiles,
    };
  } catch (error) {
    logger.logEvent(
      'diagnostic.bundle.create.error',
      {
        output_path: outputZipPath,
      },
      'error',
      { process: 'main', error }
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await rm(bundleRootDir, { recursive: true, force: true });
  }
}
