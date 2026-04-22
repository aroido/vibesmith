/**
 * Component List Integration Tests
 * API call and data display, type filter triggers API re-call
 * MSW-based mock API
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ComponentListPage } from '../components/ComponentListPage';

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

const mockComponentsAll = [
  {
    id: 'comp_001',
    type: 'skill',
    name: 'fastapi-route',
    description: 'FastAPI 라우트 스캐폴딩',
    enabled: true,
    tags: ['python', 'fastapi'],
    project_id: 'proj_001',
    project_name: 'vibesmith',
    path: '/path/to/skill',
    created_at: '2026-02-09T10:00:00Z',
    updated_at: '2026-02-09T15:00:00Z',
  },
  {
    id: 'comp_002',
    type: 'agent',
    name: 'planner',
    description: '구현 계획 수립',
    enabled: true,
    tags: ['planning'],
    project_id: 'proj_global',
    project_name: 'global',
    path: '/path/to/agent',
    created_at: '2026-02-09T10:00:00Z',
    updated_at: '2026-02-09T15:00:00Z',
  },
];

const mockComponentsDisabled = [
  ...mockComponentsAll,
  {
    id: 'comp_003',
    type: 'skill',
    name: 'disabled-skill',
    description: '비활성화된 스킬',
    enabled: false,
    tags: [],
    project_id: 'proj_001',
    project_name: 'vibesmith',
    path: '/path/to/disabled',
    created_at: '2026-02-09T10:00:00Z',
    updated_at: '2026-02-09T15:00:00Z',
  },
];

let componentsStore = [...mockComponentsDisabled];

const server = setupServer(
  http.get(/\/api\/components/, ({ request }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const enabledParam = url.searchParams.get('enabled');

    let filtered = type
      ? componentsStore.filter((c) => c.type === type)
      : componentsStore;

    if (enabledParam === 'true') {
      filtered = filtered.filter((c) => c.enabled);
    } else if (enabledParam === 'false') {
      filtered = filtered.filter((c) => !c.enabled);
    }

    return HttpResponse.json(filtered);
  }),
  http.patch('*/api/components/bulk-toggle', async ({ request }) => {
    const body = (await request.json()) as {
      component_ids?: string[];
      enabled?: boolean;
    };

    const ids = Array.isArray(body.component_ids) ? body.component_ids : [];
    if (ids.length === 0 || typeof body.enabled !== 'boolean') {
      return HttpResponse.json({ detail: 'invalid request' }, { status: 422 });
    }

    componentsStore = componentsStore.map((component) =>
      ids.includes(component.id)
        ? { ...component, enabled: body.enabled as boolean }
        : component
    );

    const updatedIds = componentsStore
      .filter((component) => ids.includes(component.id) && component.enabled === body.enabled)
      .map((component) => component.id);

    return HttpResponse.json({
      updated_count: updatedIds.length,
      updated_ids: updatedIds,
    });
  })
);

beforeAll(() => server.listen());
beforeEach(() => {
  componentsStore = [...mockComponentsDisabled];
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderWithProviders(initialEntries: string[] = ['/components']) {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/components" element={<ComponentListPage />} />
          <Route path="*" element={<ComponentListPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ComponentList Integration', () => {
  it('should fetch and display components from API', async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('fastapi-route')).toBeInTheDocument();
    });

    expect(screen.getByText('FastAPI 라우트 스캐폴딩')).toBeInTheDocument();
    expect(screen.getByText('planner')).toBeInTheDocument();
    expect(screen.getByText('구현 계획 수립')).toBeInTheDocument();
  });

  it('should refetch with type filter when Skills tab clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('fastapi-route')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Skills 필터/i }));

    await waitFor(() => {
      expect(screen.getByText('fastapi-route')).toBeInTheDocument();
      expect(screen.queryByText('planner')).not.toBeInTheDocument();
    });
  });

  it('should refetch with type filter when Agents tab clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('planner')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Agents 필터/i }));

    await waitFor(() => {
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.queryByText('fastapi-route')).not.toBeInTheDocument();
    });
  });

  it('should filter by status when Status filter changed', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('fastapi-route')).toBeInTheDocument();
    });

    const statusFilter = screen.getByLabelText('활성화 상태 필터');
    await user.selectOptions(statusFilter, 'disabled');

    await waitFor(() => {
      expect(screen.getByText('disabled-skill')).toBeInTheDocument();
      expect(screen.queryByText('fastapi-route')).not.toBeInTheDocument();
    });
  });

  it('should display error and retry when API fails', async () => {
    server.use(
      http.get(/\/api\/components/, () =>
        HttpResponse.json({ detail: '서버 오류' }, { status: 500 })
      )
    );

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    // Reset to success and retry
    server.resetHandlers();
    const retryButton = screen.getByRole('button', { name: '재시도' });
    await userEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('fastapi-route')).toBeInTheDocument();
    });
  });

  it('should bulk disable selected components in selection mode', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('fastapi-route')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('component-list-selection-mode-toggle'));
    await user.click(screen.getByTestId('component-list-select-comp_001'));
    await user.click(screen.getByTestId('component-list-select-comp_002'));
    await user.click(screen.getByTestId('component-list-bulk-disable-button'));

    await waitFor(() => {
      expect(screen.getAllByText(/sleep|비활성/i).length).toBeGreaterThanOrEqual(2);
    });
  });
});
