/**
 * useCreateComponent hook unit tests
 * Mutation, success navigation, error handling (spec Appendix B)
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import i18n from '@/i18n';
import { useCreateComponent } from './useCreateComponent';

const mockNavigate = vi.fn();
const mockT = (key: string, opts?: Record<string, unknown>) => {
  if (opts && typeof opts === 'object') {
    return Object.entries(opts).reduce(
      (acc, [k, v]) => acc.replace(new RegExp(`{{${k}}}`, 'g'), String(v)),
      i18n.t(key)
    );
  }
  return i18n.t(key);
};

vi.mock('react-i18next', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-i18next')>();
  return {
    ...mod,
    useTranslation: () => ({
      t: mockT,
      i18n,
      ready: true,
    }),
  };
});

vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...mod,
    useNavigate: () => mockNavigate,
  };
});

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(MemoryRouter, {}, children)
    );
  };
};

const mockCreateResponse = {
  id: 'comp_new',
  type: 'skill' as const,
  name: 'my-new-skill',
  description: 'A skill that does something useful',
  enabled: true,
  tags: ['python', 'automation'],
  project_id: 'proj_abc123',
  project_name: 'vibesmith',
  path: '/Users/user/Projects/vibesmith/.claude/skills/my-new-skill/SKILL.md',
  created_at: '2026-02-13T10:00:00Z',
  updated_at: '2026-02-13T10:00:00Z',
};

const server = setupServer(
  http.post('*/api/components', async ({ request }) => {
    const body = (await request.json()) as { name: string };
    if (body.name === 'duplicate-skill') {
      return HttpResponse.json(
        { detail: 'Component with this name already exists' },
        { status: 400 }
      );
    }
    return HttpResponse.json(mockCreateResponse, { status: 201 });
  })
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  mockNavigate.mockClear();
});
afterAll(() => server.close());

describe('useCreateComponent', () => {
  it('should create component and navigate to detail on success', async () => {
    const { result } = renderHook(() => useCreateComponent(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      type: 'skill',
      name: 'my-new-skill',
      project_id: 'proj_abc123',
      content: '---\nname: my-new-skill\n---\n# Content',
      tags: ['python', 'automation'],
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.id).toBe('comp_new');
    expect(mockNavigate).toHaveBeenCalledWith('/components/comp_new');
  });

  it('should transition from pending to success', async () => {
    const { result } = renderHook(() => useCreateComponent(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      type: 'skill',
      name: 'pending-skill',
      project_id: 'proj_abc123',
      content: 'content',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.isPending).toBe(false);
    expect(mockNavigate).toHaveBeenCalledWith('/components/comp_new');
  });

  it('should set error when creation fails', async () => {
    server.use(
      http.post('*/api/components', () =>
        HttpResponse.json(
          { detail: 'Component with this name already exists' },
          { status: 400 }
        )
      )
    );

    const { result } = renderHook(() => useCreateComponent(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      type: 'skill',
      name: 'duplicate-skill',
      project_id: 'proj_abc123',
      content: 'content',
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
