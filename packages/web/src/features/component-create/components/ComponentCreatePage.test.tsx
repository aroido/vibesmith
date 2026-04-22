/**
 * ComponentCreatePage integration tests
 * Page layout, form integration, success toast (spec Appendix B)
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import i18n from 'i18next';
import { ComponentCreatePage } from './ComponentCreatePage';
import * as notifyModule from '@/common/utils/notify';

const mockProjects = [
  {
    id: 'proj_global',
    name: 'global',
    path: '/Users/user/.claude',
    is_global: true,
  },
  {
    id: 'proj_abc123',
    name: 'vibesmith',
    path: '/Users/user/Projects/vibesmith',
    is_global: false,
  },
];

const mockCreateResponse = {
  id: 'comp_new',
  type: 'skill',
  name: 'my-new-skill',
  description: 'A skill',
  enabled: true,
  tags: ['python'],
  project_id: 'proj_abc123',
  project_name: 'vibesmith',
  path: '/path/to/skill.md',
  created_at: '2026-02-13T10:00:00Z',
  updated_at: '2026-02-13T10:00:00Z',
};

const server = setupServer(
  http.get('*/api/projects', () => HttpResponse.json(mockProjects)),
  http.post('*/api/components', () =>
    HttpResponse.json(mockCreateResponse, { status: 201 })
  )
);

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...mod,
    useNavigate: () => mockNavigate,
  };
});

function renderWithProviders(initialPath = '/components/create') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/components/create" element={<ComponentCreatePage />} />
          <Route path="/components/:id" element={<div>Component Detail</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeAll(() => server.listen());
beforeEach(async () => {
  await i18n.changeLanguage('ko');
});
afterEach(() => {
  server.resetHandlers();
  mockNavigate.mockClear();
});
afterAll(() => server.close());

describe('ComponentCreatePage', () => {
  function getNameField() {
    return screen.getByLabelText(
      new RegExp(i18n.t('components:create.nameLabel'), 'i')
    );
  }

  it('should render page with heading and form', async () => {
    renderWithProviders();

    const title = i18n.t('components:create.title');
    const backLink = i18n.t('components:create.backToComponents');
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByText(i18n.t('components:create.subtitle'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: backLink })).toBeInTheDocument();

    await waitFor(() => {
      const radiogroupLabel = i18n.t('components:create.typeRadiogroupAria');
      expect(screen.getByRole('radiogroup', { name: radiogroupLabel })).toBeInTheDocument();
    });
  });

  it('should create component and navigate to detail on success', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText(i18n.t('components:create.projectSelectAria'))).not.toBeDisabled();
    });

    await user.type(getNameField(), 'my-new-skill');
    await user.selectOptions(screen.getByLabelText(i18n.t('components:create.projectSelectAria')), 'proj_abc123');
    await user.click(screen.getByRole('button', { name: i18n.t('common:createComponent') }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/components/comp_new');
    });
  });

  it('should show toast on success', async () => {
    const notifySuccessSpy = vi.spyOn(notifyModule.notify, 'success');
    const user = userEvent.setup();
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText(i18n.t('components:create.projectSelectAria'))).not.toBeDisabled();
    });

    await user.type(getNameField(), 'my-new-skill');
    await user.selectOptions(screen.getByLabelText(i18n.t('components:create.projectSelectAria')), 'proj_abc123');
    await user.click(screen.getByRole('button', { name: i18n.t('common:createComponent') }));

    await waitFor(() => {
      expect(notifySuccessSpy).toHaveBeenCalledWith(i18n.t('components:create.successToast'));
    });

    notifySuccessSpy.mockRestore();
  });

  it('should show error when creation fails', async () => {
    server.use(
      http.post('*/api/components', () =>
        HttpResponse.json({ detail: '이미 존재하는 이름입니다' }, { status: 400 })
      )
    );

    const user = userEvent.setup();
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText(i18n.t('components:create.projectSelectAria'))).not.toBeDisabled();
    });

    await user.type(getNameField(), 'duplicate');
    await user.selectOptions(screen.getByLabelText(i18n.t('components:create.projectSelectAria')), 'proj_abc123');
    await user.click(screen.getByRole('button', { name: i18n.t('common:createComponent') }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/이미 존재|already exists/i)).toBeInTheDocument();
    });
  });
});
