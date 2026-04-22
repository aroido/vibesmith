/**
 * Dashboard API client
 * Uses common API client (docs/03_API_SPEC.md)
 * component-list API 함수 재사용 금지 - 대시보드 전용 자체 구현
 */

import type {
  DashboardStats,
  SystemStatus,
  Component,
  Project,
  ComponentBreakdown,
  Trend,
  UsageComponentType,
  UsageSummary,
  UsageTimelineDays,
  UsageComponentTimeline,
  UsageScanResult,
  UsageResetResult,
  UsageScopeIndex,
} from '../types';
import {
  type ApiStatsResponse,
  type ApiSystemStatusResponse,
  type ApiComponentResponse,
  type ApiProjectResponse,
  type ApiUsageResponse,
  type ApiUsageScanResponse,
  type ApiUsageResetResponse,
  transformStats,
  transformSystemStatus,
  transformComponent,
  transformUsage,
  transformUsageScan,
  transformUsageReset,
} from '../types/api';
import { apiClient, apiFetch } from '@/common/api';

/**
 * Dashboard 통계 조회 (클라이언트 사이드 필터링)
 * GET /api/stats + GET /api/components (projectId가 있을 경우)
 */
export async function getDashboardStats(projectId?: string | null): Promise<DashboardStats> {
  // 전체 통계 조회
  const data = await apiClient<ApiStatsResponse>('/api/stats');
  
  // projectId가 없으면 전체 통계 반환
  if (!projectId) {
    return transformStats(data);
  }
  
  // projectId가 있으면 클라이언트 사이드에서 필터링
  const components = await apiClient<ApiComponentResponse[]>('/api/components');
  const projectComponents = components.filter(c => c.project_id === projectId);
  
  // 프로젝트별 통계 계산
  const totalSkills = projectComponents.filter(c => c.type === 'skill').length;
  const totalAgents = projectComponents.filter(c => c.type === 'agent' || c.type === 'subagent').length;
  const totalCommands = projectComponents.filter(c => c.type === 'command').length;
  const totalHooks = projectComponents.filter(c => c.type === 'hook').length;
  const totalRules = projectComponents.filter(c => c.type === 'rule').length;
  const activeCount = projectComponents.filter(c => c.enabled).length;
  const inactiveCount = projectComponents.filter(c => !c.enabled).length;
  const totalCount = projectComponents.length;
  
  return {
    totalCount,
    totalSkills,
    totalAgents,
    totalCommands,
    totalHooks,
    totalRules,
    activeCount,
    inactiveCount,
    trends: data.trends, // 트렌드는 전체 데이터 사용 (프로젝트별 트렌드는 백엔드 구현 필요)
  };
}

/**
 * 시스템 상태 조회
 * GET /api/system/status
 */
export async function getSystemStatus(): Promise<SystemStatus> {
  const data = await apiClient<ApiSystemStatusResponse>('/api/system/status');
  return transformSystemStatus(data);
}

/**
 * 최근 구성요소 조회
 * GET /api/components/recent?limit={N}
 */
export async function getRecentComponents(
  limit: number = 10
): Promise<Component[]> {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10;
  const items = await apiClient<ApiComponentResponse[]>(
    `/api/components/recent?limit=${safeLimit}`
  );
  return items.map(transformComponent);
}

/**
 * Dashboard용 프로젝트 목록 (클라이언트에서 breakdown 집계)
 * GET /api/projects + GET /api/components → breakdown 계산
 */
export async function getProjectsForDashboard(): Promise<Project[]> {
  const [projects, components] = await Promise.all([
    apiClient<ApiProjectResponse[]>('/api/projects?include_hidden=true'),
    apiClient<ApiComponentResponse[]>('/api/components'),
  ]);

  const totalCount = components.length;

  return projects.map((proj) => {
    const projectComponents = components.filter(
      (c) => c.project_id === proj.id
    );

    const breakdown: ComponentBreakdown = {
      skills: projectComponents.filter((c) => c.type === 'skill').length,
      agents: projectComponents.filter((c) => c.type === 'agent').length,
      commands: projectComponents.filter((c) => c.type === 'command').length,
      hooks: projectComponents.filter((c) => c.type === 'hook').length,
      rules: projectComponents.filter((c) => c.type === 'rule').length,
    };

    const componentCount = projectComponents.length;
    const percentage =
      totalCount > 0 ? Math.round((componentCount / totalCount) * 100) : 0;

    const trend: Trend = {
      value: 0,
      percentage: 0,
      direction: 'neutral',
    };

    const platforms = [
      ...new Set(
        projectComponents
          .map((c) => c.platform)
          .filter((p): p is string => Boolean(p)),
      ),
    ];

    return {
      id: proj.id,
      name: proj.name,
      path: proj.path,
      isGlobal: proj.is_global,
      componentCount,
      breakdown,
      percentage,
      trend,
      platforms,
      hiddenAt: proj.hidden_at,
    } satisfies Project;
  });
}

export interface UsageQueryOptions {
  projectId?: string | null;
  componentType?: UsageComponentType | null;
  days?: number;
}

