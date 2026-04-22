/**
 * ComponentDetailPage unit tests
 * Loading, error, 404, success rendering, Copy to Project flow
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import i18n from 'i18next';
import * as sonner from 'sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ComponentDetailPage } from './ComponentDetailPage';

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
  content: '본문 내용입니다',
  frontmatter: {},
  dependencies: {
    depends_on: [{ id: 'comp_010', name: 'pydantic-model', type: 'skill' }],
    depended_by: [],
  },
  created_at: '2026-02-09T10:00:00Z',
  updated_at: '2026-02-09T15:00:00Z',
};

const mockProjects = [
  { id: 'proj_abc123', name: 'vibesmith', path: '/path', is_global: false },
  { id: 'proj_target', name: 'other-project', path: '/other', is_global: false },
];

const mockCopyResponse = {
  copied: [
    {
      original_id: 'comp_001',
      new_id: 'comp_copy_001',
      name: 'fastapi-route',
      type: 'skill',
    },
  ],
};

const mockUsageTimeline = {
  component_id: 'comp_001',
  component_name: 'fastapi-route',
  timeline: [
    { date: '2026-02-19', count: 5, intensity: 1.0 },
    { date: '2026-02-18', count: 3, intensity: 0.6 },
    { date: '2026-02-17', count: 0, intensity: 0.0 },
  ],
};

const server = setupServer(
  http.get('*/api/components/:id', ({ params }) => {
    const id = params.id as string;
    if (id === 'comp_001') {
      return HttpResponse.json(mockComponentDetail);
    }
    if (id === 'comp_404') {
      return HttpResponse.json({ detail: 'Not found' }, { status: 404 });
    }
    return HttpResponse.json({ detail: 'Server error' }, { status: 500 });
  }),
  http.get('*/api/usage/component', ({ request }) => {
    const url = new URL(request.url);
    const componentId = url.searchParams.get('component_id');

    if (componentId === 'comp_001') {
      return HttpResponse.json(mockUsageTimeline);
    }

    return HttpResponse.json({ detail: 'Not found' }, { status: 404 });
  }),
  http.get('*/api/projects', () => HttpResponse.json(mockProjects)),
  http.post('*/api/components/:id/copy', async ({ params, request }) => {
    const body = (await request.json()) as {
      target_project_id: string;
      include_dependencies?: boolean;
    };
    if (params.id === 'comp_001' && body.target_project_id) {
      return HttpResponse.json(mockCopyResponse, { status: 201 });
    }
    return HttpResponse.json({ detail: 'Bad request' }, { status: 400 });
  })
);

beforeAll(async () => {
  await i18n.changeLanguage('ko');
  server.listen();
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderWithProviders(initialPath = '/components/comp_001') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/components/:id" element={<ComponentDetailPage />} />
          <Route path="/components" element={<div>Component List</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ComponentDetailPage', () => {
  it('should show loading skeleton when loading', () => {
    renderWithProviders();

    expect(screen.getByRole('status', { name: /로딩 중|Loading/ })).toBeInTheDocument();
  });

  it('should show error message and retry button on error', async () => {
    renderWithProviders('/components/comp_500');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Server error|일시적인 오류|요청을 처리할 수 없습니다/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /재시도|Retry/ })).toBeInTheDocument();
  });

  it('should show 404 message and list link when not found', async () => {
    renderWithProviders('/components/comp_404');

    await waitFor(() => {
      expect(screen.getByText(/구성요소를 찾을 수 없습니다|Component not found/)).toBeInTheDocument();
    });

    const listLink = screen.getByRole('link', { name: /목록으로 돌아가기|Back to list/i });
    expect(listLink).toBeInTheDocument();
    expect(listLink).toHaveAttribute('href', '/components');
  });

  it('should render name, type, metadata, content, dependencies on success', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'fastapi-route' })).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { level: 1, name: 'fastapi-route' })).toBeInTheDocument();
    expect(screen.getAllByText(/FastAPI 라우트 스캐폴딩/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/vibesmith/)).toBeInTheDocument();
    expect(screen.queryByText(/본문 내용입니다/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /pydantic-model/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /분석|Analysis/ }));
    expect(screen.getByText(/Usage Trend|사용 추이/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /콘텐츠|Content/ }));
    expect(screen.getByText(/본문 내용입니다/)).toBeInTheDocument();
  });

  describe('Copy to Project', () => {
    it('should render Copy button and open modal on click', async () => {
      const user = userEvent.setup();
      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'fastapi-route' })).toBeInTheDocument();
      });

      const copyBtn = screen.getByRole('button', { name: /다른 프로젝트로 복사|Copy to Project/ });
      expect(copyBtn).toBeInTheDocument();
      await user.click(copyBtn);

      expect(
        screen.getByRole('dialog', { name: /다른 프로젝트로 복사|Copy to Project/ })
      ).toBeInTheDocument();
    });

    it('should copy component and close modal on success', async () => {
      const user = userEvent.setup();
      const toastSuccessSpy = vi.spyOn(sonner.toast, 'success').mockImplementation(() => 'id');

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'fastapi-route' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: '다른 프로젝트로 복사' }));

      await waitFor(() => {
        expect(
          screen.getByRole('dialog', { name: /다른 프로젝트로 복사|Copy to Project/ })
        ).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByLabelText(/대상 프로젝트 선택|Select target project/)).not.toBeDisabled();
      });

      const dialog = screen.getByRole('dialog', { name: /다른 프로젝트로 복사|Copy to Project/ });
      await user.selectOptions(
        within(dialog).getByLabelText(/대상 프로젝트 선택|Select target project/),
        'proj_target'
      );
      await user.click(within(dialog).getByRole('button', { name: /복사|Copy/ }));

      await waitFor(() => {
        expect(
          screen.queryByRole('dialog', { name: /다른 프로젝트로 복사|Copy to Project/ })
        ).not.toBeInTheDocument();
      });

      expect(toastSuccessSpy).toHaveBeenCalledWith(
        expect.stringMatching(/구성요소가 복사되었습니다|Component copied successfully/),
        expect.objectContaining({
          duration: 3000,
          action: undefined,
        })
      );

      toastSuccessSpy.mockRestore();
    });
  });
});
