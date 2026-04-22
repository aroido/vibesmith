/**
 * Component Create feature types
 */

import type { ComponentType } from '@/common/types';

export type { ComponentType };

/** API 요청 타입 (POST /api/components) */
export interface CreateComponentDto {
  type: ComponentType;
  name: string;
  project_id: string;
  content: string;
  tags?: string[];
  /** 플랫폼 (claude_code | cursor). API 스펙 §2.3 필수 */
  platform?: string;
}

/** Feature 상태 */
export interface ComponentCreateState {
  selectedType: ComponentType;
  selectedProjectId: string;
  name: string;
  description: string;
  tags: string[];
  content: string;
  loading: boolean;
  error: Error | null;
}

/** 템플릿 타입 */
export interface ComponentTemplate {
  type: ComponentType;
  content: string;
}

/** 생성 API 응답 */
export interface ComponentCreateResponse {
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
