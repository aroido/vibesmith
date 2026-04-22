/**
 * Dashboard API types and transform functions
 * API 응답(snake_case) ↔ 클라이언트 타입(camelCase)
 * Based on: docs/03_API_SPEC.md §4, §2.1, §1.1
 */

import type {
  DashboardStats,
  SystemStatus,
  Component,
  Trend,
  ComponentType,
  UsageSummary,
  UsageScanResult,
  UsageResetResult,
  UsageComponentType,
} from './index';

// ── API 응답 타입 (snake_case) ─────────────────────────────────────────────

/** GET /api/stats 응답 */
export interface ApiStatsResponse {
  total_skills: number;
  total_agents: number;
  total_commands: number;
  total_hooks: number;
  total_rules: number;
  active_count: number;
  inactive_count: number;
  total_count: number;
  trends: {
    skills: ApiTrendResponse;
    agents: ApiTrendResponse;
    commands: ApiTrendResponse;
    hooks: ApiTrendResponse;
    rules: ApiTrendResponse;
  };
}

export interface ApiTrendResponse {
  value: number;
  percentage: number;
  direction: 'up' | 'down' | 'neutral';
}

/** GET /api/system/status 응답 */
export interface ApiSystemStatusResponse {
  is_live: boolean;
  last_scan_at: string;
  active_workers: {
    watcher: boolean;
    usage_scanner: boolean;
  };
  health_score: number;
}

/** GET /api/components 항목 (docs 03_API_SPEC §2.1) */
export interface ApiComponentResponse {
  id: string;
  type: string;
  name: string;
  description?: string | null;
  enabled: boolean;
  tags?: string[] | null;
  project_id?: string | null;
  project_name?: string | null;
  platform?: string | null;
  path: string;
  created_at: string;
  updated_at: string;
}

/** GET /api/projects 항목 (docs 03_API_SPEC §1.1) */
export interface ApiProjectResponse {
  id: string;
  name: string;
  path: string;
  is_global: boolean;
  component_count: number;
  last_scanned_at: string;
  dir_exists: boolean;
  has_claude_dir: boolean;
  hidden_at: string | null;
}

/** GET /api/usage 응답 */
export interface ApiUsageResponse {
  ranking: ApiUsageRankingItem[];
  unused: ApiUsageUnusedItem[];
  total_sessions_parsed: number;
  last_parsed_at: string | null;
}

export interface ApiUsageRankingItem {
  component_id: string | null;
  component_name: string;
  component_type: UsageComponentType;
  use_count: number;
  time_qualified_count?: number;
  count_only_count?: number;
}

export interface ApiUsageUnusedItem {
  component_name: string;
  component_type: UsageComponentType;
  created_at: string;
}

/** POST /api/usage/scan 응답 */
export interface ApiUsageScanResponse {
  sessions_parsed: number;
  stats_saved: number;
}

/** POST /api/usage/reset 응답 */
export interface ApiUsageResetResponse {
  deleted_sessions: number;
  deleted_parse_states: number;
  preserved_sessions: number;
  preserved_parse_states: number;
}

// ── 변환 함수 ────────────────────────────────────────────────────────────────

/** ApiStatsResponse → DashboardStats */
export function transformStats(data: ApiStatsResponse): DashboardStats {
  return {
    totalSkills: data.total_skills,
    totalAgents: data.total_agents,
    totalCommands: data.total_commands,
    totalHooks: data.total_hooks,
    totalRules: data.total_rules,
    activeCount: data.active_count,
    inactiveCount: data.inactive_count,
    totalCount: data.total_count,
    trends: {
      skills: transformTrend(data.trends.skills),
      agents: transformTrend(data.trends.agents),
      commands: transformTrend(data.trends.commands),
      hooks: transformTrend(data.trends.hooks),
      rules: transformTrend(data.trends.rules),
    },
  };
}

function transformTrend(t: ApiTrendResponse): Trend {
  return {
    value: t.value,
    percentage: t.percentage,
    direction: t.direction,
  };
}

/** ApiSystemStatusResponse → SystemStatus */
export function transformSystemStatus(
  data: ApiSystemStatusResponse
): SystemStatus {
  return {
    isLive: data.is_live,
    lastScanAt: new Date(data.last_scan_at),
    activeWorkers: {
      watcher: data.active_workers.watcher,
      usageScanner: data.active_workers.usage_scanner,
    },
    healthScore: data.health_score,
  };
}

/** ApiComponentResponse → Component */
export function transformComponent(data: ApiComponentResponse): Component {
  return {
    id: data.id,
    name: data.name,
    type: data.type as ComponentType,
    scope: data.project_name === 'global' || !data.project_id ? 'global' : 'project',
    projectName: data.project_name ?? undefined,
    projectId: data.project_id ?? undefined,
    isActive: data.enabled,
    lastUsed: new Date(data.updated_at),
    path: data.path,
    description: data.description ?? undefined,
    tags: data.tags ?? undefined,
  };
}

/** ApiUsageResponse → UsageSummary */
export function transformUsage(data: ApiUsageResponse): UsageSummary {
  return {
    ranking: data.ranking.map((item) => ({
      componentId: item.component_id,
      componentName: item.component_name,
      componentType: item.component_type,
      useCount: item.use_count,
      timeQualifiedCount:
        typeof item.time_qualified_count === 'number'
          ? item.time_qualified_count
          : undefined,
      countOnlyCount:
        typeof item.count_only_count === 'number'
          ? item.count_only_count
          : undefined,
    })),
    unused: data.unused.map((item) => ({
      componentName: item.component_name,
      componentType: item.component_type,
      createdAt: new Date(item.created_at),
    })),
    totalSessionsParsed: data.total_sessions_parsed,
    lastParsedAt: data.last_parsed_at ? new Date(data.last_parsed_at) : null,
  };
}

/** ApiUsageScanResponse → UsageScanResult */
export function transformUsageScan(data: ApiUsageScanResponse): UsageScanResult {
  return {
    sessionsParsed: data.sessions_parsed,
    statsSaved: data.stats_saved,
  };
}

/** ApiUsageResetResponse → UsageResetResult */
export function transformUsageReset(data: ApiUsageResetResponse): UsageResetResult {
  return {
    deletedSessions: data.deleted_sessions,
    deletedParseStates: data.deleted_parse_states,
    preservedSessions: data.preserved_sessions,
    preservedParseStates: data.preserved_parse_states,
  };
}
