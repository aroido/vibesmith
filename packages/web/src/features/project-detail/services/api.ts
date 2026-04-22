/**
 * Project Detail API Client
 * v1.10.0 - 프로젝트 상세 API 클라이언트
 */

import type {
  ProjectActivity,
  ProjectActivityQueryOptions,
  ProjectBreakdown,
  ProjectComponentFilters,
  ProjectDetail,
} from '../types';
import type { Component } from '../../../common/types';
import { apiClient } from '@/common/api';

interface ProjectDetailApiResponse {
  id?: string;
  name?: string;
  path?: string;
  is_global?: boolean;
  component_count?: number;
  last_scanned_at?: string | null;
  dir_exists?: boolean;
  platforms?: unknown;
  breakdown?: Partial<Record<keyof ProjectBreakdown, unknown>> | null;
}

interface ProjectComponentsCollectionResponse {
  items?: unknown;
  components?: unknown;
  total?: unknown;
}

const EMPTY_BREAKDOWN: ProjectBreakdown = {
  skill: 0,
  agent: 0,
  command: 0,
  hook: 0,
  rule: 0,
};

function toCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function normalizeBreakdown(
  breakdown: Partial<Record<keyof ProjectBreakdown, unknown>> | null | undefined
): ProjectBreakdown {
  if (!breakdown) return EMPTY_BREAKDOWN;

  return {
    skill: toCount(breakdown.skill),
    agent: toCount(breakdown.agent),
    command: toCount(breakdown.command),
    hook: toCount(breakdown.hook),
    rule: toCount(breakdown.rule),
  };
}

function normalizeProjectComponents(
  response: Component[] | ProjectComponentsCollectionResponse
): Component[] {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response.items)) {
    return response.items as Component[];
  }

  if (Array.isArray(response.components)) {
    return response.components as Component[];
  }

  return [];
}

/**
 * 프로젝트 상세 정보 조회
 * GET /api/projects/:id
 */
export async function fetchProjectDetail(projectId: string): Promise<ProjectDetail> {
  const response = await apiClient<ProjectDetailApiResponse>(`/api/projects/${projectId}`);

  const breakdown = normalizeBreakdown(response.breakdown);
  const breakdownTotal =
    breakdown.skill + breakdown.agent + breakdown.command + breakdown.hook + breakdown.rule;
  const hasComponentCount =
    typeof response.component_count === 'number' &&
    Number.isFinite(response.component_count);

  return {
    id: response.id ?? projectId,
    name: response.name ?? '',
    path: response.path ?? '',
    is_global: Boolean(response.is_global),
    component_count: hasComponentCount ? toCount(response.component_count) : breakdownTotal,
    last_scanned_at: response.last_scanned_at ?? null,
    dir_exists: response.dir_exists ?? true,
    platforms: Array.isArray(response.platforms)
      ? response.platforms.filter((value): value is string => typeof value === 'string')
      : [],
    breakdown,
  };
}

/**
 * 프로젝트별 구성요소 목록 조회
 * GET /api/projects/:id/components
 */
export async function fetchProjectComponents(
  projectId: string,
  filters?: ProjectComponentFilters
): Promise<Component[]> {
  const params = new URLSearchParams();
  if (filters?.type && filters.type !== 'overview') {
    params.append('type', filters.type);
  }
  if (filters?.search) {
    params.append('search', filters.search);
  }
  if (filters?.sortBy) {
    params.append('sort', filters.sortBy);
  }

  const queryString = params.toString();
  const url = queryString
    ? `/api/projects/${projectId}/components?${queryString}`
    : `/api/projects/${projectId}/components`;
  const response = await apiClient<
    Component[] | ProjectComponentsCollectionResponse
  >(url);
  return normalizeProjectComponents(response);
}

/**
 * 프로젝트 활동 로그 조회
 * GET /api/projects/:id/activities
 */
export async function fetchProjectActivities(
  projectId: string,
  options: ProjectActivityQueryOptions = {}
): Promise<ProjectActivity[]> {
  const params = new URLSearchParams();
  if (options.limit != null) params.set('limit', String(options.limit));
  if (options.offset != null) params.set('offset', String(options.offset));

  const query = params.toString();
  const url = query
    ? `/api/projects/${projectId}/activities?${query}`
    : `/api/projects/${projectId}/activities`;

  return apiClient<ProjectActivity[]>(url);
}
