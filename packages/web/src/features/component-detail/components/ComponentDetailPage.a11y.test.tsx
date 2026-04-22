/**
 * ComponentDetailPage Accessibility Tests (axe-core)
 * WCAG 2.1 AA 준수 검증
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { axe } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ComponentDetailPage } from './ComponentDetailPage';

const mockComponent = {
  id: 'comp_001',
  type: 'skill',
  name: 'test-skill',
  description: 'Test skill description',
  enabled: true,
  tags: ['python'],
  project_id: 'proj_001',
  project_name: 'vibesmith',
  path: '/path/to/skill',
  content: '# Test',
  frontmatter: {},
  dependencies: { depends_on: [], depended_by: [] },
  created_at: '2026-02-09T10:00:00Z',
  updated_at: '2026-02-09T15:00:00Z',
};

const server = setupServer(
  http.get('*/api/components/comp_001', () => HttpResponse.json(mockComponent)),
  http.get('*/api/usage/component', () =>
    HttpResponse.json({
      component_id: 'comp_001',
      component_name: 'test-skill',
      timeline: [],
    })
  )
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderDetail() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/components/comp_001']}>
        <Routes>
          <Route path="/components/:id" element={<ComponentDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ComponentDetailPage Accessibility', () => {
  it('should have no axe accessibility violations', async () => {
    const { container } = renderDetail();
    await screen.findByRole('heading', { name: 'test-skill' });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have main landmark with id for skip link', async () => {
    renderDetail();
    await screen.findByRole('heading', { name: 'test-skill' });
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main-content');
  });
});
