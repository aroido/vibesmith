/**
 * Projects API Resources
 * 프로젝트 및 프리셋 관련 공통 API 엔드포인트
 */

import { apiClient, apiFetch } from '../client';

/** 프로젝트 응답 타입 */
export interface ProjectResponse {
  id: string;
  name: string;
  path: string;
  is_global: boolean;
  platform?: string;
  platforms?: string[];
  component_count: number;
  last_scanned_at?: string;
  dir_exists?: boolean;
  has_claude_dir?: boolean;
  created_at: string;
  updated_at: string;
}

export type ConflictPolicy = 'fail' | 'skip' | 'rename' | 'overwrite';
export type ProjectTemplateScope = 'all' | 'system' | 'user';
export type ProjectPresetType = 'template' | 'snapshot';

export interface ProjectTemplateComponentBlueprint {
  component_type: 'skill' | 'agent' | 'command' | 'hook' | 'rule';
  template_id?: string | null;
  name: string;
  description?: string | null;
  platform: 'claude_code' | 'cursor';
  config: Record<string, unknown>;
  content?: string | null;
  frontmatter?: Record<string, unknown> | null;
  tags?: string[];
  source_component_id?: string | null;
  order_index?: number | null;
}

export interface ProjectTemplateSummaryResponse {
  id: string;
  name: string;
  description: string;
  scope: Exclude<ProjectTemplateScope, 'all'>;
  preset_type: ProjectPresetType;
  version: number;
  latest_revision: number;
  revisions_count: number;
  component_count: number;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ProjectTemplateResponse extends ProjectTemplateSummaryResponse {
  components: ProjectTemplateComponentBlueprint[];
}

export interface ProjectTemplateListResponse {
  items: ProjectTemplateSummaryResponse[];
  total: number;
}

export interface GetProjectTemplatesOptions {
  q?: string;
  scope?: ProjectTemplateScope;
  limit?: number;
  offset?: number;
}

export interface ProjectTemplateCreateRequest {
  name: string;
  description: string;
  tags?: string[];
  preset_type?: ProjectPresetType;
  components: ProjectTemplateComponentBlueprint[];
  change_note?: string | null;
}

export interface ProjectTemplateFromProjectRequest {
  source_project_id: string;
  name: string;
  description: string;
  tags?: string[];
  component_ids: string[];
  include_disabled?: boolean;
  conflict_if_name_exists?: boolean;
}

export interface ProjectTemplateRevisionSummaryResponse {
  revision: number;
  preset_type: ProjectPresetType;
  created_at: string;
  created_by?: string | null;
  change_note: string;
  item_count: number;
}

export interface ProjectTemplateRevisionResponse
  extends ProjectTemplateRevisionSummaryResponse {
  template_id: string;
  items: ProjectTemplateComponentBlueprint[];
}

export interface ProjectTemplateRevisionListResponse {
  items: ProjectTemplateRevisionSummaryResponse[];
  total: number;
}

export interface PresetPreviewRequest {
  preset_id: string;
  revision?: number;
  conflict_policy?: ConflictPolicy;
}

export interface PresetPreviewSummary {
  to_create: number;
  to_update: number;
  to_skip: number;
  to_rename: number;
  conflicts: number;
}

export interface PresetPreviewItem {
  name: string;
  type: 'skill' | 'agent' | 'command' | 'hook' | 'rule';
  platform: 'claude_code' | 'cursor';
  action: 'create' | 'update' | 'skip' | 'rename' | 'conflict';
  reason: string;
  target_component_id?: string | null;
  renamed_to?: string | null;
}

export interface PresetPreviewResponse {
  project_id: string;
  preset_id: string;
  revision: number;
  policy: ConflictPolicy;
  summary: PresetPreviewSummary;
  items: PresetPreviewItem[];
  last_policy?: ConflictPolicy | null;
}

export interface PresetApplyRequest {
  preset_id: string;
  revision?: number;
  conflict_policy?: ConflictPolicy;
}

export interface PresetApplySummary {
  created: number;
  updated: number;
  skipped: number;
  renamed: number;
  failed: number;
}

export interface PresetApplyResponse {
  project_id: string;
  preset_id: string;
  revision: number;
  policy: ConflictPolicy;
  summary: PresetApplySummary;
  items: PresetPreviewItem[];
}

export interface CreateProjectWithPresetRequest {
  path: string;
  preset_id: string;
  revision?: number;
  conflict_policy?: ConflictPolicy;
  name?: string;
  scan_after_create?: boolean;
}

export interface AppliedPresetResponse {
  id: string;
  name: string;
  version: number;
  revision: number;
}

export interface CreateProjectWithPresetResponse {
  project: ProjectResponse;
  applied_preset: AppliedPresetResponse;
  created_components: number;
  scanned_components: number;
}

/** 프로젝트 목록 조회 */
export async function getProjects(): Promise<ProjectResponse[]> {
  return apiClient('/api/projects');
}

/** 프로젝트 프리셋 목록 조회 */
export async function getProjectTemplates(
  options: GetProjectTemplatesOptions = {}
): Promise<ProjectTemplateListResponse> {
  const params = new URLSearchParams();

  if (options.q?.trim()) params.set('q', options.q.trim());
  if (options.scope) params.set('scope', options.scope);
  if (typeof options.limit === 'number') params.set('limit', String(options.limit));
  if (typeof options.offset === 'number') params.set('offset', String(options.offset));

  const query = params.toString();
  const path = query ? `/api/project-templates?${query}` : '/api/project-templates';
  return apiClient<ProjectTemplateListResponse>(path);
}

/** 프로젝트 프리셋 상세 조회 */
export async function getProjectTemplate(templateId: string): Promise<ProjectTemplateResponse> {
  return apiClient<ProjectTemplateResponse>(`/api/project-templates/${templateId}`);
}

/** 프로젝트 프리셋 생성 */
export async function createProjectTemplate(
  request: ProjectTemplateCreateRequest
): Promise<ProjectTemplateResponse> {
  return apiClient<ProjectTemplateResponse>('/api/project-templates', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/** 프로젝트 프리셋 수정 (immutable revision append) */
export async function updateProjectTemplate(
  templateId: string,
  request: ProjectTemplateCreateRequest
): Promise<ProjectTemplateResponse> {
  return apiClient<ProjectTemplateResponse>(`/api/project-templates/${templateId}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

/** 프로젝트 프리셋 삭제 */
export async function deleteProjectTemplate(templateId: string): Promise<void> {
  await apiFetch(`/api/project-templates/${templateId}`, { method: 'DELETE' });
}

/** 프로젝트 컴포넌트 선택 기반 snapshot 프리셋 생성 */
export async function createProjectTemplateFromProject(
  request: ProjectTemplateFromProjectRequest
): Promise<ProjectTemplateResponse> {
  return apiClient<ProjectTemplateResponse>('/api/project-templates/from-project', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/** 프리셋 revision 목록 조회 */
export async function getProjectTemplateRevisions(
  templateId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<ProjectTemplateRevisionListResponse> {
  const params = new URLSearchParams();
  if (typeof options.limit === 'number') params.set('limit', String(options.limit));
  if (typeof options.offset === 'number') params.set('offset', String(options.offset));
  const query = params.toString();
  const path = query
    ? `/api/project-templates/${templateId}/revisions?${query}`
    : `/api/project-templates/${templateId}/revisions`;
  return apiClient<ProjectTemplateRevisionListResponse>(path);
}

/** 프리셋 revision 상세 조회 */
export async function getProjectTemplateRevision(
  templateId: string,
  revision: number
): Promise<ProjectTemplateRevisionResponse> {
  return apiClient<ProjectTemplateRevisionResponse>(
    `/api/project-templates/${templateId}/revisions/${revision}`
  );
}

/** 프리셋 revision 복원 (새 revision 생성) */
export async function restoreProjectTemplateRevision(
  templateId: string,
  revision: number,
  changeNote?: string
): Promise<ProjectTemplateRevisionResponse> {
  return apiClient<ProjectTemplateRevisionResponse>(
    `/api/project-templates/${templateId}/revisions/${revision}/restore`,
    {
      method: 'POST',
      body: JSON.stringify({ change_note: changeNote ?? null }),
    }
  );
}

/** 프로젝트 프리셋 적용 preview */
export async function previewProjectPreset(
  projectId: string,
  request: PresetPreviewRequest
): Promise<PresetPreviewResponse> {
  return apiClient<PresetPreviewResponse>(`/api/projects/${projectId}/preset-preview`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/** 프로젝트 프리셋 적용 실행 */
export async function applyProjectPreset(
  projectId: string,
  request: PresetApplyRequest
): Promise<PresetApplyResponse> {
  return apiClient<PresetApplyResponse>(`/api/projects/${projectId}/apply-preset`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/** 프리셋 기반 프로젝트 생성 */
export async function createProjectWithPreset(
  request: CreateProjectWithPresetRequest
): Promise<CreateProjectWithPresetResponse> {
  return apiClient<CreateProjectWithPresetResponse>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/** 프로젝트 삭제 */
export async function deleteProject(id: string): Promise<void> {
  await apiFetch(`/api/projects/${id}`, {
    method: 'DELETE',
  });
}

/** 프로젝트별 구성요소 항목 (GET /api/projects/{id}/components 응답) */
export interface ProjectComponentItem {
  id: string;
  type: string;
  name: string;
  description?: string;
  enabled: boolean;
  tags: string[];
  project_id: string;
  path: string;
  created_at: string;
  updated_at: string;
}

/** 백엔드 Paginated 응답 형식 */
interface PaginatedComponentsResponse {
  items: ProjectComponentItem[];
  total: number;
}

/** 프로젝트별 구성요소 목록 조회 */
export async function getProjectComponents(projectId: string): Promise<ProjectComponentItem[]> {
  const res = await apiClient<PaginatedComponentsResponse | ProjectComponentItem[]>(
    `/api/projects/${projectId}/components`
  );
  return Array.isArray(res) ? res : res.items ?? [];
}
