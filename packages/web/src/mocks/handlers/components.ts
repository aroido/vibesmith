/**
 * Components API MSW Handlers
 * Based on docs/api/spec.md §2
 */

import { http, HttpResponse } from 'msw';
import { demoComponents } from '../data/demo-components';

const mockComponents = demoComponents;

const mockComponentDetail = {
  id: 'comp_001',
  type: 'skill',
  name: 'fastapi-route',
  description: 'FastAPI route scaffolding',
  enabled: true,
  tags: ['python', 'fastapi'],
  project_id: 'proj_abc123',
  project_name: 'vibesmith',
  path: '/Users/user/Projects/vibesmith/.claude/skills/fastapi-route/SKILL.md',
  content: '---\nname: fastapi-route\ndescription: FastAPI route scaffolding\n---\nBody content...',
  frontmatter: {
    name: 'fastapi-route',
    description: 'FastAPI route scaffolding',
    'allowed-tools': ['Read', 'Write', 'Bash'],
  },
  dependencies: {
    depends_on: [],
    depended_by: [],
  },
  created_at: '2026-02-09T10:00:00Z',
  updated_at: '2026-02-09T15:00:00Z',
  platform: 'claude_code',
};

/** Mutable store for list/detail tests */
let componentsStore = [...mockComponents];

function getFilteredComponents(url: URL) {
  const type = url.searchParams.get('type');
  const tag = url.searchParams.get('tag');
  const projectId = url.searchParams.get('project_id');
  const q = url.searchParams.get('q');
  const enabledParam = url.searchParams.get('enabled');
  const platform = url.searchParams.get('platform');

  let filtered = [...componentsStore];
  if (type) filtered = filtered.filter((c) => c.type === type);
  if (tag) {
    const tags = tag.split(',').map((t) => t.trim());
    filtered = filtered.filter((c) => tags.some((t) => c.tags?.includes(t)));
  }
  if (projectId) filtered = filtered.filter((c) => c.project_id === projectId);
  if (q) {
    const qLower = q.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.name.toLowerCase().includes(qLower) ||
        (c.description?.toLowerCase().includes(qLower) ?? false)
    );
  }
  if (enabledParam === 'true') filtered = filtered.filter((c) => c.enabled);
  else if (enabledParam === 'false') filtered = filtered.filter((c) => !c.enabled);
  if (platform) filtered = filtered.filter((c) => c.platform === platform);

  return filtered;
}

