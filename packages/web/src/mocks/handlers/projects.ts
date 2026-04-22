/**
 * Projects + Presets V2 API MSW Handlers
 */

import { http, HttpResponse } from 'msw';

type ProjectRecord = {
  id: string;
  name: string;
  path: string;
  is_global: boolean;
  component_count: number;
  last_scanned_at: string;
  dir_exists: boolean;
  platforms: string[];
  has_claude_dir: boolean;
  created_at: string;
  updated_at: string;
};

type ConflictPolicy = 'fail' | 'skip' | 'rename' | 'overwrite';
type PresetType = 'template' | 'snapshot';

type ProjectTemplateComponentBlueprint = {
  component_type: 'skill' | 'agent' | 'command' | 'hook' | 'rule';
  template_id?: string | null;
  name: string;
  description?: string;
  platform: 'claude_code' | 'cursor';
  config: Record<string, unknown>;
  content?: string | null;
  frontmatter?: Record<string, unknown> | null;
  tags?: string[];
  source_component_id?: string | null;
  order_index?: number;
};

type TemplateRevisionRecord = {
  revision: number;
  preset_type: PresetType;
  created_at: string;
  created_by: string | null;
  change_note: string;
  items: ProjectTemplateComponentBlueprint[];
};

type ProjectTemplateRecord = {
  id: string;
  name: string;
  description: string;
  scope: 'system' | 'user';
  preset_type: PresetType;
  version: number;
  tags: string[];
  revisions: TemplateRevisionRecord[];
  created_at: string;
  updated_at: string;
};

const NOW = '2026-02-24T09:30:00Z';

const BASE_PROJECTS: ProjectRecord[] = [
  {
    id: 'proj_abc123',
    name: 'vibesmith',
    path: '/Users/user/Projects/vibesmith',
    is_global: false,
    component_count: 12,
    last_scanned_at: NOW,
    dir_exists: true,
    platforms: ['claude_code', 'cursor'],
    has_claude_dir: true,
    created_at: '2026-02-09T10:00:00Z',
    updated_at: NOW,
  },
  {
    id: 'proj_global',
    name: 'global',
    path: '/Users/user/.claude',
    is_global: true,
    component_count: 5,
    last_scanned_at: NOW,
    dir_exists: true,
    platforms: ['claude_code'],
    has_claude_dir: true,
    created_at: '2026-02-01T10:00:00Z',
    updated_at: NOW,
  },
];

const BASE_PROJECT_TEMPLATES: ProjectTemplateRecord[] = [
  {
    id: 'preset-react-fastapi',
    name: 'React + FastAPI Starter',
    description: 'Frontend + backend starter preset',
    scope: 'system',
    preset_type: 'template',
    version: 1,
    tags: ['starter', 'fullstack'],
    revisions: [
      {
        revision: 1,
        preset_type: 'template',
        created_at: '2026-02-23T10:00:00Z',
        created_by: null,
        change_note: 'seed',
        items: [
          {
            component_type: 'skill',
            template_id: 'react-component',
            name: 'react-ui-helper',
            description: 'UI helper skill',
            platform: 'claude_code',
            config: {},
          },
          {
            component_type: 'agent',
            template_id: 'code-reviewer',
            name: 'review-agent',
            description: 'Code review agent',
            platform: 'cursor',
            config: {},
          },
        ],
      },
    ],
    created_at: '2026-02-23T10:00:00Z',
    updated_at: '2026-02-23T10:00:00Z',
  },
];

let projectsStore: ProjectRecord[] = [];
let projectTemplatesStore: ProjectTemplateRecord[] = [];
let projectPolicyStore: Record<string, ConflictPolicy | undefined> = {};

function cloneTemplate(template: ProjectTemplateRecord): ProjectTemplateRecord {
  return {
    ...template,
    tags: [...template.tags],
    revisions: template.revisions.map((revision) => ({
      ...revision,
      items: revision.items.map((item) => ({
        ...item,
        config: { ...item.config },
        tags: item.tags ? [...item.tags] : [],
        frontmatter: item.frontmatter ? { ...item.frontmatter } : item.frontmatter,
      })),
    })),
  };
}

function getLatestRevision(template: ProjectTemplateRecord): TemplateRevisionRecord {
  return [...template.revisions].sort((a, b) => b.revision - a.revision)[0];
}

