import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ComponentType } from '@/common/types/component';
import type { TreeProjectGroup } from '../services/treeTransform';
import { TreeNode } from './TreeNode';

export interface DependencyTreeProps {
  tree: TreeProjectGroup[];
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string) => void;
}

const typeBadgeStyles: Record<ComponentType, string> = {
  skill: 'bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)] text-[var(--color-primary)]',
  agent: 'bg-[color-mix(in_srgb,var(--color-accent)_14%,transparent)] text-[var(--color-accent)]',
  command: 'bg-[color-mix(in_srgb,var(--color-state-success)_14%,transparent)] text-theme-success',
  hook: 'bg-[color-mix(in_srgb,var(--color-state-warning)_14%,transparent)] text-theme-warning',
  rule: 'bg-[color-mix(in_srgb,var(--color-state-danger)_14%,transparent)] text-theme-danger',
};

const PLATFORM_LABELS: Record<string, string> = {
  claude_code: 'Claude Code',
  cursor: 'Cursor',
};

export const DependencyTree: React.FC<DependencyTreeProps> = ({
  tree,
  selectedNodeId,
  onNodeSelect,
}) => {
  const { t } = useTranslation('dependencyGraph');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    () => new Set(),
  );

  const toggle = useCallback((key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const countNodes = (group: TreeProjectGroup): number =>
    group.platformGroups.reduce(
      (sum, pg) => sum + pg.typeGroups.reduce((s, tg) => s + tg.nodes.length, 0),
      0,
    );

  return (
    <div className="vs-frost-panel rounded-xl overflow-hidden divide-y divide-theme">
      {tree.map((project) => {
        const projectKey = project.projectId;
        const isProjectCollapsed = collapsedSections.has(projectKey);

        return (
          <div key={project.projectId}>
            {/* Project Header Row */}
            <button
              data-testid={`project-toggle-${project.projectId}`}
              type="button"
              onClick={() => toggle(projectKey)}
              className="flex items-center w-full text-left h-10 px-3 hover:bg-[color-mix(in_srgb,var(--color-text-primary)_5%,transparent)] transition-colors"
            >
              <span className="w-4 shrink-0 text-theme-tertiary text-[10px] select-none">
                {isProjectCollapsed ? '►' : '▼'}
              </span>
              {project.isGlobal && (
                <span
                  data-testid={`project-global-${project.projectId}`}
                  className="text-xs mr-1.5"
                >
                  🌐
                </span>
              )}
              <span className="font-semibold text-sm text-theme-primary truncate">
                {project.projectName}
              </span>
              <span className="flex-1" />
              <span className="text-[11px] text-theme-tertiary mr-2">
                {countNodes(project)}
              </span>
            </button>

            {/* Platform Groups */}
            {!isProjectCollapsed &&
              project.platformGroups.map((platformGroup) => {
                const platformKey = `${project.projectId}:${platformGroup.platform}`;
                const isPlatformCollapsed = collapsedSections.has(platformKey);
                const platformNodeCount = platformGroup.typeGroups.reduce(
                  (s, tg) => s + tg.nodes.length,
                  0,
                );

                return (
                  <div key={platformGroup.platform}>
                    {/* Platform Header Row */}
                    <button
                      data-testid={`platform-toggle-${platformKey}`}
                      type="button"
                      onClick={() => toggle(platformKey)}
                      className="flex items-center w-full text-left h-8 hover:bg-[color-mix(in_srgb,var(--color-text-primary)_5%,transparent)] transition-colors"
                      style={{ paddingLeft: 28 }}
                    >
                      <span className="w-4 shrink-0 text-theme-tertiary text-[10px] select-none">
                        {isPlatformCollapsed ? '►' : '▼'}
                      </span>
                      <span className="text-[11px] font-medium text-theme-secondary">
                        {PLATFORM_LABELS[platformGroup.platform] ?? platformGroup.platform}
                      </span>
                      <span className="flex-1" />
                      <span className="text-[11px] text-theme-tertiary mr-2">
                        {platformNodeCount}
                      </span>
                    </button>

                    {/* Type Groups */}
                    {!isPlatformCollapsed &&
                      platformGroup.typeGroups.map((typeGroup) => {
                        const typeKey = `${platformKey}:${typeGroup.type}`;
                        const isTypeCollapsed = collapsedSections.has(typeKey);

                        return (
                          <div key={typeGroup.type}>
                            {/* Type Header Row */}
                            <button
                              data-testid={`type-toggle-${typeKey}`}
                              type="button"
                              onClick={() => toggle(typeKey)}
                              className="flex items-center w-full text-left h-8 hover:bg-[color-mix(in_srgb,var(--color-text-primary)_5%,transparent)] transition-colors"
                              style={{ paddingLeft: 48 }}
                            >
                              <span className="w-4 shrink-0 text-theme-tertiary text-[10px] select-none">
                                {isTypeCollapsed ? '►' : '▼'}
                              </span>
                              <span
                                className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${typeBadgeStyles[typeGroup.type]}`}
                              >
                                {t(`legend.${typeGroup.type}`)}
                              </span>
                              <span className="flex-1" />
                              <span className="text-[11px] text-theme-tertiary mr-2">
                                {typeGroup.nodes.length}
                              </span>
                            </button>

                            {/* Nodes */}
                            {!isTypeCollapsed &&
                              typeGroup.nodes.map((node) => (
                                <TreeNode
                                  key={node.id}
                                  node={node}
                                  selectedNodeId={selectedNodeId}
                                  onNodeSelect={onNodeSelect}
                                  depth={3}
                                />
                              ))}
                          </div>
                        );
                      })}
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
};
