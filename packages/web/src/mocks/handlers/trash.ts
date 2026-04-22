/**
 * Trash API MSW Handlers
 * Provide mock data when Backend #165 is unavailable
 */

import { http, HttpResponse } from 'msw';
import type { TrashItem } from '@/common/api/resources/trash';

const MOCK_TRASH_ITEMS: TrashItem[] = [
  {
    id: 'comp_trash_001',
    name: 'git-commit-message',
    type: 'skill',
    description: 'Git commit message skill',
    deleted_at: '2026-02-14T10:30:00Z',
    original_path: '/Users/user/.claude/skills/git-commit-message/SKILL.md',
    project_name: 'global',
    content: '---\nname: git-commit-message\ndescription: Git commit message skill\n---\nBody content...',
  },
  {
    id: 'comp_trash_002',
    name: 'pydantic-model',
    type: 'skill',
    description: 'Pydantic v2 model generation',
    deleted_at: '2026-02-13T14:20:00Z',
    original_path: '/Users/user/Projects/vibesmith/.claude/skills/pydantic-model/SKILL.md',
    project_name: 'vibesmith',
    content: '---\nname: pydantic-model\n...',
  },
  {
    id: 'comp_trash_003',
    name: 'planner',
    type: 'agent',
    description: 'Implementation planning',
    deleted_at: '2026-02-12T09:15:00Z',
    original_path: '/Users/user/.claude/agents/planner/AGENT.md',
    project_name: 'global',
  },
];

/** Mutable store for trash tests */
let trashStore = [...MOCK_TRASH_ITEMS];

export function resetTrashStore() {
  trashStore = [...MOCK_TRASH_ITEMS];
}

export const trashHandlers = [
  // GET /api/trash
  http.get('*/api/trash', () => {
    return HttpResponse.json(trashStore);
  }),

  // POST /api/trash/:id/restore
  http.post('*/api/trash/:id/restore', ({ params }) => {
    const id = params.id as string;
    const idx = trashStore.findIndex((i) => i.id === id);
    if (idx === -1) {
      return HttpResponse.json(
        { detail: 'Trash item not found' },
        { status: 404 }
      );
    }
    trashStore = trashStore.filter((i) => i.id !== id);
    return HttpResponse.json({
      message: 'Restored',
      component_id: id,
    });
  }),

  // DELETE /api/trash/:id
  http.delete('*/api/trash/:id', ({ params }) => {
    const id = params.id as string;
    const idx = trashStore.findIndex((i) => i.id === id);
    if (idx === -1) {
      return HttpResponse.json(
        { detail: 'Trash item not found' },
        { status: 404 }
      );
    }
    trashStore = trashStore.filter((i) => i.id !== id);
    return new HttpResponse(null, { status: 204 });
  }),

  // DELETE /api/trash (empty all)
  http.delete('*/api/trash', () => {
    trashStore = [];
    return new HttpResponse(null, { status: 204 });
  }),
];
