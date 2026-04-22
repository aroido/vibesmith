/**
 * Component Edit API client
 * 공통 API resources를 재사용
 */

import {
  getComponent,
  updateComponent as updateComponentApi,
  deleteComponent as deleteComponentApi,
  toggleComponent as toggleComponentApi,
} from '@/common/api';
import type { UpdateComponentDto } from '../types';
import type { UpdateComponentResponse } from '@/common/api';

/**
 * 구성요소 상세 조회 (공통 API 재사용)
 * GET /api/components/{id}
 */
export { getComponent };

/**
 * 구성요소 수정 (공통 API 래퍼)
 * PUT /api/components/{id}
 */
export async function updateComponent(
  id: string,
  data: UpdateComponentDto
): Promise<UpdateComponentResponse> {
  return updateComponentApi(id, data);
}

/**
 * 구성요소 삭제 (공통 API 재사용)
 * DELETE /api/components/{id}
 */
export const deleteComponent = deleteComponentApi;

/**
 * 구성요소 토글 (공통 API 재사용)
 * POST /api/components/{id}/toggle
 */
export const toggleComponent = toggleComponentApi;
