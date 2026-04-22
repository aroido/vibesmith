/**
 * Component Detail API client
 * 공통 API resources를 재사용하고 feature별 타입으로 래핑
 */

import type {
  ComponentDetail,
  CopyResponse,
  ToggleResponse,
  ComponentUsageTimeline,
  UsageTimelineDays,
} from '../types';
import {
  getComponent as getComponentApi,
  deleteComponent as deleteComponentApi,
  toggleComponent as toggleComponentApi,
  copyComponent as copyComponentApi,
  getProjects,
  ApiError,
  apiClient,
} from '@/common/api';

/**
 * 구성요소 상세 조회 (공통 API 래퍼)
 * GET /api/components/{id}
 */
export async function getComponent(id: string): Promise<ComponentDetail> {
  return getComponentApi(id) as Promise<ComponentDetail>;
}

/**
 * name 기반 구성요소 조회 (Issue #484)
 * 목록 API로 name 검색 후 첫 번째 결과의 상세 조회
 * GET /api/components?q={name} → GET /api/components/{id}
 */
export async function getComponentByName(name: string): Promise<ComponentDetail> {
  const { getComponents } = await import('@/common/api');
  
  // name으로 검색
  const list = await getComponents({ q: name });
  
  // 정확히 일치하는 항목 찾기 (대소문자 구분 없음)
  const match = list.find(c => c.name.toLowerCase() === name.toLowerCase());
  
  if (!match) {
    throw new ApiError(`Component not found: ${name}`, 404, 'Not found');
  }
  
  // ID로 상세 조회
  return getComponent(match.id);
}

/**
 * 구성요소 삭제 (공통 API 재사용)
 * DELETE /api/components/{id}
 */
export const deleteComponent = deleteComponentApi;

/**
 * 구성요소 On/Off 토글 (공통 API 래퍼)
 * POST /api/components/{id}/toggle
 */
export async function toggleComponent(
  id: string,
  enabled?: boolean
): Promise<ToggleResponse> {
  return toggleComponentApi(id, enabled) as Promise<ToggleResponse>;
}

/**
 * 프로젝트 목록 조회 (공통 API 재사용)
 * GET /api/projects
 */
export { getProjects };

/**
 * 구성요소 복사 (공통 API 래퍼)
 * POST /api/components/{id}/copy
 */
export async function copyComponent(
  id: string,
  targetProjectId: string,
  includeDependencies: boolean = false
): Promise<CopyResponse> {
  return copyComponentApi(id, targetProjectId, includeDependencies) as Promise<CopyResponse>;
}

/**
 * 구성요소 인라인 편집 (부분 업데이트)
 * PUT /api/components/{id}
 */
export async function updateComponent(
  id: string,
  payload: { name?: string; description?: string; tags?: string[]; content?: string }
): Promise<ComponentDetail> {
  return apiClient<ComponentDetail>(`/api/components/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/**
 * 구성요소 사용 추이 조회
 * GET /api/usage/component?component_id={id}&days={days}&limit={limit}
 */
export async function getComponentUsageTimeline(
  componentId: string,
  options?: { days?: UsageTimelineDays; limit?: number }
): Promise<ComponentUsageTimeline> {
  const days = options?.days ?? 1;
  const limit = options?.limit ?? (days === 1 ? 10 : 8);

  const query = new URLSearchParams({
    component_id: componentId,
    days: String(days),
    limit: String(limit),
  });

  return apiClient<ComponentUsageTimeline>(`/api/usage/component?${query.toString()}`);
}
