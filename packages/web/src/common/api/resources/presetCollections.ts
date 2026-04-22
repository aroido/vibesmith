import { apiClient, apiFetch } from '../client';

export type PresetScope = 'all' | 'system' | 'user';
export type PresetWritableScope = Exclude<PresetScope, 'all'>;
export type PresetComponentType = 'skill' | 'agent' | 'command' | 'hook' | 'rule';
export type PresetPlatform = 'claude_code' | 'cursor';
export type PinMode = 'pin' | 'latest';
export type CollectionConflictPolicy = 'fail' | 'skip' | 'rename' | 'overwrite';

export interface PresetSummaryResponse {
  id: string;
  name: string;
  component_type: PresetComponentType;
  platform: PresetPlatform;
  description: string;
  scope: PresetWritableScope;
  tags: string[];
  latest_revision: number;
  revisions_count: number;
  created_at: string;
  updated_at: string;
}

export type PresetResponse = PresetSummaryResponse;

export interface PresetListResponse {
  items: PresetSummaryResponse[];
  total: number;
}

export interface PresetRevisionSummaryResponse {
  revision: number;
  created_at: string;
  created_by?: string | null;
  change_note: string;
  content_hash: string;
}

export interface PresetRevisionResponse extends PresetRevisionSummaryResponse {
  preset_id: string;
  content: string;
  frontmatter: Record<string, unknown>;
  tags: string[];
}

export interface PresetRevisionListResponse {
  items: PresetRevisionSummaryResponse[];
  total: number;
}

export interface CollectionItemInput {
  preset_id: string;
  order_index?: number | null;
  pin_mode: PinMode;
  pinned_revision?: number | null;
  alias_name?: string | null;
}

export interface CollectionItemResolvedResponse {
  order_index: number;
  preset_id: string;
  pin_mode: PinMode;
  pinned_revision?: number | null;
  resolved_revision: number;
  alias_name?: string | null;
  preset_name?: string | null;
}

export interface CollectionSummaryResponse {
  id: string;
  name: string;
  description: string;
  scope: PresetWritableScope;
  tags: string[];
  latest_revision: number;
  revisions_count: number;
  items_count: number;
  created_at: string;
  updated_at: string;
}

export interface CollectionResponse extends CollectionSummaryResponse {
  items: CollectionItemResolvedResponse[];
}

export interface CollectionListResponse {
  items: CollectionSummaryResponse[];
  total: number;
}

export interface CollectionRevisionSummaryResponse {
  revision: number;
  created_at: string;
  created_by?: string | null;
  change_note: string;
  item_count: number;
}

export interface CollectionRevisionResponse extends CollectionRevisionSummaryResponse {
  collection_id: string;
  revision_id: string;
  items: CollectionItemResolvedResponse[];
}

export interface CollectionRevisionListResponse {
  items: CollectionRevisionSummaryResponse[];
  total: number;
}

export interface PresetCreateRequest {
  name: string;
  component_type: PresetComponentType;
  platform: PresetPlatform;
  description?: string;
  scope?: PresetWritableScope;
  tags?: string[];
  content: string;
  frontmatter?: Record<string, unknown> | null;
  change_note?: string | null;
}

export interface PresetFromProjectRequest {
  source_project_id: string;
  component_id: string;
  name: string;
  description?: string | null;
  tags?: string[];
  include_disabled?: boolean;
  conflict_if_name_exists?: boolean;
  scope?: PresetWritableScope;
}

export interface CollectionCreateRequest {
  name: string;
  description?: string;
  scope?: PresetWritableScope;
  tags?: string[];
  items: CollectionItemInput[];
  change_note?: string | null;
}

export interface GetPresetsOptions {
  q?: string;
  scope?: PresetScope;
  component_type?: PresetComponentType;
  platform?: PresetPlatform;
  limit?: number;
  offset?: number;
}

export interface GetCollectionsOptions {
  q?: string;
  scope?: PresetScope;
  limit?: number;
  offset?: number;
}

export interface CollectionPreviewRequest {
  project_id: string;
  revision?: number;
  conflict_policy?: CollectionConflictPolicy;
  item_overrides?: Record<string, CollectionConflictPolicy>;
}

export interface CollectionPreviewSummary {
  to_create: number;
  to_update: number;
  to_skip: number;
  to_rename: number;
  conflicts: number;
}

export interface CollectionPreviewItem {
  preset_id: string;
  preset_revision: number;
  name: string;
  type: PresetComponentType;
  platform: PresetPlatform;
  action: 'create' | 'update' | 'skip' | 'rename' | 'conflict';
  reason: string;
  target_component_id?: string | null;
  renamed_to?: string | null;
  existing_content?: string | null;
  new_content?: string | null;
}

export interface CollectionPreviewResponse {
  project_id: string;
  collection_id: string;
  collection_revision_id: string;
  revision: number;
  policy: CollectionConflictPolicy;
  summary: CollectionPreviewSummary;
  items: CollectionPreviewItem[];
  last_policy?: CollectionConflictPolicy | null;
}

export interface CollectionApplyRequest {
  project_id: string;
  revision?: number;
  conflict_policy?: CollectionConflictPolicy;
  item_overrides?: Record<string, CollectionConflictPolicy>;
}

export interface CollectionApplySummary {
  created: number;
  updated: number;
  skipped: number;
  renamed: number;
  failed: number;
}

