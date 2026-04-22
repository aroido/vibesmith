import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import i18n from '@/i18n';
import type { TreeProjectGroup, TreeDependencyNode } from '../services/treeTransform';
import { DependencyTree } from './DependencyTree';

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

function makeTreeNode(overrides: Partial<TreeDependencyNode> = {}): TreeDependencyNode {
  return {
    id: 'node-1',
    name: 'my-skill',
    type: 'skill',
    platform: 'claude_code',
    enabled: true,
    isGlobal: false,
    isCyclic: false,
    isBroken: false,
    dependsOn: [],
    ...overrides,
  };
}

function makeProject(
  overrides: Partial<TreeProjectGroup> = {},
): TreeProjectGroup {
  return {
    projectId: 'proj-1',
    projectName: 'My Project',
    isGlobal: false,
    platformGroups: [
      {
        platform: 'claude_code',
        typeGroups: [
          {
            type: 'skill',
            nodes: [makeTreeNode()],
          },
        ],
      },
    ],
    ...overrides,
  };
}

const defaultProps = {
  selectedNodeId: null as string | null,
  onNodeSelect: vi.fn(),
};

function renderTree(
  projects: TreeProjectGroup[],
  propOverrides: Partial<typeof defaultProps> = {},
) {
  const props = { ...defaultProps, ...propOverrides };
  props.onNodeSelect = propOverrides.onNodeSelect ?? vi.fn();
  return render(
    <DependencyTree tree={projects} {...props} />,
  );
}

describe('DependencyTree', () => {
  describe('project groups', () => {
    it('renders project group names', () => {
      const projects = [
        makeProject({ projectId: 'p1', projectName: 'Alpha Project' }),
        makeProject({ projectId: 'p2', projectName: 'Beta Project' }),
      ];
      renderTree(projects);
      expect(screen.getByText('Alpha Project')).toBeInTheDocument();
      expect(screen.getByText('Beta Project')).toBeInTheDocument();
    });
  });

  describe('collapse behavior', () => {
    it('toggles project collapse on click', async () => {
      renderTree([makeProject({ projectId: 'p1' })]);

      // Initially expanded: nodes are visible
      expect(screen.getByTestId('tree-node-node-1')).toBeInTheDocument();

      // Click to collapse
      await userEvent.click(screen.getByTestId('project-toggle-p1'));
      expect(screen.queryByTestId('tree-node-node-1')).not.toBeInTheDocument();

      // Click to expand again
      await userEvent.click(screen.getByTestId('project-toggle-p1'));
      expect(screen.getByTestId('tree-node-node-1')).toBeInTheDocument();
    });
  });

  describe('global project', () => {
    it('shows Globe icon for global projects', () => {
      renderTree([makeProject({ projectId: 'gp', isGlobal: true })]);
      expect(screen.getByTestId('project-global-gp')).toBeInTheDocument();
    });

    it('does not show Globe icon for non-global projects', () => {
      renderTree([makeProject({ projectId: 'np', isGlobal: false })]);
      expect(screen.queryByTestId('project-global-np')).not.toBeInTheDocument();
    });
  });
});
