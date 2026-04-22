/**
 * ComponentListPage Accessibility Tests
 * jest-axe, keyboard navigation, screen reader support
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeAll, afterEach, afterAll, beforeEach } from 'vitest';
import { axe } from 'jest-axe';
import i18n from 'i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ComponentListPage } from './ComponentListPage';

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
  http.get(/\/api\/components/, () => HttpResponse.json(mockComponents))
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(async () => {
  await i18n.changeLanguage('ko');
});

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/components']}>
        <Routes>
          <Route path="/components" element={<ComponentListPage />} />
          <Route path="*" element={<ComponentListPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ComponentListPage Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = renderWithProviders();
    await screen.findByText('fastapi-route');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should allow keyboard navigation to type filter buttons', async () => {
    const user = userEvent.setup();
    renderWithProviders();
    await screen.findByText('fastapi-route');

    const allLabel = i18n.t('components:list.typeTabAria', {
      label: i18n.t('components:list.typeTabAll'),
    });
    const skillsLabel = i18n.t('components:list.typeTabAria', {
      label: i18n.t('components:list.typeTabSkill'),
    });
    const allButton = screen.getByRole('button', { name: allLabel });
    allButton.focus();
    expect(document.activeElement).toBe(allButton);

    await user.tab();
    const skillsButton = screen.getByRole('button', { name: skillsLabel });
    expect(document.activeElement).toBe(skillsButton);
  });

  it('should toggle type button with Enter key', async () => {
    const user = userEvent.setup();
    renderWithProviders();
    await screen.findByText('fastapi-route');

    const skillsLabel = i18n.t('components:list.typeTabAria', {
      label: i18n.t('components:list.typeTabSkill'),
    });
    const skillsButton = screen.getByRole('button', { name: skillsLabel });
    skillsButton.focus();
    await user.keyboard('{Enter}');

    expect(skillsButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('should have proper landmark structure', async () => {
    renderWithProviders();
    await screen.findByText('fastapi-route');

    const mainMenuLabel = i18n.t('navigation:mainMenu');
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: mainMenuLabel })).toBeInTheDocument();
  });

  it('should have descriptive aria-labels on type filter buttons', async () => {
    renderWithProviders();
    await screen.findByText('fastapi-route');

    const tablistAria = i18n.t('components:list.typeTablistAria');
    const allLabel = i18n.t('components:list.typeTabAria', {
      label: i18n.t('components:list.typeTabAll'),
    });
    const skillsLabel = i18n.t('components:list.typeTabAria', {
      label: i18n.t('components:list.typeTabSkill'),
    });
    expect(screen.getByRole('group', { name: tablistAria })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: allLabel })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: skillsLabel })).toBeInTheDocument();
  });
});
