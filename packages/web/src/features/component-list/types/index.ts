/**
 * Component List feature types
 * Based on docs/03_API_SPEC.md §2.1
 */

import type { ComponentType } from '@/common/types';

export type { ComponentType };

/** API 응답 타입 */
export interface ComponentListItem {
  id: string;
  type: ComponentType;
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

/** 태그 필터 모드 */
export type TagFilterMode = 'or' | 'and';

/** 필터 조건 */
export interface ComponentListFilters {
  type?: ComponentType;
  types?: ComponentType[];
  project_id?: string;
  tag?: string;
  tags?: string[];
  tag_filter_mode?: TagFilterMode;
  q?: string;
  enabled?: boolean;
  platform?: string;
}

/** Feature 상태 */
export interface ComponentListState {
  components: ComponentListItem[];
  selectedTypes: ComponentType[];
  selectedProjectId: string | null;
  loading: boolean;
  error: Error | null;
}
