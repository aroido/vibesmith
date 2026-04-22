/**
 * ProjectFilter Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProjectFilter } from './ProjectFilter';
import * as api from '../services/api';
import type { ProjectResponse } from '@/common/api';

// Mock API
vi.mock('../services/api', () => ({
  getProjects: vi.fn(),
}));

const mockProjects: ProjectResponse[] = [
  {
    id: 'proj_001',
    name: 'vibesmith',
    path: '/Users/user/Projects/vibesmith',
    is_global: false,
    component_count: 42,
    last_scanned_at: '2026-02-12T10:00:00Z',
    dir_exists: true,
    has_claude_dir: true,
    created_at: '2026-02-12T10:00:00Z',
    updated_at: '2026-02-12T10:00:00Z',
  },
  {
    id: 'proj_global',
    name: 'global',
    path: '/Users/user/.claude',
    is_global: true,
    component_count: 51,
    last_scanned_at: '2026-02-12T10:00:00Z',
    dir_exists: true,
    created_at: '2026-02-12T10:00:00Z',
    updated_at: '2026-02-12T10:00:00Z',
    has_claude_dir: false,
  },
];

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('ProjectFilter', () => {
  it('renders project select', async () => {
    vi.mocked(api.getProjects).mockResolvedValue(mockProjects);

    renderWithQueryClient(
      <ProjectFilter selectedProjectId={null} onProjectChange={vi.fn()} />
    );

    expect(screen.getByLabelText('프로젝트 필터')).toBeInTheDocument();
    expect(screen.getByText('프로젝트')).toBeInTheDocument();
  });

  it('loads and displays projects', async () => {
    vi.mocked(api.getProjects).mockResolvedValue(mockProjects);

    renderWithQueryClient(
      <ProjectFilter selectedProjectId={null} onProjectChange={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByText(/vibesmith/)).toBeInTheDocument();
    });

    expect(screen.getByText(/global \(글로벌\)/)).toBeInTheDocument();
  });

  it('calls onProjectChange when selection changes', async () => {
    const user = userEvent.setup();
    const onProjectChange = vi.fn();
    vi.mocked(api.getProjects).mockResolvedValue(mockProjects);

    renderWithQueryClient(
      <ProjectFilter
        selectedProjectId={null}
        onProjectChange={onProjectChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/vibesmith/)).toBeInTheDocument();
    });

    const select = screen.getByLabelText('프로젝트 필터');
    await user.selectOptions(select, 'proj_001');

    expect(onProjectChange).toHaveBeenCalledWith('proj_001');
  });

  it('calls onProjectChange with null when "모든 프로젝트" is selected', async () => {
    const user = userEvent.setup();
    const onProjectChange = vi.fn();
    vi.mocked(api.getProjects).mockResolvedValue(mockProjects);

    renderWithQueryClient(
      <ProjectFilter
        selectedProjectId="proj_001"
        onProjectChange={onProjectChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/vibesmith/)).toBeInTheDocument();
    });

    const select = screen.getByLabelText('프로젝트 필터');
    await user.selectOptions(select, 'all');

    expect(onProjectChange).toHaveBeenCalledWith(null);
  });

  it('disables select while loading', () => {
    vi.mocked(api.getProjects).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithQueryClient(
      <ProjectFilter selectedProjectId={null} onProjectChange={vi.fn()} />
    );

    expect(screen.getByLabelText('프로젝트 필터')).toBeDisabled();
  });
});
