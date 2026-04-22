/**
 * useProjectComponentList Hook
 * 프로젝트 펼침 시 실제 구성요소 목록 표시용
 *
 * GET /api/projects/{id}/components — 타입별 그룹화하여 반환
 */

import { useQuery } from '@tanstack/react-query';
import { getProjectComponents } from '@/common/api/resources/projects';
import type { ProjectComponentItem } from '@/common/api/resources/projects';

export interface ComponentsByType {
  skills: ProjectComponentItem[];
  agents: ProjectComponentItem[];
  commands: ProjectComponentItem[];
  hooks: ProjectComponentItem[];
  rules: ProjectComponentItem[];
}

const TYPE_TO_KEY: Record<string, keyof ComponentsByType> = {
  skill: 'skills',
  agent: 'agents',
  command: 'commands',
  hook: 'hooks',
  rule: 'rules',
};

export function useProjectComponentList(projectId: string | undefined, enabled: boolean) {
  const query = useQuery({
    queryKey: ['project-components', projectId],
    queryFn: () => getProjectComponents(projectId!),
    enabled: Boolean(projectId) && enabled,
    staleTime: 30_000,
  });

  const byType: ComponentsByType = {
    skills: [],
    agents: [],
    commands: [],
    hooks: [],
    rules: [],
  };

  if (query.data) {
    for (const c of query.data) {
      const key = TYPE_TO_KEY[c.type];
      if (key) byType[key].push(c);
    }
  }

  return { ...query, byType };
}