function toTemplateSummary(template: ProjectTemplateRecord) {
  const latest = getLatestRevision(template);
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    scope: template.scope,
    preset_type: template.preset_type,
    version: template.version,
    latest_revision: latest.revision,
    revisions_count: template.revisions.length,
    component_count: latest.items.length,
    tags: template.tags,
    created_at: template.created_at,
    updated_at: template.updated_at,
  };
}

function createTemplateId(name: string): string {
  return `preset-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now().toString(36)}`;
}

function isAbsoluteOrHomePath(path: string): boolean {
  const trimmed = path.trim();
  return trimmed.startsWith('/') || trimmed.startsWith('~/');
}

function resolveRevision(
  template: ProjectTemplateRecord,
  revision?: number
): TemplateRevisionRecord | undefined {
  if (typeof revision === 'number') {
    return template.revisions.find((item) => item.revision === revision);
  }
  return getLatestRevision(template);
}

function resetStores() {
  projectsStore = BASE_PROJECTS.map((project) => ({ ...project, platforms: [...project.platforms] }));
  projectTemplatesStore = BASE_PROJECT_TEMPLATES.map(cloneTemplate);
  projectPolicyStore = {};
}

function createPreviewForPolicy(
  policy: ConflictPolicy,
  template: ProjectTemplateRecord,
  projectId: string
) {
  const latest = getLatestRevision(template);
  const first = latest.items[0];
  const project = projectsStore.find((item) => item.id === projectId);
  const hasConflict = Boolean(project && project.component_count > 0 && latest.items.length > 0);

  if (!first) {
    return {
      summary: { to_create: 0, to_update: 0, to_skip: 0, to_rename: 0, conflicts: 0 },
      items: [],
    };
  }

  if (!hasConflict) {
    return {
      summary: { to_create: 1, to_update: 0, to_skip: 0, to_rename: 0, conflicts: 0 },
      items: [
        {
          name: first.name,
          type: first.component_type,
          platform: first.platform,
          action: 'create',
          reason: 'new_component',
          target_component_id: null,
          renamed_to: null,
        },
      ],
    };
  }

  if (policy === 'fail') {
    return {
      summary: { to_create: 0, to_update: 0, to_skip: 0, to_rename: 0, conflicts: 1 },
      items: [
        {
          name: first.name,
          type: first.component_type,
          platform: first.platform,
          action: 'conflict',
          reason: 'name_type_platform_conflict',
          target_component_id: 'comp_existing',
          renamed_to: null,
        },
      ],
    };
  }

  if (policy === 'skip') {
    return {
      summary: { to_create: 0, to_update: 0, to_skip: 1, to_rename: 0, conflicts: 1 },
      items: [
        {
          name: first.name,
          type: first.component_type,
          platform: first.platform,
          action: 'skip',
          reason: 'policy_skip_conflict',
          target_component_id: 'comp_existing',
          renamed_to: null,
        },
      ],
    };
  }

  if (policy === 'rename') {
    return {
      summary: { to_create: 0, to_update: 0, to_skip: 0, to_rename: 1, conflicts: 1 },
      items: [
        {
          name: first.name,
          type: first.component_type,
          platform: first.platform,
          action: 'rename',
          reason: 'policy_rename_conflict',
          target_component_id: 'comp_existing',
          renamed_to: `${first.name}-preset-1`,
        },
      ],
    };
  }

  return {
    summary: { to_create: 0, to_update: 1, to_skip: 0, to_rename: 0, conflicts: 1 },
    items: [
      {
        name: first.name,
        type: first.component_type,
        platform: first.platform,
        action: 'update',
        reason: 'policy_overwrite_conflict',
        target_component_id: 'comp_existing',
        renamed_to: null,
      },
    ],
  };
}

resetStores();

