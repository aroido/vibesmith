/**
 * View Toggle Tests - Card/Table view switch + localStorage persistence
 * Issue #496
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ComponentListPage } from '../components/ComponentListPage';

const VIEW_STORAGE_KEY = 'vibesmith_components_view';

const mockComponents = [
  {
    id: 'comp_001',
    type: 'skill',
    name: 'fastapi-route',
    description: 'FastAPI 스캐폴딩',
    enabled: true,
    tags: ['python'],
    project_id: 'proj_001',
    project_name: 'vibesmith',
    path: '/path/to/skill',
    created_at: '2026-02-09T10:00:00Z',
    updated_at: '2026-02-09T15:00:00Z',
  },
];

const server = setupServer(
  http.get(/\/api\/components/, () => HttpResponse.json(mockComponents)),
  http.get(/\/api\/tags/, () => HttpResponse.json([])),
  http.get(/\/api\/projects/, () => HttpResponse.json([]))
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  localStorage.removeItem(VIEW_STORAGE_KEY);
});
afterAll(() => server.close());

beforeEach(async () => {
  await i18n.changeLanguage('ko');
});

function renderWithProviders(initialEntries = ['/components']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/components" element={<ComponentListPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('View Toggle', () => {
  it('should show card view by default when no localStorage/URL', async () => {
    renderWithProviders();
    await screen.findByText('fastapi-route');

    const cardsButton = screen.getByTestId('view-toggle-cards');
    const tableButton = screen.getByTestId('view-toggle-table');

    expect(cardsButton).toHaveAttribute('aria-pressed', 'true');
    expect(tableButton).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('list', { name: '구성요소 목록' })).toBeInTheDocument();
  });

  it('should switch to table view when table button clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders();
    await screen.findByText('fastapi-route');

    await user.click(screen.getByTestId('view-toggle-table'));

    expect(screen.getByTestId('view-toggle-table')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('fastapi-route')).toBeInTheDocument();
  });

  it('should switch back to card view when cards button clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(['/components?view=table']);
    await screen.findByText('fastapi-route');

    expect(screen.getByRole('table')).toBeInTheDocument();

    await user.click(screen.getByTestId('view-toggle-cards'));

    expect(screen.getByTestId('view-toggle-cards')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('list', { name: '구성요소 목록' })).toBeInTheDocument();
  });

  it('should persist view mode to localStorage', async () => {
    const user = userEvent.setup();
    renderWithProviders();
    await screen.findByText('fastapi-route');

    expect(localStorage.getItem(VIEW_STORAGE_KEY)).toBeNull();

    await user.click(screen.getByTestId('view-toggle-table'));
    expect(localStorage.getItem(VIEW_STORAGE_KEY)).toBe('table');

    await user.click(screen.getByTestId('view-toggle-cards'));
    expect(localStorage.getItem(VIEW_STORAGE_KEY)).toBe('cards');
  });

  it('should restore view from localStorage on mount', async () => {
    localStorage.setItem(VIEW_STORAGE_KEY, 'table');
    renderWithProviders(['/components']);
    await screen.findByText('fastapi-route');

    expect(screen.getByTestId('view-toggle-table')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('should prefer URL param over localStorage', async () => {
    localStorage.setItem(VIEW_STORAGE_KEY, 'cards');
    renderWithProviders(['/components?view=table']);
    await screen.findByText('fastapi-route');

    expect(screen.getByTestId('view-toggle-table')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});
