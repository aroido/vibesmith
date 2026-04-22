import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import i18n from '@/i18n';
import { DependencyGraphPage } from '../index';
import { api } from '../services/api';
import { getProjects } from '@/common/api';

vi.mock('../services/api');
vi.mock('@/common/api', () => ({
  getProjects: vi.fn(),
}));
vi.mock('@/components/common', () => ({
  AppTopNav: () => <nav data-testid="app-top-nav">Nav</nav>,
  PageFrame: ({ children, title }: { children: any; title?: any }) => (
    <main>
      {title && <h1>{title}</h1>}
      {children}
    </main>
  ),
  ComponentWorkspaceTabs: () => <nav data-testid="components-workspace-tabs" />,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
};

const mockGraphData = {
  nodes: [
    { id: 'c1', name: 'fastapi-route', type: 'skill' as const, project_id: 'proj_a', enabled: true, platform: 'claude_code' },
    { id: 'c2', name: 'pydantic-model', type: 'skill' as const, project_id: 'proj_a', enabled: true, platform: 'claude_code' },
    { id: 'c3', name: 'global-util', type: 'skill' as const, project_id: 'proj_global', enabled: true, platform: 'claude_code' },
  ],
  edges: [
    { source: 'c1', target: 'c2', type: 'context' as const },
    { source: 'c1', target: 'c3', type: 'body_reference' as const },
  ],
  cycles: [] as string[][],
};

describe('DependencyTreePage (integration)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.mocked(api).getDependencies.mockResolvedValue(mockGraphData);
    vi.mocked(api).getDependencyDetail.mockResolvedValue({
      component_id: 'c1',
      depends_on: [
        { id: 'c2', name: 'pydantic-model', type: 'skill', dependency_type: 'context', is_broken: false },
      ],
      depended_by: [],
    });
    vi.mocked(getProjects).mockResolvedValue([
      { id: 'proj_a', name: 'Project A', path: '/tmp/a', is_global: false, component_count: 2, created_at: '', updated_at: '' },
      { id: 'proj_global', name: 'Global', path: '/tmp/g', is_global: true, component_count: 1, created_at: '', updated_at: '' },
    ]);
  });

  it('should render loading then tree', async () => {
    render(<DependencyGraphPage />, { wrapper: createWrapper() });
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('project-toggle-proj_a')).toBeInTheDocument();
    });
  });

  it('should render page heading', async () => {
    render(<DependencyGraphPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /dependency/i, level: 1 })).toBeInTheDocument();
    });
  });

  it('should show global section first', async () => {
    render(<DependencyGraphPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('project-toggle-proj_global')).toBeInTheDocument();
    });
    const projectToggles = screen.getAllByTestId(/project-toggle-/);
    expect(projectToggles[0]).toHaveAttribute('data-testid', 'project-toggle-proj_global');
    expect(screen.getAllByText('global-util').length).toBeGreaterThan(0);
  });

  it('should show empty state when no nodes', async () => {
    vi.mocked(api).getDependencies.mockResolvedValue({ nodes: [], edges: [], cycles: [] });
    render(<DependencyGraphPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText(/no components found/i)).toBeInTheDocument();
    });
  });

  it('should show error state', async () => {
    vi.mocked(api).getDependencies.mockRejectedValue(new Error('Network error'));
    render(<DependencyGraphPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText(/failed to load dependency graph/i)).toBeInTheDocument();
    });
  });

  it('should have search input', async () => {
    render(<DependencyGraphPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/name or id/i)).toBeInTheDocument();
    });
  });
});
