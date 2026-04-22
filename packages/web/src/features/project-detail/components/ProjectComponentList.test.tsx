// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { ProjectComponentList } from './ProjectComponentList';
import type { Component } from '../../../common/types';

const mockComponents: Component[] = [
  {
    id: 'comp_001',
    type: 'skill',
    name: 'alpha-skill',
    description: 'Alpha description',
    enabled: true,
    tags: ['a'],
    project_id: 'proj_001',
    project_name: 'vibesmith',
    path: '/tmp/alpha',
    created_at: '2026-02-09T10:00:00Z',
    updated_at: '2026-02-09T15:00:00Z',
  },
  {
    id: 'comp_002',
    type: 'hook',
    name: 'always-on-hook',
    description: 'Hook description',
    enabled: true,
    tags: ['h'],
    project_id: 'proj_001',
    project_name: 'vibesmith',
    path: '/tmp/hook',
    created_at: '2026-02-09T10:00:00Z',
    updated_at: '2026-02-09T15:00:00Z',
  },
];

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('ProjectComponentList', () => {
  it('renders list items as links when selection mode is disabled', () => {
    renderWithRouter(
      <ProjectComponentList components={mockComponents} />
    );

    expect(screen.getByRole('link', { name: /alpha-skill/i })).toBeInTheDocument();
  });

  it('shows bulk toolbar and triggers callbacks in selection mode', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    const onBulkDisable = vi.fn();
    const onSelectionModeToggle = vi.fn();

    renderWithRouter(
      <ProjectComponentList
        components={mockComponents}
        selectionMode={true}
        selectedComponentIds={[]}
        selectableComponentIds={['comp_001']}
        onSelectionModeToggle={onSelectionModeToggle}
        onSelectionChange={onSelectionChange}
        onSelectAll={vi.fn()}
        onClearSelection={vi.fn()}
        onBulkEnable={vi.fn()}
        onBulkDisable={onBulkDisable}
      />
    );

    expect(screen.getByTestId('project-detail-bulk-disable-button')).toBeDisabled();
    await user.click(screen.getByTestId('project-detail-select-comp_001'));
    expect(onSelectionChange).toHaveBeenCalledWith('comp_001', true);

    await user.click(screen.getByTestId('project-detail-selection-mode-toggle'));
    expect(onSelectionModeToggle).toHaveBeenCalled();
  });

  it('does not render selection checkbox for hook items in selection mode', () => {
    renderWithRouter(
      <ProjectComponentList
        components={mockComponents}
        selectionMode={true}
        selectedComponentIds={[]}
        selectableComponentIds={['comp_001']}
        onSelectionChange={vi.fn()}
      />
    );

    expect(screen.getByTestId('project-detail-select-comp_001')).toBeInTheDocument();
    expect(screen.queryByTestId('project-detail-select-comp_002')).not.toBeInTheDocument();
  });
});
