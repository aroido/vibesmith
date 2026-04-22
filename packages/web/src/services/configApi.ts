/**
 * Config API Client
 */

import { apiClient } from '@/common/api';

export interface ConfigResponse {
  home_path: string | null;
  cursor_global_path?: string | null;
  root_paths: string[];
}

export interface DryRunResult {
  dry_run: true;
  affected_projects: number;
  projects: { id: string; name: string; path: string }[];
}

export interface FactoryResetResult {
  scanned_projects: number;
  total_components: number;
  usage_reset: boolean;
}

/**
 * 서버 설정 조회
 */
export async function getConfig(): Promise<ConfigResponse> {
  return await apiClient<ConfigResponse>('/api/config');
}

/**
 * 프로젝트 루트 경로 제거 (dry_run=true면 프리뷰만)
 */
export async function removeRootPath(path: string): Promise<{ root_paths: string[] }> {
  return await apiClient<{ root_paths: string[] }>('/api/config/root-paths', {
    method: 'DELETE',
    body: JSON.stringify({ path }),
  });
}

/**
 * 루트 경로 제거 전 영향 범위 프리뷰
 */
export async function dryRunRemoveRootPath(path: string): Promise<DryRunResult> {
  return await apiClient<DryRunResult>('/api/config/root-paths?dry_run=true', {
    method: 'DELETE',
    body: JSON.stringify({ path }),
  });
}

/**
 * 전체 초기화 (Factory Reset)
 */
export async function factoryReset(): Promise<FactoryResetResult> {
  return await apiClient<FactoryResetResult>('/api/system/factory-reset', {
    method: 'POST',
  });
}
