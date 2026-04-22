/**
 * Templates API MSW Handlers
 * Based on docs/api/spec.md (template management)
 */

import { http, HttpResponse } from 'msw';

const mockTemplates = [
  {
    id: 'template_skill_basic',
    name: 'Basic Skill',
    description: 'Basic skill template',
    component_type: 'skill',
    category: 'development',
    icon: 'skill',
    difficulty: 'beginner',
    estimated_time: '2 min',
    tags: ['basic', 'getting-started'],
    is_builtin: true,
    fields: [
      {
        name: 'skill_name',
        type: 'text',
        label: 'Skill Name',
        required: true,
      },
      {
        name: 'description',
        type: 'textarea',
        label: 'Description',
        required: false,
      },
    ],
  },
  {
    id: 'template_agent_basic',
    name: 'Basic Agent',
    description: 'Basic agent template',
    component_type: 'agent',
    category: 'code-quality',
    icon: 'agent',
    difficulty: 'intermediate',
    estimated_time: '3 min',
    tags: ['basic', 'getting-started'],
    is_builtin: true,
    fields: [
      {
        name: 'agent_name',
        type: 'text',
        label: 'Agent Name',
        required: true,
      },
    ],
  },
];

export const templatesHandlers = [
  // GET /api/templates
  http.get('*/api/templates', ({ request }) => {
    const url = new URL(request.url);
    const componentType = url.searchParams.get('component_type');
    
    let filtered = mockTemplates;
    
    if (componentType) {
      filtered = mockTemplates.filter((t) => t.component_type === componentType);
    }
    
    return HttpResponse.json({
      templates: filtered,
      total: filtered.length,
    });
  }),

  // GET /api/templates/:id
  http.get('*/api/templates/:id', ({ params }) => {
    const id = params.id as string;
    const template = mockTemplates.find((t) => t.id === id);
    
    if (!template) {
      return HttpResponse.json(
        {
          detail: 'Template not found',
          message_key: 'errors.template_not_found',
          message: 'Template not found',
        },
        { status: 404 }
      );
    }
    
    return HttpResponse.json(template);
  }),
];
