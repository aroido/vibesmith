/**
 * Project Detail Types
 * v1.10.0 - 프로젝트 상세 페이지 타입 정의
 */

import type { Component, ComponentType } from '../../../common/types';

/**
 * 프로젝트 상세 정보
 */
export interface ProjectDetail {
  id: string;
  name: string;
  path: string;
  is_global: boolean;
  component_count: number;
  last_scanned_at: string | null;
  dir_exists: boolean;
  platforms: string[];
  breakdown: ProjectBreakdown;
}

/**
 * 프로젝트 타입별 구성요소 개수
 */
export interface ProjectBreakdown {
  skill: number;
  agent: number;
  command: number;
  hook: number;
  rule: number;
}

export type ProjectActivityType =
  | 'component_created'
  | 'component_updated'
  | 'component_deleted'
  | 'preset_applied';

export interface ProjectActivity {
  id: string;
  activity_type: ProjectActivityType;
  component_id: string | null;
  component_name: string;
  component_type: string;
  created_at: string;
}

export interface ProjectActivityQueryOptions {
  limit?: number;
  offset?: number;
}

/**
 * 프로젝트별 구성요소 필터
 */
export interface ProjectComponentFilters {
  type?: TabType;
  search?: string;
  sortBy?: 'name' | 'date';
}

/**
 * 탭 타입 (Overview + ComponentType)
 */
export type TabType = 'overview' | ComponentType;

/**
 * 프로젝트 상세 페이지 상태
 */
export interface ProjectDetailState {
  project: ProjectDetail | null;
  components: Component[];
  selectedTab: TabType;
  searchQuery: string;
  sortBy: 'name' | 'date';
  loading: boolean;
  error: Error | null;
}
