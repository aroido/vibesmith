import type { ComponentType, GraphData, GraphEdge, GraphNode } from '../types';

export interface TreeDependencyNode {
  id: string;
  name: string;
  type: ComponentType;
  platform: string;
  enabled: boolean;
  isGlobal: boolean;
  isCyclic: boolean;
  isBroken: boolean;
  dependsOn: TreeDependencyNode[];
}

export interface TreeTypeGroup {
  type: ComponentType;
  nodes: TreeDependencyNode[];
}

export interface TreePlatformGroup {
  platform: string;
  typeGroups: TreeTypeGroup[];
}

export interface TreeProjectGroup {
  projectId: string;
  projectName: string;
  isGlobal: boolean;
  platformGroups: TreePlatformGroup[];
}

const TYPE_ORDER: ComponentType[] = ['skill', 'agent', 'command', 'hook', 'rule'];
const PLATFORM_ORDER = ['claude_code', 'cursor'];

/**
 * GraphData(노드/엣지/순환)를 Project > Platform > Type > Component 계층 트리로 변환한다.
 */
export function buildDependencyTree(
  data: GraphData,
  globalProjectIds: Set<string>,
  projectNames: Map<string, string>,
): TreeProjectGroup[] {
  const { nodes, edges } = data;

  if (nodes.length === 0) return [];

  // 노드 맵 (id -> GraphNode)
  const nodeMap = new Map<string, GraphNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  // 엣지 인덱스: source -> [(target, edge)]
  const edgesBySource = new Map<string, { targetId: string; edge: GraphEdge }[]>();
  for (const edge of edges) {
    const list = edgesBySource.get(edge.source);
    if (list) {
      list.push({ targetId: edge.target, edge });
    } else {
      edgesBySource.set(edge.source, [{ targetId: edge.target, edge }]);
    }
  }

  // 프로젝트별 노드 그룹핑
  const projectNodeMap = new Map<string, GraphNode[]>();
  for (const node of nodes) {
    const list = projectNodeMap.get(node.project_id);
    if (list) {
      list.push(node);
    } else {
      projectNodeMap.set(node.project_id, [node]);
    }
  }

  // 재귀적으로 TreeDependencyNode를 빌드
  function buildNode(
    nodeId: string,
    ancestors: Set<string>,
    isBroken: boolean,
  ): TreeDependencyNode {
    const graphNode = nodeMap.get(nodeId);

    // 순환 참조 감지: 조상 경로에 이미 있으면 중단
    if (ancestors.has(nodeId)) {
      return {
        id: nodeId,
        name: graphNode?.name ?? nodeId,
        type: graphNode?.type ?? 'skill',
        platform: graphNode?.platform ?? 'unknown',
        enabled: graphNode?.enabled ?? true,
        isGlobal: globalProjectIds.has(graphNode?.project_id ?? ''),
        isCyclic: true,
        isBroken,
        dependsOn: [],
      };
    }

    const newAncestors = new Set(ancestors);
    newAncestors.add(nodeId);

    const children = edgesBySource.get(nodeId) ?? [];
    const dependsOn = children.map(({ targetId, edge }) =>
      buildNode(targetId, newAncestors, edge.is_broken ?? false),
    );

    return {
      id: nodeId,
      name: graphNode?.name ?? nodeId,
      type: graphNode?.type ?? 'skill',
      platform: graphNode?.platform ?? 'unknown',
      enabled: graphNode?.enabled ?? true,
      isGlobal: globalProjectIds.has(graphNode?.project_id ?? ''),
      isCyclic: false,
      isBroken,
      dependsOn,
    };
  }

  // 프로젝트 그룹 생성
  const projectGroups: TreeProjectGroup[] = [];

  for (const [projectId, projectNodes] of projectNodeMap) {
    const isGlobal = globalProjectIds.has(projectId);
    const projectName = projectNames.get(projectId) ?? projectId;

    // 플랫폼별 → 타입별 그룹화
    const byPlatform = new Map<string, Map<ComponentType, GraphNode[]>>();
    for (const node of projectNodes) {
      const platform = node.platform || 'unknown';
      let typeMap = byPlatform.get(platform);
      if (!typeMap) {
        typeMap = new Map();
        byPlatform.set(platform, typeMap);
      }
      const list = typeMap.get(node.type);
      if (list) {
        list.push(node);
      } else {
        typeMap.set(node.type, [node]);
      }
    }

    // 플랫폼 순서대로 그룹 생성
    const allPlatforms = [...byPlatform.keys()].sort((a, b) => {
      const ai = PLATFORM_ORDER.indexOf(a);
      const bi = PLATFORM_ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    const platformGroups: TreePlatformGroup[] = [];
    for (const platform of allPlatforms) {
      const typeMap = byPlatform.get(platform)!;

      const typeGroups: TreeTypeGroup[] = [];
      for (const type of TYPE_ORDER) {
        const typeNodes = typeMap.get(type);
        if (!typeNodes || typeNodes.length === 0) continue;

        typeGroups.push({
          type,
          nodes: typeNodes.map((node) => buildNode(node.id, new Set(), false)),
        });
      }

      if (typeGroups.length > 0) {
        platformGroups.push({ platform, typeGroups });
      }
    }

    projectGroups.push({
      projectId,
      projectName,
      isGlobal,
      platformGroups,
    });
  }

  // 정렬: 글로벌 프로젝트 먼저, 그 다음 이름순
  projectGroups.sort((a, b) => {
    if (a.isGlobal && !b.isGlobal) return -1;
    if (!a.isGlobal && b.isGlobal) return 1;
    return a.projectName.localeCompare(b.projectName);
  });

  return projectGroups;
}
