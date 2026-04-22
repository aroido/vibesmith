/**
 * ProjectSelector unit tests
 * Dropdown rendering, selection change, loading state (spec Appendix B)
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { axe } from 'jest-axe';
import i18n from 'i18next';
import { ProjectSelector } from './ProjectSelector';
import type { Project } from '@/common/types';

const mockProjects: Project[] = [
  {
    id: 'proj_global',
    name: 'global',
    path: '/Users/user/.claude',
    is_global: true,
    component_count: 5,
    last_scanned_at: '2026-02-13T09:00:00Z',
    dir_exists: true,
    has_claude_dir: false,
  },
  {
    id: 'proj_abc123',
    name: 'vibesmith',
    path: '/Users/user/Projects/vibesmith',
    is_global: false,
    component_count: 12,
    last_scanned_at: '2026-02-13T09:00:00Z',
    dir_exists: true,
    has_claude_dir: true,
  },
];

describe('ProjectSelector', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ko');
  });

  it('should render project dropdown with projects', () => {
    const onProjectChange = vi.fn();
    render(
      <ProjectSelector
        selectedProjectId=""
        projects={mockProjects}
        onProjectChange={onProjectChange}
      />
    );

    const projectSelectAria = i18n.t('components:create.projectSelectAria');
    expect(screen.getByLabelText(projectSelectAria)).toBeInTheDocument();
    expect(screen.getByText(/global\s*\([^)]+\)/)).toBeInTheDocument();
    expect(screen.getByText(/vibesmith/)).toBeInTheDocument();
  });

  it('should call onProjectChange when selection changes', async () => {
    const user = userEvent.setup();
    const onProjectChange = vi.fn();
    render(
      <ProjectSelector
        selectedProjectId="proj_global"
        projects={mockProjects}
        onProjectChange={onProjectChange}
      />
    );

    const projectSelectAria = i18n.t('components:create.projectSelectAria');
    const select = screen.getByLabelText(projectSelectAria);
    await user.selectOptions(select, 'proj_abc123');

    expect(onProjectChange).toHaveBeenCalledWith('proj_abc123');
  });

  it('should show Loading... when isLoading', () => {
    render(
      <ProjectSelector
        selectedProjectId=""
        projects={[]}
        isLoading={true}
        onProjectChange={vi.fn()}
      />
    );

    const projectSelectAria = i18n.t('components:create.projectSelectAria');
    const select = screen.getByLabelText(projectSelectAria);
    expect(select).toBeDisabled();
    const loadingLabel = i18n.t('components:create.loading');
    expect(screen.getByRole('option', { name: loadingLabel })).toBeInTheDocument();
  });

  it('should show empty option when no project selected', () => {
    render(
      <ProjectSelector
        selectedProjectId=""
        projects={mockProjects}
        onProjectChange={vi.fn()}
      />
    );

    const projectSelectAria = i18n.t('components:create.projectSelectAria');
    const select = screen.getByLabelText(projectSelectAria);
    expect(select).toHaveValue('');
  });

  it('should have no accessibility violations', async () => {
    const { container } = render(
      <ProjectSelector
        selectedProjectId="proj_global"
        projects={mockProjects}
        onProjectChange={vi.fn()}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
