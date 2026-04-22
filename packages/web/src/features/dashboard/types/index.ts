/**
 * Dashboard feature types
 */

import type { ComponentType } from '@/common/types';
import type { ReactNode } from 'react';

export type { ComponentType };

export type TrendDirection = 'up' | 'down' | 'neutral';

export interface Trend {
  value: number;        // 변화량 (+3, -1)
  percentage: number;   // 변화율 (7%, -17%)
  direction: TrendDirection;
}

export interface DashboardStats {
  totalSkills: number;
  totalAgents: number;
  totalCommands: number;
  totalHooks: number;
  totalRules: number;
  activeCount: number;
  inactiveCount: number;
  totalCount: number;
  trends: {
    skills: Trend;
    agents: Trend;
    commands: Trend;
    hooks: Trend;
    rules: Trend;
  };
}

export interface ActiveWorkers {
  watcher: boolean;
  usageScanner: boolean;
}

export interface SystemStatus {
  isLive: boolean;
  lastScanAt: Date;
  activeWorkers: ActiveWorkers;
  healthScore: number;  // 0-100
}

export interface Component {
  id: string;
  name: string;
  type: ComponentType;
  scope: 'global' | 'project';
  projectName?: string;
  projectId?: string;
  isActive: boolean;
  lastUsed?: Date;
  path: string;
  description?: string;
  tags?: string[];
}

export interface RecentActivity {
  component: Component;
  timestamp: Date;
  isLive: boolean;  // 현재 활성 상태
}

export interface ComponentBreakdown {
  skills: number;
  agents: number;
  commands: number;
  hooks: number;
  rules: number;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  isGlobal: boolean;
  componentCount: number;
  breakdown: ComponentBreakdown;
  percentage: number;  // 전체 대비 비율
  trend: Trend;
  /** 포함된 플랫폼 목록 (e.g. ['claude_code', 'cursor']) */
  platforms: string[];
  /** Quick Start 샘플 프로젝트 여부 (v1.7.0) */
  isSample?: boolean;
  /** 숨긴 시각 (null이면 활성 프로젝트) */
  hiddenAt?: string | null;
}

export interface TypeDistribution {
  type: ComponentType;
  count: number;
  percentage: number;
  color: string;  // Neon color
}

export type UsageComponentType = 'skill' | 'command' | 'agent' | 'hook';

export interface UsageRankingItem {
  componentId: string | null;
  componentName: string;
  componentType: UsageComponentType;
  useCount: number;
  timeQualifiedCount?: number;
  countOnlyCount?: number;
}

export interface UsageUnusedItem {
  componentName: string;
  componentType: UsageComponentType;
  createdAt: Date;
}

export interface UsageSummary {
  ranking: UsageRankingItem[];
  unused: UsageUnusedItem[];
  totalSessionsParsed: number;
  lastParsedAt: Date | null;
}

export type UsageTimelineDays = 1 | 7;

export interface UsageTimelineEntry {
  date: string;
  count: number;
  intensity: number;
}

export interface UsageComponentTimeline {
  componentId: string;
  componentName: string;
  timeline: UsageTimelineEntry[];
}

export interface UsageScopeIndexEntry {
  id: string;
  name: string;
  type: UsageComponentType;
  projectId: string | null;
  projectName: string | null;
  isActive: boolean;
  createdAt: Date | null;
  tags: string[];
}

export type UsageScopeIndex = Record<string, UsageScopeIndexEntry>;

export interface UsageTreemapMetric {
  componentId: string | null;
  componentName: string;
  componentType: UsageComponentType;
  projectId: string | null;
  projectName: string | null;
  currentUseCount: number;
  previousUseCount: number;
  currentTimeQualifiedCount: number;
  currentCountOnlyCount: number;
  previousTimeQualifiedCount: number;
  previousCountOnlyCount: number;
  deltaRate: number;
  share: number;
  isActive: boolean;
  tags: string[];
}

export type UsageCleanupCandidateTier = 'strong' | 'medium';

export interface UsageCleanupCandidate {
  componentId: string;
  componentName: string;
  componentType: UsageComponentType;
  projectId: string | null;
  projectName: string | null;
  createdAt: Date | null;
  ageDays: number | null;
  last30DaysUseCount: number;
  last90DaysUseCount: number;
  tier: UsageCleanupCandidateTier;
  reason: 'unused-30d' | 'low-usage-90d';
  selectedByDefault: boolean;
}

export interface UsageInsightsV2Summary {
  totalCurrentUseCount: number;
  trackedComponentCount: number;
  strongCandidateCount: number;
  mediumCandidateCount: number;
}

export interface UsageInsightsV2Data {
  treemapMetrics: UsageTreemapMetric[];
  cleanupCandidates: UsageCleanupCandidate[];
  summary: UsageInsightsV2Summary;
}

export interface UsageScanResult {
  sessionsParsed: number;
  statsSaved: number;
}

export interface UsageResetResult {
  deletedSessions: number;
  deletedParseStates: number;
  preservedSessions: number;
  preservedParseStates: number;
}

/** Context Optimizer (v1.7.0) - 컨텍스트 최적화 어드바이저 */
export type SuggestionType = 'unused' | 'duplicate' | 'oversized' | 'tech_mismatch' | 'global_overuse';

export type SuggestionAction = 'disable' | 'move' | 'merge' | 'split';

export type SuggestionPriority = 'high' | 'medium' | 'low';

/**
 * 최적화 제안
 * Issue #501: 백엔드 API 응답 타입 (OptimizationSuggestion)
 */
export interface Suggestion {
  type: SuggestionType;
  component_id: string;
  component_name: string;
  reason: string;
  action: SuggestionAction;
  priority: SuggestionPriority;
  similarity_score?: number | null;
  // 프론트엔드 호환용 (선택)
  component_type?: 'skill' | 'agent' | 'command' | 'rule';
  estimated_tokens?: number;
  actions?: SuggestionAction[];
}

/** 플랫폼별 계층 통계 */

export interface TierComponentInfo {
  id: string;
  name: string;
  type: string;
  estimated_tokens: number;
  file_size_bytes: number;
}

export interface TierStats {
  name: string;
  label: string;
  description: string;
  components: TierComponentInfo[];
  total_tokens: number;
  count: number;
  counts_toward_limit: boolean;
}

export interface PlatformContextStats {
  platform: string;
  tiers: TierStats[];
  recommended_max_tokens: number;
  effective_tokens: number;
  status: 'ok' | 'warning' | 'critical';
}

export interface ContextStatsResponse {
  platforms: PlatformContextStats[];
  suggestions: Suggestion[];
}

export type StatsCardColor = 'cyan' | 'purple' | 'green' | 'orange' | 'blue' | 'white';

export interface StatsCardProps {
  title: string;
  value: number;
  trend?: Trend;
  icon: ReactNode;
  color: StatsCardColor;
  progress?: number;  // 0-100
  /** Active/Sleep 카드용: 부가 값 (예: Sleep count) */
  secondaryValue?: number;
  secondaryLabel?: string;
}
