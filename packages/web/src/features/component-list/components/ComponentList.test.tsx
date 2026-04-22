/**
 * ComponentList unit tests
 * Loading, error, empty state
 */

import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'jest-axe';
import { ComponentList } from './ComponentList';
import type { ComponentListItem as ComponentListItemType } from '../types';

function renderWithRouter(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const createComponent = (
  overrides: Partial<ComponentListItemType> = {}
): ComponentListItemType => ({
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
  ...overrides,
});

describe('ComponentList', () => {
  it('should show loading skeleton when isLoading is true', () => {
    render(
      <ComponentList
        filters={{}}
        components={undefined}
        isLoading={true}
        error={null}
      />
    );

    expect(screen.getByRole('status', { name: '로딩 중...' })).toBeInTheDocument();
  });

  it('should show error message when error is present', () => {
    const error = new Error('일시적인 오류가 발생했습니다');
    render(
      <ComponentList
        filters={{}}
        components={undefined}
        isLoading={false}
        error={error}
      />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('일시적인 오류가 발생했습니다')).toBeInTheDocument();
  });

  it('should show retry button when error and onRetry provided', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const error = new Error('서버 오류');
    render(
      <ComponentList
        filters={{}}
        components={undefined}
        isLoading={false}
        error={error}
        onRetry={onRetry}
      />
    );

    const retryButton = screen.getByRole('button', { name: '재시도' });
    await user.click(retryButton);
    expect(onRetry).toHaveBeenCalled();
  });

  it('should show empty state when no components', () => {
    render(
      <ComponentList
        filters={{}}
        components={[]}
        isLoading={false}
        error={null}
      />
    );

    expect(screen.getByText('아직 구성요소가 없습니다')).toBeInTheDocument();
  });

  it('should show type-specific empty message when type filter applied', () => {
    render(
      <ComponentList
        filters={{ type: 'skill' }}
        components={[]}
        isLoading={false}
        error={null}
      />
    );

    expect(screen.getByText('해당 타입의 구성요소가 없습니다')).toBeInTheDocument();
  });

  it('should render component list when data exists', () => {
    const components = [
      createComponent({ name: 'fastapi-route' }),
      createComponent({ id: 'comp_002', name: 'planner' }),
    ];
    renderWithRouter(
      <ComponentList
        filters={{}}
        components={components}
        isLoading={false}
        error={null}
      />
    );

    expect(screen.getByRole('list', { name: '구성요소 목록' })).toBeInTheDocument();
    expect(screen.getByText('fastapi-route')).toBeInTheDocument();
    expect(screen.getByText('planner')).toBeInTheDocument();
  });

  it('should group components by type sections', () => {
    const components = [
      createComponent({ id: 'comp_001', type: 'agent', name: 'planner' }),
      createComponent({ id: 'comp_002', type: 'skill', name: 'fastapi-route' }),
      createComponent({ id: 'comp_003', type: 'hook', name: 'post-commit-hook' }),
    ];

    renderWithRouter(
      <ComponentList
        filters={{}}
        components={components}
        isLoading={false}
        error={null}
      />
    );

    const headings = screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent?.trim());
    expect(headings).toEqual(['Skills', 'Agents', 'Hooks']);
  });

  it('should have no accessibility violations in list state', async () => {
    const components = [createComponent()];
    const { container } = renderWithRouter(
      <ComponentList
        filters={{}}
        components={components}
        isLoading={false}
        error={null}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
