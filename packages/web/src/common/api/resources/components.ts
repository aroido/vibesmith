/**
 * Components API Resources
 * 구성요소 관련 공통 API 엔드포인트
 */

import { apiClient, apiFetch } from '../client';

/** 구성요소 상세 조회 응답 타입 */
export interface ComponentDetailResponse {
  id: string;
  type: string;
  name: string;
  description: string;
  content: string;
  platform: string;
  enabled: boolean;
  tags: string[];
  project_id: string;
  project_name: string;
  path: string;
  frontmatter?: Record<string, unknown> | null;
  dependencies?: {
    depends_on: Array<{ id: string; name: string; type: string }>;
    depended_by: Array<{ id: string; name: string; type: string }>;
  };
  created_at: string;
  updated_at: string;
}

/** 구성요소 목록 조회 응답 타입 */
export interface ComponentListItemResponse {
  id: string;
  type: string;
  name: string;
  description: string;
  enabled: boolean;
  tags: string[];
  project_id: string;
  project_name: string;
  path: string;
  created_at: string;
  updated_at: string;
}

/** 구성요소 생성 요청 타입 */
export interface CreateComponentRequest {
  type: string;
  name: string;
  project_id: string;
  content: string;
  tags?: string[];
  platform?: string;
}

/** 구성요소 생성 응답 타입 */
export interface CreateComponentResponse {
  id: string;
  type: string;
  name: string;
  description: string;
  enabled: boolean;
  tags: string[];
  project_id: string;
  project_name: string;
  path: string;
  created_at: string;
  updated_at: string;
}

/** 구성요소 수정 요청 타입 */
export interface UpdateComponentRequest {
  content?: string;
  tags?: string[];
}

/** 구성요소 수정 응답 타입 */
export interface UpdateComponentResponse {
  id: string;
  type: string;
  name: string;
  description: string;
  enabled: boolean;
  tags: string[];
  project_id: string;
  path: string;
  created_at: string;
  updated_at: string;
}

/** 구성요소 토글 응답 타입 */
export interface ToggleComponentResponse {
  id: string;
  enabled: boolean;
  affected_dependencies: Array<{ id: string; name: string; type: string }>;
}

/** 구성요소 일괄 토글 응답 타입 */
export interface BulkToggleComponentsResponse {
  updated_count: number;
  updated_ids: string[];
}

/** 구성요소 복사 응답 타입 */
export interface CopyComponentResponse {
  copied: Array<{
    original_id: string;
    new_id: string;
    name: string;
    type: string;
  }>;
}

/**
 * 구성요소 목록 조회
 * GET /api/components
 */
export async function getComponents(filters: {
  type?: string;
  project_id?: string;
  tag?: string;
  q?: string;
  enabled?: boolean;
  platform?: string;
} = {}): Promise<ComponentListItemResponse[]> {
  const params = new URLSearchParams();
  if (filters.type) params.set('type', filters.type);
  if (filters.project_id) params.set('project_id', filters.project_id);
  if (filters.tag) params.set('tag', filters.tag);
  if (filters.q) params.set('q', filters.q);
  if (filters.enabled !== undefined) params.set('enabled', String(filters.enabled));
  if (filters.platform) params.set('platform', filters.platform);
  
  const qs = params.toString();
  return apiClient(`/api/components${qs ? `?${qs}` : ''}`);
}

/**
 * 구성요소 상세 조회
 * GET /api/components/{id}
 */
export async function getComponent(id: string): Promise<ComponentDetailResponse> {
  return apiClient(`/api/components/${id}`);
}

/**
 * 구성요소 생성
 * POST /api/components
 */
export async function createComponent(
  data: CreateComponentRequest
): Promise<CreateComponentResponse> {
  // Issue #312: platform 미입력 시 백엔드가 프로젝트 경로(.claude/.cursor)로 자동 추론
  return apiClient('/api/components', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * 구성요소 수정
 * PUT /api/components/{id}
 */
export async function updateComponent(
  id: string,
  data: UpdateComponentRequest
): Promise<UpdateComponentResponse> {
  return apiClient(`/api/components/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * 구성요소 삭제
 * DELETE /api/components/{id}?permanent=false (Soft Delete, 휴지통 이동)
 * DELETE /api/components/{id}?permanent=true (영구 삭제)
 * Backend #165: permanent=false가 기본값
 */
export async function deleteComponent(
  id: string,
  options?: { permanent?: boolean }
): Promise<void> {
  const permanent = options?.permanent ?? false;
  const qs = new URLSearchParams({ permanent: String(permanent) });
  await apiFetch(`/api/components/${id}?${qs}`, {
    method: 'DELETE',
  });
}

/**
 * 구성요소 On/Off 토글
 * POST /api/components/{id}/toggle
 */
export async function toggleComponent(
  id: string,
  enabled?: boolean
): Promise<ToggleComponentResponse> {
  return apiClient(`/api/components/${id}/toggle`, {
    method: 'POST',
    body: JSON.stringify(enabled !== undefined ? { enabled } : {}),
  });
}

/**
 * 구성요소 일괄 On/Off 토글
 * PATCH /api/components/bulk-toggle
 */
export async function bulkToggleComponents(
  componentIds: string[],
  enabled: boolean
): Promise<BulkToggleComponentsResponse> {
  return apiClient('/api/components/bulk-toggle', {
    method: 'PATCH',
    body: JSON.stringify({
      component_ids: componentIds,
      enabled,
    }),
  });
}

/** 태그 통계 (이름 + 사용 횟수) */
export interface TagInfo {
  name: string;
  count: number;
}

/**
 * 사용 가능한 태그 목록 조회
 * 모든 컴포넌트의 태그를 집계하여 반환
 */
export async function getAvailableTags(): Promise<TagInfo[]> {
  const components = await getComponents();
  const tagMap = new Map<string, number>();

  for (const component of components) {
    const tags = component.tags ?? [];
    if (Array.isArray(tags)) {
      for (const tag of tags) {
        tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
      }
    }
  }

  return Array.from(tagMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * 구성요소 복사
 * POST /api/components/{id}/copy
 */
export async function copyComponent(
  id: string,
  targetProjectId: string,
  includeDependencies: boolean = false
): Promise<CopyComponentResponse> {
  return apiClient(`/api/components/${id}/copy`, {
    method: 'POST',
    body: JSON.stringify({
      target_project_id: targetProjectId,
      include_dependencies: includeDependencies,
    }),
  });
}

/** 버전 히스토리 항목 — GET /api/components/{id}/versions 응답 */
export interface VersionHistoryItem {
  version: number;
  content: string;
  created_at: string;
}

/** 롤백 요청 — POST /api/components/{id}/rollback */
export interface RollbackRequest {
  version: number;
}

/** 롤백 응답 */
export interface RollbackResponse {
  id: string;
  restored_version: number;
  new_version: number;
  message: string;
}

/** 구성요소 버전 목록 조회 — GET /api/components/{id}/versions */
export async function getComponentVersions(
  id: string
): Promise<VersionHistoryItem[]> {
  return apiClient(`/api/components/${id}/versions`);
}

/** 구성요소 롤백 — POST /api/components/{id}/rollback */
export async function rollbackComponent(
  id: string,
  version: number
): Promise<RollbackResponse> {
  return apiClient(`/api/components/${id}/rollback`, {
    method: 'POST',
    body: JSON.stringify({ version }),
  });
}
