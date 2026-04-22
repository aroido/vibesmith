// TypeScript types for Dependency Graph feature

import type { ComponentType } from '@/common/types';

export type { ComponentType };
export type DependencyType = 'context' | 'body_reference';

export interface GraphNode {
  id: string;              // 구성요소 ID
  name: string;            // 구성요소 이름
  type: ComponentType;     // skill | agent | command | hook | rule
  project_id: string;      // 프로젝트 ID
  enabled: boolean;        // 활성/비활성 상태
  platform: string;        // claude_code | cursor
}

export interface GraphEdge {
  source: string;          // 소스 노드 ID
  target: string;          // 타겟 노드 ID
  type: DependencyType;    // context | body_reference
  is_broken?: boolean;     // 끊어진 참조 여부 (선택적)
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  cycles: string[][]; // 순환참조 경로 (예: [["comp_001", "comp_010", "comp_001"]])
}

export interface GraphOverviewGroup {
  id: string;
  label: string;
  subtitle: string;
  nodeIds: string[];
  nodeCount: number;
  dominantType: ComponentType;
  cycleCount: number;
  hasCycle: boolean;
  brokenEdgeCount: number;
}

export interface GraphOverviewData {
  groups: GraphOverviewGroup[];
  graph: GraphData;
}

export interface DependencyItem {
  id: string;
  name: string;
  type: ComponentType;
  dependency_type: DependencyType;
  is_broken?: boolean;            // 끊어진 참조 여부
}

export interface DependencyDetail {
  component_id: string;
  depends_on: DependencyItem[];   // 이 노드가 참조하는 것
  depended_by: DependencyItem[];  // 이 노드를 참조하는 것
}

export interface GraphFilters {
  project_id: string | null;      // null = "All"
  types: ComponentType[];          // 선택된 타입 목록
  includeGlobal: boolean;          // 글로벌 프로젝트 컴포넌트 포함 여부
}