export interface UsageScopeIndexQueryOptions {
  projectId?: string | null;
  componentType?: UsageComponentType | null;
}

interface ApiUsageComponentTimelineResponse {
  component_id: string;
  component_name: string;
  timeline: Array<{
    date: string;
    count: number;
    intensity: number;
  }>;
}

function isUsageComponentType(value: string): value is UsageComponentType {
  return value === 'skill' || value === 'command' || value === 'agent' || value === 'hook';
}

/**
 * Usage 인사이트 조회
 * GET /api/usage
 */
export async function getUsageSummary(options: UsageQueryOptions = {}): Promise<UsageSummary> {
  const params = new URLSearchParams();

  if (options.projectId) params.set('project_id', options.projectId);
  if (options.componentType) params.set('component_type', options.componentType);
  if (options.days && options.days > 0) params.set('days', String(options.days));

  const query = params.toString();
  const path = query ? `/api/usage?${query}` : '/api/usage';
  const data = await apiClient<ApiUsageResponse>(path);
  return transformUsage(data);
}

/**
 * Usage 데이터 수동 스캔 트리거
 * POST /api/usage/scan
 */
export async function triggerUsageScan(): Promise<UsageScanResult> {
  const data = await apiClient<ApiUsageScanResponse>('/api/usage/scan', {
    method: 'POST',
  });
  return transformUsageScan(data);
}

/**
 * Usage 데이터 초기화
 * POST /api/usage/reset
 */
export async function resetUsageData(): Promise<UsageResetResult> {
  const data = await apiClient<ApiUsageResetResponse>('/api/usage/reset', {
    method: 'POST',
  });
  return transformUsageReset(data);
}

/**
 * Usage ranking 항목의 프로젝트명 조회
 * GET /api/components (클라이언트 필터링)
 */
export async function getUsageRankingProjectNames(
  componentIds: string[]
): Promise<Record<string, string>> {
  if (componentIds.length === 0) return {};

  const idSet = new Set(componentIds);
  const components = await apiClient<ApiComponentResponse[]>('/api/components');
  const projectNameByComponentId: Record<string, string> = {};

  for (const component of components) {
    if (!idSet.has(component.id)) continue;
    projectNameByComponentId[component.id] = component.project_name ?? component.project_id ?? '';
  }

  return projectNameByComponentId;
}

/**
 * Usage 인사이트 v2용 컴포넌트 인덱스 조회
 * GET /api/components (클라이언트 필터링)
 */
export async function getUsageScopeIndex(
  options: UsageScopeIndexQueryOptions = {}
): Promise<UsageScopeIndex> {
  const components = await apiClient<ApiComponentResponse[]>('/api/components');
  const scopeIndex: UsageScopeIndex = {};

  for (const component of components) {
    if (!isUsageComponentType(component.type)) continue;
    if (options.projectId && component.project_id !== options.projectId) continue;
    if (options.componentType && component.type !== options.componentType) continue;

    scopeIndex[component.id] = {
      id: component.id,
      name: component.name,
      type: component.type,
      projectId: component.project_id ?? null,
      projectName: component.project_name ?? null,
      isActive: component.enabled,
      createdAt: component.created_at ? new Date(component.created_at) : null,
      tags: component.tags ?? [],
    };
  }

  return scopeIndex;
}

/**
 * 특정 컴포넌트 usage timeline 조회
 * GET /api/usage/component?component_id={id}&days={days}&limit={limit}
 */
export async function getUsageComponentTimeline(
  componentId: string,
  options?: {
    days?: UsageTimelineDays;
    limit?: number;
    aggregationMode?: 'strict' | 'expanded';
  }
): Promise<UsageComponentTimeline> {
  const days = options?.days ?? 1;
  const limit = options?.limit ?? (days === 1 ? 84 : 12);
  const aggregationMode = options?.aggregationMode ?? 'strict';

  const params = new URLSearchParams({
    component_id: componentId,
    days: String(days),
    limit: String(limit),
    aggregation_mode: aggregationMode,
  });

  const data = await apiClient<ApiUsageComponentTimelineResponse>(
    `/api/usage/component?${params.toString()}`
  );

  return {
    componentId: data.component_id,
    componentName: data.component_name,
    timeline: data.timeline ?? [],
  };
}

/**
 * 프로젝트 삭제
 * DELETE /api/projects/{id}
 *
 * 글로벌 프로젝트(is_global=true)는 백엔드에서 400 Bad Request로 차단된다.
 * 프론트엔드는 ProjectBar에서 글로벌 프로젝트에 삭제 버튼을 숨겨 UX로도 방지한다.
 */
export async function deleteProject(projectId: string): Promise<void> {
  await apiFetch(`/api/projects/${projectId}`, { method: 'DELETE' });
}

/**
 * PATCH /api/projects/{id}/unhide
 * 숨긴 프로젝트를 복원한다.
 */
export async function unhideProject(projectId: string): Promise<void> {
  await apiFetch(`/api/projects/${projectId}/unhide`, { method: 'PATCH' });
}
