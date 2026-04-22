/**
 * useUpdateComponent hook unit tests
 * Spec Appendix B - mutation, success navigation, error handling
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterEach,
  afterAll,
} from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useUpdateComponent } from './useUpdateComponent';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...mod,
    useNavigate: () => mockNavigate,
  };
});

const server = setupServer(
  http.put('*/api/components/:id', async ({ request }) => {
    const body = (await request.json()) as { content?: string; tags?: string[] };
    if (body?.content?.includes('error-trigger')) {
      return HttpResponse.json({ detail: 'Bad request' }, { status: 400 });
    }
    return HttpResponse.json({
      id: 'comp_001',
      type: 'skill',
      name: 'fastapi-route',
      description: 'Updated',
      enabled: true,
      tags: body?.tags ?? ['python'],
      project_id: 'proj_abc123',
      path: '/path',
      created_at: '',
      updated_at: '',
    });
  })
);

function createWrapper() {
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
}

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  mockNavigate.mockClear();
});
afterAll(() => server.close());

describe('useUpdateComponent', () => {
  it('should mutate and navigate on success', async () => {
    const { result } = renderHook(
      () => useUpdateComponent({ id: 'comp_001' }),
      { wrapper: createWrapper() }
    );

    result.current.mutate({
      content: '---\n"name": "fastapi-route"\n"description": "Updated"\n---\nUpdated body',
      tags: ['python', 'crud'],
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockNavigate).toHaveBeenCalledWith('/components/comp_001');
  });

  it('should set error when mutation fails', async () => {
    server.use(
      http.put('*/api/components/:id', () =>
        HttpResponse.json({ detail: 'Server error' }, { status: 500 })
      )
    );

    const { result } = renderHook(
      () => useUpdateComponent({ id: 'comp_001' }),
      { wrapper: createWrapper() }
    );

    result.current.mutate({
      content: 'error-trigger body',
      tags: ['python'],
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
