import { app } from 'electron';
import { existsSync } from 'fs';
import { join } from 'path';

export type ResolvedPathInfo = {
  path: string;
  source: 'resolved' | 'fallback';
  checkedPaths: string[];
};

function uniquePaths(paths: string[]): string[] {
  return Array.from(new Set(paths));
}

export function getResourcePathCandidates(fileName: string): string[] {
  return uniquePaths([
    // app.asar 내부(out/main -> ../resources)
    join(__dirname, '../resources', fileName),
    // app.asar 기준 절대경로
    join(app.getAppPath(), 'resources', fileName),
    // extraResources 기준 경로
    join(process.resourcesPath, fileName),
  ]);
}

export function resolveResourcePath(fileName: string): ResolvedPathInfo {
  const candidates = getResourcePathCandidates(fileName);
  const resolved = candidates.find((candidate) => existsSync(candidate));

  if (resolved) {
    return {
      path: resolved,
      source: 'resolved',
      checkedPaths: candidates,
    };
  }

  return {
    path: candidates[0],
    source: 'fallback',
    checkedPaths: candidates,
  };
}