export const projectsHandlers = [
  http.get('*/api/projects', () => HttpResponse.json(projectsStore)),

  http.post('*/api/projects', async ({ request }) => {
    const body = (await request.json()) as {
      path?: string;
      preset_id?: string;
      revision?: number;
      conflict_policy?: ConflictPolicy;
      name?: string;
      scan_after_create?: boolean;
    };

    const path = (body.path ?? '').trim();
    const presetId = (body.preset_id ?? '').trim();

    if (!path || !presetId) {
      return HttpResponse.json(
        {
          detail: 'path and preset_id are required',
          message_key: 'errors.validation_error',
          message: 'path and preset_id are required',
        },
        { status: 422 }
      );
    }

    if (!isAbsoluteOrHomePath(path)) {
      return HttpResponse.json(
        {
          detail: 'Project path must be absolute',
          message_key: 'errors.project_path_not_absolute',
          message: 'Project path must be absolute',
        },
        { status: 400 }
      );
    }

    if (projectsStore.some((project) => project.path === path)) {
      return HttpResponse.json(
        {
          detail: 'Project already exists',
          message_key: 'errors.project_already_exists',
          message: 'Project already exists',
        },
        { status: 409 }
      );
    }

    const preset = projectTemplatesStore.find((item) => item.id === presetId);
    if (!preset) {
      return HttpResponse.json(
        {
          detail: 'Project template not found',
          message_key: 'errors.project_template_not_found',
          message: 'Project template not found',
        },
        { status: 404 }
      );
    }

    const resolvedRevision = resolveRevision(preset, body.revision);
    if (!resolvedRevision) {
      return HttpResponse.json(
        {
          detail: 'Project preset revision not found',
          message_key: 'errors.project_template_revision_not_found',
          message: 'Project preset revision not found',
        },
        { status: 404 }
      );
    }

    const pathParts = path.split('/').filter(Boolean);
    const defaultName = pathParts[pathParts.length - 1] ?? 'new-project';
    const createdComponents = resolvedRevision.items.length;
    const scanAfterCreate = body.scan_after_create ?? true;
    const createdProject: ProjectRecord = {
      id: `proj_${Date.now()}`,
      name: (body.name ?? '').trim() || defaultName,
      path,
      is_global: false,
      component_count: createdComponents,
      last_scanned_at: NOW,
      dir_exists: true,
      platforms: ['claude_code'],
      has_claude_dir: true,
      created_at: NOW,
      updated_at: NOW,
    };
    projectsStore = [createdProject, ...projectsStore];

    return HttpResponse.json(
      {
        project: createdProject,
        applied_preset: {
          id: preset.id,
          name: preset.name,
          version: preset.version,
          revision: resolvedRevision.revision,
        },
        created_components: createdComponents,
        scanned_components: scanAfterCreate ? createdComponents : 0,
      },
      { status: 201 }
    );
  }),

  http.get('*/api/projects/:id', ({ params }) => {
    const id = params.id as string;
    const project = projectsStore.find((item) => item.id === id);

    if (!project) {
      return HttpResponse.json(
        {
          detail: 'Project not found',
          message_key: 'errors.project_not_found',
          message: 'Project not found',
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      ...project,
      breakdown: {
        skill: Math.max(1, project.component_count - 2),
        agent: 1,
        command: 1,
        hook: 0,
        rule: 0,
      },
    });
  }),

  http.get('*/api/projects/:id/activities', () =>
    HttpResponse.json([
      {
        id: 'activity_1',
        activity_type: 'component_created',
        component_id: 'comp_1',
        component_name: 'git-commit',
        component_type: 'skill',
        created_at: '2026-02-18T10:00:00Z',
      },
      {
        id: 'activity_2',
        activity_type: 'preset_applied',
        component_id: 'comp_2',
        component_name: 'react-feature',
        component_type: 'skill',
        created_at: '2026-02-18T11:00:00Z',
      },
    ])
  ),

  http.get('*/api/projects/:id/components', ({ params }) => {
    const id = params.id as string;
    const project = projectsStore.find((item) => item.id === id);
    if (!project) {
      return HttpResponse.json(
        {
          detail: 'Project not found',
          message_key: 'errors.project_not_found',
          message: 'Project not found',
        },
        { status: 404 }
      );
    }

    const items = Array.from({ length: Math.max(project.component_count, 1) }).map((_, index) => ({
      id: `${project.id}_comp_${index + 1}`,
      type: 'skill',
      name: index === 0 ? 'shared-skill' : `component-${index + 1}`,
      description: 'Mock component',
      enabled: true,
      tags: ['mock'],
      project_id: project.id,
      path: `/skills/component-${index + 1}`,
      created_at: NOW,
      updated_at: NOW,
    }));

    return HttpResponse.json({ items, total: items.length });
  }),

  http.delete('*/api/projects/:id', ({ params }) => {
    const id = params.id as string;
    const project = projectsStore.find((item) => item.id === id);

    if (!project) {
      return HttpResponse.json(
        {
          detail: 'Project not found',
          message_key: 'errors.project_not_found',
          message: 'Project not found',
        },
        { status: 404 }
      );
    }

    if (project.is_global) {
      return HttpResponse.json(
        {
          detail: 'Global project cannot be deleted',
          message_key: 'errors.global_project_cannot_delete',
          message: 'Global project cannot be deleted',
        },
        { status: 400 }
      );
    }

    projectsStore = projectsStore.filter((item) => item.id !== id);
    return HttpResponse.json({ message: 'Deleted', message_key: 'common.deleted' });
  }),

  http.post('*/api/projects/:projectId/preset-preview', async ({ params, request }) => {
    const projectId = params.projectId as string;
    const project = projectsStore.find((item) => item.id === projectId);
    if (!project) {
      return HttpResponse.json(
        {
          detail: 'Project not found',
          message_key: 'errors.project_not_found',
          message: 'Project not found',
        },
        { status: 404 }
      );
    }

    const body = (await request.json()) as {
      preset_id?: string;
      revision?: number;
      conflict_policy?: ConflictPolicy;
    };
    const presetId = (body.preset_id ?? '').trim();
    const policy = body.conflict_policy ?? 'fail';
    const preset = projectTemplatesStore.find((item) => item.id === presetId);
    if (!preset) {
      return HttpResponse.json(
        {
          detail: 'Project template not found',
          message_key: 'errors.project_template_not_found',
          message: 'Project template not found',
        },
        { status: 404 }
      );
    }

    const revision = resolveRevision(preset, body.revision);
    if (!revision) {
      return HttpResponse.json(
        {
          detail: 'Project preset revision not found',
          message_key: 'errors.project_template_revision_not_found',
          message: 'Project preset revision not found',
        },
        { status: 404 }
      );
    }

    const preview = createPreviewForPolicy(policy, preset, projectId);
    return HttpResponse.json({
      project_id: projectId,
      preset_id: presetId,
      revision: revision.revision,
      policy,
      summary: preview.summary,
      items: preview.items,
      last_policy: projectPolicyStore[projectId] ?? null,
    });
  }),

  http.post('*/api/projects/:projectId/apply-preset', async ({ params, request }) => {
    const projectId = params.projectId as string;
    const project = projectsStore.find((item) => item.id === projectId);
    if (!project) {
      return HttpResponse.json(
        {
          detail: 'Project not found',
          message_key: 'errors.project_not_found',
          message: 'Project not found',
        },
        { status: 404 }
      );
    }

    const body = (await request.json()) as {
      preset_id?: string;
      revision?: number;
      conflict_policy?: ConflictPolicy;
    };
    const presetId = (body.preset_id ?? '').trim();
    const policy = body.conflict_policy ?? 'fail';
    const preset = projectTemplatesStore.find((item) => item.id === presetId);
    if (!preset) {
      return HttpResponse.json(
        {
          detail: 'Project template not found',
          message_key: 'errors.project_template_not_found',
          message: 'Project template not found',
        },
        { status: 404 }
      );
    }

    const revision = resolveRevision(preset, body.revision);
    if (!revision) {
      return HttpResponse.json(
        {
          detail: 'Project preset revision not found',
          message_key: 'errors.project_template_revision_not_found',
          message: 'Project preset revision not found',
        },
        { status: 404 }
      );
    }

    const preview = createPreviewForPolicy(policy, preset, projectId);
    if (policy === 'fail' && preview.summary.conflicts > 0) {
      projectPolicyStore[projectId] = policy;
      return HttpResponse.json(
        {
          detail: 'Preset apply failed due to conflicts (policy=fail)',
          message_key: 'errors.project_template_apply_conflict',
          message: 'Preset apply failed due to conflicts (policy=fail)',
        },
        { status: 409 }
      );
    }

    if (policy === 'rename' || preview.summary.to_create > 0) {
      project.component_count += 1;
    }

    projectPolicyStore[projectId] = policy;
    return HttpResponse.json({
      project_id: projectId,
      preset_id: presetId,
      revision: revision.revision,
      policy,
      summary: {
        created: preview.summary.to_create,
        updated: preview.summary.to_update,
        skipped: preview.summary.to_skip + (policy === 'fail' ? preview.summary.conflicts : 0),
        renamed: preview.summary.to_rename,
        failed: 0,
      },
      items: preview.items,
    });
  }),

  http.get('*/api/project-templates', ({ request }) => {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').toLowerCase().trim();
    const scope = (url.searchParams.get('scope') ?? 'all').toLowerCase();
    const limit = Number(url.searchParams.get('limit') ?? '20');
    const offset = Number(url.searchParams.get('offset') ?? '0');

    let filtered = [...projectTemplatesStore];
    if (scope === 'system' || scope === 'user') {
      filtered = filtered.filter((template) => template.scope === scope);
    }
    if (q) {
      filtered = filtered.filter((template) => {
        const haystack = `${template.name} ${template.description}`.toLowerCase();
        return haystack.includes(q);
      });
    }

    const safeOffset = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 20;
    const paged = filtered.slice(safeOffset, safeOffset + safeLimit);

    return HttpResponse.json({
      items: paged.map(toTemplateSummary),
      total: filtered.length,
    });
  }),

  http.get('*/api/project-templates/:templateId', ({ params }) => {
    const templateId = params.templateId as string;
    const template = projectTemplatesStore.find((item) => item.id === templateId);
    if (!template) {
      return HttpResponse.json(
        {
          detail: 'Project template not found',
          message_key: 'errors.project_template_not_found',
          message: 'Project template not found',
        },
        { status: 404 }
      );
    }
    return HttpResponse.json({
      ...toTemplateSummary(template),
      components: getLatestRevision(template).items,
    });
  }),

  http.post('*/api/project-templates', async ({ request }) => {
    const body = (await request.json()) as {
      name?: string;
      description?: string;
      tags?: string[];
      preset_type?: PresetType;
      components?: ProjectTemplateComponentBlueprint[];
      change_note?: string;
    };
    const name = (body.name ?? '').trim();
    const description = (body.description ?? '').trim();
    const components = Array.isArray(body.components) ? body.components : [];
    if (!name || !description || components.length === 0) {
      return HttpResponse.json(
        {
          detail: 'name, description, components are required',
          message_key: 'errors.validation_error',
          message: 'name, description, components are required',
        },
        { status: 422 }
      );
    }
    if (projectTemplatesStore.some((template) => template.name.toLowerCase() === name.toLowerCase())) {
      return HttpResponse.json(
        {
          detail: 'Project template name already exists',
          message_key: 'errors.project_template_name_exists',
          message: 'Project template name already exists',
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const created: ProjectTemplateRecord = {
      id: createTemplateId(name),
      name,
      description,
      scope: 'user',
      preset_type: body.preset_type ?? 'template',
      version: 1,
      tags: Array.isArray(body.tags) ? body.tags : [],
      revisions: [
        {
          revision: 1,
          preset_type: body.preset_type ?? 'template',
          created_at: now,
          created_by: null,
          change_note: body.change_note ?? 'initial revision',
          items: components,
        },
      ],
      created_at: now,
      updated_at: now,
    };
    projectTemplatesStore = [created, ...projectTemplatesStore];
    return HttpResponse.json(
      {
        ...toTemplateSummary(created),
        components: getLatestRevision(created).items,
      },
      { status: 201 }
    );
  }),

  http.post('*/api/project-templates/from-project', async ({ request }) => {
    const body = (await request.json()) as {
      source_project_id?: string;
      name?: string;
      description?: string;
      tags?: string[];
      component_ids?: string[];
      include_disabled?: boolean;
      conflict_if_name_exists?: boolean;
    };
    const sourceProjectId = (body.source_project_id ?? '').trim();
    const sourceProject = projectsStore.find((project) => project.id === sourceProjectId);
    if (!sourceProject) {
      return HttpResponse.json(
        {
          detail: 'Source project not found',
          message_key: 'errors.project_template_source_project_not_found',
          message: 'Source project not found',
        },
        { status: 404 }
      );
    }

    const name = (body.name ?? '').trim();
    const description = (body.description ?? '').trim();
    const componentIds = Array.isArray(body.component_ids) ? body.component_ids : [];
    if (!name || !description || componentIds.length === 0) {
      return HttpResponse.json(
        {
          detail: 'name, description, component_ids are required',
          message_key: 'errors.validation_error',
          message: 'name, description, component_ids are required',
        },
        { status: 422 }
      );
    }

    const duplicated = projectTemplatesStore.some((template) => template.name.toLowerCase() === name.toLowerCase());
    if (duplicated && (body.conflict_if_name_exists ?? true)) {
      return HttpResponse.json(
        {
          detail: 'Project template name already exists',
          message_key: 'errors.project_template_name_exists',
          message: 'Project template name already exists',
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const created: ProjectTemplateRecord = {
      id: createTemplateId(name),
      name: duplicated ? `${name}-${Date.now().toString(36)}` : name,
      description,
      scope: 'user',
      preset_type: 'snapshot',
      version: 1,
      tags: Array.isArray(body.tags) ? body.tags : [],
      revisions: [
        {
          revision: 1,
          preset_type: 'snapshot',
          created_at: now,
          created_by: null,
          change_note: 'created from project components',
          items: componentIds.map((componentId, index) => ({
            component_type: 'skill',
            name: `snapshot-${index + 1}`,
            description: `Snapshot item from ${componentId}`,
            platform: 'claude_code',
            content: `---\\nname: snapshot-${index + 1}\\n---\\n\\nMock snapshot`,
            frontmatter: { name: `snapshot-${index + 1}` },
            tags: ['snapshot'],
            source_component_id: componentId,
            config: {},
          })),
        },
      ],
      created_at: now,
      updated_at: now,
    };
    projectTemplatesStore = [created, ...projectTemplatesStore];
    return HttpResponse.json(
      {
        ...toTemplateSummary(created),
        components: getLatestRevision(created).items,
      },
      { status: 201 }
    );
  }),

  http.put('*/api/project-templates/:templateId', async ({ params, request }) => {
    const templateId = params.templateId as string;
    const body = (await request.json()) as {
      name?: string;
      description?: string;
      tags?: string[];
      components?: ProjectTemplateComponentBlueprint[];
      change_note?: string;
    };
    const index = projectTemplatesStore.findIndex((item) => item.id === templateId);
    if (index < 0) {
      return HttpResponse.json(
        {
          detail: 'Project template not found',
          message_key: 'errors.project_template_not_found',
          message: 'Project template not found',
        },
        { status: 404 }
      );
    }
    const current = projectTemplatesStore[index];
    if (current.scope === 'system') {
      return HttpResponse.json(
        {
          detail: 'System template is immutable',
          message_key: 'errors.project_template_system_immutable',
          message: 'System template is immutable',
        },
        { status: 403 }
      );
    }

    const name = (body.name ?? '').trim();
    const description = (body.description ?? '').trim();
    const components = Array.isArray(body.components) ? body.components : [];
    if (!name || !description || components.length === 0) {
      return HttpResponse.json(
        {
          detail: 'name, description, components are required',
          message_key: 'errors.validation_error',
          message: 'name, description, components are required',
        },
        { status: 422 }
      );
    }

    if (
      projectTemplatesStore.some(
        (template) => template.id !== current.id && template.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      return HttpResponse.json(
        {
          detail: 'Project template name already exists',
          message_key: 'errors.project_template_name_exists',
          message: 'Project template name already exists',
        },
        { status: 400 }
      );
    }

    const nextRevision = Math.max(...current.revisions.map((revision) => revision.revision)) + 1;
    const now = new Date().toISOString();
    const updated: ProjectTemplateRecord = {
      ...current,
      name,
      description,
      tags: Array.isArray(body.tags) ? body.tags : [],
      version: current.version + 1,
      updated_at: now,
      revisions: [
        ...current.revisions,
        {
          revision: nextRevision,
          preset_type: current.preset_type,
          created_at: now,
          created_by: null,
          change_note: body.change_note ?? `revision ${nextRevision}`,
          items: components,
        },
      ],
    };
    projectTemplatesStore[index] = updated;
    return HttpResponse.json({
      ...toTemplateSummary(updated),
      components: getLatestRevision(updated).items,
    });
  }),

  http.get('*/api/project-templates/:templateId/revisions', ({ params }) => {
    const templateId = params.templateId as string;
    const template = projectTemplatesStore.find((item) => item.id === templateId);
    if (!template) {
      return HttpResponse.json(
        {
          detail: 'Project template not found',
          message_key: 'errors.project_template_not_found',
          message: 'Project template not found',
        },
        { status: 404 }
      );
    }
    const items = [...template.revisions]
      .sort((a, b) => b.revision - a.revision)
      .map((revision) => ({
        revision: revision.revision,
        preset_type: revision.preset_type,
        created_at: revision.created_at,
        created_by: revision.created_by,
        change_note: revision.change_note,
        item_count: revision.items.length,
      }));
    return HttpResponse.json({ items, total: items.length });
  }),

  http.get('*/api/project-templates/:templateId/revisions/:revision', ({ params }) => {
    const templateId = params.templateId as string;
    const revisionValue = Number(params.revision as string);
    const template = projectTemplatesStore.find((item) => item.id === templateId);
    if (!template) {
      return HttpResponse.json(
        {
          detail: 'Project template not found',
          message_key: 'errors.project_template_not_found',
          message: 'Project template not found',
        },
        { status: 404 }
      );
    }
    const revision = template.revisions.find((item) => item.revision === revisionValue);
    if (!revision) {
      return HttpResponse.json(
        {
          detail: 'Project preset revision not found',
          message_key: 'errors.project_template_revision_not_found',
          message: 'Project preset revision not found',
        },
        { status: 404 }
      );
    }
    return HttpResponse.json({
      template_id: template.id,
      revision: revision.revision,
      preset_type: revision.preset_type,
      created_at: revision.created_at,
      created_by: revision.created_by,
      change_note: revision.change_note,
      item_count: revision.items.length,
      items: revision.items,
    });
  }),

  http.post('*/api/project-templates/:templateId/revisions/:revision/restore', async ({ params, request }) => {
    const templateId = params.templateId as string;
    const revisionValue = Number(params.revision as string);
    const body = (await request.json().catch(() => ({}))) as { change_note?: string | null };
    const index = projectTemplatesStore.findIndex((item) => item.id === templateId);
    if (index < 0) {
      return HttpResponse.json(
        {
          detail: 'Project template not found',
          message_key: 'errors.project_template_not_found',
          message: 'Project template not found',
        },
        { status: 404 }
      );
    }
    const template = projectTemplatesStore[index];
    if (template.scope === 'system') {
      return HttpResponse.json(
        {
          detail: 'System template is immutable',
          message_key: 'errors.project_template_system_immutable',
          message: 'System template is immutable',
        },
        { status: 403 }
      );
    }
    const revision = template.revisions.find((item) => item.revision === revisionValue);
    if (!revision) {
      return HttpResponse.json(
        {
          detail: 'Project preset revision not found',
          message_key: 'errors.project_template_revision_not_found',
          message: 'Project preset revision not found',
        },
        { status: 404 }
      );
    }

    const nextRevision = Math.max(...template.revisions.map((item) => item.revision)) + 1;
    const now = new Date().toISOString();
    const restored: TemplateRevisionRecord = {
      revision: nextRevision,
      preset_type: revision.preset_type,
      created_at: now,
      created_by: null,
      change_note: body.change_note ?? `restore revision ${revisionValue}`,
      items: revision.items.map((item) => ({ ...item, config: { ...item.config } })),
    };
    template.revisions.push(restored);
    template.version += 1;
    template.updated_at = now;
    projectTemplatesStore[index] = template;

    return HttpResponse.json({
      template_id: template.id,
      revision: restored.revision,
      preset_type: restored.preset_type,
      created_at: restored.created_at,
      created_by: restored.created_by,
      change_note: restored.change_note,
      item_count: restored.items.length,
      items: restored.items,
    });
  }),

  http.delete('*/api/project-templates/:templateId', ({ params }) => {
    const templateId = params.templateId as string;
    const index = projectTemplatesStore.findIndex((item) => item.id === templateId);
    if (index < 0) {
      return HttpResponse.json(
        {
          detail: 'Project template not found',
          message_key: 'errors.project_template_not_found',
          message: 'Project template not found',
        },
        { status: 404 }
      );
    }
    if (projectTemplatesStore[index].scope === 'system') {
      return HttpResponse.json(
        {
          detail: 'System template is immutable',
          message_key: 'errors.project_template_system_immutable',
          message: 'System template is immutable',
        },
        { status: 403 }
      );
    }
    projectTemplatesStore.splice(index, 1);
    return HttpResponse.json({ message: 'Deleted', message_key: 'common.deleted' });
  }),
];

export function resetProjectsStore() {
  resetStores();
}