export const componentsHandlers = [
  // GET /api/components
  http.get('*/api/components', ({ request }) => {
    const url = new URL(request.url);
    const filtered = getFilteredComponents(url);
    return HttpResponse.json(filtered);
  }),

  // GET /api/components/recent
  http.get('*/api/components/recent', ({ request }) => {
    const url = new URL(request.url);
    const limitParam = Number(url.searchParams.get('limit') ?? '10');
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.floor(limitParam) : 10;

    const sorted = [...componentsStore].sort((a, b) => {
      const dateA = new Date(a.updated_at).getTime();
      const dateB = new Date(b.updated_at).getTime();
      return dateB - dateA;
    });

    return HttpResponse.json(sorted.slice(0, limit));
  }),

  // GET /api/components/:id
  http.get('*/api/components/:id', ({ params }) => {
    const id = params.id as string;
    const component = componentsStore.find((c) => c.id === id);
    if (!component) {
      return HttpResponse.json({ detail: 'Component not found' }, { status: 404 });
    }
    const detail = {
      ...mockComponentDetail,
      ...component,
      id: component.id,
      content: `---\nname: ${component.name}\ndescription: ${component.description}\n---\nBody content`,
      frontmatter: {
        name: component.name,
        description: component.description,
        'allowed-tools': ['Read', 'Write', 'Bash'],
      },
      dependencies: { depends_on: [], depended_by: [] },
    };
    return HttpResponse.json(detail);
  }),

  // POST /api/components
  http.post('*/api/components', async ({ request }) => {
    const body = (await request.json()) as {
      type: string;
      name: string;
      project_id: string;
      content: string;
      tags?: string[];
      platform?: string;
    };

    if (!body.type || !body.name || !body.project_id || !body.content) {
      return HttpResponse.json(
        { detail: 'type, name, project_id, and content are required' },
        { status: 422 }
      );
    }

    const exists = componentsStore.some((c) => c.name === body.name && c.project_id === body.project_id);
    if (exists) {
      return HttpResponse.json(
        { detail: 'A component with the same name already exists' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const newComponent = {
      id: `comp_new_${Date.now()}`,
      type: body.type,
      name: body.name,
      description: body.name,
      enabled: true,
      tags: body.tags ?? [],
      project_id: body.project_id,
      project_name: 'vibesmith',
      path: `/path/to/${body.type}s/${body.name}/SKILL.md`,
      created_at: now,
      updated_at: now,
      platform: body.platform ?? 'cursor',
    };
    componentsStore.push(newComponent);
    return HttpResponse.json(newComponent, { status: 201 });
  }),

  // PUT /api/components/:id
  http.put('*/api/components/:id', async ({ params, request }) => {
    const id = params.id as string;
    const body = (await request.json()) as { content?: string; tags?: string[] };
    const idx = componentsStore.findIndex((c) => c.id === id);
    if (idx === -1) {
      return HttpResponse.json({ detail: 'Component not found' }, { status: 404 });
    }
    const updated = {
      ...componentsStore[idx],
      ...(body.content !== undefined && { description: 'Updated description' }),
      ...(body.tags !== undefined && { tags: body.tags }),
      updated_at: new Date().toISOString(),
    };
    componentsStore[idx] = updated;
    return HttpResponse.json(updated);
  }),

  // DELETE /api/components/:id
  http.delete('*/api/components/:id', ({ params }) => {
    const id = params.id as string;
    const idx = componentsStore.findIndex((c) => c.id === id);
    if (idx === -1) {
      return HttpResponse.json({ detail: 'Component not found' }, { status: 404 });
    }
    componentsStore.splice(idx, 1);
    return HttpResponse.json({
      message: 'Deleted',
      affected_dependencies: [],
    });
  }),

  // POST /api/components/:id/toggle
  http.post('*/api/components/:id/toggle', async ({ params, request }) => {
    const id = params.id as string;
    const idx = componentsStore.findIndex((c) => c.id === id);
    if (idx === -1) {
      return HttpResponse.json({ detail: 'Component not found' }, { status: 404 });
    }
    let enabled = !componentsStore[idx].enabled;
    try {
      const body = (await request.json()) as { enabled?: boolean };
      if (typeof body?.enabled === 'boolean') enabled = body.enabled;
    } catch {
      // empty body
    }
    componentsStore[idx] = { ...componentsStore[idx], enabled };
    return HttpResponse.json({
      id,
      enabled,
      affected_dependencies: [],
    });
  }),

  // PATCH /api/components/bulk-toggle
  http.patch('*/api/components/bulk-toggle', async ({ request }) => {
    const body = (await request.json()) as {
      component_ids?: string[];
      enabled?: boolean;
    };
    const componentIds = Array.isArray(body.component_ids) ? body.component_ids : [];

    if (componentIds.length === 0 || typeof body.enabled !== 'boolean') {
      return HttpResponse.json(
        { detail: 'component_ids and enabled are required' },
        { status: 422 }
      );
    }

    const updatedIds: string[] = [];
    const nextEnabled = body.enabled as boolean;
    componentsStore = componentsStore.map((component) => {
      if (!componentIds.includes(component.id)) return component;
      if (component.enabled === nextEnabled) return component;
      updatedIds.push(component.id);
      return { ...component, enabled: nextEnabled };
    });

    return HttpResponse.json({
      updated_count: updatedIds.length,
      updated_ids: updatedIds,
    });
  }),

  // POST /api/components/:id/copy
  http.post('*/api/components/:id/copy', async ({ params, request }) => {
    const id = params.id as string;
    const body = (await request.json()) as {
      target_project_id: string;
      include_dependencies?: boolean;
    };
    const source = componentsStore.find((c) => c.id === id);
    if (!source) {
      return HttpResponse.json({ detail: 'Component not found' }, { status: 404 });
    }
    if (!body?.target_project_id) {
      return HttpResponse.json(
        { detail: 'target_project_id is required' },
        { status: 422 }
      );
    }
    const targetHasSame = componentsStore.some(
      (c) => c.project_id === body.target_project_id && c.name === source.name
    );
    if (targetHasSame) {
      return HttpResponse.json(
        { detail: 'A component with the same name already exists in the target project' },
        { status: 400 }
      );
    }
    const newId = `comp_copy_${Date.now()}`;
    const copied = {
      ...source,
      id: newId,
      project_id: body.target_project_id,
      project_name: 'target' as const,
    };
    componentsStore.push(copied);
    return HttpResponse.json(
      {
        copied: [
          {
            original_id: id,
            new_id: newId,
            name: source.name,
            type: source.type,
          },
        ],
      },
      { status: 201 }
    );
  }),

  http.get('*/api/components/:id/versions', ({ params }) => {
    const id = params.id as string;
    const component = componentsStore.find((c) => c.id === id);
    if (!component) {
      return HttpResponse.json({ detail: 'Component not found' }, { status: 404 });
    }
    return HttpResponse.json([
      { version: 3, content: '---\nname: ' + component.name + '\n---\nLatest', created_at: '2026-02-09T16:30:00Z' },
      { version: 2, content: '---\nname: ' + component.name + '\n---\nPrevious', created_at: '2026-02-09T14:00:00Z' },
      { version: 1, content: '---\nname: ' + component.name + '\n---\nInitial', created_at: '2026-02-09T10:00:00Z' },
    ]);
  }),

  http.post('*/api/components/:id/rollback', async ({ params, request }) => {
    const id = params.id as string;
    const body = (await request.json()) as { version: number };
    const component = componentsStore.find((c) => c.id === id);
    if (!component) {
      return HttpResponse.json({ detail: 'Component not found' }, { status: 404 });
    }
    if (body?.version == null) {
      return HttpResponse.json({ detail: 'version is required' }, { status: 422 });
    }
    return HttpResponse.json({
      id,
      restored_version: body.version,
      new_version: 4,
      message: 'Rolled back to version ' + body.version,
    });
  }),
];

/** Reset store for isolated tests (call in afterEach if needed) */
export function resetComponentsStore() {
  componentsStore = [...mockComponents];
}
