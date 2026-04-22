/**
 * 공통 엔터티 타입
 * 여러 feature에서 공유하는 도메인 엔터티
 */

import type { ComponentType } from './component';

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

/** 구성요소 기본 타입 (목록용) */
export interface Component {
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
  platform?: string;
}

/** 구성요소 상세 (API 응답 기반) */
export interface ComponentDetail extends Component {
  content: string;
  frontmatter: Record<string, unknown>;
  dependencies: DependencyInfo;
}

/** 프로젝트 */
export interface Project {
  id: string;
  name: string;
  path: string;
  is_global: boolean;
  component_count?: number;
  last_scanned_at?: string;
  dir_exists?: boolean;
  has_claude_dir?: boolean;
}
