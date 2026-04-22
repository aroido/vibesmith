import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import i18n from '@/i18n';
import type { TreeDependencyNode } from '../services/treeTransform';
import { TreeNode } from './TreeNode';

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

function makeNode(overrides: Partial<TreeDependencyNode> = {}): TreeDependencyNode {
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

const defaultProps = {
  selectedNodeId: null as string | null,
  onNodeSelect: vi.fn(),
  depth: 0,
};

function renderNode(
  nodeOverrides: Partial<TreeDependencyNode> = {},
  propOverrides: Partial<typeof defaultProps> = {},
) {
  const node = makeNode(nodeOverrides);
  const props = { ...defaultProps, ...propOverrides };
  props.onNodeSelect = propOverrides.onNodeSelect ?? vi.fn();
  return render(
    <TreeNode node={node} {...props} />,
  );
}

describe('TreeNode', () => {
  describe('basic rendering', () => {
    it('renders the node name', () => {
      renderNode({ name: 'hello-skill' });
      expect(screen.getByText('hello-skill')).toBeInTheDocument();
    });

    it('renders the type badge text', () => {
      renderNode({ type: 'agent' });
      expect(screen.getByTestId('type-dot-node-1')).toHaveTextContent('agent');
    });

    it('renders the type-colored dot with data-testid', () => {
      renderNode({ id: 'abc' });
      const dot = screen.getByTestId('type-dot-abc');
      expect(dot).toBeInTheDocument();
    });

    it('renders the node button with data-testid', () => {
      renderNode({ id: 'xyz' });
      expect(screen.getByTestId('tree-node-xyz')).toBeInTheDocument();
    });
  });

  describe('node selection', () => {
    it('calls onNodeSelect when clicked', async () => {
      const onNodeSelect = vi.fn();
      renderNode({ id: 'click-me' }, { onNodeSelect });
      await userEvent.click(screen.getByTestId('tree-node-click-me'));
      expect(onNodeSelect).toHaveBeenCalledWith('click-me');
    });

    it('applies selected background class when selected', () => {
      renderNode({ id: 'sel' }, { selectedNodeId: 'sel' });
      const btn = screen.getByTestId('tree-node-sel');
      expect(btn.className).toContain(
        'bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]',
      );
    });

    it('does not apply selected background class when not selected', () => {
      renderNode({ id: 'sel' }, { selectedNodeId: 'other' });
      const btn = screen.getByTestId('tree-node-sel');
      expect(btn.className).not.toContain(
        'bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]',
      );
    });
  });

  describe('global icon', () => {
    it('shows globe icon for global nodes', () => {
      renderNode({ id: 'g1', isGlobal: true });
      expect(screen.getByTestId('global-icon-g1')).toBeInTheDocument();
    });

    it('does not show globe icon for non-global nodes', () => {
      renderNode({ id: 'g2', isGlobal: false });
      expect(screen.queryByTestId('global-icon-g2')).not.toBeInTheDocument();
    });
  });

  describe('cyclic warning', () => {
    it('shows cyclic warning with danger styling', () => {
      renderNode({ id: 'cyc', isCyclic: true });
      const warning = screen.getByTestId('cyclic-warning-cyc');
      expect(warning).toBeInTheDocument();
      expect(screen.getByText('Circular ref')).toBeInTheDocument();
    });

    it('applies danger background for cyclic nodes', () => {
      renderNode({ id: 'cyc', isCyclic: true });
      const btn = screen.getByTestId('tree-node-cyc');
      expect(btn.className).toContain(
        'bg-[color-mix(in_srgb,var(--color-state-danger)_8%,transparent)]',
      );
    });

    it('does not show cyclic warning for non-cyclic nodes', () => {
      renderNode({ id: 'ok' });
      expect(screen.queryByTestId('cyclic-warning-ok')).not.toBeInTheDocument();
    });
  });

  describe('broken warning', () => {
    it('shows broken warning text with warning styling', () => {
      renderNode({ id: 'brk', isBroken: true });
      const warning = screen.getByText('Broken');
      expect(warning).toBeInTheDocument();
      expect(warning.closest('span')?.className).toContain('text-theme-warning');
    });

    it('does not show broken text when also cyclic (cyclic takes priority)', () => {
      renderNode({ id: 'both', isBroken: true, isCyclic: true });
      // Cyclic warning shown, broken text not shown
      expect(screen.getByText('Circular ref')).toBeInTheDocument();
      expect(screen.queryByText('Broken')).not.toBeInTheDocument();
    });
  });

  describe('disabled state', () => {
    it('applies opacity-40 when disabled', () => {
      renderNode({ id: 'dis', enabled: false });
      const btn = screen.getByTestId('tree-node-dis');
      expect(btn.className).toContain('opacity-40');
    });

    it('does not apply opacity-40 when enabled', () => {
      renderNode({ id: 'en', enabled: true });
      const btn = screen.getByTestId('tree-node-en');
      expect(btn.className).not.toContain('opacity-40');
    });
  });

  describe('recursive children', () => {
    it('renders children nodes', () => {
      const child = makeNode({ id: 'child-1', name: 'child-skill' });
      renderNode({ id: 'parent', dependsOn: [child] });
      expect(screen.getByText('child-skill')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-child-1')).toBeInTheDocument();
    });

    it('renders nested children', () => {
      const grandchild = makeNode({ id: 'gc', name: 'grandchild' });
      const child = makeNode({ id: 'c', name: 'child', dependsOn: [grandchild] });
      renderNode({ id: 'p', dependsOn: [child] });
      expect(screen.getByText('grandchild')).toBeInTheDocument();
    });

    it('does not render children container when no dependsOn', () => {
      const { container } = renderNode({ dependsOn: [] });
      expect(container.querySelector('.border-l')).not.toBeInTheDocument();
    });
  });
});
