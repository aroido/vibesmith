import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n';
import { CreateProjectPresetForm } from './CreateProjectPresetForm';

const COLLECTIONS_RESPONSE = {
  items: [
    {
      id: 'collection-react-fastapi',
      name: 'React + FastAPI Starter',
      description: 'Frontend + backend starter preset',
      scope: 'system',
      latest_revision: 1,
      revisions_count: 1,
      items_count: 2,
      tags: ['starter'],
      created_at: '2026-02-23T00:00:00Z',
      updated_at: '2026-02-23T00:00:00Z',
    },
  ],
  total: 1,
};

let lastCreatePayload: Record<string, unknown> | null = null;

const server = setupServer(
  http.get('*/api/collections', () => HttpResponse.json(COLLECTIONS_RESPONSE)),
  http.post('*/api/projects', async ({ request }) => {
    lastCreatePayload = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        project: {
          id: 'proj_new_1',
          name: 'new-app',
          path: '/Users/user/Projects/new-app',
          is_global: false,
          platforms: ['claude_code'],
          component_count: 2,
          last_scanned_at: '2026-02-24T00:00:00Z',
          dir_exists: true,
          created_at: '2026-02-24T00:00:00Z',
          updated_at: '2026-02-24T00:00:00Z',
        },
        applied_preset: {
          id: 'collection-react-fastapi',
          name: 'React + FastAPI Starter',
          revision: 1,
        },
        created_components: 2,
        scanned_components: 2,
      },
      { status: 201 }
    );
  })
);

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>
  );
}

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  lastCreatePayload = null;
});
afterAll(() => server.close());

describe('CreateProjectPresetForm', () => {
  it('shows validation error when path is empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateProjectPresetForm />);

    await screen.findByTestId('project-preset-select');

    await user.click(
      screen.getByRole('button', {
        name: new RegExp(i18n.t('scan:createProjectWithPreset'), 'i'),
      })
    );

    expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('scan:pathRequired'));
  });

  it('creates project with selected preset and resets path on success', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateProjectPresetForm />);

    const pathInput = await screen.findByLabelText(
      new RegExp(i18n.t('scan:projectCreatePathLabel'), 'i')
    );

    await user.type(pathInput, '/Users/user/Projects/new-app');
    await user.click(
      screen.getByRole('button', {
        name: new RegExp(i18n.t('scan:createProjectWithPreset'), 'i'),
      })
    );

    await waitFor(() => {
      expect(lastCreatePayload).toMatchObject({
        path: '/Users/user/Projects/new-app',
        preset_id: 'collection-react-fastapi',
        conflict_policy: 'fail',
        scan_after_create: true,
      });
    });

    await waitFor(() => {
      expect(pathInput).toHaveValue('');
    });
  });

  it('shows retry UI when preset list fails to load', async () => {
    server.use(
      http.get('*/api/collections', () =>
        HttpResponse.json({ detail: 'preset list unavailable' }, { status: 500 })
      )
    );

    renderWithProviders(<CreateProjectPresetForm />);

    expect(await screen.findByTestId('project-preset-retry-button')).toBeInTheDocument();
  });

  it('keeps input value when create request fails', async () => {
    server.use(
      http.post('*/api/projects', () =>
        HttpResponse.json(
          {
            detail: 'Project path is not empty',
            message_key: 'errors.project_path_not_empty',
            message: 'Project path is not empty',
          },
          { status: 409 }
        )
      )
    );

    const user = userEvent.setup();
    renderWithProviders(<CreateProjectPresetForm />);

    const pathInput = await screen.findByLabelText(
      new RegExp(i18n.t('scan:projectCreatePathLabel'), 'i')
    );

    await user.type(pathInput, '/Users/user/Projects/existing-path');
    await user.click(
      screen.getByRole('button', {
        name: new RegExp(i18n.t('scan:createProjectWithPreset'), 'i'),
      })
    );

    await waitFor(() => {
      expect(pathInput).toHaveValue('/Users/user/Projects/existing-path');
    });
  });
});
