// @vitest-environment happy-dom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectDetailPage } from './ProjectDetailPage';
import { useProjectDetail } from './hooks/useProjectDetail';
import { useProjectComponents } from './hooks/useProjectComponents';
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>();
  return { ...mod, useNavigate: () => mockNavigate };
});

vi.mock('./hooks/useProjectDetail', () => ({
  useProjectDetail: vi.fn(),
}));

vi.mock('./hooks/useProjectComponents', () => ({
  useProjectComponents: vi.fn(),
}));

vi.mock('./components/CollectionApplyModal', () => ({
  CollectionApplyModal: () => <div data-testid="collection-apply-modal" />,
}));

vi.mock('./components/ProjectStatsSection', () => ({
  ProjectStatsSection: () => <div data-testid="project-stats-section" />,
}));

vi.mock('./components/ProjectTabNavigation', () => ({
  ProjectTabNavigation: () => <div data-testid="project-tab-navigation" />,
}));

vi.mock('./components/ProjectComponentList', () => ({
  ProjectComponentList: () => <div data-testid="project-component-list" />,
}));

const mockProject = {
  id: 'proj_001',
  name: 'VibeSmith',
  path: '/Users/user/vibesmith',
  is_global: false,
  component_count: 12,
  last_scanned_at: '2026-02-25T10:00:00Z',
  dir_exists: true,
  platforms: ['mac'],
  breakdown: {
    skill: 5,
    agent: 3,
    command: 2,
    hook: 1,
    rule: 1,
  },
};

function renderPage(initialPath = '/projects/proj_001') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ProjectDetailPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();

    vi.mocked(useProjectDetail).mockReturnValue({
      data: mockProject,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useProjectDetail>);

    vi.mocked(useProjectComponents).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useProjectComponents>);

  });

  it('renders project header with path and back button', () => {
    renderPage();

    const main = screen.getByRole('main');
    expect(within(main).getByRole('heading', { name: /VibeSmith/ })).toBeInTheDocument();
    expect(screen.getByText('/Users/user/vibesmith')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /프로젝트 목록으로 돌아가기|Back to Projects/i })
    ).toBeInTheDocument();
  });

  it('navigates to project list from back button', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /프로젝트 목록으로 돌아가기|Back to Projects/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/projects');
  });
});