export interface CollectionApplyResponse {
  project_id: string;
  collection_id: string;
  collection_revision_id: string;
  revision: number;
  policy: CollectionConflictPolicy;
  summary: CollectionApplySummary;
  items: CollectionPreviewItem[];
}

export async function getPresets(
  options: GetPresetsOptions = {}
): Promise<PresetListResponse> {
  const params = new URLSearchParams();
  if (options.q?.trim()) params.set('q', options.q.trim());
  if (options.scope) params.set('scope', options.scope);
  if (options.component_type) params.set('component_type', options.component_type);
  if (options.platform) params.set('platform', options.platform);
  if (typeof options.limit === 'number') params.set('limit', String(options.limit));
  if (typeof options.offset === 'number') params.set('offset', String(options.offset));

  const query = params.toString();
  const path = query ? `/api/presets?${query}` : '/api/presets';
  return apiClient<PresetListResponse>(path);
}

export async function getPreset(presetId: string): Promise<PresetResponse> {
  return apiClient<PresetResponse>(`/api/presets/${presetId}`);
}

export async function createPreset(request: PresetCreateRequest): Promise<PresetResponse> {
  return apiClient<PresetResponse>('/api/presets', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function createPresetFromProject(
  request: PresetFromProjectRequest
): Promise<PresetResponse> {
  return apiClient<PresetResponse>('/api/presets/from-project', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function updatePreset(
  presetId: string,
  request: PresetCreateRequest
): Promise<PresetResponse> {
  return apiClient<PresetResponse>(`/api/presets/${presetId}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

export async function deletePreset(presetId: string): Promise<void> {
  await apiFetch(`/api/presets/${presetId}`, { method: 'DELETE' });
}

export async function getPresetRevisions(
  presetId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<PresetRevisionListResponse> {
  const params = new URLSearchParams();
  if (typeof options.limit === 'number') params.set('limit', String(options.limit));
  if (typeof options.offset === 'number') params.set('offset', String(options.offset));
  const query = params.toString();
  const path = query
    ? `/api/presets/${presetId}/revisions?${query}`
    : `/api/presets/${presetId}/revisions`;
  return apiClient<PresetRevisionListResponse>(path);
}

export async function getPresetRevision(
  presetId: string,
  revision: number
): Promise<PresetRevisionResponse> {
  return apiClient<PresetRevisionResponse>(`/api/presets/${presetId}/revisions/${revision}`);
}

export async function restorePresetRevision(
  presetId: string,
  revision: number,
  changeNote?: string
): Promise<PresetRevisionResponse> {
  return apiClient<PresetRevisionResponse>(`/api/presets/${presetId}/revisions/${revision}/restore`, {
    method: 'POST',
    body: JSON.stringify({ change_note: changeNote ?? null }),
  });
}

export async function getCollections(
  options: GetCollectionsOptions = {}
): Promise<CollectionListResponse> {
  const params = new URLSearchParams();
  if (options.q?.trim()) params.set('q', options.q.trim());
  if (options.scope) params.set('scope', options.scope);
  if (typeof options.limit === 'number') params.set('limit', String(options.limit));
  if (typeof options.offset === 'number') params.set('offset', String(options.offset));

  const query = params.toString();
  const path = query ? `/api/collections?${query}` : '/api/collections';
  return apiClient<CollectionListResponse>(path);
}

export async function getCollection(collectionId: string): Promise<CollectionResponse> {
  return apiClient<CollectionResponse>(`/api/collections/${collectionId}`);
}

export async function createCollection(
  request: CollectionCreateRequest
): Promise<CollectionResponse> {
  return apiClient<CollectionResponse>('/api/collections', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function updateCollection(
  collectionId: string,
  request: CollectionCreateRequest
): Promise<CollectionResponse> {
  return apiClient<CollectionResponse>(`/api/collections/${collectionId}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

export async function deleteCollection(collectionId: string): Promise<void> {
  await apiFetch(`/api/collections/${collectionId}`, { method: 'DELETE' });
}

export async function getCollectionRevisions(
  collectionId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<CollectionRevisionListResponse> {
  const params = new URLSearchParams();
  if (typeof options.limit === 'number') params.set('limit', String(options.limit));
  if (typeof options.offset === 'number') params.set('offset', String(options.offset));
  const query = params.toString();
  const path = query
    ? `/api/collections/${collectionId}/revisions?${query}`
    : `/api/collections/${collectionId}/revisions`;
  return apiClient<CollectionRevisionListResponse>(path);
}

export async function getCollectionRevision(
  collectionId: string,
  revision: number
): Promise<CollectionRevisionResponse> {
  return apiClient<CollectionRevisionResponse>(
    `/api/collections/${collectionId}/revisions/${revision}`
  );
}

export async function restoreCollectionRevision(
  collectionId: string,
  revision: number,
  changeNote?: string
): Promise<CollectionRevisionResponse> {
  return apiClient<CollectionRevisionResponse>(
    `/api/collections/${collectionId}/revisions/${revision}/restore`,
    {
      method: 'POST',
      body: JSON.stringify({ change_note: changeNote ?? null }),
    }
  );
}

export async function previewCollectionApply(
  collectionId: string,
  request: CollectionPreviewRequest
): Promise<CollectionPreviewResponse> {
  return apiClient<CollectionPreviewResponse>(`/api/collections/${collectionId}/preview`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function applyCollection(
  collectionId: string,
  request: CollectionApplyRequest
): Promise<CollectionApplyResponse> {
  return apiClient<CollectionApplyResponse>(`/api/collections/${collectionId}/apply`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}
