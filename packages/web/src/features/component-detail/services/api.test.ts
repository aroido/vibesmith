/**
 * Component Detail API unit tests
 * MSW mocking: GET, DELETE, POST toggle
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  getComponent,
  deleteComponent,
  toggleComponent,
  copyComponent,
} from './api';
import { ApiError } from '@/common/api';

const mockComponentDetail = {
  id: 'comp_001',
  type: 'skill',
  name: 'fastapi-route',
  description: 'FastAPI 라우트 스캐폴딩',
  enabled: true,
  tags: ['python', 'fastapi'],
  project_id: 'proj_abc123',
  project_name: 'vibesmith',
  path: '/Users/user/vibesmith/.claude/skills/fastapi-route/SKILL.md',
  content: '---\nname: fastapi-route\n---\n본문 내용...',
  frontmatter: { name: 'fastapi-route', description: 'FastAPI 라우트 스캐폴딩' },
  dependencies: {
    depends_on: [{ id: 'comp_010', name: 'pydantic-model', type: 'skill' }],
    depended_by: [],
  },
  created_at: '2026-02-09T10:00:00Z',
  updated_at: '2026-02-09T15:00:00Z',
};

const server = setupServer(
  http.get('*/api/components/:id', ({ params }) => {
    const id = params.id as string;
    if (id === 'comp_001') {
      return HttpResponse.json(mockComponentDetail);
    }
    return HttpResponse.json({ detail: 'Not found' }, { status: 404 });
  }),
  http.delete('*/api/components/:id', ({ params }) => {
    const id = params.id as string;
    if (id === 'comp_001') {
      return new HttpResponse(null, { status: 200 });
    }
    return HttpResponse.json({ detail: 'Not found' }, { status: 404 });
  }),
  http.post('*/api/components/:id/toggle', () => {
    return HttpResponse.json({
      id: 'comp_001',
      enabled: false,
      affected_dependencies: [],
    });
  }),
  http.post('*/api/components/:id/copy', async ({ params, request }) => {
    const id = params.id as string;
    void (await request.json()); // validate request body is JSON
    return HttpResponse.json(
      {
        copied: [
          {
            original_id: id,
            new_id: `comp_copy_${id}`,
            name: 'fastapi-route',
            type: 'skill',
          },
        ],
      },
      { status: 201 }
    );
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('getComponent', () => {
  it('should return component detail on 200', async () => {
    const result = await getComponent('comp_001');

    expect(result).toEqual(mockComponentDetail);
    expect(result.id).toBe('comp_001');
    expect(result.name).toBe('fastapi-route');
    expect(result.dependencies.depends_on).toHaveLength(1);
  });

  it('should throw on 404', async () => {
    server.use(
      http.get('*/api/components/:id', () =>
        HttpResponse.json({ detail: 'Not found' }, { status: 404 })
      )
    );

    await expect(getComponent('comp_invalid')).rejects.toThrow(ApiError);
    await expect(getComponent('comp_invalid')).rejects.toMatchObject({
      statusCode: 404,
      message: expect.any(String),
    });
  });

  it('should throw on 500', async () => {
    server.use(
      http.get('*/api/components/:id', () =>
        HttpResponse.json({ detail: 'Internal Server Error' }, { status: 500 })
      )
    );

    await expect(getComponent('comp_001')).rejects.toThrow(ApiError);
    await expect(getComponent('comp_001')).rejects.toMatchObject({
      statusCode: 500,
    });
  });
});

describe('deleteComponent', () => {
  it('should succeed on 200', async () => {
    await expect(deleteComponent('comp_001')).resolves.not.toThrow();
  });

  it('should throw on 404', async () => {
    server.use(
      http.delete('*/api/components/:id', () =>
        HttpResponse.json({ detail: 'Not found' }, { status: 404 })
      )
    );

    await expect(deleteComponent('comp_001')).rejects.toThrow(ApiError);
    await expect(deleteComponent('comp_001')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('toggleComponent', () => {
  it('should succeed on 200', async () => {
    await expect(toggleComponent('comp_001')).resolves.not.toThrow();
  });

  it('should send enabled in body when provided', async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post('*/api/components/:id/toggle', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          id: 'comp_001',
          enabled: false,
          affected_dependencies: [],
        });
      })
    );

    await toggleComponent('comp_001', false);

    expect(capturedBody).toEqual({ enabled: false });
  });
});

describe('copyComponent', () => {
  it('should call correct endpoint', async () => {
    const result = await copyComponent(
      'comp_001',
      'proj_xyz789',
      false
    );

    expect(result).toEqual({
      copied: [
        {
          original_id: 'comp_001',
          new_id: 'comp_copy_comp_001',
          name: 'fastapi-route',
          type: 'skill',
        },
      ],
    });
  });

  it('should send correct request body format', async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post('*/api/components/:id/copy', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          { copied: [{ original_id: 'c1', new_id: 'c2', name: 'x', type: 'skill' }] },
          { status: 201 }
        );
      })
    );

    await copyComponent('comp_001', 'proj_target', false);
    expect(capturedBody).toEqual({
      target_project_id: 'proj_target',
      include_dependencies: false,
    });

    await copyComponent('comp_001', 'proj_target', true);
    expect(capturedBody).toEqual({
      target_project_id: 'proj_target',
      include_dependencies: true,
    });
  });

  it('should parse response correctly', async () => {
    const result = await copyComponent('comp_001', 'proj_xyz789', false);

    expect(result).toHaveProperty('copied');
    expect(Array.isArray(result.copied)).toBe(true);
    expect(result.copied[0]).toMatchObject({
      original_id: 'comp_001',
      new_id: expect.any(String),
      name: 'fastapi-route',
      type: 'skill',
    });
  });

  it('should throw on 400', async () => {
    server.use(
      http.post('*/api/components/:id/copy', () =>
        HttpResponse.json(
          { detail: 'Component with the same name already exists in target project' },
          { status: 400 }
        )
      )
    );

    await expect(
      copyComponent('comp_001', 'proj_xyz789', false)
    ).rejects.toThrow(ApiError);
    await expect(
      copyComponent('comp_001', 'proj_xyz789', false)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('should throw on 404', async () => {
    server.use(
      http.post('*/api/components/:id/copy', () =>
        HttpResponse.json({ detail: 'Not found' }, { status: 404 })
      )
    );

    await expect(
      copyComponent('comp_001', 'proj_xyz789', false)
    ).rejects.toThrow(ApiError);
    await expect(
      copyComponent('comp_001', 'proj_xyz789', false)
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('should throw on 500', async () => {
    server.use(
      http.post('*/api/components/:id/copy', () =>
        HttpResponse.json({ detail: 'Internal Server Error' }, { status: 500 })
      )
    );

    await expect(
      copyComponent('comp_001', 'proj_xyz789', false)
    ).rejects.toThrow(ApiError);
    await expect(
      copyComponent('comp_001', 'proj_xyz789', false)
    ).rejects.toMatchObject({ statusCode: 500 });
  });
});
