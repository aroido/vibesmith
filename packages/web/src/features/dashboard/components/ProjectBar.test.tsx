/**
 * ProjectBar unit tests
 * Rendering, breakdown display, expand/collapse, hide action (#28)
 */

import type { ReactElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { axe } from 'jest-axe';
import * as sonner from 'sonner';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { projectComponentsHandlers } from '@/mocks/handlers';
import { ProjectBar } from './ProjectBar';
import type { Project } from '../types';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...mod,
    useNavigate: () => mockNavigate,
  };
});

const server = setupServer(
  ...projectComponentsHandlers,
  http.delete('http://localhost:8000/api/projects/:id', () =>
    HttpResponse.json({ message: '삭제되었습니다' })
  )
);

function renderWithQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

beforeAll(() => server.listen());
beforeEach(() => mockNavigate.mockClear());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function createProject(overrides: Partial<Project> = {}): Project {
  const { platforms, ...rest } = overrides;
  const baseProject: Project = {
    id: 'proj_vibesmith',
    name: 'vibesmith',
    path: '/Users/user/vibesmith',
    isGlobal: false,
    componentCount: 42,
    breakdown: {
      skills: 18,
      agents: 8,
      commands: 12,
      hooks: 2,
      rules: 2,
    },
    percentage: 78,
    trend: { value: 0, percentage: 0, direction: 'neutral' },
    platforms: ['claude_code'],
  };

  return {
    ...baseProject,
    ...rest,
    platforms: platforms ?? baseProject.platforms,
  };
}

