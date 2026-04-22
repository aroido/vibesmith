/**
 * Dependencies API MSW Handlers
 * Based on docs/api/spec.md (dependency management)
 */

import { http, HttpResponse } from 'msw';

type MockComponentType = 'skill' | 'agent' | 'command' | 'hook' | 'rule';

interface MockNode {
  id: string;
  name: string;
  type: MockComponentType;
  project_id: string;
  enabled: boolean;
}

interface MockEdge {
  source: string;
  target: string;
  type: string;
  is_broken?: boolean;
}

interface MockGraphData {
  nodes: MockNode[];
  edges: MockEdge[];
  cycles: string[][];
}

interface MockDependencyItem {
  id: string;
  name: string;
  type: string;
  dependency_type: string;
  is_broken?: boolean;
}

interface MockDependencyDetail {
  component_id: string;
  depends_on: MockDependencyItem[];
  depended_by: MockDependencyItem[];
}

const mockGraphData: MockGraphData = {
  nodes: [
    { id: 'comp_001', name: 'fastapi-route', type: 'skill', project_id: 'proj_abc123', enabled: true },
    { id: 'comp_002', name: 'pydantic-model', type: 'skill', project_id: 'proj_abc123', enabled: true },
    { id: 'comp_003', name: 'pytest-write', type: 'skill', project_id: 'proj_abc123', enabled: true },
    { id: 'comp_004', name: 'sqlite-schema', type: 'skill', project_id: 'proj_abc123', enabled: false },
    { id: 'comp_005', name: 'code-reviewer', type: 'agent', project_id: 'proj_global', enabled: true },
    { id: 'comp_006', name: 'git-commit', type: 'skill', project_id: 'proj_global', enabled: true },
  ],
  edges: [
    { source: 'comp_001', target: 'comp_002', type: 'context' },
    { source: 'comp_001', target: 'comp_003', type: 'context' },
    { source: 'comp_003', target: 'comp_001', type: 'body_reference' },
    { source: 'comp_002', target: 'comp_004', type: 'context', is_broken: true },
    { source: 'comp_005', target: 'comp_006', type: 'context' },
  ],
  cycles: [
    ['comp_001', 'comp_003', 'comp_001'],
  ],
};

const mockDependencyDetail: Record<string, MockDependencyDetail> = {
  comp_001: {
    component_id: 'comp_001',
    depends_on: [
      { id: 'comp_002', name: 'pydantic-model', type: 'skill', dependency_type: 'context' },
      { id: 'comp_003', name: 'pytest-write', type: 'skill', dependency_type: 'context' },
    ],
    depended_by: [
      { id: 'comp_003', name: 'pytest-write', type: 'skill', dependency_type: 'body_reference' },
    ],
  },
  comp_002: {
    component_id: 'comp_002',
    depends_on: [
      { id: 'comp_004', name: 'sqlite-schema', type: 'skill', dependency_type: 'context', is_broken: true },
    ],
    depended_by: [
      { id: 'comp_001', name: 'fastapi-route', type: 'skill', dependency_type: 'context' },
    ],
  },
  comp_005: {
    component_id: 'comp_005',
    depends_on: [
      { id: 'comp_006', name: 'git-commit', type: 'skill', dependency_type: 'context' },
    ],
    depended_by: [],
  },
};

const VALID_TYPES = new Set<MockComponentType>(['skill', 'agent', 'command', 'hook', 'rule']);

function normalizeTypes(values: string[]): Set<MockComponentType> | null {
  const normalized = values.filter(
    (value): value is MockComponentType => VALID_TYPES.has(value as MockComponentType),
  );
  return normalized.length > 0 ? new Set(normalized) : null;
}

function getFilteredGraphData(projectId: string | null, types: Set<MockComponentType> | null) {
  const nodes = mockGraphData.nodes.filter((node) => {
    if (projectId && node.project_id !== projectId) return false;
    if (types && !types.has(node.type)) return false;
    return true;
  });

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = mockGraphData.edges.filter(
    (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
  );
  const cycles = mockGraphData.cycles.filter((cycle) => cycle.every((id) => nodeIds.has(id)));

  return { nodes, edges, cycles };
}

export const dependenciesHandlers = [
  // GET /api/dependencies (full dependency list - graph data)
  http.get('*/api/dependencies', ({ request }) => {
    const url = new URL(request.url);
    const projectId = url.searchParams.get('project_id');
    const types = normalizeTypes(url.searchParams.getAll('type'));

    return HttpResponse.json(getFilteredGraphData(projectId, types));
  }),

  // GET /api/dependencies/:component_id (dependencies by component)
  http.get('*/api/dependencies/:component_id', ({ params }) => {
    const componentId = params.component_id as string;
    
    // Return mock detail data
    const detail = mockDependencyDetail[componentId] || {
      component_id: componentId,
      depends_on: [],
      depended_by: [],
    };
    
    return HttpResponse.json(detail);
  }),
];
