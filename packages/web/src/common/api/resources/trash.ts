/**
 * Trash API Resources
 * 휴지통 관련 API 엔드포인트
 * Backend #165 구현 시 실제 API 연동
 */

import { apiClient, apiFetch } from '../client';

/** 휴지통 항목 타입 */
export type TrashItemType =
  | 'skill'
  | 'agent'
  | 'command'
  | 'hook'
  | 'rule';

/** 휴지통 항목 (삭제된 구성요소) */
export interface TrashItem {
  id: string;
  name: string;
  type: TrashItemType;
  description: string;
  deleted_at: string;
  original_path: string;
  project_name: string;
  content?: string;
}

/** 복원 API 응답 */
export interface RestoreResponse {
  message: string;
  component_id: string;
}

/**
 * 휴지통 목록 조회
 * GET /api/trash
 * @throws API 오류 시 상위로 전파 (React Query error 상태로 표시)
 */
export async function getTrashList(): Promise<TrashItem[]> {
  const data = await apiClient<TrashItem[] | { items: TrashItem[] }>(
    '/api/trash'
  );
  if (Array.isArray(data)) return data;
  return data.items ?? [];
}

/**
 * 휴지통 항목 복원
 * POST /api/trash/{id}/restore
 */
export async function restoreTrashItem(id: string): Promise<RestoreResponse> {
  return apiClient<RestoreResponse>(`/api/trash/${id}/restore`, {
    method: 'POST',
  });
}

/**
 * 휴지통 항목 영구 삭제
 * DELETE /api/trash/{id}
 */
export async function permanentDeleteTrashItem(id: string): Promise<void> {
  await apiFetch(`/api/trash/${id}`, { method: 'DELETE' });
}

/**
 * 휴지통 비우기
 * DELETE /api/trash
 */
export async function emptyTrash(): Promise<void> {
  await apiFetch('/api/trash', { method: 'DELETE' });
}
