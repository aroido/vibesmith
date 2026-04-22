import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';

import type { ComponentType } from '@/common/types/component';
import type { TreeDependencyNode } from '../services/treeTransform';

export interface TreeNodeProps {
  node: TreeDependencyNode;
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string) => void;
  depth: number;
}

const typeBadgeStyles: Record<ComponentType, string> = {
  skill: 'bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)] text-[var(--color-primary)]',
  agent: 'bg-[color-mix(in_srgb,var(--color-accent)_14%,transparent)] text-[var(--color-accent)]',
  command: 'bg-[color-mix(in_srgb,var(--color-state-success)_14%,transparent)] text-theme-success',
  hook: 'bg-[color-mix(in_srgb,var(--color-state-warning)_14%,transparent)] text-theme-warning',
  rule: 'bg-[color-mix(in_srgb,var(--color-state-danger)_14%,transparent)] text-theme-danger',
};

export const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  selectedNodeId,
  onNodeSelect,
  depth,
}) => {
  const { t } = useTranslation('dependencyGraph');
  const isSelected = selectedNodeId === node.id;
  const hasChildren = node.dependsOn.length > 0 && !node.isCyclic;
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div>
      {/* Row — use div with role instead of nested interactive elements */}
      <div
        data-testid={`tree-node-${node.id}`}
        role="button"
        tabIndex={0}
        onClick={() => onNodeSelect(node.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onNodeSelect(node.id);
        }}
        className={[
          'group flex items-center w-full text-left h-8 transition-colors cursor-pointer',
          isSelected
            ? 'bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]'
            : 'hover:bg-[color-mix(in_srgb,var(--color-text-primary)_5%,transparent)]',
          node.isCyclic
            ? 'bg-[color-mix(in_srgb,var(--color-state-danger)_8%,transparent)]'
            : '',
          !node.enabled ? 'opacity-40' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ paddingLeft: depth * 20 + 8 }}
      >
        {/* Collapse toggle — separate clickable area */}
        <span
          role="button"
          tabIndex={hasChildren ? 0 : -1}
          onClick={(e) => {
            if (hasChildren) {
              e.stopPropagation();
              setCollapsed((prev) => !prev);
            }
          }}
          onKeyDown={(e) => {
            if (hasChildren && (e.key === 'Enter' || e.key === ' ')) {
              e.stopPropagation();
              setCollapsed((prev) => !prev);
            }
          }}
          className={`w-4 shrink-0 text-[10px] select-none ${hasChildren ? 'cursor-pointer text-theme-secondary hover:text-theme-primary' : 'text-transparent'}`}
        >
          {hasChildren ? (collapsed ? '►' : '▼') : '·'}
        </span>

        {/* Node name */}
        <span
          className={[
            'text-sm truncate',
            hasChildren ? 'font-medium' : '',
            isSelected ? 'text-theme-primary' : 'text-theme-secondary',
            node.isCyclic ? 'text-theme-danger' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {node.name}
        </span>

        {/* Spacer */}
        <span className="flex-1 min-w-3" />

        {/* Cyclic warning */}
        {node.isCyclic && (
          <span
            data-testid={`cyclic-warning-${node.id}`}
            className="flex items-center gap-1 text-[11px] text-theme-danger mr-2 shrink-0"
          >
            <AlertTriangle className="h-3 w-3" />
            {t('tree.circular')}
          </span>
        )}

        {/* Broken warning */}
        {node.isBroken && !node.isCyclic && (
          <span className="flex items-center gap-1 text-[11px] text-theme-warning mr-2 shrink-0">
            <AlertTriangle className="h-3 w-3" />
            {t('panel.broken')}
          </span>
        )}

        {/* Global badge */}
        {node.isGlobal && (
          <span
            data-testid={`global-icon-${node.id}`}
            className="text-[10px] text-theme-tertiary mr-1.5 shrink-0"
          >
            🌐
          </span>
        )}

        {/* Type badge - right aligned */}
        <span
          data-testid={`type-dot-${node.id}`}
          className={`text-[11px] font-medium px-1.5 py-0.5 rounded mr-2 shrink-0 ${typeBadgeStyles[node.type]}`}
        >
          {node.type}
        </span>
      </div>

      {/* Children */}
      {hasChildren && !collapsed && (
        <div>
          {node.dependsOn.map((child, index) => (
            <TreeNode
              key={`${child.id}-${index}`}
              node={child}
              selectedNodeId={selectedNodeId}
              onNodeSelect={onNodeSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};
