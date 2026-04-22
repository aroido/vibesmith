import type {
  UsageCleanupCandidate,
  UsageComponentType,
  UsageInsightsV2Data,
  UsageScopeIndex,
  UsageSummary,
  UsageTreemapMetric,
} from '../../types';

const PROTECTED_TAGS = new Set(['core', 'critical', 'protected']);
const DAY_IN_MS = 24 * 60 * 60 * 1000;

interface RankingItemLike {
  componentId: string | null;
  componentName: string;
  componentType: UsageComponentType;
  useCount: number;
  timeQualifiedCount?: number;
  countOnlyCount?: number;
}

interface RankingBreakdown {
  timeQualifiedCount: number;
  countOnlyCount: number;
}

export interface BuildUsageInsightsV2DataParams {
  currentSummary: UsageSummary;
  comparisonSummary: UsageSummary;
  usage30dSummary: UsageSummary;
  usage90dSummary: UsageSummary;
  scopeIndex: UsageScopeIndex;
  now?: Date;
}

function normalizeSafeDate(value: Date | null): Date | null {
  if (!value) return null;
  return Number.isFinite(value.getTime()) ? value : null;
}

export function getUsageRankingKey(item: RankingItemLike): string {
  if (item.componentId) return `id:${item.componentId}`;
  return `fallback:${item.componentType}:${item.componentName.toLowerCase()}`;
}

function buildRankingMap(summary: UsageSummary): Map<string, number> {
  const usageMap = new Map<string, number>();

  for (const item of summary.ranking) {
    const key = getUsageRankingKey(item);
    usageMap.set(key, (usageMap.get(key) ?? 0) + item.useCount);
  }

  return usageMap;
}

function buildUsageByComponentId(summary: UsageSummary): Map<string, number> {
  const usageMap = new Map<string, number>();

  for (const item of summary.ranking) {
    if (!item.componentId) continue;
    usageMap.set(item.componentId, (usageMap.get(item.componentId) ?? 0) + item.useCount);
  }

  return usageMap;
}

function buildRankingBreakdownMap(summary: UsageSummary): Map<string, RankingBreakdown> {
  const breakdownMap = new Map<string, RankingBreakdown>();

  for (const item of summary.ranking) {
    const key = getUsageRankingKey(item);
    const normalizedBreakdown = getComparableTimelineCounts(item);
    const prev = breakdownMap.get(key) ?? {
      timeQualifiedCount: 0,
      countOnlyCount: 0,
    };
    breakdownMap.set(key, {
      timeQualifiedCount: prev.timeQualifiedCount + normalizedBreakdown.timeQualifiedCount,
      countOnlyCount: prev.countOnlyCount + normalizedBreakdown.countOnlyCount,
    });
  }

  return breakdownMap;
}

export function calculatePreviousUseCount(
  currentUseCount: number,
  comparisonWindowUseCount: number
): number {
  return Math.max(comparisonWindowUseCount - currentUseCount, 0);
}

export function calculateDeltaRate(
  currentUseCount: number,
  previousUseCount: number
): number {
  const safeCurrent = Math.max(currentUseCount, 0);
  const safePrevious = Math.max(previousUseCount, 0);

  if (safeCurrent === 0 && safePrevious === 0) return 0;

  // 이전 구간 표본이 매우 작으면(0~2회) 증감율이 왜곡되므로
  // 분석 화면에서는 변화율 표시를 생략할 수 있도록 0으로 고정한다.
  if (safePrevious < 3) {
    return 0;
  }

  return (safeCurrent - safePrevious) / safePrevious;
}

function getComparableTimelineCounts(item: RankingItemLike): RankingBreakdown {
  const hasExplicitBreakdown =
    typeof item.timeQualifiedCount === 'number' || typeof item.countOnlyCount === 'number';
  if (!hasExplicitBreakdown) {
    return {
      timeQualifiedCount: Math.max(item.useCount, 0),
      countOnlyCount: 0,
    };
  }

  return {
    timeQualifiedCount: Math.max(item.timeQualifiedCount ?? 0, 0),
    countOnlyCount: Math.max(item.countOnlyCount ?? 0, 0),
  };
}

export function isProtectedUsageComponent(tags: string[]): boolean {
  return tags.some((tag) => PROTECTED_TAGS.has(tag.trim().toLowerCase()));
}

export function getComponentAgeDays(
  createdAt: Date | null,
  now: Date = new Date()
): number | null {
  const safeCreatedAt = normalizeSafeDate(createdAt);
  if (!safeCreatedAt) return null;

  const safeNow = normalizeSafeDate(now);
  if (!safeNow) return null;

  const diff = safeNow.getTime() - safeCreatedAt.getTime();
  if (!Number.isFinite(diff)) return null;
  if (diff <= 0) return 0;
  return Math.floor(diff / DAY_IN_MS);
}

