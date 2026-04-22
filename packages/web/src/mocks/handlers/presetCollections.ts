/**
 * Preset & Collection API MSW handlers
 * Covers Preset Workspace demo flows.
 */

import { http, HttpResponse } from 'msw';

const presetItems = [
  {
    id: 'preset-alpha',
    name: 'api-gateway-starter',
    component_type: 'skill',
    platform: 'claude_code',
    description: 'API gateway starter preset',
    scope: 'user',
    tags: ['api', 'starter'],
    latest_revision: 3,
    revisions_count: 3,
    created_at: '2026-02-10T09:00:00Z',
    updated_at: '2026-02-28T08:30:00Z',
  },
  {
    id: 'preset-beta',
    name: 'frontend-review-kit',
    component_type: 'agent',
    platform: 'cursor',
    description: 'Frontend review checklist and response template',
    scope: 'system',
    tags: ['frontend', 'review'],
    latest_revision: 2,
    revisions_count: 2,
    created_at: '2026-02-08T10:20:00Z',
    updated_at: '2026-02-27T06:10:00Z',
  },
  {
    id: 'preset-gamma',
    name: 'release-note-writer',
    component_type: 'command',
    platform: 'claude_code',
    description: 'Structured release note generation preset',
    scope: 'user',
    tags: ['release', 'docs'],
    latest_revision: 1,
    revisions_count: 1,
    created_at: '2026-02-06T11:00:00Z',
    updated_at: '2026-02-26T11:00:00Z',
  },
];

const presetRevisionMap: Record<string, number[]> = {
  'preset-alpha': [3, 2, 1],
  'preset-beta': [2, 1],
  'preset-gamma': [1],
};

const collectionItems = [
  {
    id: 'collection-react-fastapi',
    name: 'React + FastAPI Starter',
    description: 'Collection for shipping full-stack MVP features quickly',
    scope: 'user',
    tags: ['starter', 'fullstack'],
    latest_revision: 4,
    revisions_count: 4,
    items_count: 2,
    created_at: '2026-02-12T09:00:00Z',
    updated_at: '2026-02-28T08:00:00Z',
    items: [
      {
        order_index: 0,
        preset_id: 'preset-alpha',
        pin_mode: 'latest',
        pinned_revision: null,
        resolved_revision: 3,
        alias_name: null,
        preset_name: 'api-gateway-starter',
      },
      {
        order_index: 1,
        preset_id: 'preset-beta',
        pin_mode: 'pin',
        pinned_revision: 2,
        resolved_revision: 2,
        alias_name: 'reviewer',
        preset_name: 'frontend-review-kit',
      },
    ],
  },
];

function applyPagination<T>(items: T[], url: URL) {
  const limitParam = Number(url.searchParams.get('limit') ?? '100');
  const offsetParam = Number(url.searchParams.get('offset') ?? '0');
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.floor(limitParam) : 100;
  const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? Math.floor(offsetParam) : 0;
  return {
    total: items.length,
    items: items.slice(offset, offset + limit),
  };
}

export const presetCollectionsHandlers = [
  http.get('*/api/presets', ({ request }) => {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    const scope = url.searchParams.get('scope');
    const componentType = url.searchParams.get('component_type');
    const platform = url.searchParams.get('platform');

    let filtered = [...presetItems];
    if (q) {
      filtered = filtered.filter((item) => {
        const searchable = [item.name, item.description, ...(item.tags ?? [])]
          .join(' ')
          .toLowerCase();
        return searchable.includes(q);
      });
    }
    if (scope && scope !== 'all') {
      filtered = filtered.filter((item) => item.scope === scope);
    }
    if (componentType) {
      filtered = filtered.filter((item) => item.component_type === componentType);
    }
    if (platform) {
      filtered = filtered.filter((item) => item.platform === platform);
    }

    return HttpResponse.json(applyPagination(filtered, url));
  }),

  http.get('*/api/presets/:presetId', ({ params }) => {
    const presetId = String(params.presetId);
    const preset = presetItems.find((item) => item.id === presetId);
    if (!preset) {
      return HttpResponse.json({ detail: 'Preset not found' }, { status: 404 });
    }
    return HttpResponse.json(preset);
  }),

  http.get('*/api/presets/:presetId/revisions', ({ params }) => {
    const presetId = String(params.presetId);
    const revisions = presetRevisionMap[presetId] ?? [1];

    return HttpResponse.json({
      total: revisions.length,
      items: revisions.map((revision) => ({
        revision,
        created_at: `2026-02-${String(10 + revision).padStart(2, '0')}T09:00:00Z`,
        created_by: 'mock-user',
        change_note: `Revision ${revision} update`,
        content_hash: `hash-${presetId}-${revision}`,
      })),
    });
  }),

  http.get('*/api/presets/:presetId/revisions/:revision', ({ params }) => {
    const presetId = String(params.presetId);
    const revision = Number(params.revision ?? '1');
    const preset = presetItems.find((item) => item.id === presetId);
    if (!preset) {
      return HttpResponse.json({ detail: 'Preset not found' }, { status: 404 });
    }

    return HttpResponse.json({
      preset_id: presetId,
      revision,
      created_at: `2026-02-${String(10 + revision).padStart(2, '0')}T09:00:00Z`,
      created_by: 'mock-user',
      change_note: `Revision ${revision} update`,
      content_hash: `hash-${presetId}-${revision}`,
      frontmatter: {
        name: preset.name,
        description: preset.description,
      },
      content: `# ${preset.name}\n\nRevision ${revision} content`,
      tags: preset.tags,
    });
  }),

  http.get('*/api/collections', ({ request }) => {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    const scope = url.searchParams.get('scope');

    let filtered = collectionItems.map(({ items: _items, ...summary }) => summary);
    if (q) {
      filtered = filtered.filter((item) => {
        const searchable = [item.name, item.description, ...(item.tags ?? [])]
          .join(' ')
          .toLowerCase();
        return searchable.includes(q);
      });
    }
    if (scope && scope !== 'all') {
      filtered = filtered.filter((item) => item.scope === scope);
    }

    return HttpResponse.json(applyPagination(filtered, url));
  }),

  http.get('*/api/collections/:collectionId', ({ params }) => {
    const collectionId = String(params.collectionId);
    const collection = collectionItems.find((item) => item.id === collectionId);
    if (!collection) {
      return HttpResponse.json({ detail: 'Collection not found' }, { status: 404 });
    }
    return HttpResponse.json(collection);
  }),
];
