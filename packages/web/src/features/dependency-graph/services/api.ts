/**
 * Dependency Graph API
 * Real API only - Mock 제거 완료
 */

import type { GraphData, DependencyDetail, GraphFilters } from '../types';
import { apiClient } from '@/common/api';

function normalizeGraphData(data: unknown): GraphData {
  if (!data || typeof data !== 'object') {
    return { nodes: [], edges: [], cycles: [] };
  }

  const record = data as Record<string, unknown>;
  const nodes = Array.isArray(record.nodes) ? (record.nodes as GraphData['nodes']) : [];
  const edges = Array.isArray(record.edges) ? (record.edges as GraphData['edges']) : [];
  const cycles = Array.isArray(record.cycles)
    ? record.cycles
        .filter(Array.isArray)
        .map((cycle) => cycle.filter((nodeId): nodeId is string => typeof nodeId === 'string'))
    : [];

  return { nodes, edges, cycles };
}

export const api = {
  async getDependencies(filters: GraphFilters): Promise<GraphData> {
    const params = new URLSearchParams();
    if (filters.project_id) params.append('project_id', filters.project_id);
    filters.types.forEach((type) => params.append('type', type));

    const response = await apiClient<unknown>(`/api/dependencies?${params.toString()}`);
    return normalizeGraphData(response);
  },

  async getDependencyDetail(componentId: string): Promise<DependencyDetail> {
    return apiClient<DependencyDetail>(`/api/dependencies/${componentId}`);
  },
};
