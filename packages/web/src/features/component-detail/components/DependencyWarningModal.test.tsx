/**
 * DependencyWarningModal unit tests
 * Spec: toggle-enhancement.md Appendix B.1
 * - 렌더링 (영향받는 구성요소 목록)
 * - onConfirm when Disable Anyway clicked
 * - onCancel when Cancel clicked
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import i18n from 'i18next';
import { axe } from 'jest-axe';
import { DependencyWarningModal } from './DependencyWarningModal';
import type { DependencyItem } from '../types';

const mockDependencies: DependencyItem[] = [
  { id: 'comp_010', name: 'pydantic-model', type: 'skill' },
  { id: 'comp_020', name: 'pytest-write', type: 'skill' },
];

describe('DependencyWarningModal', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('ko');
  });

  it('should not render when isOpen is false', () => {
    render(
      <DependencyWarningModal
        isOpen={false}
        componentName="fastapi-route"
        affectedDependencies={mockDependencies}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render modal with title when isOpen', () => {
    render(
      <DependencyWarningModal
        isOpen={true}
        componentName="fastapi-route"
        affectedDependencies={mockDependencies}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/fastapi-route.*비활성화|Disable fastapi-route/)).toBeInTheDocument();
  });

  it('should render affected dependencies list', () => {
    render(
      <DependencyWarningModal
        isOpen={true}
        componentName="fastapi-route"
        affectedDependencies={mockDependencies}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText(/이 구성요소를 사용하는 것|This component is used by/)).toBeInTheDocument();
    expect(screen.getByText(/pydantic-model/)).toBeInTheDocument();
    expect(screen.getByText(/pytest-write/)).toBeInTheDocument();
    expect(screen.getByText(/비활성화하면|Disabling this component may affect/)).toBeInTheDocument();
  });

  it('should call onConfirm when Disable Anyway clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <DependencyWarningModal
        isOpen={true}
        componentName="fastapi-route"
        affectedDependencies={mockDependencies}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    await user.click(screen.getByRole('button', { name: /그래도 비활성화|Disable Anyway/i }));

    expect(onConfirm).toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('should call onCancel when Cancel clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <DependencyWarningModal
        isOpen={true}
        componentName="fastapi-route"
        affectedDependencies={mockDependencies}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    await user.click(screen.getByRole('button', { name: /취소|Cancel/i }));

    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('should render empty list when no dependencies', () => {
    render(
      <DependencyWarningModal
        isOpen={true}
        componentName="fastapi-route"
        affectedDependencies={[]}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText(/fastapi-route.*비활성화|Disable fastapi-route/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /취소|Cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /그래도 비활성화|Disable Anyway/ })).toBeInTheDocument();
  });

  it('should have no accessibility violations', async () => {
    const { container } = render(
      <DependencyWarningModal
        isOpen={true}
        componentName="fastapi-route"
        affectedDependencies={mockDependencies}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
