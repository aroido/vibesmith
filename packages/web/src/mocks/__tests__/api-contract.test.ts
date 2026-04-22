/**
 * API Contract Tests
 * MSW 핸들러가 API 스펙과 일치하는지 검증
 * Based on docs/api/spec.md
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../server';
import { resetProjectsStore } from '../handlers';

const API_BASE = 'http://localhost:8000';

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  resetProjectsStore();
});
afterAll(() => server.close());

describe('API Contract - MSW Handlers', () => {
  it('GET /api/projects returns array with required fields', async () => {
    const res = await fetch(`${API_BASE}/api/projects`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      const project = data[0];
      expect(project).toHaveProperty('id');
      expect(project).toHaveProperty('name');
      expect(project).toHaveProperty('path');
      expect(project).toHaveProperty('is_global');
      expect(project).toHaveProperty('component_count');
      expect(project).toHaveProperty('last_scanned_at');
      expect(project).toHaveProperty('dir_exists');
      expect(project).toHaveProperty('platforms');
    }
  });

  it('GET /api/project-templates returns list response', async () => {
    const res = await fetch(`${API_BASE}/api/project-templates`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('items');
    expect(data).toHaveProperty('total');
    expect(Array.isArray(data.items)).toBe(true);
    if (data.items.length > 0) {
      const template = data.items[0];
      expect(template).toHaveProperty('id');
      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('scope');
      expect(template).toHaveProperty('component_count');
    }
  });

  it('GET /api/project-templates/:id returns template detail with components', async () => {
    const listRes = await fetch(`${API_BASE}/api/project-templates`);
    const listData = await listRes.json();
    const templateId = listData.items[0]?.id;

    expect(templateId).toBeTruthy();

    const res = await fetch(`${API_BASE}/api/project-templates/${templateId as string}`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('components');
    expect(Array.isArray(data.components)).toBe(true);
    expect(data).toHaveProperty('latest_revision');
    expect(data).toHaveProperty('revisions_count');
  });

  it('GET /api/project-templates/:id/revisions returns revision list', async () => {
    const listRes = await fetch(`${API_BASE}/api/project-templates`);
    const listData = await listRes.json();
    const templateId = listData.items[0]?.id as string | undefined;
    expect(templateId).toBeTruthy();

    const res = await fetch(`${API_BASE}/api/project-templates/${templateId as string}/revisions`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('items');
    expect(data).toHaveProperty('total');
    expect(Array.isArray(data.items)).toBe(true);
    if (data.items.length > 0) {
      expect(data.items[0]).toHaveProperty('revision');
      expect(data.items[0]).toHaveProperty('item_count');
    }
  });

  it('POST /api/project-templates/from-project creates snapshot preset', async () => {
    const projectsRes = await fetch(`${API_BASE}/api/projects`);
    const projects = await projectsRes.json();
    const sourceProject = projects.find((project: { is_global: boolean }) => !project.is_global);
    expect(sourceProject).toBeTruthy();

    const res = await fetch(`${API_BASE}/api/project-templates/from-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_project_id: sourceProject.id,
        name: 'Contract Snapshot',
        description: 'snapshot for contract test',
        tags: ['contract'],
        component_ids: ['comp-a', 'comp-b'],
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.preset_type).toBe('snapshot');
    expect(data).toHaveProperty('latest_revision');
    expect(Array.isArray(data.components)).toBe(true);
  });

  it('POST /api/projects/:id/preset-preview returns preview summary', async () => {
    const projectRes = await fetch(`${API_BASE}/api/projects`);
    const projects = await projectRes.json();
    const project = projects.find((item: { is_global: boolean }) => !item.is_global);
    expect(project).toBeTruthy();

    const templateRes = await fetch(`${API_BASE}/api/project-templates`);
    const templates = await templateRes.json();
    const template = templates.items[0];
    expect(template).toBeTruthy();

    const res = await fetch(`${API_BASE}/api/projects/${project.id}/preset-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preset_id: template.id,
        revision: template.latest_revision,
        conflict_policy: 'fail',
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('summary');
    expect(data.summary).toHaveProperty('conflicts');
    expect(Array.isArray(data.items)).toBe(true);
  });

  it('POST /api/projects/:id/apply-preset with fail policy can return conflict 409', async () => {
    const projectRes = await fetch(`${API_BASE}/api/projects`);
    const projects = await projectRes.json();
    const project = projects.find((item: { is_global: boolean }) => !item.is_global);
    expect(project).toBeTruthy();

    const templateRes = await fetch(`${API_BASE}/api/project-templates`);
    const templates = await templateRes.json();
    const template = templates.items[0];
    expect(template).toBeTruthy();

    const res = await fetch(`${API_BASE}/api/projects/${project.id}/apply-preset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preset_id: template.id,
        revision: template.latest_revision,
        conflict_policy: 'fail',
      }),
    });
    expect([200, 409]).toContain(res.status);
    if (res.status === 409) {
      const data = await res.json();
      expect(data).toHaveProperty('message_key');
      expect(data.message_key).toBe('errors.project_template_apply_conflict');
    }
  });

  it('POST /api/projects returns preset-based create response', async () => {
    const listRes = await fetch(`${API_BASE}/api/project-templates`);
    const listData = await listRes.json();
    const presetId = listData.items[0]?.id as string | undefined;
    expect(presetId).toBeTruthy();

    const res = await fetch(`${API_BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: '/Users/user/Projects/contract-created-project',
        preset_id: presetId,
        scan_after_create: true,
      }),
    });
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data).toHaveProperty('project');
    expect(data).toHaveProperty('applied_preset');
    expect(data).toHaveProperty('created_components');
    expect(data).toHaveProperty('scanned_components');
    expect(data.applied_preset).toHaveProperty('id');
    expect(data.applied_preset.id).toBe(presetId);
  });

  it('GET /api/components returns array with required fields', async () => {
    const res = await fetch(`${API_BASE}/api/components`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      const comp = data[0];
      expect(comp).toHaveProperty('id');
      expect(comp).toHaveProperty('type');
      expect(comp).toHaveProperty('name');
      expect(comp).toHaveProperty('enabled');
      expect(comp).toHaveProperty('project_id');
      expect(comp).toHaveProperty('path');
      expect(comp).toHaveProperty('created_at');
      expect(comp).toHaveProperty('updated_at');
    }
  });

  it('GET /api/components/recent returns limited recent components', async () => {
    const res = await fetch(`${API_BASE}/api/components/recent?limit=1`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeLessThanOrEqual(1);
    if (data.length > 0) {
      const comp = data[0];
      expect(comp).toHaveProperty('id');
      expect(comp).toHaveProperty('updated_at');
    }
  });

  it('POST /api/components returns 201 with component', async () => {
    const res = await fetch(`${API_BASE}/api/components`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'skill',
        name: 'contract-test-skill',
        project_id: 'proj_abc123',
        content: '---\nname: test\n---\ncontent',
        platform: 'cursor',
      }),
    });
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data).toHaveProperty('id');
    expect(data.name).toBe('contract-test-skill');
    expect(data.type).toBe('skill');
  });

  it('PATCH /api/components/bulk-toggle returns updated_count and updated_ids', async () => {
    const res = await fetch(`${API_BASE}/api/components/bulk-toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        component_ids: ['comp_001', 'comp_002'],
        enabled: false,
      }),
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('updated_count');
    expect(data).toHaveProperty('updated_ids');
    expect(Array.isArray(data.updated_ids)).toBe(true);
  });

  it('GET /api/components/:id/versions returns version history array', async () => {
    const res = await fetch(`${API_BASE}/api/components/comp_001/versions`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      const version = data[0];
      expect(version).toHaveProperty('version');
      expect(version).toHaveProperty('content');
      expect(version).toHaveProperty('created_at');
    }
  });

  it('POST /api/components/:id/rollback returns rollback metadata', async () => {
    const res = await fetch(`${API_BASE}/api/components/comp_001/rollback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: 2 }),
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('restored_version');
    expect(data).toHaveProperty('new_version');
    expect(data).toHaveProperty('message');
  });

  it('POST /api/backup/create returns created backup metadata', async () => {
    const res = await fetch(`${API_BASE}/api/backup/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('size_bytes');
    expect(data).toHaveProperty('checksum');
    expect(data).toHaveProperty('created_at');
  });

  it('GET /api/backup/list returns backup list', async () => {
    const res = await fetch(`${API_BASE}/api/backup/list`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      const item = data[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('version');
      expect(item).toHaveProperty('size_bytes');
      expect(item).toHaveProperty('checksum');
      expect(item).toHaveProperty('created_at');
    }
  });

  it('GET /api/backup/:id returns backup detail payload', async () => {
    const listRes = await fetch(`${API_BASE}/api/backup/list`);
    const list = await listRes.json();
    const targetId = list[0]?.id;
    expect(targetId).toBeTruthy();

    const res = await fetch(`${API_BASE}/api/backup/${targetId}`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('payload');
    expect(data.payload).toHaveProperty('data');
  });

  it('POST /api/backup/restore returns restored counts', async () => {
    const listRes = await fetch(`${API_BASE}/api/backup/list`);
    const list = await listRes.json();
    const targetId = list[0]?.id;
    expect(targetId).toBeTruthy();

    const res = await fetch(`${API_BASE}/api/backup/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backup_id: targetId }),
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('restored_projects');
    expect(data).toHaveProperty('restored_components');
    expect(data).toHaveProperty('restored_tags');
    expect(data).toHaveProperty('restored_dependencies');
    expect(data).toHaveProperty('restored_versions');
  });

  it('DELETE /api/backup/:id returns delete message', async () => {
    const createRes = await fetch(`${API_BASE}/api/backup/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const created = await createRes.json();
    const targetId = created.id as string;

    const res = await fetch(`${API_BASE}/api/backup/${targetId}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('message');
    expect(data).toHaveProperty('message_key');
  });

  it('POST /api/feedback returns created issue metadata', async () => {
    const res = await fetch(`${API_BASE}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Feedback test',
        description: 'Feedback description',
        category: 'bug',
        system_info: {
          runtime: 'web',
        },
      }),
    });
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data).toHaveProperty('issue_url');
    expect(data).toHaveProperty('issue_number');
    expect(data.issue_url).toContain('github.com/aroido/vibesmith/issues/');
  });

  it('POST /api/license/validate returns validation result', async () => {
    const res = await fetch(`${API_BASE}/api/license/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'VS-VALID-PRO',
      }),
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('valid');
    expect(data).toHaveProperty('plan');
    expect(data).toHaveProperty('expires_at');
    expect(data.valid).toBe(true);
    expect(data.plan).toBe('pro');
  });

  it('GET /api/license/me returns current license status', async () => {
    const res = await fetch(`${API_BASE}/api/license/me`, {
      headers: {
        'X-License-Key': 'VS-VALID-TEAM',
      },
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('valid');
    expect(data).toHaveProperty('plan');
    expect(data).toHaveProperty('expires_at');
    expect(data.valid).toBe(true);
    expect(data.plan).toBe('team');
  });

  it('POST /api/license/checkout returns checkout session metadata', async () => {
    const res = await fetch(`${API_BASE}/api/license/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan: 'pro',
        email: 'user@example.com',
      }),
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('checkout_url');
    expect(data).toHaveProperty('session_id');
  });

  it('POST /api/scan returns status and message', async () => {
    const res = await fetch(`${API_BASE}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('message');
    expect(data.status).toBe('started');
  });

  it('POST /api/usage/scan returns sessions_parsed and stats_saved', async () => {
    const res = await fetch(`${API_BASE}/api/usage/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('sessions_parsed');
    expect(data).toHaveProperty('stats_saved');
  });

  it('POST /api/usage/reset returns selective deletion summary', async () => {
    const res = await fetch(`${API_BASE}/api/usage/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('deleted_sessions');
    expect(data).toHaveProperty('deleted_parse_states');
    expect(data).toHaveProperty('preserved_sessions');
    expect(data).toHaveProperty('preserved_parse_states');
  });

  it('GET /api/stats returns dashboard stats shape', async () => {
    const res = await fetch(`${API_BASE}/api/stats`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('total_skills');
    expect(data).toHaveProperty('active_count');
    expect(data).toHaveProperty('trends');
    expect(data.trends).toHaveProperty('skills');
  });

  it('GET /api/system/status returns status shape', async () => {
    const res = await fetch(`${API_BASE}/api/system/status`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('is_live');
    expect(data).toHaveProperty('last_scan_at');
    expect(data).toHaveProperty('active_workers');
    expect(data).toHaveProperty('health_score');
  });

  it('handles API 404 error with detail', async () => {
    server.use(
      http.get('*/api/components/not-found-id', () =>
        HttpResponse.json({ detail: '구성요소를 찾을 수 없습니다' }, { status: 404 })
      )
    );

    const res = await fetch(`${API_BASE}/api/components/not-found-id`);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data).toHaveProperty('detail');
  });

  it('GET /api/projects/:id returns project detail with breakdown', async () => {
    const res = await fetch(`${API_BASE}/api/projects/proj_abc123`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('breakdown');
    expect(data.breakdown).toHaveProperty('skill');
    expect(data.breakdown).toHaveProperty('agent');
  });

  it('GET /api/projects/:id/activities returns activity list', async () => {
    const res = await fetch(`${API_BASE}/api/projects/proj_abc123/activities`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      const activity = data[0];
      expect(activity).toHaveProperty('id');
      expect(activity).toHaveProperty('activity_type');
      expect(activity).toHaveProperty('component_name');
      expect(activity).toHaveProperty('created_at');
    }
  });

  it('GET /api/conflicts returns conflicts list', async () => {
    const res = await fetch(`${API_BASE}/api/conflicts`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      const conflict = data[0];
      expect(conflict).toHaveProperty('id');
      expect(conflict).toHaveProperty('name');
      expect(conflict).toHaveProperty('global_component_id');
      expect(conflict).toHaveProperty('project_component_id');
    }
  });

  it('POST /api/conflicts/:id/resolve returns success', async () => {
    const res = await fetch(`${API_BASE}/api/conflicts/global_1|project_2/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ignore' }),
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('success');
    expect(data).toHaveProperty('conflict_id');
  });

  it('POST /api/components/generate returns generated content', async () => {
    const res = await fetch(`${API_BASE}/api/components/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        component_type: 'skill',
        template_id: 'template_skill_basic',
        name: 'test-skill',
        description: 'Generated for test',
        config: { skill_name: 'test-skill' },
      }),
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('content');
    expect(data).toHaveProperty('preview_id');
    expect(data).toHaveProperty('expires_at');
    expect(data).toHaveProperty('component_type');
    expect(data).toHaveProperty('file_name');
  });

  it('POST /api/components/save returns 201 with saved component', async () => {
    const res = await fetch(`${API_BASE}/api/components/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: 'proj_abc123',
        type: 'skill',
        name: 'wizard-skill',
        content: '# Wizard Skill',
        platform: 'cursor',
      }),
    });
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data).toHaveProperty('id');
    expect(data.name).toBe('wizard-skill');
  });

  it('GET /api/templates returns templates list', async () => {
    const res = await fetch(`${API_BASE}/api/templates`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('templates');
    expect(data).toHaveProperty('total');
    expect(Array.isArray(data.templates)).toBe(true);
    if (data.templates.length > 0) {
      const template = data.templates[0];
      expect(template).toHaveProperty('id');
      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('component_type');
      expect(template).toHaveProperty('fields');
    }
  });

  it('GET /api/templates/:id returns template detail', async () => {
    const res = await fetch(`${API_BASE}/api/templates/template_skill_basic`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('name');
    expect(data).toHaveProperty('fields');
    expect(Array.isArray(data.fields)).toBe(true);
  });

  it('GET /api/dependencies returns graph payload', async () => {
    const res = await fetch(`${API_BASE}/api/dependencies`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('nodes');
    expect(data).toHaveProperty('edges');
    expect(data).toHaveProperty('cycles');
    expect(Array.isArray(data.nodes)).toBe(true);
    expect(Array.isArray(data.edges)).toBe(true);
    expect(Array.isArray(data.cycles)).toBe(true);
  });

  it('GET /api/dependencies/:id returns dependency info (stub)', async () => {
    const res = await fetch(`${API_BASE}/api/dependencies/comp_abc123`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('component_id');
    expect(data).toHaveProperty('depends_on');
    expect(data).toHaveProperty('depended_by');
  });
});
