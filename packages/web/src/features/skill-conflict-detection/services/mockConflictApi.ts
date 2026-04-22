/**
 * Mock Conflict API (Spec §7.3)
 * Backend GET /api/conflicts, POST /api/conflicts/:id/resolve 미구현 시 사용
 * Issue #159, #164
 */

import type { Conflict } from '../types';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Mock conflict list - 글로벌 vs 프로젝트 동일 이름 구성요소 */
export const mockConflicts: Conflict[] = [
  {
    id: 'conflict_1',
    name: 'git-commit',
    type: 'skill',
    globalComponentId: 'comp_global_1',
    projectComponentId: 'comp_proj_1',
    projectName: 'vibesmith',
    priority: 'project',
    isIntentional: false,
  },
  {
    id: 'conflict_2',
    name: 'code-review',
    type: 'skill',
    globalComponentId: 'comp_global_2',
    projectComponentId: 'comp_proj_2',
    projectName: 'vibesmith',
    priority: 'project',
    isIntentional: false,
  },
  {
    id: 'conflict_3',
    name: 'test-writer',
    type: 'skill',
    globalComponentId: 'comp_global_3',
    projectComponentId: 'comp_proj_3',
    projectName: 'vibesmith',
    priority: 'project',
    isIntentional: true,
  },
];

/** Mock global component content (git-commit) */
export const mockGlobalContent = `# Git Commit Skill (Global)

Conventional Commits 1.0.0 specification.

## Usage
- feat: new feature
- fix: bug fix
- docs: documentation
`;

/** Mock project component content (git-commit) */
export const mockProjectContent = `# Git Commit Skill (Babitalk)

Babitalk 커밋 컨벤션.

## Usage
- feat: 기능 추가
- fix: 버그 수정
- refactor: 리팩토링
`;

/** Mock fetch conflicts - simulates API latency */
export async function fetchMockConflicts(): Promise<Conflict[]> {
  await delay(300);
  return [...mockConflicts];
}

/** Mock fetch component content - for Side-by-Side comparison */
export async function fetchMockComponentContent(
  componentId: string
): Promise<string> {
  await delay(150);
  if (componentId.includes('global')) {
    return mockGlobalContent;
  }
  return mockProjectContent;
}
