/**
 * ComponentListItem unit tests
 * Rendering, active state, tag display
 */

import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { axe } from 'jest-axe';
import i18n from 'i18next';
import { ComponentListItem } from './ComponentListItem';
import type { ComponentListItem as ComponentListItemType } from '../types';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderWithRouter(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const createComponent = (
  overrides: Partial<ComponentListItemType> = {}
): ComponentListItemType => ({
  id: 'comp_001',
  type: 'skill',
  name: 'fastapi-route',
  description: 'FastAPI 라우트 스캐폴딩 — RESTful CRUD 패턴',
  enabled: true,
  tags: ['python', 'fastapi'],
  project_id: 'proj_abc123',
  project_name: 'vibesmith',
  path: '/Users/user/vibesmith/.claude/skills/fastapi-route/SKILL.md',
  created_at: '2026-02-09T10:00:00Z',
  updated_at: '2026-02-09T15:00:00Z',
  ...overrides,
});

describe('ComponentListItem', () => {
  beforeEach(async () => {
    mockNavigate.mockReset();
    await i18n.changeLanguage('ko');
  });

  it('should render component name and description', () => {
    const component = createComponent();
    renderWithRouter(<ComponentListItem component={component} />);

    expect(screen.getByText('fastapi-route')).toBeInTheDocument();
    expect(screen.getByText(/FastAPI 라우트 스캐폴딩/)).toBeInTheDocument();
  });

  it('should display enabled badge when enabled', () => {
    const component = createComponent({ enabled: true });
    renderWithRouter(<ComponentListItem component={component} />);

    expect(screen.getByText('활성')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: '구성요소를 비활성화' })).toBeInTheDocument();
  });

  it('should display disabled badge when not enabled', () => {
    const component = createComponent({ enabled: false });
    renderWithRouter(<ComponentListItem component={component} />);

    expect(screen.getByText('비활성')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: '구성요소를 활성화' })).toBeInTheDocument();
  });

  it('should display tags when present', () => {
    const component = createComponent({ tags: ['python', 'fastapi', 'rest'] });
    renderWithRouter(<ComponentListItem component={component} />);

    expect(screen.getByText('python')).toBeInTheDocument();
    expect(screen.getByText('fastapi')).toBeInTheDocument();
    expect(screen.getByText('rest')).toBeInTheDocument();
  });

  it('should not render tags section when tags array is empty', () => {
    const component = createComponent({ tags: [] });
    renderWithRouter(<ComponentListItem component={component} />);

    expect(screen.queryByRole('group', { name: '태그' })).not.toBeInTheDocument();
  });

  it('should display path with folder icon', () => {
    const component = createComponent();
    renderWithRouter(<ComponentListItem component={component} />);

    expect(screen.getByText(/\/Users\/user\/vibesmith/)).toBeInTheDocument();
  });

  it('should render with semantic article element', () => {
    const component = createComponent();
    renderWithRouter(<ComponentListItem component={component} />);

    expect(screen.getByRole('article')).toBeInTheDocument();
  });

  it('should call onToggle callback when toggle button clicked', async () => {
    const user = userEvent.setup();
    const component = createComponent({ enabled: true });
    const onToggle = vi.fn();
    renderWithRouter(<ComponentListItem component={component} onToggle={onToggle} />);

    await user.click(screen.getByRole('switch', { name: '구성요소를 비활성화' }));
    expect(onToggle).toHaveBeenCalledWith(component.id, false);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should navigate to detail when card area is clicked', async () => {
    const user = userEvent.setup();
    const component = createComponent();
    renderWithRouter(<ComponentListItem component={component} />);

    await user.click(screen.getByTestId(`component-list-item-${component.id}-card`));
    expect(mockNavigate).toHaveBeenCalledWith(`/components/${component.id}`);
  });

  it('should have no accessibility violations', async () => {
    const component = createComponent();
    const { container } = renderWithRouter(<ComponentListItem component={component} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
