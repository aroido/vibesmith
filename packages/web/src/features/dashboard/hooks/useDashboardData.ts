/**
 * Dashboard data fetching hooks
 * Uses React Query for server state management
 * API: services/api (component-list 재사용 금지)
 */

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import * as api from '../services/api';
import type {
  Component,
  Project,
  UsageComponentType,
  UsageInsightsV2Data,
  UsageTimelineDays,
} from '../types';
import { buildUsageInsightsV2Data } from '../components/usage-insights-v2/usageTreemapTransform';

/** 30초 캐시, 30초 자동 갱신, 탭 포커스 시 리페칭 */
export function useDashboardStats(projectId?: string | null) {
  return useQuery({
    queryKey: ['dashboard', 'stats', projectId],
    queryFn: () => api.getDashboardStats(projectId),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

/** 5초 캐시, 5초 폴링, 탭 포커스 시 리페칭 */
export function useSystemStatus() {
  return useQuery({
    queryKey: ['dashboard', 'system-status'],
    queryFn: () => api.getSystemStatus(),
    staleTime: 5 * 1000,
    refetchInterval: 5 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    // 백엔드 미구현 시 재시도 방지
    retry: 1,
    retryDelay: 1000,
  });
}

/** 10초 캐시, 탭 포커스 시 리페칭 */
export function useRecentActivity() {
  return useQuery({
    queryKey: ['dashboard', 'recent-activity'],
    queryFn: (): Promise<Component[]> => api.getRecentComponents(10),
    staleTime: 10 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

/** 1분 캐시, 탭 포커스 시 리페칭 */
export function useProjects() {
  return useQuery({
    queryKey: ['dashboard', 'projects'],
    queryFn: (): Promise<Project[]> => api.getProjectsForDashboard(),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

interface UsageSummaryParams {
  projectId?: string | null;
  componentType?: 'all' | UsageComponentType;
  days?: number;
  enabled?: boolean;
}

/** 60초 캐시, 60초 폴링 (UsageScanner 주기 정렬), 탭 포커스 시 리페칭 */
export function useUsageSummary(params: UsageSummaryParams) {
  const { projectId, componentType = 'all', days = 30, enabled = true } = params;

  return useQuery({
    queryKey: ['dashboard', 'usage', projectId, componentType, days],
    queryFn: () =>
      api.getUsageSummary({
        projectId,
        componentType: componentType === 'all' ? null : componentType,
        days,
      }),
    enabled,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 1,
    retryDelay: 1000,
    placeholderData: (previousData) => previousData,
  });
}

interface UsageScopeIndexParams {
  projectId?: string | null;
  componentType?: 'all' | UsageComponentType;
}

/** Usage 인사이트 v2용 컴포넌트 인덱스 */
export function useUsageScopeIndex(params: UsageScopeIndexParams) {
  const { projectId, componentType = 'all' } = params;
  const normalizedType = componentType === 'all' ? null : componentType;

  return useQuery({
    queryKey: ['dashboard', 'usage', 'scope-index', projectId, normalizedType],
    queryFn: () =>
      api.getUsageScopeIndex({
        projectId,
        componentType: normalizedType,
      }),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 1,
    retryDelay: 1000,
    placeholderData: (previousData) => previousData,
  });
}

interface UsageInsightsV2Params {
  projectId?: string | null;
  componentType?: 'all' | UsageComponentType;
  days?: number;
}

/** Usage 인사이트 v2 데이터 계층: current/comparison/30d/90d + scope index 결합 */
export function useUsageInsightsV2Data(params: UsageInsightsV2Params): {
  data: UsageInsightsV2Data | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => Promise<unknown[]>;
  currentSummaryQuery: ReturnType<typeof useUsageSummary>;
  comparisonSummaryQuery: ReturnType<typeof useUsageSummary>;
  usage30dSummaryQuery: ReturnType<typeof useUsageSummary>;
  usage90dSummaryQuery: ReturnType<typeof useUsageSummary>;
  scopeIndexQuery: ReturnType<typeof useUsageScopeIndex>;
} {
  const { projectId, componentType = 'all', days = 30 } = params;

  const currentSummaryQuery = useUsageSummary({
    projectId,
    componentType,
    days,
    enabled: true,
  });
  const comparisonSummaryQuery = useUsageSummary({
    projectId,
    componentType,
    days: Math.max(days * 2, 1),
    enabled: true,
  });
  const usage30dSummaryQuery = useUsageSummary({
    projectId,
    componentType,
    days: 30,
    enabled: days !== 30,
  });
  const usage90dSummaryQuery = useUsageSummary({
    projectId,
    componentType,
    days: 90,
    enabled: days !== 90,
  });
  const scopeIndexQuery = useUsageScopeIndex({
    projectId,
    componentType,
  });

  const resolvedCurrentSummary = currentSummaryQuery.data;
  const resolvedComparisonSummary = comparisonSummaryQuery.data ?? resolvedCurrentSummary;
  const resolved30dSummary =
    (days === 30 ? resolvedCurrentSummary : usage30dSummaryQuery.data) ?? resolvedCurrentSummary;
  const resolved90dSummary =
    (days === 90 ? resolvedCurrentSummary : usage90dSummaryQuery.data) ??
    resolvedComparisonSummary ??
    resolvedCurrentSummary;

  const data = useMemo(() => {
    if (
      !resolvedCurrentSummary ||
      !resolvedComparisonSummary ||
      !resolved30dSummary ||
      !resolved90dSummary ||
      !scopeIndexQuery.data
    ) {
      return undefined;
    }

    return buildUsageInsightsV2Data({
      currentSummary: resolvedCurrentSummary,
      comparisonSummary: resolvedComparisonSummary,
      usage30dSummary: resolved30dSummary,
      usage90dSummary: resolved90dSummary,
      scopeIndex: scopeIndexQuery.data,
    });
  }, [
    resolvedCurrentSummary,
    resolvedComparisonSummary,
    resolved30dSummary,
    resolved90dSummary,
    scopeIndexQuery.data,
  ]);

  const isLoading =
    (currentSummaryQuery.isLoading || scopeIndexQuery.isLoading) && !data;

  const isError = (currentSummaryQuery.isError || scopeIndexQuery.isError) && !data;

  const error =
    currentSummaryQuery.error ??
    scopeIndexQuery.error ??
    null;

  const refetch = () =>
    Promise.all([
      currentSummaryQuery.refetch(),
      comparisonSummaryQuery.refetch(),
      usage30dSummaryQuery.refetch(),
      usage90dSummaryQuery.refetch(),
      scopeIndexQuery.refetch(),
    ]);

  return {
    data,
    isLoading,
    isError,
    error,
    refetch,
    currentSummaryQuery,
    comparisonSummaryQuery,
    usage30dSummaryQuery,
    usage90dSummaryQuery,
    scopeIndexQuery,
  };
}

/** 선택 컴포넌트 usage timeline (heat strip 보조 시각화용) */
export function useUsageComponentTimeline(
  componentId: string | null | undefined,
  days: UsageTimelineDays = 1
) {
  const limit = days === 1 ? 84 : 12;

  return useQuery({
    queryKey: ['dashboard', 'usage', 'component-timeline', componentId, days, limit],
    queryFn: () => {
      if (!componentId) throw new Error('componentId is required');
      return api.getUsageComponentTimeline(componentId, {
        days,
        limit,
        aggregationMode: 'strict',
      });
    },
    enabled: !!componentId,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 1,
    retryDelay: 1000,
    placeholderData: (previousData) => previousData,
  });
}

function invalidateUsageQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['dashboard', 'usage'] });
}

/** Usage 수동 스캔 mutation (POST /api/usage/scan) */
export function useTriggerUsageScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.triggerUsageScan(),
    onSuccess: () => {
      invalidateUsageQueries(queryClient);
    },
  });
}

/** Usage 데이터 초기화 mutation (POST /api/usage/reset) */
export function useResetUsageData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.resetUsageData(),
    onSuccess: () => {
      invalidateUsageQueries(queryClient);
    },
  });
}

/** Usage ranking 컴포넌트 ID 목록으로 프로젝트명 매핑 조회 */
export function useUsageRankingProjectNames(componentIds: string[]) {
  const normalizedIds = [...new Set(componentIds)].sort();

  return useQuery({
    queryKey: ['dashboard', 'usage', 'project-names', normalizedIds],
    queryFn: () => api.getUsageRankingProjectNames(normalizedIds),
    enabled: normalizedIds.length > 0,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 1,
    retryDelay: 1000,
  });
}

/** 프로젝트 숨기기 mutation (DELETE /api/projects/{id}) */
export function useDeleteProject() {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => api.deleteProject(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'projects'] });
      toast.success(t('hooks.projectHidden'));
    },
    onError: (error: Error) => {
      toast.error(error.message ?? t('hooks.projectDeleteFailed'));
    },
  });
}

/** 숨긴 프로젝트 복원 mutation (PATCH /api/projects/{id}/unhide) */
export function useUnhideProject() {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => api.unhideProject(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'projects'] });
      toast.success(t('hooks.projectUnhidden'));
    },
    onError: (error: Error) => {
      toast.error(error.message ?? t('hooks.projectDeleteFailed'));
    },
  });
}
