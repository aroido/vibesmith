/**
 * Component Edit API unit tests
 * Spec §7.3 Error Handling - 404, 400, 500
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { getComponent, updateComponent } from './api';
import { ApiError } from '@/common/api';

const mockDetail = {
  id: 'comp_001',
  type: 'skill',
  name: 'fastapi-route',
  description: 'FastAPI 라우트 스캐폴딩',
  enabled: true,
  tags: ['python', 'fastapi'],
  project_id: 'proj_abc123',
  project_name: 'vibesmith',
  path: '/path/to/skill.md',
  content: '---\nname: fastapi-route\n---\n본문',
  frontmatter: {},
  dependencies: { depends_on: [], depended_by: [] },
  created_at: '2026-02-09T10:00:00Z',
  updated_at: '2026-02-09T15:00:00Z',
};

const mockUpdateResponse = {
  id: 'comp_001',
  type: 'skill',
  name: 'fastapi-route',
  description: '수정된 설명',
  enabled: true,
  tags: ['python', 'fastapi', 'crud'],
  project_id: 'proj_abc123',
  path: '/path/to/skill.md',
  created_at: '2026-02-09T10:00:00Z',
  updated_at: '2026-02-13T10:30:00Z',
};

const server = setupServer(
  http.get('*/api/components/:id', ({ params }) => {
    const id = params.id as string;
    if (id === 'comp_001') return HttpResponse.json(mockDetail);
    if (id === 'comp_404') return HttpResponse.json({ detail: 'Not found' }, { status: 404 });
    return HttpResponse.json({ detail: 'Server error' }, { status: 500 });
  }),
  http.put('*/api/components/:id', async ({ request, params }) => {
    const id = params.id as string;
    const body = (await request.json()) as { content?: string; tags?: string[] };
    if (id === 'comp_400') return HttpResponse.json({ detail: 'Invalid name' }, { status: 400 });
    if (id === 'comp_409') return HttpResponse.json({ detail: 'Name already exists' }, { status: 409 });
    if (id === 'comp_500') return HttpResponse.json({ detail: 'Internal error' }, { status: 500 });
    return HttpResponse.json({ ...mockUpdateResponse, ...body });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('getComponent (re-export)', () => {
  it('should return component on 200', async () => {
    const result = await getComponent('comp_001');
    expect(result.id).toBe('comp_001');
    expect(result.name).toBe('fastapi-route');
  });

  it('should throw on 404', async () => {
    await expect(getComponent('comp_404')).rejects.toThrow();
  });
});

describe('updateComponent', () => {
  it('should succeed on 200', async () => {
    const result = await updateComponent('comp_001', {
      content: '---\nname: x\n---\nbody',
      tags: ['python', 'fastapi', 'crud'],
    });
    expect(result.id).toBe('comp_001');
    expect(result.tags).toContain('crud');
  });

  it('should throw ApiError on 404', async () => {
    server.use(
      http.put('*/api/components/:id', () =>
        HttpResponse.json({ detail: 'Not found' }, { status: 404 })
      )
    );
    await expect(updateComponent('comp_001', {})).rejects.toThrow(ApiError);
    await expect(updateComponent('comp_001', {})).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('should throw on 400', async () => {
    await expect(
      updateComponent('comp_400', { content: 'invalid' })
    ).rejects.toThrow(ApiError);
    await expect(
      updateComponent('comp_400', { content: 'invalid' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('should throw on 409', async () => {
    await expect(
      updateComponent('comp_409', { content: 'dup' })
    ).rejects.toThrow(ApiError);
    await expect(
      updateComponent('comp_409', { content: 'dup' })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('should throw on 500', async () => {
    await expect(
      updateComponent('comp_500', {})
    ).rejects.toThrow(ApiError);
    await expect(
      updateComponent('comp_500', {})
    ).rejects.toMatchObject({ statusCode: 500 });
  });
});
