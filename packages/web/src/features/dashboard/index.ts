/**
 * Dashboard feature public API
 * Only export what should be accessible from outside this feature
 */

// Components
export { DashboardPage } from './components/DashboardPage';
export { DashboardHeader } from './components/DashboardHeader';
export { StatsGrid } from './components/StatsGrid';
export { StatsCard } from './components/StatsCard';
export { SystemStatusBanner } from './components/SystemStatusBanner';
export { RecentActivityPanel } from './components/RecentActivityPanel';
export { ActivityItem } from './components/ActivityItem';
export { ProjectBreakdownPanel } from './components/ProjectBreakdownPanel';
export { ProjectBar } from './components/ProjectBar';
export { TypeDistributionChart } from './components/TypeDistributionChart';
export { UsageInsightsWidget } from './components/UsageInsightsWidget';
export { UsageTreemapPanel } from './components/usage-insights-v2/UsageTreemapPanel';
export { ProjectSelector } from './components/ProjectSelector';
export { ContextOptimizerWidget } from './components/ContextOptimizerWidget';
export { SuggestionsModal } from './components/SuggestionsModal';

// Hooks
export {
  useDashboardStats,
  useSystemStatus,
  useRecentActivity,
  useProjects,
  useUsageSummary,
  useUsageScopeIndex,
  useUsageInsightsV2Data,
  useUsageComponentTimeline,
  useDeleteProject,
  useUnhideProject,
} from './hooks/useDashboardData';
export {
  useContextStats,
  useBulkDisableComponents,
} from './hooks/useContextStats';
export { useKeyboardShortcuts, useKonamiCode } from './hooks/useKeyboardShortcuts';

// Types
export type {
  DashboardStats,
  SystemStatus,
  Component,
  Project,
  ComponentType,
  Trend,
  TrendDirection,
  StatsCardProps,
  ContextStatsResponse,
  Suggestion,
  UsageSummary,
  UsageTimelineDays,
  UsageTimelineEntry,
  UsageComponentTimeline,
  UsageComponentType,
  UsageRankingItem,
  UsageUnusedItem,
  UsageScopeIndexEntry,
  UsageScopeIndex,
  UsageTreemapMetric,
  UsageCleanupCandidateTier,
  UsageCleanupCandidate,
  UsageInsightsV2Summary,
  UsageInsightsV2Data,
} from './types';
