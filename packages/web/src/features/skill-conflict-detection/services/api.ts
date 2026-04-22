/**
 * Conflict API client (Spec §7)
 * Real API - Backend #164 구현 완료
 */

import { getComponent, apiFetch } from '@/common/api';
import type {
  Conflict,
  ConflictResolveRequest,
  ConflictResolveResponse,
} from '../types';

/** API response snake_case → camelCase 변환 */
function toConflict(raw: Record<string, unknown>): Conflict {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    type: raw.type as Conflict['type'],
    globalComponentId: String(raw.global_component_id ?? raw.globalComponentId ?? ''),
    projectComponentId: String(raw.project_component_id ?? raw.projectComponentId ?? ''),
    projectName: String(raw.project_name ?? raw.projectName ?? ''),
    priority: (raw.priority as Conflict['priority']) ?? 'project',
    isIntentional: Boolean(raw.is_intentional ?? raw.isIntentional ?? false),
  };
}

/**
 * GET /api/conflicts - 충돌 목록 조회
 * @param projectId - optional, 해당 프로젝트 충돌만 조회
 */
export async function getConflicts(projectId?: string): Promise<Conflict[]> {
  const url = projectId
    ? `/api/conflicts?project_id=${encodeURIComponent(projectId)}`
    : '/api/conflicts';
  const res = await apiFetch(url);
  const raw = (await res.json()) as unknown[];

  return Array.isArray(raw)
    ? raw.map((item) => toConflict(item as Record<string, unknown>))
    : [];
}

/**
 * POST /api/conflicts/:id/resolve - 충돌 해결
 */
export async function resolveConflict(
  conflictId: string,
  request: ConflictResolveRequest
): Promise<ConflictResolveResponse> {
  const body: Record<string, unknown> = {
    action: request.action,
  };
  if (request.newName) body.new_name = request.newName;
  if (request.target) body.target = request.target;

  const res = await apiFetch(`/api/conflicts/${conflictId}/resolve`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  const raw = (await res.json()) as Record<string, unknown>;
  return {
    success: Boolean(raw.success),
    conflictId: String(raw.conflict_id ?? conflictId),
    updatedComponentIds: Array.isArray(raw.updated_component_ids)
      ? raw.updated_component_ids.map(String)
      : undefined,
  };
}

/**
 * 구성요소 내용 조회 (Side-by-Side 비교용)
 * GET /api/components/:id 사용
 */
export async function getComponentContent(componentId: string): Promise<string> {
  const component = await getComponent(componentId);
  return component?.content ?? '';
}
