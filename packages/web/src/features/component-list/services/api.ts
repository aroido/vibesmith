/**
 * Component List API client
 * 공통 API resources를 재사용
 */

import type { ComponentListItem, ComponentListFilters } from '../types';
import {
  getComponents as getComponentsApi,
  toggleComponent as toggleComponentApi,
  bulkToggleComponents as bulkToggleComponentsApi,
  type ToggleComponentResponse,
  type BulkToggleComponentsResponse,
} from '@/common/api';

/**
 * 구성요소 목록 조회 (공통 API 래퍼)
 * GET /api/components
 * tag_filter_mode 'and' 시 클라이언트 필터링
 */
export async function getComponents(
  filters: ComponentListFilters = {}
): Promise<ComponentListItem[]> {
  const { tags = [], tag_filter_mode, types = [], ...apiFilters } = filters;
  const apiParams = { ...apiFilters };
  const normalizedTypes = types.length > 0
    ? types
    : filters.type
      ? [filters.type]
      : [];

  if (normalizedTypes.length === 1) {
    apiParams.type = normalizedTypes[0];
  } else {
    delete apiParams.type;
  }

  if (tags.length > 0) {
    apiParams.tag = tags.join(',');
  }

  const raw = await getComponentsApi(apiParams) as ComponentListItem[];
  let filtered = raw;

  if (normalizedTypes.length > 1) {
    filtered = filtered.filter((c) => normalizedTypes.includes(c.type));
  }

  if (tag_filter_mode === 'and' && tags.length > 1) {
    return filtered.filter((c) => {
      const compTags = c.tags ?? [];
      return tags.every((t) => compTags.includes(t));
    });
  }
  return filtered;
}

/**
 * 프로젝트 목록 조회 (공통 API 재사용)
 * GET /api/projects
 */
export { getProjects, getAvailableTags } from '@/common/api';
export type { TagInfo } from '@/common/api';

/**
 * 구성요소 활성화/비활성화 토글
 * POST /api/components/{id}/toggle
 */
export async function toggleComponent(
  id: string,
  enabled?: boolean
): Promise<ToggleComponentResponse> {
  return toggleComponentApi(id, enabled);
}

/**
 * 구성요소 일괄 활성화/비활성화
 * PATCH /api/components/bulk-toggle
 */
export async function bulkToggleComponents(
  componentIds: string[],
  enabled: boolean
): Promise<BulkToggleComponentsResponse> {
  return bulkToggleComponentsApi(componentIds, enabled);
}
