/**
 * Conflicts API MSW Handlers
 * Based on docs/api/spec.md (conflict management)
 */

import { http, HttpResponse } from 'msw';

const mockConflicts = [
  {
    id: 'global_1|project_2',
    name: 'git-commit',
    type: 'skill',
    global_component_id: 'global_1',
    project_component_id: 'project_2',
    project_name: 'vibesmith',
    priority: 'project',
    is_intentional: false,
  },
];

export const conflictsHandlers = [
  // GET /api/conflicts
  http.get('*/api/conflicts', () => {
    return HttpResponse.json(mockConflicts);
  }),

  // POST /api/conflicts/:id/resolve
  http.post('*/api/conflicts/:id/resolve', async ({ params, request }) => {
    const id = params.id as string;
    const body = await request.json();
    const { action, new_name } = body as {
      action: 'disable_global' | 'delete_project' | 'rename' | 'ignore';
      new_name?: string;
      target?: 'global' | 'project';
    };
    
    if (!mockConflicts.find((c) => c.id === id)) {
      return HttpResponse.json(
        { detail: 'Conflict not found' },
        { status: 404 }
      );
    }
    
    if (action === 'rename' && !new_name) {
      return HttpResponse.json(
        { detail: 'new_name is required for rename action' },
        { status: 400 }
      );
    }
    
    return HttpResponse.json({
      success: true,
      conflict_id: id,
      updated_component_ids: ['comp_1', 'comp_2'],
    });
  }),
];
