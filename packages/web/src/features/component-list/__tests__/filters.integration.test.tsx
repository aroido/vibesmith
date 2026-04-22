/**
 * Filters Integration Tests
 * Tests the interaction between all three filters
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from 'i18next';
import { ComponentListPage } from '../components/ComponentListPage';
import * as api from '../services/api';
import type { ProjectResponse } from '@/common/api';

// Mock API - component-list wrapper + common (for useTagStats)
vi.mock('../services/api', () => ({
  getComponents: vi.fn(),
  getProjects: vi.fn(),
  getAvailableTags: vi.fn(),
}));

vi.mock('@/common/api', async (importOriginal) => {
  const actual = await importOriginal() as object;
  const mockTags = [
    { name: 'python', count: 15 },
    { name: 'react', count: 10 },
    { name: 'fastapi', count: 8 },
  ];
  return {
    ...actual,
    getAvailableTags: vi.fn(() => Promise.resolve(mockTags)),
  };
});

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
];

const mockTags: api.TagInfo[] = [
  { name: 'python', count: 15 },
  { name: 'react', count: 10 },
];

const mockComponents = [
  {
    id: 'comp_001',
    type: 'skill' as const,
    name: 'fastapi-route',
    description: 'FastAPI 라우트 스캐폴딩',
    enabled: true,
    tags: ['python', 'fastapi'],
    project_id: 'proj_001',
    project_name: 'vibesmith',
    path: '/path/to/skill',
    created_at: '2026-02-12T10:00:00Z',
    updated_at: '2026-02-12T10:00:00Z',
  },
  {
    id: 'comp_002',
    type: 'agent' as const,
    name: 'planner',
    description: 'Plan implementation tasks',
    enabled: true,
    tags: ['planning'],
    project_id: 'proj_001',
    project_name: 'vibesmith',
    path: '/path/to/agent',
    created_at: '2026-02-12T10:00:00Z',
    updated_at: '2026-02-12T10:00:00Z',
  },
];

function createLargeMockComponents(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `comp_${String(index + 1).padStart(3, '0')}`,
    type: index % 2 === 0 ? 'skill' as const : 'agent' as const,
    name: `component-${index + 1}`,
    description: `description-${index + 1}`,
    enabled: index % 3 !== 0,
    tags: index % 2 === 0 ? ['python'] : ['planning'],
    project_id: 'proj_001',
    project_name: 'vibesmith',
    path: `/path/to/component-${index + 1}`,
    created_at: '2026-02-12T10:00:00Z',
    updated_at: '2026-02-12T10:00:00Z',
  }));
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/components']}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

function LocationSearchProbe() {
  const location = useLocation();
  return <output data-testid="location-search">{location.search}</output>;
}

function renderWithMemoryRouter(initialPath: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route
            path="/components"
            element={(
              <>
                <ComponentListPage />
                <LocationSearchProbe />
              </>
            )}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Filters Integration', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ko');
    vi.clearAllMocks();
    vi.mocked(api.getProjects).mockResolvedValue(mockProjects);
    vi.mocked(api.getAvailableTags).mockResolvedValue(mockTags);
    vi.mocked(api.getComponents).mockResolvedValue(mockComponents);
  });

  it('renders all filter components', async () => {
    renderWithProviders(<ComponentListPage />);

    await waitFor(() => {
      expect(screen.getByText('필터')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('구성요소 타입 필터')).toBeInTheDocument();
    expect(screen.getByLabelText('프로젝트 필터')).toBeInTheDocument();
    expect(screen.getByLabelText('검색어 입력')).toBeInTheDocument();
    expect(screen.getByLabelText('태그 검색')).toBeInTheDocument();
  });

  it('applies type filter', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ComponentListPage />);

    await waitFor(() => {
      expect(screen.getByText('필터')).toBeInTheDocument();
    });

    // Select skill type
    const skillButton = screen.getByRole('button', { name: /skills/i });
    await user.click(skillButton);

    await waitFor(() => {
      expect(api.getComponents).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'skill' })
      );
    });
  });

  it('supports multi type selection (OR) and stores types query', async () => {
    const user = userEvent.setup();
    renderWithMemoryRouter('/components');

    await waitFor(() => {
      expect(screen.getByText('필터')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /skills/i }));
    await user.click(screen.getByRole('button', { name: /agents/i }));

    await waitFor(() => {
      const search = screen.getByTestId('location-search').textContent ?? '';
      expect(search).toContain('types=skill%2Cagent');
    });

    await waitFor(() => {
      expect(api.getComponents).toHaveBeenCalledWith(
        expect.objectContaining({ types: ['skill', 'agent'] })
      );
    });
  });

  it('applies Hooks type filter and shows correct components', async () => {
    const user = userEvent.setup();
    const hookComponents = [
      { ...mockComponents[0], id: 'hook_001', type: 'hook' as const },
    ];
    vi.mocked(api.getComponents).mockResolvedValue(hookComponents);

    renderWithProviders(<ComponentListPage />);

    await waitFor(() => {
      expect(screen.getByText('필터')).toBeInTheDocument();
    });

    const hooksButton = screen.getByRole('button', { name: /hooks/i });
    await user.click(hooksButton);

    await waitFor(() => {
      expect(api.getComponents).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'hook' })
      );
    });
  });

  it('applies Rules type filter and shows correct components', async () => {
    const user = userEvent.setup();
    const ruleComponents = [
      { ...mockComponents[0], id: 'rule_001', type: 'rule' as const },
    ];
    vi.mocked(api.getComponents).mockResolvedValue(ruleComponents);

    renderWithProviders(<ComponentListPage />);

    await waitFor(() => {
      expect(screen.getByText('필터')).toBeInTheDocument();
    });

    const rulesButton = screen.getByRole('button', { name: /rules/i });
    await user.click(rulesButton);

    await waitFor(() => {
      expect(api.getComponents).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'rule' })
      );
    });
  });

  it('applies project filter', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ComponentListPage />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /vibesmith/ })).toBeInTheDocument();
    });

    const projectSelect = screen.getByLabelText('프로젝트 필터');
    await user.selectOptions(projectSelect, 'proj_001');

    await waitFor(() => {
      expect(api.getComponents).toHaveBeenCalledWith(
        expect.objectContaining({ project_id: 'proj_001' })
      );
    });
  });

  it('applies search filter with debounce', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ComponentListPage />);

    await waitFor(() => {
      expect(screen.getByText('필터')).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText('검색어 입력');
    await user.type(searchInput, 'fastapi');

    await waitFor(
      () => {
        expect(api.getComponents).toHaveBeenCalledWith(
          expect.objectContaining({ q: 'fastapi' })
        );
      },
      { timeout: 500 }
    );
  });

  it('applies tag filter', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ComponentListPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('태그 검색')).toBeInTheDocument();
    });

    const tagInput = screen.getByLabelText('태그 검색');
    await user.click(tagInput);
    await user.type(tagInput, 'python');
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());
    await user.click(screen.getByRole('option', { name: /python/ }));

    await waitFor(() => {
      expect(api.getComponents).toHaveBeenCalledWith(
        expect.objectContaining({ tag: 'python' })
      );
    });
  });

  it('combines multiple filters', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ComponentListPage />);

    await waitFor(() => {
      expect(screen.getByText('필터')).toBeInTheDocument();
    });

    // Apply type filter
    const skillButton = screen.getByRole('button', { name: /skills/i });
    await user.click(skillButton);

    // Apply project filter
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /vibesmith/ })).toBeInTheDocument();
    });
    const projectSelect = screen.getByLabelText('프로젝트 필터');
    await user.selectOptions(projectSelect, 'proj_001');

    // Apply search filter
    const searchInput = screen.getByLabelText('검색어 입력');
    await user.type(searchInput, 'route');

    await waitFor(
      () => {
        expect(api.getComponents).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'skill',
            project_id: 'proj_001',
            q: 'route',
          })
        );
      },
      { timeout: 3000 }
    );
  });

  it('shows active filters summary', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ComponentListPage />);

    await waitFor(() => {
      expect(screen.getByText('필터')).toBeInTheDocument();
    });

    // Apply filters
    const skillButton = screen.getByRole('button', { name: /skills/i });
    await user.click(skillButton);

    await waitFor(() => {
      expect(screen.getByText('활성 필터:')).toBeInTheDocument();
      expect(screen.getByText(/타입:.*[Ss]kill/)).toBeInTheDocument();
    });
  });

  it('clears all filters', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ComponentListPage />);

    await waitFor(() => {
      expect(screen.getByText('필터')).toBeInTheDocument();
    });

    // Apply filters
    const skillButton = screen.getByRole('button', { name: /skills/i });
    await user.click(skillButton);

    await waitFor(() => {
      expect(screen.getByText('활성 필터:')).toBeInTheDocument();
    });

    // Clear all
    const clearButton = screen.getByRole('button', { name: '활성 필터 모두 지우기' });
    await user.click(clearButton);

    // Active filters summary should disappear
    await waitFor(() => {
      expect(screen.queryByText('활성 필터:')).not.toBeInTheDocument();
    });

    // All tab should be selected (ko: "전체 필터", en: "All filter")
    const allLabel = i18n.t('components:list.typeTabAria', {
      label: i18n.t('components:list.typeTabAll'),
    });
    const allTab = screen.getByRole('button', { name: allLabel });
    expect(allTab).toHaveAttribute('aria-pressed', 'true');
  });

  it('initializes filters from URL search params', async () => {
    renderWithMemoryRouter(
      '/components?type=skill&project=proj_001&q=fastapi&tags=python&status=enabled&view=table'
    );

    await waitFor(() => {
      expect(api.getComponents).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'skill',
          project_id: 'proj_001',
          q: 'fastapi',
          tag: 'python',
          enabled: true,
        })
      );
    });
  });

  it('initializes hook filter from URL search params', async () => {
    renderWithMemoryRouter('/components?type=hook');

    await waitFor(() => {
      expect(api.getComponents).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'hook' })
      );
    });
  });

  it('initializes rule filter from URL search params', async () => {
    renderWithMemoryRouter('/components?type=rule');

    await waitFor(() => {
      expect(api.getComponents).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'rule' })
      );
    });
  });

  it('persists filter changes into URL search params', async () => {
    const user = userEvent.setup();
    renderWithMemoryRouter('/components');

    await waitFor(() => {
      expect(screen.getByText('필터')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /skills/i }));
    await user.selectOptions(screen.getByLabelText('프로젝트 필터'), 'proj_001');
    // 태그: 입력 후 제안 클릭 (다중 선택 UI)
    const tagInput = screen.getByLabelText('태그 검색');
    await user.click(tagInput);
    await user.type(tagInput, 'python');
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());
    const pythonOption = screen.getByRole('option', { name: /python/ });
    await user.click(pythonOption);
    await user.selectOptions(screen.getByLabelText('활성화 상태 필터'), 'enabled');

    await waitFor(() => {
      const search = screen.getByTestId('location-search').textContent ?? '';
      expect(search).toContain('types=skill');
      expect(search).toContain('project=proj_001');
      expect(search).toContain('tags=python');
      expect(search).toContain('status=enabled');
    });
  });

  it('resets page to 1 when status filter changes', async () => {
    const user = userEvent.setup();
    vi.mocked(api.getComponents).mockResolvedValue(createLargeMockComponents(120));
    renderWithMemoryRouter('/components?page=2');

    await waitFor(() => {
      const search = screen.getByTestId('location-search').textContent ?? '';
      expect(search).toContain('page=2');
    });

    await user.selectOptions(screen.getByLabelText('활성화 상태 필터'), 'disabled');

    await waitFor(() => {
      const search = screen.getByTestId('location-search').textContent ?? '';
      expect(search).not.toContain('page=');
    });
  });

  it('normalizes out-of-range page param to the last valid page', async () => {
    vi.mocked(api.getComponents).mockResolvedValue(createLargeMockComponents(60));
    renderWithMemoryRouter('/components?page=3');

    await waitFor(() => {
      const search = screen.getByTestId('location-search').textContent ?? '';
      expect(search).toContain('page=2');
    });

    expect(screen.queryByText('아직 구성요소가 없습니다')).not.toBeInTheDocument();
    expect(screen.getByText('component-51')).toBeInTheDocument();
  });
});
