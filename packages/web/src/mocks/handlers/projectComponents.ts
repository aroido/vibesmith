/**
 * Project Components API MSW Handlers
 * GET /api/projects/:id/components
 * Based on docs/api/spec.md §1.3
 */

import { http, HttpResponse } from 'msw';

const mockProjectComponents: Record<string, object[]> = {
  proj_abc123: [
    {
      id: 'comp_001',
      type: 'skill',
      name: 'fastapi-route',
      description: 'FastAPI route scaffolding',
      enabled: true,
      tags: ['python', 'fastapi'],
      project_id: 'proj_abc123',
      path: '/Users/user/Projects/vibesmith/.claude/skills/fastapi-route/SKILL.md',
      created_at: '2026-02-09T10:00:00Z',
      updated_at: '2026-02-09T15:00:00Z',
      platform: 'claude_code',
    },
  ],
  proj_vibesmith: [
    { id: 'comp_s1', type: 'skill', name: 'git-commit', enabled: true, tags: [], project_id: 'proj_vibesmith', path: '/path', created_at: '2026-02-09T10:00:00Z', updated_at: '2026-02-09T15:00:00Z', platform: 'claude_code' },
    { id: 'comp_s2', type: 'skill', name: 'api-integration', enabled: true, tags: [], project_id: 'proj_vibesmith', path: '/path', created_at: '2026-02-09T10:00:00Z', updated_at: '2026-02-09T15:00:00Z', platform: 'claude_code' },
    { id: 'comp_a1', type: 'agent', name: 'planner', enabled: true, tags: [], project_id: 'proj_vibesmith', path: '/path', created_at: '2026-02-09T10:00:00Z', updated_at: '2026-02-09T15:00:00Z', platform: 'claude_code' },
    { id: 'comp_c1', type: 'command', name: 'code-review', enabled: true, tags: [], project_id: 'proj_vibesmith', path: '/path', created_at: '2026-02-09T10:00:00Z', updated_at: '2026-02-09T15:00:00Z', platform: 'claude_code' },
  ],
  proj_global: [
    {
      id: 'comp_002',
      type: 'agent',
      name: 'planner',
      description: 'Implementation planning',
      enabled: true,
      tags: ['planning'],
      project_id: 'proj_global',
      path: '/Users/user/.claude/agents/planner/AGENT.md',
      created_at: '2026-02-09T10:00:00Z',
      updated_at: '2026-02-09T15:00:00Z',
      platform: 'claude_code',
    },
  ],
};

export const projectComponentsHandlers = [
  http.get(/\/api\/projects\/[^/]+\/components/, ({ request }) => {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.indexOf('projects') + 1];
    const typeFilter = url.searchParams.get('type');

    const raw = (mockProjectComponents[id] ?? []) as Array<{ type: string }>;
    if (!raw.length && id !== 'proj_abc123' && id !== 'proj_global') {
      return HttpResponse.json({ detail: 'Project not found' }, { status: 404 });
    }

    let filtered = [...raw];
    if (typeFilter) {
      filtered = filtered.filter((c) => c.type === typeFilter);
    }

    return HttpResponse.json(filtered);
  }),
];
