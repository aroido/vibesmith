/**
 * ComponentCreateForm unit tests
 * Fields render, template load on type change, validation (spec Appendix B)
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { axe } from 'jest-axe';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import i18n from 'i18next';
import { ComponentCreateForm } from './ComponentCreateForm';

function labelRegex(label: string): RegExp {
  return new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

const mockProjects = [
  {
    id: 'proj_global',
    name: 'global',
    path: '/Users/user/.claude',
    is_global: true,
    component_count: 5,
    last_scanned_at: '2026-02-13T09:00:00Z',
    dir_exists: true,
    has_claude_dir: false,
  },
  {
    id: 'proj_abc123',
    name: 'vibesmith',
    path: '/Users/user/Projects/vibesmith',
    is_global: false,
    component_count: 12,
    last_scanned_at: '2026-02-13T09:00:00Z',
    dir_exists: true,
    has_claude_dir: true,
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
beforeEach(async () => {
  await i18n.changeLanguage('ko');
});
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/components/create']}>
        <ComponentCreateForm />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ComponentCreateForm', () => {
  it('should render all fields', async () => {
    renderWithProviders();
    const projectSelectLabel = i18n.t('components:create.projectSelectAria');
    const nameLabel = labelRegex(i18n.t('components:create.nameLabel'));
    const descriptionLabel = labelRegex(i18n.t('components:create.descriptionLabel'));
    const tagsLabel = labelRegex(i18n.t('components:create.tagsLabel'));
    const contentLabel = labelRegex(i18n.t('components:create.contentLabel'));

    await waitFor(() => {
      expect(screen.getByLabelText(projectSelectLabel)).not.toBeDisabled();
    });

    const radiogroupLabel = i18n.t('components:create.typeRadiogroupAria');
    expect(screen.getByRole('radiogroup', { name: radiogroupLabel })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Skill/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Agent/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Command/i })).toBeInTheDocument();
    expect(screen.getByLabelText(nameLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(descriptionLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(tagsLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(contentLabel)).toBeInTheDocument();
    const createLabel = i18n.t('common:createComponent');
    const cancelLabel = i18n.t('common:cancel');
    expect(screen.getByRole('button', { name: createLabel })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: cancelLabel })).toBeInTheDocument();
  });

  it('should load template when type changes', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText(i18n.t('components:create.projectSelectAria'))).not.toBeDisabled();
    });

    const contentArea = screen.getByLabelText(labelRegex(i18n.t('components:create.contentLabel')));
    const initialContent = (contentArea as HTMLTextAreaElement).value;

    await user.click(screen.getByRole('radio', { name: /Agent/i }));

    await waitFor(() => {
      const newContent = (screen.getByLabelText(labelRegex(i18n.t('components:create.contentLabel'))) as HTMLTextAreaElement).value;
      expect(newContent).not.toBe(initialContent);
      expect(newContent).toContain('You are a specialized agent');
    });
  });

  it('should show validation error when name is empty', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText(i18n.t('components:create.projectSelectAria'))).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: i18n.t('common:createComponent') }));

    await waitFor(() => {
      const nameRequiredKo = '이름을 입력해주세요';
      const nameRequiredEn = 'Please enter a name';
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toMatch(new RegExp(`${nameRequiredKo}|${nameRequiredEn}`));
    });
  });

  it('should disable Create button when submitting', async () => {
    const user = userEvent.setup();
    let resolveDeferred: () => void;
    const deferred = new Promise<void>((resolve) => {
      resolveDeferred = resolve;
    });

    server.use(
      http.post('*/api/components', async () => {
        await deferred;
        return HttpResponse.json(
          {
            id: 'comp_delayed',
            type: 'skill',
            name: 'my-new-skill',
            description: '',
            enabled: true,
            tags: [],
            project_id: 'proj_abc123',
            project_name: 'vibesmith',
            path: '/path',
            created_at: '',
            updated_at: '',
          },
          { status: 201 }
        );
      })
    );

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText(i18n.t('components:create.projectSelectAria'))).not.toBeDisabled();
    });

    await user.type(screen.getByLabelText(labelRegex(i18n.t('components:create.nameLabel'))), 'my-new-skill');
    await user.selectOptions(screen.getByLabelText(i18n.t('components:create.projectSelectAria')), 'proj_abc123');
    await user.click(screen.getByRole('button', { name: i18n.t('common:createComponent') }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: i18n.t('common:creating') })).toBeDisabled();
    });

    resolveDeferred!();
  });

  it('should show error when creation fails', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText(i18n.t('components:create.projectSelectAria'))).not.toBeDisabled();
    });

    await user.type(screen.getByLabelText(labelRegex(i18n.t('components:create.nameLabel'))), 'duplicate-skill');
    await user.selectOptions(screen.getByLabelText(i18n.t('components:create.projectSelectAria')), 'proj_abc123');
    await user.click(screen.getByRole('button', { name: i18n.t('common:createComponent') }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(
        screen.getByText(/already exists|이미 존재/i)
      ).toBeInTheDocument();
    });
  });

  it('should call window.confirm when Cancel with content', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText(i18n.t('components:create.projectSelectAria'))).not.toBeDisabled();
    });

    await user.type(screen.getByLabelText(labelRegex(i18n.t('components:create.nameLabel'))), 'some-name');
    await user.click(screen.getByRole('button', { name: i18n.t('common:cancel') }));

    expect(confirmSpy).toHaveBeenCalledWith(
      i18n.t('components:create.confirmCancel')
    );
  });

  it('should have no accessibility violations', async () => {
    const { container } = renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText(i18n.t('components:create.projectSelectAria'))).not.toBeDisabled();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
