/**
 * ComponentDetailActions unit tests
 * Delete modal, confirm delete, toggle, copy modal
 */

import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { componentsHandlers } from '@/mocks/handlers/components';
import { ComponentDetailActions } from './ComponentDetailActions';
import type { ComponentDetail } from '../types';

const mockProjects = [
  { id: 'proj_001', name: 'vibesmith', path: '/path', is_global: false },
  { id: 'proj_002', name: 'other', path: '/other', is_global: false },
];

const mockVersions = [
  { version: 3, content: '---\nname: fastapi-route\n---\n최신', created_at: '2026-02-09T16:30:00Z' },
  { version: 2, content: '---\nname: fastapi-route\n---\n이전', created_at: '2026-02-09T14:00:00Z' },
  { version: 1, content: '---\nname: fastapi-route\n---\n최초', created_at: '2026-02-09T10:00:00Z' },
];

const server = setupServer(
  http.get('*/api/projects', () => HttpResponse.json(mockProjects)),
  http.get('*/api/components/:id/versions', () => HttpResponse.json(mockVersions)),
  ...componentsHandlers
);

function renderWithRouter(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

beforeAll(async () => {
  await i18n.changeLanguage('ko');
  server.listen();
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const mockComponent: ComponentDetail = {
  id: 'comp_001',
  type: 'skill',
  name: 'fastapi-route',
  description: 'FastAPI 스캐폴딩',
  enabled: true,
  tags: ['python'],
  project_id: 'proj_001',
  project_name: 'vibesmith',
  path: '/path/to/skill',
  content: '',
  frontmatter: {},
  dependencies: { depends_on: [], depended_by: [] },
  created_at: '2026-02-09T10:00:00Z',
  updated_at: '2026-02-09T15:00:00Z',
};

describe('ComponentDetailActions', () => {
  it('should show confirm modal when delete button clicked', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onToggle = vi.fn();

    renderWithRouter(
      <ComponentDetailActions
        component={mockComponent}
        onDelete={onDelete}
        onToggle={onToggle}
      />
    );

    const deleteBtn = screen.getByRole('button', { name: /삭제|Delete/ });
    await user.click(deleteBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/휴지통으로 이동하시겠습니까|move.*trash/i)).toBeInTheDocument();
    expect(screen.getByText(/fastapi-route/)).toBeInTheDocument();
  });

  it('should call onDelete when modal confirm clicked', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onToggle = vi.fn();

    renderWithRouter(
      <ComponentDetailActions
        component={mockComponent}
        onDelete={onDelete}
        onToggle={onToggle}
      />
    );

    await user.click(screen.getByRole('button', { name: /삭제|Delete/ }));
    await user.click(screen.getByRole('button', { name: /삭제 확인|Confirm delete/ }));

    expect(onDelete).toHaveBeenCalled();
  });

  it('should call onToggle when toggle button clicked', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onToggle = vi.fn();

    renderWithRouter(
      <ComponentDetailActions
        component={mockComponent}
        onDelete={onDelete}
        onToggle={onToggle}
      />
    );

    const toggleBtn = screen.getByRole('button', { name: /비활성화|Disable/ });
    await user.click(toggleBtn);

    expect(onToggle).toHaveBeenCalled();
  });

  it('should open CopyToProjectModal when copy button clicked', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onToggle = vi.fn();

    renderWithRouter(
      <ComponentDetailActions
        component={mockComponent}
        onDelete={onDelete}
        onToggle={onToggle}
      />
    );

    const copyBtn = screen.getByRole('button', { name: /다른 프로젝트로 복사|Copy to Project/ });
    await user.click(copyBtn);

    expect(screen.getByRole('dialog', { name: /다른 프로젝트로 복사|Copy to Project/ })).toBeInTheDocument();
  });

  it('should close modal when cancel clicked', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onToggle = vi.fn();

    renderWithRouter(
      <ComponentDetailActions
        component={mockComponent}
        onDelete={onDelete}
        onToggle={onToggle}
      />
    );

    await user.click(screen.getByRole('button', { name: /삭제|Delete/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /취소|Cancel/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  describe('DependencyWarningModal integration', () => {
    const affectedDeps = [
      { id: 'comp_010', name: 'pydantic-model', type: 'skill' as const },
      { id: 'comp_020', name: 'pytest-write', type: 'skill' as const },
    ];

    it('should show dependency warning modal when isDependencyWarningOpen', () => {
      renderWithRouter(
        <ComponentDetailActions
          component={mockComponent}
          onDelete={vi.fn()}
          onToggle={vi.fn()}
          isDependencyWarningOpen={true}
          affectedDependencies={affectedDeps}
          onDependencyWarningConfirm={vi.fn()}
          onDependencyWarningCancel={vi.fn()}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/fastapi-route.*비활성화|Disable fastapi-route/)).toBeInTheDocument();
      expect(screen.getByText(/pydantic-model/)).toBeInTheDocument();
      expect(screen.getByText(/pytest-write/)).toBeInTheDocument();
    });

    it('should call onDependencyWarningConfirm when Disable Anyway clicked', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      const onCancel = vi.fn();

      renderWithRouter(
        <ComponentDetailActions
          component={mockComponent}
          onDelete={vi.fn()}
          onToggle={vi.fn()}
          isDependencyWarningOpen={true}
          affectedDependencies={affectedDeps}
          onDependencyWarningConfirm={onConfirm}
          onDependencyWarningCancel={onCancel}
        />
      );

      await user.click(screen.getByRole('button', { name: /그래도 비활성화|Disable Anyway/i }));

      expect(onConfirm).toHaveBeenCalled();
      expect(onCancel).not.toHaveBeenCalled();
    });

    it('should call onDependencyWarningCancel when Cancel clicked', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      const onCancel = vi.fn();

      renderWithRouter(
        <ComponentDetailActions
          component={mockComponent}
          onDelete={vi.fn()}
          onToggle={vi.fn()}
          isDependencyWarningOpen={true}
          affectedDependencies={affectedDeps}
          onDependencyWarningConfirm={onConfirm}
          onDependencyWarningCancel={onCancel}
        />
      );

      await user.click(screen.getByRole('button', { name: /취소|Cancel/i }));

      expect(onCancel).toHaveBeenCalled();
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('should not show dependency modal when isDependencyWarningOpen is false', () => {
      renderWithRouter(
        <ComponentDetailActions
          component={mockComponent}
          onDelete={vi.fn()}
          onToggle={vi.fn()}
          isDependencyWarningOpen={false}
          affectedDependencies={affectedDeps}
          onDependencyWarningConfirm={vi.fn()}
          onDependencyWarningCancel={vi.fn()}
        />
      );

      expect(screen.queryByText(/fastapi-route.*비활성화|Disable fastapi-route/)).not.toBeInTheDocument();
    });

    it('should disable toggle button when isToggling', () => {
      renderWithRouter(
        <ComponentDetailActions
          component={mockComponent}
          onDelete={vi.fn()}
          onToggle={vi.fn()}
          isToggling={true}
        />
      );

      const toggleBtn = screen.getByRole('button', { name: /비활성화|Disable/ });
      expect(toggleBtn).toBeDisabled();
    });
  });
});
