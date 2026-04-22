/**
 * ComponentListFilters integration tests
 * Spec: toggle-enhancement.md - Status 필터 통합
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ComponentListFilters } from './ComponentListFilters';
import * as api from '../services/api';
import type { ProjectResponse } from '@/common/api';

vi.mock('../services/api', () => ({
  getProjects: vi.fn(),
  getAvailableTags: vi.fn(),
}));

vi.mock('@/common/api', async (importOriginal) => {
  const actual = await importOriginal() as object;
  return {
    ...actual,
    getAvailableTags: vi.fn(() => Promise.resolve([{ name: 'python', count: 5 }])),
  };
});

const mockProjects: ProjectResponse[] = [
  { id: 'proj_001', name: 'vibesmith', path: '/path', is_global: false, component_count: 1, last_scanned_at: '2026-02-12T10:00:00Z', dir_exists: true, has_claude_dir: true, created_at: '2026-02-12T10:00:00Z', updated_at: '2026-02-12T10:00:00Z' },
];

const mockTags = [{ name: 'python', count: 5 }];

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('ComponentListFilters', () => {
  beforeEach(() => {
    vi.mocked(api.getProjects).mockResolvedValue(mockProjects);
    vi.mocked(api.getAvailableTags).mockResolvedValue(mockTags as api.TagInfo[]);
  });

  it('should render Status filter alongside other filters', async () => {
    renderWithProviders(
      <ComponentListFilters
        selectedTypes={[]} onTypesChange={vi.fn()}
        selectedProjectId={null} onProjectChange={vi.fn()}
        searchQuery="" onSearchChange={vi.fn()}
        selectedTags={[]} onTagsChange={vi.fn()}
        tagFilterMode="or" onTagFilterModeChange={vi.fn()}
        statusFilter="all" onStatusFilterChange={vi.fn()}
      />
    );
    await waitFor(() => expect(screen.getByLabelText('활성화 상태 필터')).toBeInTheDocument());
    expect(screen.getByRole('group', { name: '구성요소 타입 필터' })).toBeInTheDocument();
  });

  it('should call onStatusFilterChange when status filter changes', async () => {
    const user = userEvent.setup();
    const onStatusFilterChange = vi.fn();
    renderWithProviders(
      <ComponentListFilters
        selectedTypes={[]} onTypesChange={vi.fn()}
        selectedProjectId={null} onProjectChange={vi.fn()}
        searchQuery="" onSearchChange={vi.fn()}
        selectedTags={[]} onTagsChange={vi.fn()}
        tagFilterMode="or" onTagFilterModeChange={vi.fn()}
        statusFilter="all" onStatusFilterChange={onStatusFilterChange}
      />
    );
    await waitFor(() => expect(screen.getByLabelText('활성화 상태 필터')).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText('활성화 상태 필터'), 'enabled');
    expect(onStatusFilterChange).toHaveBeenCalledWith('enabled');
  });
});