export function buildUsageTreemapMetrics(
  currentSummary: UsageSummary,
  comparisonSummary: UsageSummary,
  scopeIndex: UsageScopeIndex
): UsageTreemapMetric[] {
  const comparisonUsageMap = buildRankingMap(comparisonSummary);
  const currentBreakdownMap = buildRankingBreakdownMap(currentSummary);
  const comparisonBreakdownMap = buildRankingBreakdownMap(comparisonSummary);
  const totalCurrentUseCount = currentSummary.ranking.reduce(
    (sum, item) => sum + item.useCount,
    0
  );

  return currentSummary.ranking
    .map((item) => {
      const rankingKey = getUsageRankingKey(item);
      const comparisonWindowUseCount = comparisonUsageMap.get(rankingKey) ?? 0;
      const previousUseCount = calculatePreviousUseCount(
        item.useCount,
        comparisonWindowUseCount
      );
      const currentBreakdown =
        currentBreakdownMap.get(rankingKey) ?? getComparableTimelineCounts(item);
      const comparisonBreakdown = comparisonBreakdownMap.get(rankingKey) ?? {
        timeQualifiedCount: 0,
        countOnlyCount: 0,
      };
      const previousTimeQualifiedCount = Math.max(
        comparisonBreakdown.timeQualifiedCount - currentBreakdown.timeQualifiedCount,
        0
      );
      const previousCountOnlyCount = Math.max(
        comparisonBreakdown.countOnlyCount - currentBreakdown.countOnlyCount,
        0
      );
      const scope = item.componentId ? scopeIndex[item.componentId] : undefined;

      return {
        componentId: item.componentId,
        componentName: item.componentName,
        componentType: item.componentType,
        projectId: scope?.projectId ?? null,
        projectName: scope?.projectName ?? null,
        currentUseCount: item.useCount,
        previousUseCount,
        currentTimeQualifiedCount: currentBreakdown.timeQualifiedCount,
        currentCountOnlyCount: currentBreakdown.countOnlyCount,
        previousTimeQualifiedCount,
        previousCountOnlyCount,
        // 변화율은 timestamp가 있는 이벤트만 기준으로 계산한다.
        // timestamp가 없는 이벤트는 "카운트 전용"으로 유지하고 증감 계산에서 제외한다.
        deltaRate: calculateDeltaRate(
          currentBreakdown.timeQualifiedCount,
          previousTimeQualifiedCount
        ),
        share: totalCurrentUseCount > 0 ? item.useCount / totalCurrentUseCount : 0,
        isActive: scope?.isActive ?? true,
        tags: scope?.tags ?? [],
      } satisfies UsageTreemapMetric;
    })
    .sort((left, right) => {
      if (left.currentUseCount !== right.currentUseCount) {
        return right.currentUseCount - left.currentUseCount;
      }
      return left.componentName.localeCompare(right.componentName);
    });
}

export function buildCleanupCandidates(
  usage30dSummary: UsageSummary,
  usage90dSummary: UsageSummary,
  scopeIndex: UsageScopeIndex,
  now: Date = new Date()
): UsageCleanupCandidate[] {
  const usage30dByComponentId = buildUsageByComponentId(usage30dSummary);
  const usage90dByComponentId = buildUsageByComponentId(usage90dSummary);
  const candidates: UsageCleanupCandidate[] = [];

  for (const component of Object.values(scopeIndex)) {
    if (!component.isActive) continue;
    if (isProtectedUsageComponent(component.tags)) continue;

    const last30DaysUseCount = usage30dByComponentId.get(component.id) ?? 0;
    const last90DaysUseCount = usage90dByComponentId.get(component.id) ?? 0;
    const ageDays = getComponentAgeDays(component.createdAt, now);
    const isStrong = ageDays !== null && ageDays >= 30 && last30DaysUseCount === 0;
    const isMedium = !isStrong && last90DaysUseCount <= 1;

    if (!isStrong && !isMedium) continue;

    candidates.push({
      componentId: component.id,
      componentName: component.name,
      componentType: component.type,
      projectId: component.projectId,
      projectName: component.projectName,
      createdAt: component.createdAt,
      ageDays,
      last30DaysUseCount,
      last90DaysUseCount,
      tier: isStrong ? 'strong' : 'medium',
      reason: isStrong ? 'unused-30d' : 'low-usage-90d',
      selectedByDefault: isStrong,
    });
  }

  return candidates.sort((left, right) => {
    if (left.tier !== right.tier) {
      return left.tier === 'strong' ? -1 : 1;
    }
    if (left.last90DaysUseCount !== right.last90DaysUseCount) {
      return left.last90DaysUseCount - right.last90DaysUseCount;
    }
    if ((left.ageDays ?? -1) !== (right.ageDays ?? -1)) {
      return (right.ageDays ?? -1) - (left.ageDays ?? -1);
    }
    return left.componentName.localeCompare(right.componentName);
  });
}

export function buildUsageInsightsV2Data(
  params: BuildUsageInsightsV2DataParams
): UsageInsightsV2Data {
  const treemapMetrics = buildUsageTreemapMetrics(
    params.currentSummary,
    params.comparisonSummary,
    params.scopeIndex
  );
  const cleanupCandidates = buildCleanupCandidates(
    params.usage30dSummary,
    params.usage90dSummary,
    params.scopeIndex,
    params.now
  );

  return {
    treemapMetrics,
    cleanupCandidates,
    summary: {
      totalCurrentUseCount: treemapMetrics.reduce(
        (sum, item) => sum + item.currentUseCount,
        0
      ),
      trackedComponentCount: treemapMetrics.length,
      strongCandidateCount: cleanupCandidates.filter(
        (item) => item.tier === 'strong'
      ).length,
      mediumCandidateCount: cleanupCandidates.filter(
        (item) => item.tier === 'medium'
      ).length,
    },
  };
}
