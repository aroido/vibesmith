import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DependencyTree } from './DependencyTree';
import { TreeDiagram } from './TreeDiagram';
import { TreeFilters } from './TreeFilters';
import type { PlatformFilter } from './TreeFilters';
import { NodeDetailPanel } from './NodeDetailPanel';
import { useDependencyGraph } from '../hooks/useDependencyGraph';
import { buildDependencyTree } from '../services/treeTransform';
import type { ComponentType, GraphData, GraphFilters as GraphFiltersType } from '../types';
import { ComponentWorkspaceTabs, PageFrame } from '@/components/common';
import { getProjects } from '@/common/api';
import { showErrorToast, getUserFriendlyError } from '@/common/utils/error-handler';

const ALL_TYPES: ComponentType[] = ['skill', 'agent', 'command', 'hook', 'rule'];

export const DependencyTreePage: React.FC = () => {
  const { t } = useTranslation('dependencyGraph');
  const { t: tCommon } = useTranslation('common');
  const [searchParams] = useSearchParams();

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    searchParams.get('project'),
  );
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hideDisabled, setHideDisabled] = useState(false);
  const [riskOnly, setRiskOnly] = useState(false);

  const filters: GraphFiltersType = {
    project_id: null,
    types: ALL_TYPES,
    includeGlobal: true,
  };

  const { data, isLoading, error, refetch } = useDependencyGraph(filters);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
    staleTime: 5 * 60 * 1000,
  });

  const projectNameById = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects],
  );

  const globalProjectIds = useMemo(
    () => new Set(projects.filter((p) => p.is_global).map((p) => p.id)),
    [projects],
  );

  const projectOptions = useMemo(
    () =>
      projects.map((p) => ({
        id: p.id,
        name: p.name,
        isGlobal: p.is_global,
      })),
    [projects],
  );

  useEffect(() => {
    if (error) {
      showErrorToast(error);
    }
  }, [error]);

  // Risk node ids: nodes in cycles + nodes connected to broken edges
  const riskNodeIds = useMemo(() => {
    if (!data) return new Set<string>();
    const ids = new Set<string>();
    for (const cycle of data.cycles) {
      for (const nodeId of cycle) ids.add(nodeId);
    }
    for (const edge of data.edges) {
      if (edge.is_broken) {
        ids.add(edge.source);
        ids.add(edge.target);
      }
    }
    return ids;
  }, [data]);

  // Filtered graph data
  const filteredData = useMemo((): GraphData | null => {
    if (!data) return null;

    const normalizedQuery = searchQuery.trim().toLowerCase();

    const filteredNodes = data.nodes.filter((node) => {
      if (selectedProjectId && node.project_id !== selectedProjectId) return false;
      if (selectedPlatform !== 'all' && node.platform !== selectedPlatform) return false;
      if (hideDisabled && !node.enabled) return false;
      if (riskOnly && !riskNodeIds.has(node.id)) return false;
      if (normalizedQuery.length > 0) {
        return (
          node.name.toLowerCase().includes(normalizedQuery) ||
          node.id.toLowerCase().includes(normalizedQuery)
        );
      }
      return true;
    });

    const visibleIds = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = data.edges.filter(
      (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
    );
    const filteredCycles = data.cycles.filter((cycle) =>
      cycle.every((nodeId) => visibleIds.has(nodeId)),
    );

    return {
      nodes: filteredNodes,
      edges: filteredEdges,
      cycles: filteredCycles,
    };
  }, [data, selectedProjectId, selectedPlatform, searchQuery, hideDisabled, riskOnly, riskNodeIds]);

  // Build tree from filtered data
  const tree = useMemo(() => {
    if (!filteredData) return [];
    return buildDependencyTree(filteredData, globalProjectIds, projectNameById);
  }, [filteredData, globalProjectIds, projectNameById]);

  // Counts for badges
  const cycleCount = filteredData?.cycles.length ?? 0;
  const brokenCount = filteredData?.edges.filter((e) => e.is_broken).length ?? 0;

  const handleNodeSelect = (nodeId: string) => {
    setSelectedNode(nodeId);
  };

  const handleResetFilters = () => {
    setSelectedProjectId(null);
    setSelectedPlatform('all');
    setSearchQuery('');
    setHideDisabled(false);
    setRiskOnly(false);
  };

  const renderInFrame = (content: React.ReactNode) => (
    <PageFrame
      activeNav="components"
      title={t('pageTitle')}
      contentClassName="max-w-[96rem] mx-auto"
    >
      <div className="space-y-4">
        <ComponentWorkspaceTabs active="dependencies" />
        {content}
      </div>
    </PageFrame>
  );

  // Loading state
  if (isLoading) {
    return renderInFrame(
      <div className="vs-frost-panel flex h-96 items-center justify-center rounded-2xl p-8">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--color-primary)]" />
          <p className="text-theme-secondary">{t('loading')}</p>
        </div>
      </div>,
    );
  }

  // Error state
  if (error) {
    const friendlyError = getUserFriendlyError(error);
    return renderInFrame(
      <section className="vs-frost-panel rounded-2xl p-4 md:p-5">
        <div
          className="alert-theme-danger rounded-lg p-6 text-center"
          role="alert"
          aria-live="assertive"
        >
          <p className="mb-2 font-medium text-theme-danger">{t('loadError')}</p>
          <p className="text-sm text-theme-secondary">{friendlyError.message}</p>
          <button
            onClick={() => {
              void refetch();
            }}
            className="mt-4 rounded-md px-4 py-2 btn-theme-danger-soft"
          >
            {tCommon('retry')}
          </button>
        </div>
      </section>,
    );
  }

  if (!data) return null;

  // Empty state: no data at all
  if (data.nodes.length === 0) {
    return renderInFrame(
      <>
        <TreeFilters
          projects={projectOptions}
          selectedProjectId={selectedProjectId}
          onProjectChange={setSelectedProjectId}
          selectedPlatform={selectedPlatform}
          onPlatformChange={setSelectedPlatform}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          hideDisabled={hideDisabled}
          onHideDisabledChange={setHideDisabled}
          riskOnly={riskOnly}
          onRiskOnlyChange={setRiskOnly}
          cycleCount={cycleCount}
          brokenCount={brokenCount}
        />
        <div className="mt-6 vs-frost-panel rounded-2xl p-12 text-center">
          <p className="mb-4 text-theme-secondary">{t('noComponents')}</p>
          <p className="mb-6 text-sm text-theme-secondary">
            {t('noComponentsHint')}
          </p>
          <Link
            to="/components/create"
            className="inline-block rounded-md px-4 py-2 btn-theme-primary-soft"
          >
            {tCommon('createComponent')}
          </Link>
        </div>
      </>,
    );
  }

  // Empty state: filters removed everything
  if (filteredData && filteredData.nodes.length === 0) {
    return renderInFrame(
      <>
        <TreeFilters
          projects={projectOptions}
          selectedProjectId={selectedProjectId}
          onProjectChange={setSelectedProjectId}
          selectedPlatform={selectedPlatform}
          onPlatformChange={setSelectedPlatform}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          hideDisabled={hideDisabled}
          onHideDisabledChange={setHideDisabled}
          riskOnly={riskOnly}
          onRiskOnlyChange={setRiskOnly}
          cycleCount={cycleCount}
          brokenCount={brokenCount}
        />
        <div className="mt-4 flex h-96 items-center justify-center rounded-2xl p-8 vs-frost-panel">
          <p className="text-theme-primary">{t('noNodesMatchFilters')}</p>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleResetFilters}
            className="rounded-md px-4 py-2 btn-theme-primary-soft"
          >
            {t('resetFilters')}
          </button>
        </div>
      </>,
    );
  }

  // Normal render — split view: tree list (left) + diagram (right)
  return renderInFrame(
    <>
      <TreeFilters
          projects={projectOptions}
          selectedProjectId={selectedProjectId}
          onProjectChange={setSelectedProjectId}
          selectedPlatform={selectedPlatform}
          onPlatformChange={setSelectedPlatform}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          hideDisabled={hideDisabled}
          onHideDisabledChange={setHideDisabled}
          riskOnly={riskOnly}
          onRiskOnlyChange={setRiskOnly}
          cycleCount={cycleCount}
          brokenCount={brokenCount}
        />
      {/* Split View */}
      <div className="flex gap-4" style={{ height: 'calc(100vh - 6.5rem)' }}>
        {/* Left: Tree List */}
        <div className="w-[340px] shrink-0 overflow-y-auto">
          <DependencyTree
            tree={tree}
            selectedNodeId={selectedNode}
            onNodeSelect={handleNodeSelect}
          />
        </div>

        {/* Right: Visual Tree Diagram */}
        <div className="flex-1 min-w-0">
          <TreeDiagram
            tree={tree}
            selectedNodeId={selectedNode}
            onNodeSelect={handleNodeSelect}
          />
        </div>

        {/* Node Detail Panel */}
        {selectedNode && (
          <div className="w-[340px] shrink-0">
            <NodeDetailPanel
              nodeId={selectedNode}
              onClose={() => setSelectedNode(null)}
              onNodeSelect={handleNodeSelect}
            />
          </div>
        )}
      </div>
    </>,
  );
};
