import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectsPage } from './ProjectsPage';

const { mockUseProjects, mockUseUnhideProject } = vi.hoisted(() => ({
  mockUseProjects: vi.fn(),
  mockUseUnhideProject: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

vi.mock('@/components/common', () => ({
  PageFrame: ({ title, subtitle, children }: {
    title?: ReactNode;
    subtitle?: ReactNode;
    children: ReactNode;
  }) => (
    <main>
      {title && <h1>{title}</h1>}
      {subtitle && <p>{subtitle}</p>}
      {children}
    </main>
  ),
}));

vi.mock('@/features/scan', () => ({
  RescanButton: () => <button type="button">Sync</button>,
  CreateProjectPresetModal: ({ isOpen }: { isOpen: boolean }) => (
    <div data-testid="create-project-preset-modal" data-open={isOpen ? 'true' : 'false'} />
  ),
}));

vi.mock('@/features/dashboard', () => ({
  ProjectBar: ({ project }: { project: { name: string } }) => (
    <div data-testid="project-bar">{project.name}</div>
  ),
  useProjects: mockUseProjects,
  useUnhideProject: mockUseUnhideProject,
}));

describe('ProjectsPage', () => {
  beforeEach(() => {
    mockUseProjects.mockReset();
    mockUseUnhideProject.mockClear();
  });

  it('hides redundant components CTA card while keeping project list panels', () => {
    mockUseProjects.mockReturnValue({
      data: [
        { id: 'proj_1', name: 'Alpha', componentCount: 12 },
        { id: 'proj_2', name: 'Beta', componentCount: 3 },
      ],
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('create-project-preset-modal')).toHaveAttribute('data-open', 'false');
    expect(screen.getAllByTestId('project-bar')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /컴포넌트|components/i })).not.toBeInTheDocument();
  });
});
