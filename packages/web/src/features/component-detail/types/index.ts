/**
 * Component Detail feature types
 * Based on docs/03_API_SPEC.md §2.2
 */

import type { ComponentType } from '@/common/types';

export type { ComponentType };

/** 종속성 항목 */
export interface DependencyItem {
  id: string;
  name: string;
  type: ComponentType;
}

/** 종속성 정보 */
export interface DependencyInfo {
  depends_on: DependencyItem[];
  depended_by: DependencyItem[];
}

/** POST /api/components/{id}/toggle 응답 (docs/03_API_SPEC.md §2.6) */
export interface ToggleResponse {
  id: string;
  enabled: boolean;
  affected_dependencies: DependencyItem[];
}

/** 복사 API 응답 - POST /api/components/{id}/copy (docs/03_API_SPEC.md §2.7) */
export interface CopiedItem {
  original_id: string;
  new_id: string;
  name: string;
  type: string;
}

export interface CopyResponse {
  copied: CopiedItem[];
}

/** API 상세 응답 타입 */
export interface ComponentDetail {
  id: string;
  type: ComponentType;
  name: string;
  description: string;
  enabled: boolean;
  tags: string[];
  project_id: string;
  project_name: string;
  path: string;
  content: string;
  frontmatter: Record<string, unknown>;
  dependencies: DependencyInfo;
  created_at: string;
  updated_at: string;
}

export type UsageTimelineDays = 1 | 7;

export interface ComponentUsageTimelineEntry {
  date: string;
  count: number;
  intensity: number;
}

export interface ComponentUsageTimeline {
  component_id: string;
  component_name: string;
  timeline: ComponentUsageTimelineEntry[];
}
