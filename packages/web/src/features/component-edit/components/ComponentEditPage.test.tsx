/**
 * ComponentEditPage integration tests
 * Spec Appendix B - load data, populate form, save, error handling
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ComponentEditPage } from './ComponentEditPage';

const mockComponentDetail = {
  id: 'comp_001',
  type: 'skill',
  name: 'fastapi-route',
  description: 'FastAPI 라우트 스캐폴딩',
  enabled: true,
  tags: ['python', 'fastapi'],
  project_id: 'proj_abc123',
  project_name: 'vibesmith',
  path: '/path/to/skill.md',
  content: '---\nname: fastapi-route\ndescription: FastAPI 라우트 스캐폴딩\n---\n# FastAPI Route\n\n본문 내용',
  frontmatter: { name: 'fastapi-route', description: 'FastAPI 라우트 스캐폴딩' },
  dependencies: { depends_on: [], depended_by: [] },
  created_at: '2026-02-09T10:00:00Z',
  updated_at: '2026-02-09T15:00:00Z',
};

const mockUpdateResponse = {
  id: 'comp_001',
  type: 'skill',
  name: 'fastapi-route',
  description: '수정됨',
  enabled: true,
  tags: ['python', 'fastapi', 'crud'],
  project_id: 'proj_abc123',
  path: '/path/to/skill.md',
  created_at: '2026-02-09T10:00:00Z',
  updated_at: '2026-02-13T10:30:00Z',
};

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>();
  return { ...mod, useNavigate: () => mockNavigate };
});

const server = setupServer(
  http.get('*/api/components', () => HttpResponse.json([])),
  http.get('*/api/components/:id', ({ params }) => {
    const id = params.id as string;
    if (id === 'comp_001') return HttpResponse.json(mockComponentDetail);
    if (id === 'comp_404') return HttpResponse.json({ detail: 'Not found' }, { status: 404 });
    return HttpResponse.json({ detail: 'Server error' }, { status: 500 });
  }),
  http.put('*/api/components/:id', () =>
    HttpResponse.json(mockUpdateResponse)
  )
);

function renderWithProviders(initialPath = '/components/comp_001/edit') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/components/:id/edit" element={<ComponentEditPage />} />
          <Route path="/components/:id" element={<div>Detail</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  mockNavigate.mockClear();
});
afterAll(() => server.close());

describe('ComponentEditPage', () => {
  it('should show loading skeleton when loading', () => {
    renderWithProviders();
    expect(screen.getByRole('status', { name: '로딩 중' })).toBeInTheDocument();
  });

  it('should load component data and populate form', async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByDisplayValue('fastapi-route')).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('FastAPI 라우트 스캐폴딩')).toBeInTheDocument();
    expect(screen.getByText('python')).toBeInTheDocument();
    expect(screen.getByText('fastapi')).toBeInTheDocument();
    const contentArea = screen.getByLabelText(/Content/i);
    expect(contentArea).toHaveValue('# FastAPI Route\n\n본문 내용');
    expect(screen.getByText('Skill')).toBeInTheDocument();
    expect(screen.getByText('vibesmith')).toBeInTheDocument();
  });

  it('should show 404 and list link when not found', async () => {
    renderWithProviders('/components/comp_404/edit');

    await waitFor(() => {
      expect(screen.getByText('구성요소를 찾을 수 없습니다')).toBeInTheDocument();
    });

    const link = screen.getByRole('link', { name: /목록으로 돌아가기/i });
    expect(link).toHaveAttribute('href', '/components');
  });

  it('should show retry button on generic error', async () => {
    renderWithProviders('/components/comp_500/edit');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '재시도' })).toBeInTheDocument();
    });
  });

  it('should save changes and navigate to detail on success', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByDisplayValue('fastapi-route')).toBeInTheDocument();
    });

    await user.clear(screen.getByLabelText(/Description|설명/i));
    await user.type(screen.getByLabelText(/Description|설명/i), '수정된 설명');
    await user.click(screen.getByRole('button', { name: /Save Changes|변경 사항 저장/ }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/components/comp_001');
    });
  });

  it('should disable Save button when saving', async () => {
    let resolveDeferred: () => void;
    const deferred = new Promise<void>((r) => {
      resolveDeferred = r;
    });

    server.use(
      http.put('*/api/components/:id', async () => {
        await deferred;
        return HttpResponse.json(mockUpdateResponse);
      })
    );

    const user = userEvent.setup();
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByDisplayValue('fastapi-route')).toBeInTheDocument();
    });

    const saveBtn = screen.getByRole('button', {
      name: (content) => content === 'Save Changes' || content === '변경 사항 저장',
    });
    await user.click(saveBtn);

    await waitFor(() => {
      const savingBtn = screen.getByRole('button', {
        name: (content) => content === 'Saving...' || content === '저장 중...',
      });
      expect(savingBtn).toBeDisabled();
    });

    resolveDeferred!();
  });
});
