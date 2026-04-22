/**
 * Visual tree diagram — horizontal left-to-right tree with connecting lines.
 * Renders the same TreeProjectGroup data as a graphical tree.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';

import type { ComponentType } from '@/common/types/component';
import type {
  TreeProjectGroup,
  TreeDependencyNode,
} from '../services/treeTransform';

/* ── colour tokens ─────────────────────────────────────────── */

const typeBadgeStyles: Record<ComponentType, string> = {
  skill: 'bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)] text-[var(--color-primary)]',
  agent: 'bg-[color-mix(in_srgb,var(--color-accent)_14%,transparent)] text-[var(--color-accent)]',
  command: 'bg-[color-mix(in_srgb,var(--color-state-success)_14%,transparent)] text-theme-success',
  hook: 'bg-[color-mix(in_srgb,var(--color-state-warning)_14%,transparent)] text-theme-warning',
  rule: 'bg-[color-mix(in_srgb,var(--color-state-danger)_14%,transparent)] text-theme-danger',
};

const LINE_COLOR = 'var(--color-border-default)';

/* ── tiny node card ────────────────────────────────────────── */

interface DiagramNodeProps {
  node: TreeDependencyNode;
  selectedNodeId: string | null;
  onNodeSelect: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const DiagramNode: React.FC<DiagramNodeProps> = ({
  node,
  selectedNodeId,
  onNodeSelect,
  collapsed,
  onToggleCollapse,
}) => {
  const isSelected = selectedNodeId === node.id;
  const hasChildren = node.dependsOn.length > 0 && !node.isCyclic;

  return (
    <div
      data-diagram-node-id={node.id}
      data-testid={`diagram-node-${node.id}`}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onNodeSelect(node.id);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onNodeSelect(node.id);
      }}
      className={[
        'inline-flex items-center gap-1.5 whitespace-nowrap',
        'rounded border px-2 py-1 text-[11px] leading-tight',
        'transition-all cursor-pointer select-none shrink-0',
        node.isCyclic
          ? 'border-[var(--color-state-danger)] bg-[color-mix(in_srgb,var(--color-state-danger)_15%,var(--color-bg-canvas))]'
          : isSelected
            ? 'border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_15%,var(--color-bg-canvas))] shadow-sm'
            : 'border-[var(--color-border-default)] bg-theme-elevated hover:border-[var(--color-primary)]',
        !node.enabled ? 'opacity-40' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className={node.isCyclic ? 'text-theme-danger font-medium' : 'text-theme-primary'}>
        {node.name}
      </span>
      <span className={`text-[10px] px-1 rounded ${typeBadgeStyles[node.type]}`}>
        {node.type}
      </span>
      {node.isGlobal && <span className="text-[10px]">🌐</span>}
      {node.isCyclic && <span className="text-[10px]">⚠</span>}
      {node.isBroken && !node.isCyclic && <span className="text-[10px] text-theme-warning">⚠</span>}
      {hasChildren && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              onToggleCollapse();
            }
          }}
          className="text-theme-tertiary hover:text-theme-primary cursor-pointer px-0.5"
        >
          {collapsed ? '►' : '▼'}
        </span>
      )}
    </div>
  );
};

/* ── SVG connector lines ───────────────────────────────────── */

/**
 * Draws right-angle connector lines from a parent node to its children.
 * Uses a ref-based approach: after render, measure DOM positions and draw SVG.
 */
interface ConnectorLinesProps {
  parentRef: React.RefObject<HTMLDivElement | null>;
  childRefs: React.RefObject<(HTMLDivElement | null)[]>;
}

const ConnectorLines: React.FC<ConnectorLinesProps> = ({ parentRef, childRefs }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [paths, setPaths] = useState<string[]>([]);

  // Measure after every render, but only update state when paths actually change
  // (value comparison prevents infinite re-render loops)
  useEffect(() => {
    const svg = svgRef.current;
    const parent = parentRef.current;
    const children = childRefs.current;
    if (!svg || !parent || !children) return;

    const container = svg.parentElement;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();

    const parentRect = parent.getBoundingClientRect();
    const px = parentRect.right - containerRect.left;
    const py = parentRect.top + parentRect.height / 2 - containerRect.top;

    const midX = px + 12; // horizontal arm length

    const newPaths: string[] = [];
    for (const child of children) {
      if (!child) continue;
      const nodeEl = child.querySelector('[data-diagram-node-id]') ?? child;
      const childRect = nodeEl.getBoundingClientRect();
      const cx = childRect.left - containerRect.left;
      const cy = childRect.top + childRect.height / 2 - containerRect.top;

      newPaths.push(`M${px},${py} L${midX},${py} L${midX},${cy} L${cx},${cy}`);
    }

    const joined = newPaths.join('|');
    setPaths((prev) => (prev.join('|') === joined ? prev : newPaths));
  });

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%', overflow: 'visible' }}
    >
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={LINE_COLOR}
          strokeWidth={1}
        />
      ))}
    </svg>
  );
};

/* ── recursive subtree (horizontal flow) ───────────────────── */

