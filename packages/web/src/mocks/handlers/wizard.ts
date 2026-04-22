/**
 * Component Wizard API MSW Handlers
 * Based on docs/api/spec.md (component creation wizard)
 */

import { http, HttpResponse } from 'msw';

export const wizardHandlers = [
  // POST /api/components/generate (preview)
  http.post('*/api/components/generate', async ({ request }) => {
    const body = await request.json();
    const { template_id, component_type, name, description, config } = body as {
      template_id: string;
      component_type: string;
      name: string;
      description?: string;
      config?: Record<string, unknown>;
    };

    if (!template_id || !component_type || !name) {
      return HttpResponse.json(
        { detail: 'template_id, component_type, name are required' },
        { status: 400 }
      );
    }

    const fileName = component_type === 'agent' ? 'AGENT.md' : 'SKILL.md';
    const generatedDescription = description ?? 'Auto-generated component';

    return HttpResponse.json({
      content: `---
name: ${name}
description: ${generatedDescription}
---

# ${name}

Generated from template: ${template_id}
${config ? `\n\nConfig:\n${JSON.stringify(config, null, 2)}` : ''}
`,
      preview_id: 'preview_mock_123',
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      component_type,
      file_name: fileName,
    });
  }),

  // POST /api/components/save (save)
  http.post('*/api/components/save', async ({ request }) => {
    const body = await request.json();
    const { project_id, type, name, content } = body as {
      project_id: string;
      type: string;
      name: string;
      content: string;
      platform?: string;
    };
    
    if (!project_id || !type || !name || !content) {
      return HttpResponse.json(
        { detail: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Mock save response
    return HttpResponse.json(
      {
        id: 'comp_generated_123',
        type,
        name,
        enabled: true,
        project_id,
        path: `/${type}s/${name}`,
        created_at: '2026-02-18T12:00:00Z',
        updated_at: '2026-02-18T12:00:00Z',
        platform: 'cursor',
        description: 'Generated component',
        tags: [],
      },
      { status: 201 }
    );
  }),
];
