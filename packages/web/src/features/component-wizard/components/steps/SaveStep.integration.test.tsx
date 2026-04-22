/**
 * SaveStep API Integration Tests
 * MSW를 사용한 POST /api/components/save 계약 테스트
 * (SaveStep UI는 Radix Select + jsdom 호환 이슈로 API 레벨 테스트로 대체)
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { saveComponent } from '../../services/api';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  server.use(
    http.get('*/api/projects', () =>
      HttpResponse.json([
        { id: 'proj_abc123', name: 'vibesmith', path: '/path', is_global: false, platforms: ['claude_code', 'cursor'] },
      ])
    ),
    http.post('*/api/components/save', async ({ request }) => {
      const body = (await request.json()) as { name?: string };
      if (body?.name === 'duplicate-skill') {
        return HttpResponse.json(
          { detail: '같은 이름의 구성요소가 이미 존재합니다' },
          { status: 409 }
        );
      }
      return HttpResponse.json(
        {
          id: 'comp_new_123',
          type: 'skill',
          name: body?.name ?? 'my-new-skill',
          description: '',
          enabled: true,
          tags: [],
          project_id: 'proj_abc123',
          path: '/path/to/skill',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { status: 201 }
      );
    })
  );
});

describe('SaveStep API (saveComponent)', () => {
  it('should save component successfully via POST /api/components/save', async () => {
    const result = await saveComponent({
      type: 'skill',
      name: 'my-new-skill',
      project_id: 'proj_abc123',
      content: '---\nname: my-new-skill\n---\ncontent',
      platform: 'cursor',
    });

    expect(result.id).toBe('comp_new_123');
    expect(result.name).toBe('my-new-skill');
    expect(result.type).toBe('skill');
  });

  it('should throw when API returns 409 (duplicate)', async () => {
    await expect(
      saveComponent({
        type: 'skill',
        name: 'duplicate-skill',
        project_id: 'proj_abc123',
        content: 'content',
        platform: 'cursor',
      })
    ).rejects.toThrow();
  });

  it('should throw when API returns 500', async () => {
    server.use(
      http.post('*/api/components/save', () =>
        HttpResponse.json({ detail: '서버 오류' }, { status: 500 })
      )
    );

    await expect(
      saveComponent({
        type: 'skill',
        name: 'test',
        project_id: 'proj_abc123',
        content: 'content',
        platform: 'cursor',
      })
    ).rejects.toThrow();
  });

  it('should send claude_code platform when specified', async () => {
    let capturedPlatform: string | undefined;
    server.use(
      http.post('*/api/components/save', async ({ request }) => {
        const body = (await request.json()) as { platform?: string; name?: string };
        capturedPlatform = body?.platform;
        return HttpResponse.json(
          {
            id: 'comp_claude',
            type: 'skill',
            name: body?.name ?? 'skill',
            description: '',
            enabled: true,
            tags: [],
            project_id: 'proj_abc123',
            path: '/path',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { status: 201 }
        );
      })
    );

    await saveComponent({
      type: 'skill',
      name: 'claude-skill',
      project_id: 'proj_abc123',
      content: 'content',
      platform: 'claude_code',
    });

    expect(capturedPlatform).toBe('claude_code');
  });
});