interface SubtreeProps {
  node: TreeDependencyNode;
  selectedNodeId: string | null;
  onNodeSelect: (id: string) => void;
}

const Subtree: React.FC<SubtreeProps> = ({ node, selectedNodeId, onNodeSelect }) => {
  const hasChildren = node.dependsOn.length > 0 && !node.isCyclic;
  const [collapsed, setCollapsed] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);
  const childRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Reset child refs array length
  useEffect(() => {
    childRefs.current = childRefs.current.slice(0, node.dependsOn.length);
  }, [node.dependsOn.length]);

  return (
    <div className="relative flex items-start">
      {/* This node */}
      <div ref={parentRef} className="shrink-0 py-[3px]">
        <DiagramNode
          node={node}
          selectedNodeId={selectedNodeId}
          onNodeSelect={onNodeSelect}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((prev) => !prev)}
        />
      </div>

      {/* Connector lines + children */}
      {hasChildren && !collapsed && (
        <div className="relative flex items-start ml-0">
          {/* SVG overlay for connector lines */}
          <ConnectorLines parentRef={parentRef} childRefs={childRefs} />

          {/* Spacer for the connector arm */}
          <div className="w-8 shrink-0" />

          {/* Children column */}
          <div className="flex flex-col">
            {node.dependsOn.map((child, index) => (
              <div
                key={`${child.id}-${index}`}
                ref={(el) => { childRefs.current[index] = el; }}
              >
                <Subtree
                  node={child}
                  selectedNodeId={selectedNodeId}
                  onNodeSelect={onNodeSelect}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ── platform labels ───────────────────────────────────────── */

const PLATFORM_LABELS: Record<string, string> = {
  claude_code: 'Claude Code',
  cursor: 'Cursor',
};

/* ── root-level tree for a project ─────────────────────────── */

interface ProjectSubtreeProps {
  project: TreeProjectGroup;
  selectedNodeId: string | null;
  onNodeSelect: (id: string) => void;
}

const ProjectSubtree: React.FC<ProjectSubtreeProps> = ({
  project,
  selectedNodeId,
  onNodeSelect,
}) => {
  return (
    <div className="mb-6">
      {/* Project label */}
      <div className="flex items-center gap-1.5 mb-3">
        {project.isGlobal && <span className="text-xs">🌐</span>}
        <span className="text-xs font-semibold text-theme-secondary uppercase tracking-wider">
          {project.projectName}
        </span>
      </div>

      {/* Platform groups */}
      {project.platformGroups.map((pg) => (
        <div key={pg.platform} className="mb-4">
          <div className="mb-2">
            <span className="text-[11px] font-medium text-theme-tertiary">
              {PLATFORM_LABELS[pg.platform] ?? pg.platform}
            </span>
          </div>
          <div className="flex flex-col gap-1 ml-2">
            {pg.typeGroups.flatMap((tg) =>
              tg.nodes.map((node) => (
                <Subtree
                  key={node.id}
                  node={node}
                  selectedNodeId={selectedNodeId}
                  onNodeSelect={onNodeSelect}
                />
              )),
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

/* ── main diagram container ────────────────────────────────── */

export interface TreeDiagramProps {
  tree: TreeProjectGroup[];
  selectedNodeId: string | null;
  onNodeSelect: (id: string) => void;
}

export const TreeDiagram: React.FC<TreeDiagramProps> = ({
  tree,
  selectedNodeId,
  onNodeSelect,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const panStart = useRef({ x: 0, y: 0, scrollX: 0, scrollY: 0 });
  const [cursorStyle, setCursorStyle] = useState<'grab' | 'grabbing'>('grab');

  // Scroll to selected node
  useEffect(() => {
    if (!selectedNodeId || !containerRef.current) return;
    const el = containerRef.current.querySelector(
      `[data-diagram-node-id="${selectedNodeId}"]`,
    );
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  }, [selectedNodeId]);

  // Drag-to-pan with refs to avoid stale closure
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    isPanningRef.current = true;
    setCursorStyle('grabbing');
    const el = containerRef.current!;
    panStart.current = {
      x: e.clientX,
      y: e.clientY,
      scrollX: el.scrollLeft,
      scrollY: el.scrollTop,
    };
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isPanningRef.current || !containerRef.current) return;
      containerRef.current.scrollLeft =
        panStart.current.scrollX - (e.clientX - panStart.current.x);
      containerRef.current.scrollTop =
        panStart.current.scrollY - (e.clientY - panStart.current.y);
    };

    const onMouseUp = () => {
      isPanningRef.current = false;
      setCursorStyle('grab');
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseDown={onMouseDown}
      className="overflow-auto rounded-xl border border-theme bg-[color-mix(in_srgb,var(--color-bg-canvas)_80%,var(--color-bg-elevated))]"
      style={{ height: '100%', minHeight: 400, cursor: cursorStyle }}
    >
      <div className="p-6 min-w-max">
        {tree.map((project) => (
          <ProjectSubtree
            key={project.projectId}
            project={project}
            selectedNodeId={selectedNodeId}
            onNodeSelect={onNodeSelect}
          />
        ))}
      </div>
    </div>
  );
};
