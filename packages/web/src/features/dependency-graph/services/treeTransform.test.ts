// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { buildDependencyTree } from './treeTransform';
import type { GraphData, GraphNode, GraphEdge } from '../types';

function makeNode(overrides: Partial<GraphNode> & { id: string }): GraphNode {
  return {
    name: overrides.id,
    type: 'skill',
    project_id: 'proj-1',
    enabled: true,
    platform: 'claude_code',
    ...overrides,
  };
}

function makeEdge(source: string, target: string, overrides?: Partial<GraphEdge>): GraphEdge {
  return { source, target, type: 'context', ...overrides };
}

/** Helper: get all type groups from the first platform group */
function getTypeGroups(result: ReturnType<typeof buildDependencyTree>, projectIdx = 0) {
  return result[projectIdx].platformGroups[0].typeGroups;
}

describe('buildDependencyTree', () => {
  const emptyData: GraphData = { nodes: [], edges: [], cycles: [] };

  it('빈 데이터를 입력하면 빈 배열을 반환한다', () => {
    const result = buildDependencyTree(emptyData, new Set(), new Map());
    expect(result).toEqual([]);
  });

  it('노드를 프로젝트별로 그룹화한다', () => {
    const data: GraphData = {
      nodes: [
        makeNode({ id: 'a', project_id: 'proj-1' }),
        makeNode({ id: 'b', project_id: 'proj-2' }),
      ],
      edges: [],
      cycles: [],
    };
    const names = new Map([['proj-1', 'Project 1'], ['proj-2', 'Project 2']]);
    const result = buildDependencyTree(data, new Set(), names);

    expect(result).toHaveLength(2);
    expect(result.map((g) => g.projectId)).toEqual(['proj-1', 'proj-2']);
  });

  it('글로벌 프로젝트가 먼저 정렬된다', () => {
    const data: GraphData = {
      nodes: [
        makeNode({ id: 'a', project_id: 'proj-local' }),
        makeNode({ id: 'b', project_id: 'proj-global' }),
      ],
      edges: [],
      cycles: [],
    };
    const names = new Map([['proj-local', 'Local'], ['proj-global', 'Global']]);
    const result = buildDependencyTree(data, new Set(['proj-global']), names);

    expect(result[0].projectId).toBe('proj-global');
    expect(result[0].isGlobal).toBe(true);
    expect(result[1].projectId).toBe('proj-local');
    expect(result[1].isGlobal).toBe(false);
  });

  it('글로벌이 아닌 프로젝트는 이름순으로 정렬된다', () => {
    const data: GraphData = {
      nodes: [
        makeNode({ id: 'a', project_id: 'proj-z' }),
        makeNode({ id: 'b', project_id: 'proj-a' }),
        makeNode({ id: 'c', project_id: 'proj-m' }),
      ],
      edges: [],
      cycles: [],
    };
    const names = new Map([['proj-z', 'Zebra'], ['proj-a', 'Alpha'], ['proj-m', 'Mike']]);
    const result = buildDependencyTree(data, new Set(), names);

    expect(result.map((g) => g.projectName)).toEqual(['Alpha', 'Mike', 'Zebra']);
  });

  it('프로젝트 내에서 타입별로 그룹화하고 정해진 순서를 따른다', () => {
    const data: GraphData = {
      nodes: [
        makeNode({ id: 'a', type: 'hook' }),
        makeNode({ id: 'b', type: 'skill' }),
        makeNode({ id: 'c', type: 'command' }),
      ],
      edges: [],
      cycles: [],
    };
    const names = new Map([['proj-1', 'Project 1']]);
    const result = buildDependencyTree(data, new Set(), names);

    const types = getTypeGroups(result).map((g) => g.type);
    expect(types).toEqual(['skill', 'command', 'hook']);
  });

  it('빈 타입 그룹은 건너뛴다', () => {
    const data: GraphData = {
      nodes: [makeNode({ id: 'a', type: 'skill' })],
      edges: [],
      cycles: [],
    };
    const names = new Map([['proj-1', 'Project 1']]);
    const result = buildDependencyTree(data, new Set(), names);

    expect(getTypeGroups(result)).toHaveLength(1);
    expect(getTypeGroups(result)[0].type).toBe('skill');
  });

  it('edge의 source에서 target으로 dependsOn 자식을 생성한다', () => {
    const data: GraphData = {
      nodes: [
        makeNode({ id: 'parent', type: 'skill' }),
        makeNode({ id: 'child', type: 'agent' }),
      ],
      edges: [makeEdge('parent', 'child')],
      cycles: [],
    };
    const names = new Map([['proj-1', 'Project 1']]);
    const result = buildDependencyTree(data, new Set(), names);

    const skillGroup = getTypeGroups(result).find((g) => g.type === 'skill');
    expect(skillGroup).toBeDefined();
    const parentNode = skillGroup!.nodes[0];
    expect(parentNode.id).toBe('parent');
    expect(parentNode.dependsOn).toHaveLength(1);
    expect(parentNode.dependsOn[0].id).toBe('child');
  });

  it('재귀적으로 dependsOn 자식을 확장한다', () => {
    const data: GraphData = {
      nodes: [
        makeNode({ id: 'a' }),
        makeNode({ id: 'b' }),
        makeNode({ id: 'c' }),
      ],
      edges: [makeEdge('a', 'b'), makeEdge('b', 'c')],
      cycles: [],
    };
    const names = new Map([['proj-1', 'P']]);
    const result = buildDependencyTree(data, new Set(), names);

    const nodeA = getTypeGroups(result)[0].nodes.find((n) => n.id === 'a')!;
    expect(nodeA.dependsOn[0].id).toBe('b');
    expect(nodeA.dependsOn[0].dependsOn[0].id).toBe('c');
    expect(nodeA.dependsOn[0].dependsOn[0].dependsOn).toEqual([]);
  });

  it('순환 참조가 있으면 isCyclic=true로 표시하고 재귀를 멈춘다', () => {
    const data: GraphData = {
      nodes: [
        makeNode({ id: 'a' }),
        makeNode({ id: 'b' }),
      ],
      edges: [makeEdge('a', 'b'), makeEdge('b', 'a')],
      cycles: [['a', 'b', 'a']],
    };
    const names = new Map([['proj-1', 'P']]);
    const result = buildDependencyTree(data, new Set(), names);

    const nodeA = getTypeGroups(result)[0].nodes.find((n) => n.id === 'a')!;
    const childB = nodeA.dependsOn[0];
    expect(childB.id).toBe('b');
    // b depends on a, but a is ancestor so it should be cyclic
    const cyclicA = childB.dependsOn[0];
    expect(cyclicA.id).toBe('a');
    expect(cyclicA.isCyclic).toBe(true);
    expect(cyclicA.dependsOn).toEqual([]);
  });

  it('isBroken을 edge의 is_broken 플래그에서 가져온다', () => {
    const data: GraphData = {
      nodes: [
        makeNode({ id: 'a' }),
        makeNode({ id: 'b' }),
      ],
      edges: [makeEdge('a', 'b', { is_broken: true })],
      cycles: [],
    };
    const names = new Map([['proj-1', 'P']]);
    const result = buildDependencyTree(data, new Set(), names);

    const nodeA = getTypeGroups(result)[0].nodes.find((n) => n.id === 'a')!;
    expect(nodeA.isBroken).toBe(false);
    expect(nodeA.dependsOn[0].isBroken).toBe(true);
  });

  it('isGlobal은 노드의 project_id가 globalProjectIds에 있을 때 true', () => {
    const data: GraphData = {
      nodes: [
        makeNode({ id: 'a', project_id: 'global-proj' }),
        makeNode({ id: 'b', project_id: 'local-proj' }),
      ],
      edges: [makeEdge('a', 'b')],
      cycles: [],
    };
    const names = new Map([['global-proj', 'Global'], ['local-proj', 'Local']]);
    const result = buildDependencyTree(data, new Set(['global-proj']), names);

    const globalGroup = result.find((g) => g.projectId === 'global-proj')!;
    const nodeA = getTypeGroups(result, result.indexOf(globalGroup))[0].nodes[0];
    expect(nodeA.isGlobal).toBe(true);

    // child b is from local-proj, so isGlobal should be false
    expect(nodeA.dependsOn[0].isGlobal).toBe(false);
  });

  it('projectName이 Map에 없으면 projectId를 이름으로 사용한다', () => {
    const data: GraphData = {
      nodes: [makeNode({ id: 'a', project_id: 'unknown-proj' })],
      edges: [],
      cycles: [],
    };
    const result = buildDependencyTree(data, new Set(), new Map());

    expect(result[0].projectName).toBe('unknown-proj');
  });

  it('비활성 노드도 올바르게 표시한다', () => {
    const data: GraphData = {
      nodes: [makeNode({ id: 'a', enabled: false })],
      edges: [],
      cycles: [],
    };
    const names = new Map([['proj-1', 'P']]);
    const result = buildDependencyTree(data, new Set(), names);

    expect(getTypeGroups(result)[0].nodes[0].enabled).toBe(false);
  });

  it('플랫폼별로 그룹화한다', () => {
    const data: GraphData = {
      nodes: [
        makeNode({ id: 'a', platform: 'claude_code' }),
        makeNode({ id: 'b', platform: 'cursor' }),
      ],
      edges: [],
      cycles: [],
    };
    const names = new Map([['proj-1', 'P']]);
    const result = buildDependencyTree(data, new Set(), names);

    expect(result[0].platformGroups).toHaveLength(2);
    expect(result[0].platformGroups[0].platform).toBe('claude_code');
    expect(result[0].platformGroups[1].platform).toBe('cursor');
  });
});