describe('ProjectBar', () => {
  it('should render project name', () => {
    const project = createProject({ name: 'vibesmith' });
    renderWithQueryClient(<ProjectBar project={project} />);
    expect(screen.getByTestId('project-bar-card-proj_vibesmith')).toHaveTextContent('vibesmith');
  });

  it('should display global icon for global project', () => {
    const project = createProject({ name: 'global', isGlobal: true });
    renderWithQueryClient(<ProjectBar project={project} />);
    expect(screen.getByText(/global/)).toBeInTheDocument();
  });

  it('should display percentage and component count', () => {
    const project = createProject({ percentage: 78, componentCount: 42 });
    renderWithQueryClient(<ProjectBar project={project} />);
    expect(screen.getByText('78%')).toBeInTheDocument();
    expect(screen.getByText('[42]')).toBeInTheDocument();
  });

  it('should display component breakdown', () => {
    const project = createProject({
      breakdown: {
        skills: 18,
        agents: 8,
        commands: 12,
        hooks: 2,
        rules: 2,
      },
    });
    renderWithQueryClient(<ProjectBar project={project} />);
    expect(screen.getByText('Skills 18')).toBeInTheDocument();
    expect(screen.getByText('Agents 8')).toBeInTheDocument();
    expect(screen.getByText('Cmds 12')).toBeInTheDocument();
  });

  it('should display project path in summary row', () => {
    const project = createProject({ path: '/Users/user/vibesmith' });
    renderWithQueryClient(<ProjectBar project={project} />);
    expect(screen.getByText(/\/Users\/user\/vibesmith/)).toBeInTheDocument();
  });

  it('should fallback to trend when project path is empty', () => {
    const project = createProject({
      path: '',
      trend: { value: 0, percentage: 0, direction: 'neutral' },
    });
    renderWithQueryClient(<ProjectBar project={project} />);
    expect(screen.getByText(/0\s*→/)).toBeInTheDocument();
  });

  it('should expand and show details on expand button click', async () => {
    const user = userEvent.setup();
    const project = createProject({ path: '/Users/user/vibesmith' });
    renderWithQueryClient(<ProjectBar project={project} />);

    const expandBtn = screen.getByRole('button', { name: '펼치기' });
    await user.click(expandBtn);

    await waitFor(() => {
      expect(screen.getAllByText(/\/Users\/user\/vibesmith/)).toHaveLength(2);
    });
  });

  it('should navigate to project detail when card background is clicked', async () => {
    const user = userEvent.setup();
    const project = createProject({ id: 'proj_clickable' });
    renderWithQueryClient(<ProjectBar project={project} compact />);

    await user.click(screen.getByTestId('project-bar-card-proj_clickable'));

    expect(mockNavigate).toHaveBeenCalledWith('/projects/proj_clickable');
  });

  it('should navigate to project detail with keyboard on focused card', async () => {
    const user = userEvent.setup();
    const project = createProject({ id: 'proj_keyboard' });
    renderWithQueryClient(<ProjectBar project={project} compact />);

    const card = screen.getByTestId('project-bar-card-proj_keyboard');
    card.focus();

    await user.keyboard('{Enter}');
    expect(mockNavigate).toHaveBeenCalledWith('/projects/proj_keyboard');

    mockNavigate.mockClear();
    await user.keyboard('{Space}');
    expect(mockNavigate).toHaveBeenCalledWith('/projects/proj_keyboard');
  });

  it('should not navigate to project detail when expand button is clicked', async () => {
    const user = userEvent.setup();
    const project = createProject({ id: 'proj_no_nav_on_expand' });
    renderWithQueryClient(<ProjectBar project={project} />);

    await user.click(screen.getByRole('button', { name: '펼치기' }));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should show component list when expanded', async () => {
    const user = userEvent.setup();
    const project = createProject();
    renderWithQueryClient(<ProjectBar project={project} />);

    await user.click(screen.getByRole('button', { name: '펼치기' }));

    await waitFor(() => {
      expect(screen.getByText('git-commit')).toBeInTheDocument();
      expect(screen.getByText('api-integration')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('code-review')).toBeInTheDocument();
    });
  });

  it('should have clickable links to component detail', async () => {
    const user = userEvent.setup();
    const project = createProject();
    renderWithQueryClient(<ProjectBar project={project} />);

    await user.click(screen.getByRole('button', { name: '펼치기' }));

    await waitFor(() => {
      const link = screen.getByRole('link', { name: 'git-commit' });
      expect(link).toHaveAttribute('href', '/components/comp_s1');
    });
  });

  it('should show hide button for non-global project', () => {
    const project = createProject({ name: 'vibesmith', isGlobal: false });
    renderWithQueryClient(<ProjectBar project={project} />);
    expect(
      screen.getByRole('button', { name: /vibesmith 프로젝트 숨기기/i })
    ).toBeInTheDocument();
  });

  it('should NOT show hide button for global project', () => {
    const project = createProject({ name: 'global', isGlobal: true });
    renderWithQueryClient(<ProjectBar project={project} />);
    expect(screen.queryByRole('button', { name: /숨기기/i })).not.toBeInTheDocument();
  });

  it('should open confirm modal when hide clicked', async () => {
    const user = userEvent.setup();
    const project = createProject({ name: 'vibesmith', isGlobal: false });
    renderWithQueryClient(<ProjectBar project={project} />);

    await user.click(screen.getByRole('button', { name: /vibesmith 프로젝트 숨기기/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('프로젝트 숨기기')).toBeInTheDocument();
    expect(screen.getByText(/숨기시겠습니까/)).toBeInTheDocument();
  });

  it('should close modal and NOT call API when Cancel clicked', async () => {
    const user = userEvent.setup();
    const project = createProject({ name: 'vibesmith', isGlobal: false });
    renderWithQueryClient(<ProjectBar project={project} />);

    await user.click(screen.getByRole('button', { name: /vibesmith 프로젝트 숨기기/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '취소' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('should call hide API when confirm clicked', async () => {
    const user = userEvent.setup();
    const project = createProject({
      id: 'proj_test',
      name: 'vibesmith',
      isGlobal: false,
    });
    renderWithQueryClient(<ProjectBar project={project} />);

    await user.click(screen.getByRole('button', { name: /vibesmith 프로젝트 숨기기/i }));
    await user.click(screen.getByRole('button', { name: '숨기기 확인' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('should show error toast when API returns 400 (e.g. global project hide blocked)', async () => {
    server.use(
      http.delete('http://localhost:8000/api/projects/:id', () =>
        HttpResponse.json(
          {
            detail: '글로벌 프로젝트는 삭제할 수 없습니다',
            message_key: 'errors.global_project_cannot_delete',
            message: '글로벌 프로젝트는 삭제할 수 없습니다',
          },
          { status: 400 }
        )
      )
    );
    const toastErrorSpy = vi.spyOn(sonner.toast, 'error').mockImplementation(() => 'id');
    const user = userEvent.setup();
    const project = createProject({ name: 'vibesmith', isGlobal: false });
    renderWithQueryClient(<ProjectBar project={project} />);

    await user.click(screen.getByRole('button', { name: /vibesmith 프로젝트 숨기기/i }));
    await user.click(screen.getByRole('button', { name: '숨기기 확인' }));

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalledWith(
        '글로벌 프로젝트는 삭제할 수 없습니다'
      );
    });
    toastErrorSpy.mockRestore();
  });

  it('should have no accessibility violations', async () => {
    const project = createProject();
    const { container } = renderWithQueryClient(<ProjectBar project={project} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
