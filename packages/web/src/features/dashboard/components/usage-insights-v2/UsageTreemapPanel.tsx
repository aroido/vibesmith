import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  hierarchy,
  partition,
  treemap,
  treemapResquarify,
  type HierarchyRectangularNode,
} from 'd3-hierarchy';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useBulkDisableComponents } from '../../hooks/useContextStats';
import {
  useUsageComponentTimeline,
  useUsageInsightsV2Data,
} from '../../hooks/useDashboardData';
import type {
  UsageCleanupCandidate,
  UsageComponentType,
  UsageInsightsV2Data,
  UsageTimelineEntry,
  UsageTreemapMetric,
} from '../../types';

interface UsageTreemapPanelProps {
  projectId?: string | null;
}

interface TooltipState {
  x: number;
  y: number;
  title: string;
  lines: string[];
}

interface UsageTreeNode {
  kind: 'root' | 'type' | 'leaf';
  id: string;
  label: string;
  value: number;
  componentType?: UsageComponentType;
  componentId?: string | null;
  previousUseCount?: number;
  currentTimeQualifiedCount?: number;
  currentCountOnlyCount?: number;
  previousTimeQualifiedCount?: number;
  previousCountOnlyCount?: number;
  deltaRate?: number;
  share?: number;
  isActive?: boolean;
  isAggregate?: boolean;
  children?: UsageTreeNode[];
}

type DeltaTone = 'up' | 'down' | 'flat';
type UsageVisualizationMode = 'treemap' | 'pareto' | 'sunburst';
type UsageStylePreset = 'default' | 'neon' | 'editorial';

const DAYS_OPTIONS = [30, 60, 90] as const;
const TYPE_ORDER: UsageComponentType[] = ['skill', 'command', 'agent', 'hook'];
const TREEMAP_DEFAULT_WIDTH = 960;
const TREEMAP_DEFAULT_HEIGHT = 360;
const TREEMAP_MIN_HEIGHT = 240;
const TREEMAP_MAX_HEIGHT = 500;
const TREEMAP_LAYOUT_OCCUPANCY_TARGET = 0.94;
const HEAT_STRIP_WINDOW = 42;
const DELTA_PERCENT_DISPLAY_CAP = 300;
const DELTA_MIN_BASELINE = 3;
const TREEMAP_MAX_LEAVES_PER_TYPE = 18;
const TREEMAP_MIN_SHARE_TO_KEEP = 0.014;
const TREEMAP_AGGREGATE_MIN_COUNT = 3;
const PARETO_MIN_ROWS = 8;
const PARETO_MAX_ROWS = 24;
const PARETO_TARGET_RATIO = 0.8;
const SUNBURST_MIN_VISIBLE_ANGLE = 0.018;

const TYPE_COLORS: Record<UsageComponentType, string> = {
  skill: '#16a34a',
  command: '#2563eb',
  agent: '#d97706',
  hook: '#0891b2',
};

interface UsageChartPalette {
  upHue: number;
  upSaturation: number;
  downHue: number;
  downSaturation: number;
  flatHue: number;
  flatSaturation: number;
  neutralHue: number;
  neutralSaturation: number;
}

const USAGE_CHART_PALETTES: Record<UsageStylePreset, UsageChartPalette> = {
  default: {
    upHue: 151,
    upSaturation: 66,
    downHue: 12,
    downSaturation: 80,
    flatHue: 210,
    flatSaturation: 16,
    neutralHue: 204,
    neutralSaturation: 42,
  },
  neon: {
    upHue: 165,
    upSaturation: 82,
    downHue: 338,
    downSaturation: 88,
    flatHue: 214,
    flatSaturation: 28,
    neutralHue: 198,
    neutralSaturation: 64,
  },
  editorial: {
    upHue: 146,
    upSaturation: 54,
    downHue: 8,
    downSaturation: 64,
    flatHue: 214,
    flatSaturation: 14,
    neutralHue: 206,
    neutralSaturation: 28,
  },
};

function normalizeUsageStylePreset(value: string | null | undefined): UsageStylePreset {
  if (value === 'neon' || value === 'editorial') return value;
  if (value === 'liquid') return 'neon';
  return 'default';
}

function getUsageStylePresetFromDom(): UsageStylePreset {
  if (typeof document === 'undefined') return 'default';
  const root = document.documentElement;
  return normalizeUsageStylePreset(root.getAttribute('data-style'));
}

function getTypeLabel(
  t: (key: string, options?: Record<string, unknown>) => string,
  type: UsageComponentType,
): string {
  switch (type) {
    case 'skill':
      return t('usageInsightsV2.typeSkill');
    case 'command':
      return t('usageInsightsV2.typeCommand');
    case 'agent':
      return t('usageInsightsV2.typeAgent');
    case 'hook':
      return t('usageInsightsV2.typeHook');
    default:
      return type;
  }
}

function hasReliableDeltaBaseline(
  currentUseCount: number,
  previousUseCount: number,
): boolean {
  if (currentUseCount <= 0 && previousUseCount <= 0) return false;
  return previousUseCount >= DELTA_MIN_BASELINE;
}

function formatDeltaRate(
  deltaRate: number,
  currentUseCount = 0,
  previousUseCount = 0,
): string | null {
  if (!hasReliableDeltaBaseline(currentUseCount, previousUseCount)) return null;

  const rawPercent = deltaRate * 100;
  if (rawPercent >= DELTA_PERCENT_DISPLAY_CAP) return `>=+${DELTA_PERCENT_DISPLAY_CAP}%`;
  if (rawPercent <= -DELTA_PERCENT_DISPLAY_CAP) return `<=-${DELTA_PERCENT_DISPLAY_CAP}%`;
  const roundedPercent = Math.round(rawPercent);
  return roundedPercent > 0 ? `+${roundedPercent}%` : `${roundedPercent}%`;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function getDeltaIntensity(deltaRate: number): number {
  const magnitudePercent = Math.abs(deltaRate) * 100;
  // 10%, 100%, 1000% 차이를 완만하게 압축해 채도 편차를 확보한다.
  return clamp01(Math.log10(magnitudePercent + 1) / 4);
}

function getUsageWeight(usageRatio: number): number {
  return clamp01(Math.sqrt(Math.max(usageRatio, 0)));
}

function getCompositeIntensity(deltaRate: number, usageRatio: number): number {
  const deltaIntensity = getDeltaIntensity(deltaRate);
  const usageWeight = getUsageWeight(usageRatio);
  return clamp01(deltaIntensity * 0.64 + usageWeight * 0.36);
}

function getDeltaTone(deltaRate: number): DeltaTone {
  if (deltaRate >= 0.08) return 'up';
  if (deltaRate <= -0.08) return 'down';
  return 'flat';
}

function getLeafFillColor(
  deltaRate: number,
  usageRatio: number,
  palette: UsageChartPalette,
): string {
  const usageIntensity = clamp01(Math.pow(Math.max(usageRatio, 0), 0.72));
  if (usageRatio <= 0) return 'hsl(208, 26%, 88%)';

  // 표본이 작은 구간(변화율 미집계)은 변화율 대신 사용량 밀도로 명암을 준다.
  if (usageRatio > 0 && Math.abs(deltaRate) < 0.0001) {
    const hue = palette.neutralHue - usageIntensity * 26;
    const saturation = palette.neutralSaturation + usageIntensity * 22;
    const lightness = 86 - usageIntensity * 34;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  const tone = getDeltaTone(deltaRate);
  const intensity = getCompositeIntensity(deltaRate, usageRatio);

  if (tone === 'up') {
    const lightness = 89 - intensity * 56;
    return `hsl(${palette.upHue}, ${palette.upSaturation}%, ${lightness}%)`;
  }
  if (tone === 'down') {
    const lightness = 90 - intensity * 54;
    return `hsl(${palette.downHue}, ${palette.downSaturation}%, ${lightness}%)`;
  }

  const lightness = 88 - intensity * 20;
  return `hsl(${palette.flatHue}, ${palette.flatSaturation}%, ${lightness}%)`;
}

function getLeafStrokeColor(
  deltaRate: number,
  usageRatio: number,
  palette: UsageChartPalette,
): string {
  const usageIntensity = clamp01(Math.pow(Math.max(usageRatio, 0), 0.72));
  if (usageRatio <= 0) return 'hsl(210, 18%, 56%)';
  if (usageRatio > 0 && Math.abs(deltaRate) < 0.0001) {
    return `hsl(${palette.neutralHue - usageIntensity * 14}, ${60 + usageIntensity * 18}%, ${50 - usageIntensity * 12}%)`;
  }

  const tone = getDeltaTone(deltaRate);
  const intensity = getCompositeIntensity(deltaRate, usageRatio);
  if (tone === 'up') return `hsl(${palette.upHue}, ${Math.min(90, palette.upSaturation + 8)}%, ${44 - intensity * 10}%)`;
  if (tone === 'down') return `hsl(${palette.downHue}, ${Math.min(90, palette.downSaturation + 8)}%, ${46 - intensity * 10}%)`;
  return `hsl(${palette.flatHue}, ${Math.max(16, palette.flatSaturation + 2)}%, 50%)`;
}

function getLeafTextColor(
  deltaRate: number,
  usageRatio: number,
  palette: UsageChartPalette,
): string {
  const usageIntensity = clamp01(Math.pow(Math.max(usageRatio, 0), 0.72));
  if (usageRatio > 0 && Math.abs(deltaRate) < 0.0001) {
    return usageIntensity >= 0.37 ? '#f8fafc' : `hsl(${palette.flatHue}, 42%, 17%)`;
  }

  const tone = getDeltaTone(deltaRate);
  const intensity = getCompositeIntensity(deltaRate, usageRatio);
  if (tone === 'flat') return intensity >= 0.7 ? '#e2e8f0' : '#102033';
  return intensity >= 0.28 ? '#f8fafc' : '#102033';
}

function getLegendSwatchColor(tone: DeltaTone, palette: UsageChartPalette): string {
  if (tone === 'up') return getLeafFillColor(0.6, 0.72, palette);
  if (tone === 'down') return getLeafFillColor(-0.6, 0.72, palette);
  return getLeafFillColor(0, 0.52, palette);
}

function truncateLabel(label: string, maxLength: number): string {
  if (label.length <= maxLength) return label;
  return `${label.slice(0, Math.max(maxLength - 1, 1))}…`;
}

function wrapLabelLines(label: string, maxChars: number, maxLines: number): string[] {
  const safeMaxChars = Math.max(maxChars, 4);
  const safeMaxLines = Math.max(maxLines, 1);
  if (label.length <= safeMaxChars) return [label];

  const tokens = label
    .replace(/([/_-])/g, '$1 ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) return [truncateLabel(label, safeMaxChars)];

  const lines: string[] = [];
  let cursor = '';

  for (const token of tokens) {
    const next = cursor ? `${cursor} ${token}` : token;
    if (next.length <= safeMaxChars) {
      cursor = next;
      continue;
    }

    if (cursor) {
      lines.push(cursor);
      cursor = '';
      if (lines.length >= safeMaxLines) {
        const tail = `${lines[safeMaxLines - 1].slice(0, Math.max(safeMaxChars - 1, 1))}…`;
        lines[safeMaxLines - 1] = tail;
        return lines;
      }
    }

    if (token.length <= safeMaxChars) {
      cursor = token;
      continue;
    }

    let remainder = token;
    while (remainder.length > safeMaxChars) {
      lines.push(remainder.slice(0, safeMaxChars - 1) + '…');
      remainder = remainder.slice(safeMaxChars - 1);
      if (lines.length >= safeMaxLines) return lines.slice(0, safeMaxLines);
    }
    cursor = remainder;
  }

  if (cursor) lines.push(cursor);
  if (lines.length <= safeMaxLines) return lines;

  const head = lines.slice(0, safeMaxLines);
  head[safeMaxLines - 1] = truncateLabel(head[safeMaxLines - 1], safeMaxChars);
  return head;
}

function estimateMaxChars(widthPx: number, fontPx: number): number {
  const usableWidth = Math.max(widthPx - 20, 0);
  const estimatedCharWidth = Math.max(fontPx * 0.64, 7.5);
  return Math.max(3, Math.floor(usableWidth / estimatedCharWidth));
}

interface ComparableCounts {
  current: number;
  previous: number;
  hasTimeline: boolean;
}

function getComparableCounts(
  currentUseCount: number,
  previousUseCount: number,
  currentTimeQualifiedCount = 0,
  previousTimeQualifiedCount = 0,
): ComparableCounts {
  const safeCurrentTimeQualifiedCount = Math.max(currentTimeQualifiedCount, 0);
  const safePreviousTimeQualifiedCount = Math.max(previousTimeQualifiedCount, 0);

  if (safeCurrentTimeQualifiedCount > 0 || safePreviousTimeQualifiedCount > 0) {
    return {
      current: safeCurrentTimeQualifiedCount,
      previous: safePreviousTimeQualifiedCount,
      hasTimeline: true,
    };
  }

  return {
    current: Math.max(currentUseCount, 0),
    previous: Math.max(previousUseCount, 0),
    hasTimeline: false,
  };
}

function normalizeTreemapNodes(
  nodes: HierarchyRectangularNode<UsageTreeNode>[],
  width: number,
  height: number,
): Array<{ node: HierarchyRectangularNode<UsageTreeNode>; x0: number; x1: number; y0: number; y1: number }> {
  if (nodes.length === 0) return [];

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    if (!Number.isFinite(node.x0) || !Number.isFinite(node.y0)) continue;
    if (!Number.isFinite(node.x1) || !Number.isFinite(node.y1)) continue;
    minX = Math.min(minX, node.x0);
    minY = Math.min(minY, node.y0);
    maxX = Math.max(maxX, node.x1);
    maxY = Math.max(maxY, node.y1);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return nodes.map((node) => ({ node, x0: node.x0, x1: node.x1, y0: node.y0, y1: node.y1 }));
  }

  const occupiedWidth = Math.max(maxX - minX, 1);
  const occupiedHeight = Math.max(maxY - minY, 1);
  const occupancyX = occupiedWidth / Math.max(width, 1);
  const occupancyY = occupiedHeight / Math.max(height, 1);

  if (
    occupancyX >= TREEMAP_LAYOUT_OCCUPANCY_TARGET &&
    occupancyY >= TREEMAP_LAYOUT_OCCUPANCY_TARGET &&
    minX <= 1 &&
    minY <= 1
  ) {
    return nodes.map((node) => ({ node, x0: node.x0, x1: node.x1, y0: node.y0, y1: node.y1 }));
  }

  const scaleX = width / occupiedWidth;
  const scaleY = height / occupiedHeight;

  return nodes.map((node) => ({
    node,
    x0: (node.x0 - minX) * scaleX,
    x1: (node.x1 - minX) * scaleX,
    y0: (node.y0 - minY) * scaleY,
    y1: (node.y1 - minY) * scaleY,
  }));
}

function getDeltaBadgeClass(
  deltaRate: number,
  currentUseCount = 0,
  previousUseCount = 0,
): string {
  if (!hasReliableDeltaBaseline(currentUseCount, previousUseCount)) {
    return 'badge-theme-muted';
  }

  const tone = getDeltaTone(deltaRate);
  if (tone === 'up') return 'badge-theme-success';
  if (tone === 'down') return 'badge-theme-danger';
  return 'badge-theme-muted';
}

function calculateDeltaRateForDisplay(
  currentUseCount: number,
  previousUseCount: number,
  currentTimeQualifiedCount = 0,
  previousTimeQualifiedCount = 0,
): number {
  const comparable = getComparableCounts(
    currentUseCount,
    previousUseCount,
    currentTimeQualifiedCount,
    previousTimeQualifiedCount,
  );
  if (!comparable.hasTimeline) return 0;
  if (!hasReliableDeltaBaseline(comparable.current, comparable.previous)) return 0;
  return (comparable.current - comparable.previous) / comparable.previous;
}

function getCountOnlyRatio(countOnlyCount: number, totalCount: number): number {
  if (totalCount <= 0) return 0;
  return clamp01(countOnlyCount / totalCount);
}

interface ParetoRow {
  id: string;
  label: string;
  componentId: string | null;
  componentType: UsageComponentType;
  currentUseCount: number;
  previousUseCount: number;
  currentTimeQualifiedCount: number;
  currentCountOnlyCount: number;
  previousTimeQualifiedCount: number;
  deltaRate: number;
  share: number;
  cumulativeShare: number;
  isAggregate: boolean;
}

function getTimelineCoverage(metrics: UsageTreemapMetric[]): number {
  const totalCount = metrics.reduce((sum, metric) => sum + Math.max(metric.currentUseCount, 0), 0);
  if (totalCount <= 0) return 0;

  const totalCountOnly = metrics.reduce(
    (sum, metric) => sum + Math.max(metric.currentCountOnlyCount, 0),
    0,
  );
  return clamp01((totalCount - totalCountOnly) / totalCount);
}

function getRecommendedVisualizationMode(metrics: UsageTreemapMetric[]): UsageVisualizationMode {
  const positiveMetrics = metrics.filter((metric) => metric.currentUseCount > 0);
  if (positiveMetrics.length === 0) return 'treemap';

  const typeCount = new Set(positiveMetrics.map((metric) => metric.componentType)).size;
  const timelineCoverage = getTimelineCoverage(positiveMetrics);

  if (positiveMetrics.length >= 34 || timelineCoverage < 0.4) {
    return 'pareto';
  }

  if (
    typeCount >= 3 &&
    positiveMetrics.length >= 10 &&
    positiveMetrics.length <= 42 &&
    timelineCoverage >= 0.62
  ) {
    return 'sunburst';
  }

  return 'treemap';
}

function buildParetoRows(
  metrics: UsageTreemapMetric[],
  maxRows: number,
  t: (key: string, options?: Record<string, unknown>) => string,
): ParetoRow[] {
  const positiveMetrics = metrics
    .filter((metric) => metric.currentUseCount > 0)
    .sort((left, right) => right.currentUseCount - left.currentUseCount);
  if (positiveMetrics.length === 0) return [];

  const safeMaxRows = Math.max(PARETO_MIN_ROWS, Math.min(PARETO_MAX_ROWS, maxRows));
  const visibleRows = positiveMetrics.slice(0, safeMaxRows);
  const hiddenRows = positiveMetrics.slice(safeMaxRows);

  const rows: ParetoRow[] = visibleRows.map((metric) => ({
    id: metric.componentId ?? `${metric.componentType}:${metric.componentName}`,
    label: metric.componentName,
    componentId: metric.componentId,
    componentType: metric.componentType,
    currentUseCount: metric.currentUseCount,
    previousUseCount: metric.previousUseCount,
    currentTimeQualifiedCount: metric.currentTimeQualifiedCount,
    currentCountOnlyCount: metric.currentCountOnlyCount,
    previousTimeQualifiedCount: metric.previousTimeQualifiedCount,
    deltaRate: metric.deltaRate,
    share: 0,
    cumulativeShare: 0,
    isAggregate: false,
  }));

  if (hiddenRows.length >= 2) {
    const aggregateCurrentUseCount = hiddenRows.reduce((sum, metric) => sum + metric.currentUseCount, 0);
    const aggregatePreviousUseCount = hiddenRows.reduce((sum, metric) => sum + metric.previousUseCount, 0);
    const aggregateCurrentTimeQualifiedCount = hiddenRows.reduce(
      (sum, metric) => sum + metric.currentTimeQualifiedCount,
      0,
    );
    const aggregateCurrentCountOnlyCount = hiddenRows.reduce(
      (sum, metric) => sum + metric.currentCountOnlyCount,
      0,
    );
    const aggregatePreviousTimeQualifiedCount = hiddenRows.reduce(
      (sum, metric) => sum + metric.previousTimeQualifiedCount,
      0,
    );

    rows.push({
      id: `pareto:others:${hiddenRows.length}`,
      label: t('usageInsightsV2.othersGroup', { count: hiddenRows.length }),
      componentId: null,
      componentType: hiddenRows[0]?.componentType ?? 'skill',
      currentUseCount: aggregateCurrentUseCount,
      previousUseCount: aggregatePreviousUseCount,
      currentTimeQualifiedCount: aggregateCurrentTimeQualifiedCount,
      currentCountOnlyCount: aggregateCurrentCountOnlyCount,
      previousTimeQualifiedCount: aggregatePreviousTimeQualifiedCount,
      deltaRate: calculateDeltaRateForDisplay(
        aggregateCurrentUseCount,
        aggregatePreviousUseCount,
        aggregateCurrentTimeQualifiedCount,
        aggregatePreviousTimeQualifiedCount,
      ),
      share: 0,
      cumulativeShare: 0,
      isAggregate: true,
    });
  } else {
    for (const metric of hiddenRows) {
      rows.push({
        id: metric.componentId ?? `${metric.componentType}:${metric.componentName}`,
        label: metric.componentName,
        componentId: metric.componentId,
        componentType: metric.componentType,
        currentUseCount: metric.currentUseCount,
        previousUseCount: metric.previousUseCount,
        currentTimeQualifiedCount: metric.currentTimeQualifiedCount,
        currentCountOnlyCount: metric.currentCountOnlyCount,
        previousTimeQualifiedCount: metric.previousTimeQualifiedCount,
        deltaRate: metric.deltaRate,
        share: 0,
        cumulativeShare: 0,
        isAggregate: false,
      });
    }
  }

  const totalUseCount = rows.reduce((sum, row) => sum + row.currentUseCount, 0);
  if (totalUseCount <= 0) return rows;

  let cumulativeUseCount = 0;
  return rows.map((row) => {
    const share = row.currentUseCount / totalUseCount;
    cumulativeUseCount += row.currentUseCount;
    return {
      ...row,
      share,
      cumulativeShare: cumulativeUseCount / totalUseCount,
    };
  });
}

function buildSunburstRootData(
  metrics: UsageTreemapMetric[],
  t: (key: string, options?: Record<string, unknown>) => string,
): UsageTreeNode | null {
  const typeNodes = TYPE_ORDER.flatMap((type) => {
    const compactedMetrics = compactTypeMetricsForTreemap(metrics, type, t);
    const leaves = compactedMetrics
      .map((metric) => ({
        kind: 'leaf' as const,
        id: metric.componentId ?? `${metric.componentType}:${metric.componentName}`,
        label: metric.componentName,
        value: metric.currentUseCount,
        componentType: metric.componentType,
        componentId: metric.componentId,
        previousUseCount: metric.previousUseCount,
        currentTimeQualifiedCount: metric.currentTimeQualifiedCount,
        currentCountOnlyCount: metric.currentCountOnlyCount,
        previousTimeQualifiedCount: metric.previousTimeQualifiedCount,
        previousCountOnlyCount: metric.previousCountOnlyCount,
        deltaRate: metric.deltaRate,
        share: metric.share,
        isActive: metric.isActive,
        isAggregate: metric.tags.includes('aggregate'),
      } satisfies UsageTreeNode))
      .filter((node) => node.value > 0);

    if (leaves.length === 0) return [];

    return [
      {
        kind: 'type' as const,
        id: type,
        label: type,
        value: leaves.reduce((sum, node) => sum + node.value, 0),
        componentType: type,
        children: leaves,
      } satisfies UsageTreeNode,
    ];
  });

  if (typeNodes.length === 0) return null;

  return {
    kind: 'root',
    id: 'sunburst:all',
    label: 'all',
    value: typeNodes.reduce((sum, node) => sum + node.value, 0),
    children: typeNodes,
  };
}

function polarToCartesian(angle: number, radius: number): { x: number; y: number } {
  const adjusted = angle - Math.PI / 2;
  return {
    x: Math.cos(adjusted) * radius,
    y: Math.sin(adjusted) * radius,
  };
}

function buildAnnularSectorPath(
  startAngle: number,
  endAngle: number,
  innerRadius: number,
  outerRadius: number,
): string {
  if (outerRadius <= 0 || endAngle <= startAngle) return '';

  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;
  const outerStart = polarToCartesian(startAngle, outerRadius);
  const outerEnd = polarToCartesian(endAngle, outerRadius);

  if (innerRadius <= 0) {
    return `M 0 0 L ${outerStart.x} ${outerStart.y} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y} Z`;
  }

  const innerEnd = polarToCartesian(endAngle, innerRadius);
  const innerStart = polarToCartesian(startAngle, innerRadius);
  return `M ${outerStart.x} ${outerStart.y} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y} L ${innerEnd.x} ${innerEnd.y} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y} Z`;
}

function compactTypeMetricsForTreemap(
  metrics: UsageTreemapMetric[],
  type: UsageComponentType,
  t: (key: string, options?: Record<string, unknown>) => string,
): UsageTreemapMetric[] {
  const typed = metrics
    .filter((metric) => metric.componentType === type && metric.currentUseCount > 0)
    .sort((left, right) => right.currentUseCount - left.currentUseCount);

  if (typed.length <= TREEMAP_MAX_LEAVES_PER_TYPE) return typed;

  const totalUseCount = typed.reduce((sum, metric) => sum + metric.currentUseCount, 0);
  const visible: UsageTreemapMetric[] = [];
  const folded: UsageTreemapMetric[] = [];

  for (const [index, metric] of typed.entries()) {
    const share = totalUseCount > 0 ? metric.currentUseCount / totalUseCount : 0;
    const shouldKeep = index < TREEMAP_MAX_LEAVES_PER_TYPE || share >= TREEMAP_MIN_SHARE_TO_KEEP;
    if (shouldKeep) visible.push(metric);
    else folded.push(metric);
  }

  if (folded.length < TREEMAP_AGGREGATE_MIN_COUNT) {
    return typed;
  }

  const foldedCurrentUseCount = folded.reduce((sum, metric) => sum + metric.currentUseCount, 0);
  const foldedPreviousUseCount = folded.reduce((sum, metric) => sum + metric.previousUseCount, 0);
  const foldedCurrentTimeQualifiedCount = folded.reduce(
    (sum, metric) => sum + metric.currentTimeQualifiedCount,
    0,
  );
  const foldedCurrentCountOnlyCount = folded.reduce((sum, metric) => sum + metric.currentCountOnlyCount, 0);
  const foldedPreviousTimeQualifiedCount = folded.reduce(
    (sum, metric) => sum + metric.previousTimeQualifiedCount,
    0,
  );
  const foldedPreviousCountOnlyCount = folded.reduce(
    (sum, metric) => sum + metric.previousCountOnlyCount,
    0,
  );
  const foldedShare = totalUseCount > 0 ? foldedCurrentUseCount / totalUseCount : 0;

  visible.push({
    componentId: null,
    componentName: t('usageInsightsV2.othersGroup', { count: folded.length }),
    componentType: type,
    projectId: null,
    projectName: null,
    currentUseCount: foldedCurrentUseCount,
    previousUseCount: foldedPreviousUseCount,
    currentTimeQualifiedCount: foldedCurrentTimeQualifiedCount,
    currentCountOnlyCount: foldedCurrentCountOnlyCount,
    previousTimeQualifiedCount: foldedPreviousTimeQualifiedCount,
    previousCountOnlyCount: foldedPreviousCountOnlyCount,
    deltaRate: calculateDeltaRateForDisplay(
      foldedCurrentUseCount,
      foldedPreviousUseCount,
      foldedCurrentTimeQualifiedCount,
      foldedPreviousTimeQualifiedCount,
    ),
    share: foldedShare,
    isActive: true,
    tags: ['aggregate'],
  });

  return visible.sort((left, right) => right.currentUseCount - left.currentUseCount);
}

function parseDateOnly(dateText: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

  return new Date(Date.UTC(year, month - 1, day));
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getHeatLevel(count: number, intensity: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || intensity <= 0) return 0;
  if (intensity >= 0.8) return 4;
  if (intensity >= 0.6) return 3;
  if (intensity >= 0.35) return 2;
  return 1;
}

function getHeatClass(level: 0 | 1 | 2 | 3 | 4): string {
  switch (level) {
    case 1:
      return 'usage-heat-level-1';
    case 2:
      return 'usage-heat-level-2';
    case 3:
      return 'usage-heat-level-3';
    case 4:
      return 'usage-heat-level-4';
    case 0:
    default:
      return 'usage-heat-level-0';
  }
}

function buildHeatStripCells(entries: UsageTimelineEntry[], windowDays: number) {
  if (entries.length === 0) return [];

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const latest = parseDateOnly(sorted[sorted.length - 1]?.date ?? '');
  if (!latest) return [];

  const byDate = new Map(entries.map((entry) => [entry.date, entry]));
  const start = addUtcDays(latest, -(windowDays - 1));
  const cells: Array<{
    date: string;
    count: number;
    intensity: number;
    level: 0 | 1 | 2 | 3 | 4;
  }> = [];

  for (let cursor = start; cursor.getTime() <= latest.getTime(); cursor = addUtcDays(cursor, 1)) {
    const date = toDateOnly(cursor);
    const timelineEntry = byDate.get(date);
    const count = timelineEntry?.count ?? 0;
    const intensity = timelineEntry?.intensity ?? 0;
    cells.push({
      date,
      count,
      intensity,
      level: getHeatLevel(count, intensity),
    });
  }

  return cells;
}

function buildUsageHierarchy(
  metrics: UsageTreemapMetric[],
  width: number,
  height: number,
  t: (key: string, options?: Record<string, unknown>) => string,
): HierarchyRectangularNode<UsageTreeNode> | null {
  if (metrics.length === 0) return null;

  const typeNodes: UsageTreeNode[] = TYPE_ORDER.map((type) => {
    const compactedMetrics = compactTypeMetricsForTreemap(metrics, type, t);
    const leaves = compactedMetrics
      .map((metric) => ({
        kind: 'leaf' as const,
        id: metric.componentId ?? `${metric.componentType}:${metric.componentName}`,
        label: metric.componentName,
        value: metric.currentUseCount,
        componentType: metric.componentType,
        componentId: metric.componentId,
        previousUseCount: metric.previousUseCount,
        currentTimeQualifiedCount: metric.currentTimeQualifiedCount,
        currentCountOnlyCount: metric.currentCountOnlyCount,
        previousTimeQualifiedCount: metric.previousTimeQualifiedCount,
        previousCountOnlyCount: metric.previousCountOnlyCount,
        deltaRate: metric.deltaRate,
        share: metric.share,
        isActive: metric.isActive,
        isAggregate: metric.tags.includes('aggregate'),
      } satisfies UsageTreeNode));

    const value = leaves.reduce((sum, item) => sum + item.value, 0);

    return {
      kind: 'type' as const,
      id: type,
      label: type,
      value,
      componentType: type,
      children: leaves,
    } satisfies UsageTreeNode;
  }).filter((item) => (item.children?.length ?? 0) > 0);

  if (typeNodes.length === 0) return null;

  const rootNode: UsageTreeNode = {
    kind: 'root',
    id: 'all',
    label: 'all',
    value: typeNodes.reduce((sum, item) => sum + item.value, 0),
    children: typeNodes,
  };

  const root = hierarchy(rootNode, (node) => node.children)
    // Internal node own-values inflate parent area and create visible empty bands.
    .sum((node) => (node.kind === 'leaf' ? Math.max(node.value, 0) : 0))
    .sort((left, right) => (right.value ?? 0) - (left.value ?? 0));

  return treemap<UsageTreeNode>()
    .tile(treemapResquarify.ratio(1.2))
    .size([width, height])
    .paddingOuter(1)
    .paddingInner(2)
    .round(false)(root);
}

function buildFocusedTypeHierarchy(
  metrics: UsageTreemapMetric[],
  focusedType: UsageComponentType,
  width: number,
  height: number,
  t: (key: string, options?: Record<string, unknown>) => string,
): HierarchyRectangularNode<UsageTreeNode> | null {
  const compactedMetrics = compactTypeMetricsForTreemap(metrics, focusedType, t);
  const leaves = compactedMetrics
    .map((metric) => ({
      kind: 'leaf' as const,
      id: metric.componentId ?? `${metric.componentType}:${metric.componentName}`,
      label: metric.componentName,
      value: metric.currentUseCount,
      componentType: metric.componentType,
      componentId: metric.componentId,
      previousUseCount: metric.previousUseCount,
      currentTimeQualifiedCount: metric.currentTimeQualifiedCount,
      currentCountOnlyCount: metric.currentCountOnlyCount,
      previousTimeQualifiedCount: metric.previousTimeQualifiedCount,
      previousCountOnlyCount: metric.previousCountOnlyCount,
      deltaRate: metric.deltaRate,
      share: metric.share,
      isActive: metric.isActive,
      isAggregate: metric.tags.includes('aggregate'),
    } satisfies UsageTreeNode));

  if (leaves.length === 0) return null;

  const rootNode: UsageTreeNode = {
    kind: 'root',
    id: `focused:${focusedType}`,
    label: focusedType,
    value: leaves.reduce((sum, node) => sum + node.value, 0),
    children: leaves,
  };

  const root = hierarchy(rootNode, (node) => node.children)
    // Focused layout must also sum only leaves, otherwise half-width blank area appears.
    .sum((node) => (node.kind === 'leaf' ? Math.max(node.value, 0) : 0))
    .sort((left, right) => (right.value ?? 0) - (left.value ?? 0));

  return treemap<UsageTreeNode>()
    .tile(treemapResquarify.ratio(1.2))
    .size([width, height])
    .paddingOuter(1)
    .paddingInner(2)
    .round(false)(root);
}

function getCandidateReasonLabel(
  t: (key: string, options?: Record<string, unknown>) => string,
  candidate: UsageCleanupCandidate,
): string {
  return candidate.reason === 'unused-30d'
    ? t('usageInsightsV2.reasonUnused30d')
    : t('usageInsightsV2.reasonLowUsage90d');
}

function getCandidateTierLabel(
  t: (key: string, options?: Record<string, unknown>) => string,
  candidate: UsageCleanupCandidate,
): string {
  return candidate.tier === 'strong'
    ? t('usageInsightsV2.tierStrong')
    : t('usageInsightsV2.tierMedium');
}

export function UsageTreemapPanel({ projectId }: UsageTreemapPanelProps) {
  const { t } = useTranslation(['dashboard', 'common']);
  const treemapContainerRef = useRef<HTMLDivElement | null>(null);
  const [componentType, setComponentType] = useState<'all' | UsageComponentType>('all');
  const [days, setDays] = useState<number>(30);
  const [focusedType, setFocusedType] = useState<'all' | UsageComponentType>('all');
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [selectedQueueIds, setSelectedQueueIds] = useState<Set<string>>(new Set());
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [visualizationMode, setVisualizationMode] = useState<UsageVisualizationMode>('treemap');
  const [visualizationModeManuallySelected, setVisualizationModeManuallySelected] = useState(false);
  const [stylePreset, setStylePreset] = useState<UsageStylePreset>(() => getUsageStylePresetFromDom());
  const [treemapSize, setTreemapSize] = useState({
    width: TREEMAP_DEFAULT_WIDTH,
    height: TREEMAP_DEFAULT_HEIGHT,
  });
  const [lastResolvedData, setLastResolvedData] = useState<UsageInsightsV2Data | null>(null);

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useUsageInsightsV2Data({
    projectId,
    componentType,
    days,
  });
  const {
    data: timelineData,
    isLoading: timelineLoading,
    isError: isTimelineError,
    refetch: refetchTimeline,
  } = useUsageComponentTimeline(selectedComponentId, 1);
  const { mutate: bulkDisable, isPending: isDisabling } = useBulkDisableComponents();
  const visibleData = data ?? lastResolvedData;
  const isInitialLoading = isLoading && !visibleData;
  const isRefreshing = isLoading && !!visibleData;
  const visibleTreemapMetrics = useMemo(
    () => visibleData?.treemapMetrics ?? [],
    [visibleData?.treemapMetrics],
  );
  const chartPalette = useMemo(
    () => USAGE_CHART_PALETTES[stylePreset] ?? USAGE_CHART_PALETTES.default,
    [stylePreset],
  );
  const recommendedVisualizationMode = useMemo(
    () => getRecommendedVisualizationMode(visibleTreemapMetrics),
    [visibleTreemapMetrics],
  );

  useEffect(() => {
    if (data) setLastResolvedData(data);
  }, [data]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const syncStyle = () => {
      setStylePreset(getUsageStylePresetFromDom());
    };
    syncStyle();
    const observer = new MutationObserver(syncStyle);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-style'],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const target = treemapContainerRef.current;
    if (!target) return;
    if (typeof ResizeObserver === 'undefined') return;

    const updateSize = () => {
      const nextWidth = Math.max(320, Math.floor(target.clientWidth - 8));
      const densityRatio =
        visibleTreemapMetrics.length >= 30
          ? 0.46
          : visibleTreemapMetrics.length >= 16
            ? 0.4
            : 0.35;
      const nextHeight = Math.min(
        TREEMAP_MAX_HEIGHT,
        Math.max(TREEMAP_MIN_HEIGHT, Math.round(nextWidth * densityRatio)),
      );

      setTreemapSize((prev) =>
        prev.width === nextWidth && prev.height === nextHeight
          ? prev
          : { width: nextWidth, height: nextHeight },
      );
    };

    updateSize();
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(target);

    return () => observer.disconnect();
  }, [visibleTreemapMetrics.length]);

  const overviewTreemapRoot = useMemo(
    () => buildUsageHierarchy(visibleTreemapMetrics, treemapSize.width, treemapSize.height, t),
    [visibleTreemapMetrics, treemapSize.height, treemapSize.width, t],
  );
  const focusedTreemapRoot = useMemo(() => {
    if (focusedType === 'all') return null;
    return buildFocusedTypeHierarchy(
      visibleTreemapMetrics,
      focusedType,
      treemapSize.width,
      treemapSize.height,
      t,
    );
  }, [focusedType, treemapSize.height, treemapSize.width, visibleTreemapMetrics, t]);

  const treemapNodes = useMemo(() => {
    if (focusedType === 'all') {
      const overviewChildren = overviewTreemapRoot?.children ?? [];
      if (overviewChildren.length === 1) {
        return overviewChildren[0]?.children ?? [];
      }
      return overviewChildren;
    }
    return focusedTreemapRoot?.children ?? [];
  }, [focusedType, overviewTreemapRoot, focusedTreemapRoot]);
  const renderTreemapNodes = useMemo(
    () => normalizeTreemapNodes(treemapNodes, treemapSize.width, treemapSize.height),
    [treemapNodes, treemapSize.height, treemapSize.width],
  );
  const maxVisibleLeafUseCount = useMemo(
    () => renderTreemapNodes.reduce((max, item) => {
      if (item.node.data.kind !== 'leaf') return max;
      return Math.max(max, item.node.value ?? 0);
    }, 0),
    [renderTreemapNodes],
  );
  const paretoRowLimit = useMemo(
    () =>
      Math.max(
        PARETO_MIN_ROWS,
        Math.min(PARETO_MAX_ROWS, Math.round((treemapSize.height - 28) / 34)),
      ),
    [treemapSize.height],
  );
  const paretoRows = useMemo(
    () => buildParetoRows(visibleTreemapMetrics, paretoRowLimit, t),
    [paretoRowLimit, t, visibleTreemapMetrics],
  );
  const paretoMaxUseCount = useMemo(
    () => paretoRows.reduce((max, row) => Math.max(max, row.currentUseCount), 0),
    [paretoRows],
  );
  const sunburstRoot = useMemo(() => {
    const sunburstRootData = buildSunburstRootData(visibleTreemapMetrics, t);
    if (!sunburstRootData) return null;

    const root = hierarchy(sunburstRootData, (node) => node.children)
      .sum((node) => (node.kind === 'leaf' ? Math.max(node.value, 0) : 0))
      .sort((left, right) => (right.value ?? 0) - (left.value ?? 0));
    const radius = Math.max(Math.min(treemapSize.width, treemapSize.height) / 2 - 14, 86);
    return partition<UsageTreeNode>().size([Math.PI * 2, radius]).padding(0.003)(root);
  }, [treemapSize.height, treemapSize.width, t, visibleTreemapMetrics]);
  const sunburstNodes = useMemo(
    () =>
      sunburstRoot?.descendants().filter((node) => {
        if (node.depth === 0) return false;
        return node.x1 - node.x0 >= SUNBURST_MIN_VISIBLE_ANGLE;
      }) ?? [],
    [sunburstRoot],
  );
  const maxSunburstLeafUseCount = useMemo(
    () =>
      sunburstNodes.reduce((max, node) => {
        if (node.data.kind !== 'leaf') return max;
        return Math.max(max, node.value ?? 0);
      }, 0),
    [sunburstNodes],
  );
  const hasTreemapData = renderTreemapNodes.length > 0;
  const hasParetoData = paretoRows.length > 0;
  const hasSunburstData = sunburstNodes.length > 0;
  const activeVisualizationMode = useMemo<UsageVisualizationMode>(() => {
    if (visualizationMode === 'treemap' && hasTreemapData) return 'treemap';
    if (visualizationMode === 'pareto' && hasParetoData) return 'pareto';
    if (visualizationMode === 'sunburst' && hasSunburstData) return 'sunburst';

    if (hasTreemapData) return 'treemap';
    if (hasParetoData) return 'pareto';
    if (hasSunburstData) return 'sunburst';
    return 'treemap';
  }, [hasParetoData, hasSunburstData, hasTreemapData, visualizationMode]);

  const selectedMetric = useMemo(
    () => visibleData?.treemapMetrics.find((item) => item.componentId === selectedComponentId) ?? null,
    [visibleData?.treemapMetrics, selectedComponentId],
  );
  const metricsById = useMemo(() => {
    const map = new Map<string, UsageTreemapMetric>();
    for (const metric of visibleData?.treemapMetrics ?? []) {
      if (!metric.componentId) continue;
      map.set(metric.componentId, metric);
    }
    return map;
  }, [visibleData?.treemapMetrics]);
  const selectedCandidate = useMemo(
    () =>
      visibleData?.cleanupCandidates.find((candidate) => candidate.componentId === selectedComponentId) ?? null,
    [visibleData?.cleanupCandidates, selectedComponentId],
  );
  const selectedComparableCounts = useMemo(
    () =>
      selectedMetric
        ? getComparableCounts(
            selectedMetric.currentUseCount,
            selectedMetric.previousUseCount,
            selectedMetric.currentTimeQualifiedCount,
            selectedMetric.previousTimeQualifiedCount,
          )
        : null,
    [selectedMetric],
  );
  const selectedDeltaText = selectedMetric
    ? formatDeltaRate(
        selectedMetric.deltaRate,
        selectedComparableCounts?.current ?? 0,
        selectedComparableCounts?.previous ?? 0,
      )
    : null;
  const selectedCurrentUseCount = selectedMetric?.currentUseCount ?? 0;
  const selectedPreviousUseCount = selectedMetric?.previousUseCount ?? 0;
  const selectedDeltaReliable = selectedComparableCounts
    ? selectedComparableCounts.hasTimeline &&
      hasReliableDeltaBaseline(selectedComparableCounts.current, selectedComparableCounts.previous)
    : false;
  const selectedSharePercent = selectedMetric
    ? Math.round(selectedMetric.share * 100)
    : null;
  const selectedTypeLabel =
    selectedMetric?.componentType
      ? getTypeLabel(t, selectedMetric.componentType)
      : selectedCandidate?.componentType
        ? getTypeLabel(t, selectedCandidate.componentType)
        : null;

  const selectedQueueItems = useMemo(
    () => Array.from(selectedQueueIds),
    [selectedQueueIds],
  );

  const heatStripCells = useMemo(
    () => buildHeatStripCells(timelineData?.timeline ?? [], HEAT_STRIP_WINDOW),
    [timelineData?.timeline],
  );

  const cleanupSignature = useMemo(
    () =>
      (data?.cleanupCandidates ?? [])
        .map((candidate) => `${candidate.componentId}:${candidate.selectedByDefault ? '1' : '0'}`)
        .join('|'),
    [data?.cleanupCandidates],
  );

  useEffect(() => {
    setFocusedType(componentType === 'all' ? 'all' : componentType);
  }, [componentType]);

  useEffect(() => {
    setVisualizationModeManuallySelected(false);
  }, [componentType, days, projectId]);

  useEffect(() => {
    if (visualizationModeManuallySelected) return;
    setVisualizationMode((current) =>
      current === recommendedVisualizationMode ? current : recommendedVisualizationMode,
    );
  }, [recommendedVisualizationMode, visualizationModeManuallySelected]);

  useEffect(() => {
    if (focusedType === 'all') return;
    const hasFocusedType = visibleTreemapMetrics.some(
      (metric) => metric.componentType === focusedType,
    );

    if (!hasFocusedType) {
      setFocusedType('all');
    }
  }, [focusedType, visibleTreemapMetrics]);

  useEffect(() => {
    if (!data) return;
    const next = new Set(
      (data?.cleanupCandidates ?? [])
        .filter((candidate) => candidate.selectedByDefault)
        .map((candidate) => candidate.componentId),
    );
    setSelectedQueueIds(next);
  }, [cleanupSignature, data, data?.cleanupCandidates]);

  useEffect(() => {
    if (!visibleData) return;

    const selectableIds = new Set(
      visibleData.treemapMetrics
        .map((item) => item.componentId)
        .filter((item): item is string => Boolean(item)),
    );

    if (selectedComponentId && selectableIds.has(selectedComponentId)) return;

    const topUsedComponentId =
      visibleData.treemapMetrics.find(
        (metric) => !!metric.componentId && metric.currentUseCount > 0,
      )?.componentId ??
      visibleData.treemapMetrics.find((metric) => !!metric.componentId)?.componentId ??
      null;

    const fallback =
      topUsedComponentId ??
      visibleData.cleanupCandidates.find((candidate) => candidate.selectedByDefault)?.componentId ??
      visibleData.cleanupCandidates[0]?.componentId ??
      null;

    setSelectedComponentId(fallback);
  }, [visibleData, selectedComponentId]);

  const handleToggleQueueSelection = (componentId: string) => {
    setSelectedQueueIds((prev) => {
      const next = new Set(prev);
      if (next.has(componentId)) next.delete(componentId);
      else next.add(componentId);
      return next;
    });
    setSelectedComponentId(componentId);
  };

  const handleVisualizationModeChange = (mode: UsageVisualizationMode) => {
    setVisualizationMode(mode);
    setVisualizationModeManuallySelected(true);
    setTooltip(null);
  };

  const updateTooltipFromMetric = (
    metric: {
      title: string;
      currentUseCount: number;
      previousUseCount: number;
      currentTimeQualifiedCount: number;
      currentCountOnlyCount: number;
      previousTimeQualifiedCount: number;
      deltaRate: number;
      share: number;
    },
    event: { clientX: number; clientY: number },
  ) => {
    const countOnlyRatio = getCountOnlyRatio(metric.currentCountOnlyCount, metric.currentUseCount);
    const comparableCounts = getComparableCounts(
      metric.currentUseCount,
      metric.previousUseCount,
      metric.currentTimeQualifiedCount,
      metric.previousTimeQualifiedCount,
    );
    const deltaText = formatDeltaRate(
      metric.deltaRate,
      comparableCounts.current,
      comparableCounts.previous,
    );
    const lines = [
      t('usageInsightsV2.tooltipCurrent', { count: metric.currentUseCount }),
      t('usageInsightsV2.tooltipPrevious', { count: metric.previousUseCount }),
      t('usageInsightsV2.tooltipShare', { value: Math.round(metric.share * 100) }),
      t('usageInsightsV2.tooltipTimelineCoverage', {
        value: Math.round((1 - countOnlyRatio) * 100),
      }),
    ];

    if (deltaText) {
      lines.splice(
        2,
        0,
        t('usageInsightsV2.tooltipDelta', {
          value: deltaText,
        }),
      );
    }

    if (metric.currentCountOnlyCount > 0) {
      lines.push(
        t('usageInsightsV2.tooltipCountOnlyBreakdown', {
          countOnly: metric.currentCountOnlyCount,
          timeQualified: metric.currentTimeQualifiedCount,
        }),
      );
    }
    if (!comparableCounts.hasTimeline) {
      lines.push(t('usageInsightsV2.deltaTimelineOnlyHint'));
    }

    setTooltip({
      x: event.clientX,
      y: event.clientY,
      title: metric.title,
      lines,
    });
  };

  const updateTooltipFromNode = (
    node: HierarchyRectangularNode<UsageTreeNode>,
    event: { clientX: number; clientY: number },
  ) => {
    if (node.data.kind === 'leaf') {
      updateTooltipFromMetric(
        {
          title: node.data.label,
          currentUseCount: node.value ?? 0,
          previousUseCount: node.data.previousUseCount ?? 0,
          currentTimeQualifiedCount: node.data.currentTimeQualifiedCount ?? 0,
          currentCountOnlyCount: node.data.currentCountOnlyCount ?? 0,
          previousTimeQualifiedCount: node.data.previousTimeQualifiedCount ?? 0,
          deltaRate: node.data.deltaRate ?? 0,
          share: node.data.share ?? 0,
        },
        event,
      );
      return;
    }

    const title =
      node.data.kind === 'type' && node.data.componentType
        ? getTypeLabel(t, node.data.componentType)
        : node.data.label;
    const totalUseCount = Math.max(visibleData?.summary.totalCurrentUseCount ?? 0, 1);
    const sharePercent = Math.round(clamp01((node.value ?? 0) / totalUseCount) * 100);

    setTooltip({
      x: event.clientX,
      y: event.clientY,
      title,
      lines: [
        t('usageInsightsV2.tooltipCurrent', { count: node.value ?? 0 }),
        t('usageInsightsV2.tooltipShare', { value: sharePercent }),
      ],
    });
  };

  const handleTreemapActivation = (
    node: HierarchyRectangularNode<UsageTreeNode>,
  ) => {
    if (node.data.kind === 'type' && node.data.componentType) {
      setFocusedType(node.data.componentType);
      return;
    }

    if (node.data.kind === 'leaf' && node.data.componentId) {
      setSelectedComponentId(node.data.componentId);
    }
  };

  const handleConfirmDisable = () => {
    if (selectedQueueItems.length === 0) return;

    bulkDisable(selectedQueueItems, {
      onSuccess: () => {
        setShowConfirmDialog(false);
        setSelectedQueueIds(new Set());
        void refetch();
        if (selectedComponentId) {
          void refetchTimeline();
        }
      },
      onError: () => {
        setShowConfirmDialog(false);
      },
    });
  };

  const shouldShowTreemap = activeVisualizationMode === 'treemap';
  const shouldShowPareto = activeVisualizationMode === 'pareto';
  const shouldShowSunburst = activeVisualizationMode === 'sunburst';
  const shouldShowBreadcrumb = shouldShowTreemap;
  const shouldShowDeltaLegend = shouldShowTreemap;
  const visualizationHint =
    activeVisualizationMode === 'pareto'
      ? t('usageInsightsV2.paretoHint')
      : activeVisualizationMode === 'sunburst'
        ? t('usageInsightsV2.sunburstHint')
        : t('usageInsightsV2.treemapHint');
  const decisionSignals = useMemo(() => {
    const ranked = [...visibleTreemapMetrics]
      .filter((metric) => metric.currentUseCount > 0)
      .sort((left, right) => right.currentUseCount - left.currentUseCount);
    if (ranked.length === 0) {
      return {
        topThreeSharePercent: 0,
        longTailSharePercent: 0,
        reliableDeltaPercent: 0,
      };
    }

    const totalUseCount = ranked.reduce((sum, metric) => sum + metric.currentUseCount, 0);
    const topThreeUseCount = ranked
      .slice(0, 3)
      .reduce((sum, metric) => sum + metric.currentUseCount, 0);
    const topTenUseCount = ranked
      .slice(0, 10)
      .reduce((sum, metric) => sum + metric.currentUseCount, 0);
    const reliableDeltaCount = ranked.filter((metric) => {
      const comparable = getComparableCounts(
        metric.currentUseCount,
        metric.previousUseCount,
        metric.currentTimeQualifiedCount,
        metric.previousTimeQualifiedCount,
      );
      return comparable.hasTimeline && hasReliableDeltaBaseline(comparable.current, comparable.previous);
    }).length;

    return {
      topThreeSharePercent:
        totalUseCount > 0 ? Math.round((topThreeUseCount / totalUseCount) * 100) : 0,
      longTailSharePercent:
        totalUseCount > 0 ? Math.max(0, Math.round(((totalUseCount - topTenUseCount) / totalUseCount) * 100)) : 0,
      reliableDeltaPercent: Math.round((reliableDeltaCount / ranked.length) * 100),
    };
  }, [visibleTreemapMetrics]);

  return (
    <article
      className="vs-dashboard-panel-surface w-full rounded-xl border border-theme bg-theme-surface p-3 md:p-4"
      data-testid="usage-insights-v2-panel"
    >
      <header className="mb-4 flex flex-wrap items-center justify-end gap-2">
        {projectId && (
          <p className="mr-auto text-sm text-theme-tertiary">{t('usageInsightsV2.projectScoped')}</p>
        )}

        <div className="flex items-center gap-2">
          <label htmlFor="usage-v2-component-type" className="sr-only">
            {t('usageInsightsV2.componentTypeLabel')}
          </label>
          <select
            id="usage-v2-component-type"
            value={componentType}
            onChange={(event) => setComponentType(event.target.value as 'all' | UsageComponentType)}
            className="h-9 rounded-lg border border-theme bg-theme-elevated px-2.5 text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
          >
            <option value="all">{t('usageInsightsV2.allTypes')}</option>
            <option value="skill">{t('usageInsightsV2.typeSkill')}</option>
            <option value="command">{t('usageInsightsV2.typeCommand')}</option>
            <option value="agent">{t('usageInsightsV2.typeAgent')}</option>
            <option value="hook">{t('usageInsightsV2.typeHook')}</option>
          </select>

          <label htmlFor="usage-v2-days" className="sr-only">
            {t('usageInsightsV2.daysLabel')}
          </label>
          <select
            id="usage-v2-days"
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className="h-9 rounded-lg border border-theme bg-theme-elevated px-2.5 text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
          >
            {DAYS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t('usageInsightsV2.daysOption', { days: value })}
              </option>
            ))}
          </select>
        </div>
      </header>

      {isInitialLoading && (
        <div role="status" aria-live="polite" className="space-y-3" data-testid="usage-v2-loading">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-lg border border-theme bg-theme-elevated" />
          ))}
        </div>
      )}

      {!isInitialLoading && isError && !visibleData && (
        <div
          className="rounded-lg border border-theme bg-theme-elevated p-3 text-sm text-theme-secondary"
          data-testid="usage-v2-error"
        >
          <p>{t('usageInsightsV2.loadError')}</p>
          <button
            type="button"
            onClick={() => {
              void refetch();
            }}
            className="mt-2 h-8 rounded-md border border-theme px-3 text-xs font-medium text-theme-primary transition-colors hover:bg-theme-hover"
          >
            {t('common:retry')}
          </button>
        </div>
      )}

      {visibleData && (
        <div className="space-y-3">
          {isRefreshing && (
            <p className="text-xs text-theme-tertiary" data-testid="usage-v2-refreshing">
              {t('common:loading')}
            </p>
          )}
          <section
            className="grid grid-cols-2 gap-2 md:grid-cols-4"
            data-testid="usage-v2-summary-cards"
          >
            <div className="usage-v2-summary-card rounded-lg border border-theme px-3 py-2">
              <p className="text-sm text-theme-secondary">{t('usageInsightsV2.summaryTotalUsage')}</p>
              <p className="mt-1 text-2xl font-semibold text-theme-primary">
                {visibleData.summary.totalCurrentUseCount.toLocaleString()}
              </p>
            </div>
            <div className="usage-v2-summary-card rounded-lg border border-theme px-3 py-2">
              <p className="text-sm text-theme-secondary">{t('usageInsightsV2.summaryTracked')}</p>
              <p className="mt-1 text-2xl font-semibold text-theme-primary">
                {visibleData.summary.trackedComponentCount.toLocaleString()}
              </p>
            </div>
            <div className="usage-v2-summary-card rounded-lg border border-theme px-3 py-2">
              <p className="text-sm text-theme-secondary">{t('usageInsightsV2.summaryStrong')}</p>
              <p className="mt-1 text-2xl font-semibold text-theme-primary">
                {visibleData.summary.strongCandidateCount.toLocaleString()}
              </p>
            </div>
            <div className="usage-v2-summary-card rounded-lg border border-theme px-3 py-2">
              <p className="text-sm text-theme-secondary">{t('usageInsightsV2.summaryMedium')}</p>
              <p className="mt-1 text-2xl font-semibold text-theme-primary">
                {visibleData.summary.mediumCandidateCount.toLocaleString()}
              </p>
            </div>
          </section>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 lg:items-stretch">
            <section className="flex flex-col lg:col-span-2">
              <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="text-xl font-semibold text-theme-primary">{t('usageInsightsV2.treemapTitle')}</h3>
                  <p className="mt-0.5 text-sm text-theme-secondary">{visualizationHint}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <div className="usage-v2-mode-switch inline-flex overflow-hidden rounded-lg border border-theme p-0.5">
                    <button
                      type="button"
                      onClick={() => handleVisualizationModeChange('treemap')}
                      data-testid="usage-v2-viewmode-treemap"
                      className={`usage-v2-mode-btn h-9 rounded-md px-3.5 text-sm font-medium transition-colors ${
                        activeVisualizationMode === 'treemap'
                          ? 'usage-v2-mode-btn-active'
                          : 'text-theme-secondary hover:bg-theme-hover'
                      }`}
                    >
                      {t('usageInsightsV2.viewModeTreemap')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVisualizationModeChange('pareto')}
                      data-testid="usage-v2-viewmode-pareto"
                      className={`usage-v2-mode-btn h-9 rounded-md px-3.5 text-sm font-medium transition-colors ${
                        activeVisualizationMode === 'pareto'
                          ? 'usage-v2-mode-btn-active'
                          : 'text-theme-secondary hover:bg-theme-hover'
                      }`}
                    >
                      {t('usageInsightsV2.viewModePareto')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVisualizationModeChange('sunburst')}
                      data-testid="usage-v2-viewmode-sunburst"
                      className={`usage-v2-mode-btn h-9 rounded-md px-3.5 text-sm font-medium transition-colors ${
                        activeVisualizationMode === 'sunburst'
                          ? 'usage-v2-mode-btn-active'
                          : 'text-theme-secondary hover:bg-theme-hover'
                      }`}
                    >
                      {t('usageInsightsV2.viewModeSunburst')}
                    </button>
                  </div>
                </div>
              </div>
              <div className="usage-v2-insight-strip mb-2.5" data-testid="usage-v2-decision-signals">
                <span className="usage-v2-insight-chip">
                  {t('usageInsightsV2.signalTop3Share', { value: decisionSignals.topThreeSharePercent })}
                </span>
                <span className="usage-v2-insight-chip">
                  {t('usageInsightsV2.signalLongTailShare', { value: decisionSignals.longTailSharePercent })}
                </span>
                <span className="usage-v2-insight-chip">
                  {t('usageInsightsV2.signalReliableDelta', { value: decisionSignals.reliableDeltaPercent })}
                </span>
              </div>

              {(shouldShowDeltaLegend || shouldShowBreadcrumb) && (
                <div className="mb-2 flex items-center gap-2">
                  {shouldShowBreadcrumb && (
                    <nav
                      aria-label={t('usageInsightsV2.breadcrumbAria')}
                      className="flex items-center gap-2 text-lg"
                      data-testid="usage-v2-breadcrumb"
                    >
                      <button
                        type="button"
                        onClick={() => setFocusedType('all')}
                        disabled={focusedType === 'all'}
                        className="rounded-md border border-theme bg-theme-elevated px-2 py-1 text-theme-primary disabled:cursor-default disabled:opacity-60"
                      >
                        {t('usageInsightsV2.breadcrumbRoot')}
                      </button>
                      {focusedType !== 'all' && (
                        <>
                          <span className="text-theme-tertiary">/</span>
                          <span className="text-theme-secondary">{getTypeLabel(t, focusedType)}</span>
                        </>
                      )}
                    </nav>
                  )}
                  {shouldShowDeltaLegend && (
                    <div
                      className="ml-auto flex items-center gap-2 text-[0.95rem] text-theme-secondary"
                      data-testid="usage-v2-delta-legend"
                    >
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-theme bg-theme-surface px-2.5 py-1">
                        <span className="inline-flex items-center gap-1">
                          <span
                            className="h-2.5 w-2.5 rounded-full bg-[var(--legend-swatch)]"
                            style={{ ['--legend-swatch' as string]: getLegendSwatchColor('up', chartPalette) }}
                            aria-hidden
                          />
                          {t('usageInsightsV2.trendUp')}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span
                            className="h-2.5 w-2.5 rounded-full bg-[var(--legend-swatch)]"
                            style={{ ['--legend-swatch' as string]: getLegendSwatchColor('down', chartPalette) }}
                            aria-hidden
                          />
                          {t('usageInsightsV2.trendDown')}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span
                            className="h-2.5 w-2.5 rounded-full bg-[var(--legend-swatch)]"
                            style={{ ['--legend-swatch' as string]: getLegendSwatchColor('flat', chartPalette) }}
                            aria-hidden
                          />
                          {t('usageInsightsV2.trendFlat')}
                        </span>
                      </span>
                      <span className="group relative">
                        <span
                          className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-theme bg-theme-surface text-xs text-theme-tertiary"
                          aria-label={t('usageInsightsV2.deltaLegendLabel')}
                        >
                          ?
                        </span>
                        <span className="pointer-events-none absolute bottom-full right-0 z-50 mb-2 w-64 rounded-lg border border-theme bg-theme-elevated p-2.5 text-xs leading-relaxed text-theme-secondary opacity-0 shadow-lg transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                          <span className="mb-1.5 block border-b border-theme pb-1.5">{t('usageInsightsV2.timelineConfidenceLegend')}</span>
                          <span className="mb-1 block">{t('usageInsightsV2.deltaReliabilityHint')}</span>
                          <span className="block">{t('usageInsightsV2.deltaTimelineOnlyHint')}</span>
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div
                ref={treemapContainerRef}
                className="usage-v2-chart-stage relative flex-1 overflow-hidden rounded-lg border border-theme p-1.5 shadow-sm"
                data-testid="usage-v2-treemap-container"
              >
                {!hasTreemapData && !hasParetoData && !hasSunburstData && (
                  <p
                    className="flex items-center justify-center text-sm text-theme-secondary"
                    style={{ height: `${treemapSize.height}px` }}
                    data-testid="usage-v2-empty-treemap"
                  >
                    {t('usageInsightsV2.emptyTreemap')}
                  </p>
                )}

                {shouldShowTreemap && hasTreemapData && (
                  <svg
                    viewBox={`0 0 ${treemapSize.width} ${treemapSize.height}`}
                    preserveAspectRatio="xMidYMid meet"
                    className="block h-full w-full"
                    role="group"
                    aria-label={t('usageInsightsV2.treemapAria')}
                    data-testid="usage-v2-treemap"
                  >
                    {renderTreemapNodes.map((item, index) => {
                      const { node } = item;
                      const x = item.x0;
                      const y = item.y0;
                      const width = Math.max(item.x1 - item.x0, 1);
                      const height = Math.max(item.y1 - item.y0, 1);
                      const isLeaf = node.data.kind === 'leaf';
                      const componentTypeForNode = node.data.componentType ?? 'skill';
                      const baseColor = TYPE_COLORS[componentTypeForNode];
                      const usageRatio =
                        isLeaf && maxVisibleLeafUseCount > 0
                          ? clamp01((node.value ?? 0) / maxVisibleLeafUseCount)
                          : 0;
                      const countOnlyRatio =
                        isLeaf
                          ? getCountOnlyRatio(
                              node.data.currentCountOnlyCount ?? 0,
                              node.value ?? 0,
                            )
                          : 0;
                      const comparableCounts = getComparableCounts(
                        node.value ?? 0,
                        node.data.previousUseCount ?? 0,
                        node.data.currentTimeQualifiedCount ?? 0,
                        node.data.previousTimeQualifiedCount ?? 0,
                      );
                      const hasReliableNodeDelta =
                        isLeaf &&
                        comparableCounts.hasTimeline &&
                        hasReliableDeltaBaseline(comparableCounts.current, comparableCounts.previous);
                      const leafFillColor = getLeafFillColor(node.data.deltaRate ?? 0, usageRatio, chartPalette);
                      const leafStrokeColor = getLeafStrokeColor(
                        node.data.deltaRate ?? 0,
                        usageRatio,
                        chartPalette,
                      );
                      const leafTextColor = getLeafTextColor(
                        node.data.deltaRate ?? 0,
                        usageRatio,
                        chartPalette,
                      );
                      const titleFontSize = Math.max(
                        16,
                        Math.min(26, Math.round(Math.min(width * 0.094, height * 0.25))),
                      );
                      const detailFontSize = Math.max(
                        13,
                        Math.min(19, Math.round(titleFontSize * 0.76)),
                      );
                      const labelCharLimit = estimateMaxChars(width, titleFontSize);
                      const nodeKey = `${node.data.id}:${Math.round(node.x0)}:${Math.round(
                        node.y0,
                      )}:${Math.round(node.x1)}:${Math.round(node.y1)}:${index}`;
                      const isSelected =
                        isLeaf &&
                        node.data.componentId !== null &&
                        node.data.componentId === selectedComponentId;
                      const fillOpacity = isLeaf ? (node.data.isActive === false ? 0.4 : 1) : 0.26;
                      const label =
                        node.data.kind === 'type' && node.data.componentType
                          ? getTypeLabel(t, node.data.componentType)
                          : node.data.label;
                      const maxLabelLines = width > 240 && height > 120 ? 2 : 1;
                      const wrappedLabelLines = wrapLabelLines(label, labelCharLimit, maxLabelLines);
                      const titleLineHeight = Math.max(Math.round(titleFontSize * 1.06), 16);
                      const textBottom = y + height - 8;
                      const titleY = y + titleFontSize + 9;
                      const titleLastBaseline = titleY + (wrappedLabelLines.length - 1) * titleLineHeight;
                      const detailStartY = titleLastBaseline + detailFontSize + 5;
                      const deltaY = detailStartY + detailFontSize + 5;
                      const showTitle = width > 146 && height > 66 && titleY <= textBottom;
                      const showCount = showTitle && width > 192 && height > 98 && detailStartY <= textBottom;
                      const showDelta =
                        showCount &&
                        node.data.kind === 'leaf' &&
                        hasReliableNodeDelta &&
                        width > 212 &&
                        height > 112 &&
                        deltaY <= textBottom;

                      return (
                        <g key={nodeKey}>
                          <rect
                            x={x}
                            y={y}
                            width={width}
                            height={height}
                            rx={8}
                            fill={isLeaf ? leafFillColor : baseColor}
                            fillOpacity={fillOpacity}
                            stroke={
                              isSelected
                                ? 'var(--color-primary)'
                                : isLeaf
                                  ? leafStrokeColor
                                  : 'var(--color-border-primary)'
                            }
                            strokeWidth={isSelected ? 2.5 : 1}
                            strokeDasharray={
                              isLeaf && countOnlyRatio >= 0.5 && !isSelected ? '5 2' : undefined
                            }
                            role="button"
                            tabIndex={0}
                            data-testid={
                              node.data.kind === 'type'
                                ? `usage-v2-type-tile-${node.data.componentType}`
                                : `usage-v2-leaf-tile-${node.data.id}`
                            }
                            aria-label={
                              node.data.kind === 'type'
                                ? t('usageInsightsV2.typeTileAria', {
                                    type: label,
                                    count: node.value ?? 0,
                                  })
                                : t('usageInsightsV2.leafTileAria', {
                                    name: label,
                                    count: node.value ?? 0,
                                  })
                            }
                            onClick={(event) => {
                              handleTreemapActivation(node);
                              updateTooltipFromNode(node, {
                                clientX: event.clientX,
                                clientY: event.clientY,
                              });
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                handleTreemapActivation(node);
                              }
                            }}
                            onMouseEnter={(event) => {
                              updateTooltipFromNode(node, {
                                clientX: event.clientX,
                                clientY: event.clientY,
                              });
                            }}
                            onMouseLeave={() => setTooltip(null)}
                            onBlur={() => setTooltip(null)}
                          />

                          {showTitle && (
                            <g>
                              <text
                                x={x + 10}
                                y={titleY}
                                fill={isLeaf ? leafTextColor : 'var(--color-fg-primary)'}
                                style={{ fontSize: `${titleFontSize}px` }}
                                className="font-semibold leading-tight"
                              >
                                {wrappedLabelLines.map((line, lineIndex) => (
                                  <tspan
                                    key={`${nodeKey}-label-line-${lineIndex}`}
                                    x={x + 10}
                                    dy={lineIndex === 0 ? 0 : titleLineHeight}
                                  >
                                    {line}
                                  </tspan>
                                ))}
                              </text>
                              {showCount && (
                                <text
                                  x={x + 10}
                                  y={detailStartY}
                                  fill={isLeaf ? leafTextColor : 'var(--color-fg-secondary)'}
                                  style={{ fontSize: `${detailFontSize}px` }}
                                  className="leading-tight"
                                >
                                  {t('usageInsightsV2.tooltipCurrent', { count: node.value ?? 0 })}
                                </text>
                              )}
                              {showDelta && (
                                <text
                                  x={x + 10}
                                  y={deltaY}
                                  fill={isLeaf ? leafTextColor : 'var(--color-fg-secondary)'}
                                  style={{ fontSize: `${detailFontSize}px` }}
                                  className="font-semibold leading-tight"
                                >
                                  {t('usageInsightsV2.tooltipDelta', {
                                    value: formatDeltaRate(
                                      node.data.deltaRate ?? 0,
                                      comparableCounts.current,
                                      comparableCounts.previous,
                                    ),
                                  })}
                                </text>
                              )}
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                )}

                {shouldShowPareto && hasParetoData && (
                  <svg
                    viewBox={`0 0 ${treemapSize.width} ${treemapSize.height}`}
                    preserveAspectRatio="xMidYMid meet"
                    className="block h-full w-full"
                    role="img"
                    aria-label={t('usageInsightsV2.paretoAria')}
                    data-testid="usage-v2-pareto"
                  >
                    {(() => {
                      const leftPadding = Math.max(174, Math.min(292, treemapSize.width * 0.31));
                      const rightPadding = 126;
                      const topPadding = 18;
                      const bottomPadding = 18;
                      const innerWidth = Math.max(treemapSize.width - leftPadding - rightPadding, 1);
                      const innerHeight = Math.max(treemapSize.height - topPadding - bottomPadding, 1);
                      const rowHeight = innerHeight / Math.max(paretoRows.length, 1);
                      const targetX = leftPadding + innerWidth * PARETO_TARGET_RATIO;

                      return (
                        <>
                          <line
                            x1={targetX}
                            y1={topPadding - 4}
                            x2={targetX}
                            y2={topPadding + innerHeight + 2}
                            stroke="var(--color-primary)"
                            strokeWidth={2}
                            strokeDasharray="6 3"
                            opacity={0.8}
                          />
                          <text
                            x={targetX + 4}
                            y={topPadding - 6}
                            className="fill-[var(--color-primary)] text-[11px] font-semibold"
                          >
                            {t('usageInsightsV2.paretoTargetLabel', { value: Math.round(PARETO_TARGET_RATIO * 100) })}
                          </text>

                          {paretoRows.map((row, index) => {
                            const y = topPadding + index * rowHeight + 2;
                            const barHeight = Math.max(rowHeight - 6, 8);
                            const barY = y;
                            const usageRatio =
                              paretoMaxUseCount > 0 ? clamp01(row.currentUseCount / paretoMaxUseCount) : 0;
                            const barWidth =
                              paretoMaxUseCount > 0 ? (row.currentUseCount / paretoMaxUseCount) * innerWidth : 0;
                            const barX = leftPadding;
                            const barColor = getLeafFillColor(row.deltaRate, usageRatio, chartPalette);
                            const strokeColor = getLeafStrokeColor(row.deltaRate, usageRatio, chartPalette);
                            const isSelected = row.componentId !== null && row.componentId === selectedComponentId;
                            const labelLimit = Math.max(12, Math.floor((leftPadding - 44) / 9.1));
                            const rowLabel = truncateLabel(`${index + 1}. ${row.label}`, labelLimit);
                            const comparableCounts = getComparableCounts(
                              row.currentUseCount,
                              row.previousUseCount,
                              row.currentTimeQualifiedCount,
                              row.previousTimeQualifiedCount,
                            );
                            const deltaText = formatDeltaRate(
                              row.deltaRate,
                              comparableCounts.current,
                              comparableCounts.previous,
                            );

                            return (
                              <g key={`${row.id}:${index}`}>
                                <rect
                                  x={leftPadding - 8}
                                  y={barY - 1}
                                  width={innerWidth + 12}
                                  height={barHeight + 2}
                                  rx={7}
                                  fill="color-mix(in srgb, var(--color-bg-surface) 88%, transparent)"
                                  opacity={0.4}
                                />
                                <text
                                  x={leftPadding - 26}
                                  y={barY + barHeight / 2 + 4}
                                  textAnchor="end"
                                  className="fill-[var(--color-fg-secondary)] text-[12px] font-medium"
                                >
                                  {rowLabel}
                                </text>
                                <rect
                                  x={barX}
                                  y={barY}
                                  width={Math.max(barWidth, 2)}
                                  height={barHeight}
                                  rx={6}
                                  fill={barColor}
                                  fillOpacity={row.isAggregate ? 0.72 : 0.95}
                                  stroke={isSelected ? 'var(--color-primary)' : strokeColor}
                                  strokeWidth={isSelected ? 4 : 1}
                                  role="button"
                                  tabIndex={0}
                                  aria-label={t('usageInsightsV2.leafTileAria', {
                                    name: row.label,
                                    count: row.currentUseCount,
                                  })}
                                  onClick={(event) => {
                                    if (row.componentId) setSelectedComponentId(row.componentId);
                                    updateTooltipFromMetric(
                                      {
                                        title: row.label,
                                        currentUseCount: row.currentUseCount,
                                        previousUseCount: row.previousUseCount,
                                        currentTimeQualifiedCount: row.currentTimeQualifiedCount,
                                        currentCountOnlyCount: row.currentCountOnlyCount,
                                        previousTimeQualifiedCount: row.previousTimeQualifiedCount,
                                        deltaRate: row.deltaRate,
                                        share: row.share,
                                      },
                                      {
                                        clientX: event.clientX,
                                        clientY: event.clientY,
                                      },
                                    );
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault();
                                      if (row.componentId) setSelectedComponentId(row.componentId);
                                    }
                                  }}
                                  onMouseEnter={(event) => {
                                    updateTooltipFromMetric(
                                      {
                                        title: row.label,
                                        currentUseCount: row.currentUseCount,
                                        previousUseCount: row.previousUseCount,
                                        currentTimeQualifiedCount: row.currentTimeQualifiedCount,
                                        currentCountOnlyCount: row.currentCountOnlyCount,
                                        previousTimeQualifiedCount: row.previousTimeQualifiedCount,
                                        deltaRate: row.deltaRate,
                                        share: row.share,
                                      },
                                      {
                                        clientX: event.clientX,
                                        clientY: event.clientY,
                                      },
                                    );
                                  }}
                                  onMouseLeave={() => setTooltip(null)}
                                  onBlur={() => setTooltip(null)}
                                />
                                <text
                                  x={Math.min(barX + barWidth + 8, barX + innerWidth - 4)}
                                  y={barY + barHeight / 2 + 4}
                                  className="fill-[var(--color-fg-secondary)] text-[11px] font-medium"
                                >
                                  {deltaText
                                    ? t('usageInsightsV2.paretoRowMeta', {
                                        count: row.currentUseCount,
                                        delta: deltaText,
                                      })
                                    : t('usageInsightsV2.paretoRowMetaNoDelta', {
                                        count: row.currentUseCount,
                                      })}
                                </text>
                              </g>
                            );
                          })}

                          <polyline
                            points={paretoRows
                              .map((row, index) => {
                                const cx = leftPadding + row.cumulativeShare * innerWidth;
                                const cy = topPadding + index * rowHeight + rowHeight / 2;
                                return `${cx},${cy}`;
                              })
                              .join(' ')}
                            fill="none"
                            stroke="var(--color-primary)"
                            strokeWidth={2.4}
                          />
                          {paretoRows.map((row, index) => {
                            const cx = leftPadding + row.cumulativeShare * innerWidth;
                            const cy = topPadding + index * rowHeight + rowHeight / 2;
                            return (
                              <circle
                                key={`pareto-dot-${row.id}-${index}`}
                                cx={cx}
                                cy={cy}
                                r={2.8}
                                fill="var(--color-primary)"
                                opacity={0.86}
                              />
                            );
                          })}
                        </>
                      );
                    })()}
                  </svg>
                )}

                {shouldShowSunburst && hasSunburstData && (
                  <svg
                    viewBox={`0 0 ${treemapSize.width} ${treemapSize.height}`}
                    preserveAspectRatio="xMidYMid meet"
                    className="block h-full w-full"
                    role="img"
                    aria-label={t('usageInsightsV2.sunburstAria')}
                    data-testid="usage-v2-sunburst"
                  >
                    <g transform={`translate(${treemapSize.width / 2} ${treemapSize.height / 2})`}>
                      {sunburstNodes.map((node, index) => {
                        const path = buildAnnularSectorPath(node.x0, node.x1, node.y0, node.y1);
                        if (!path) return null;

                        if (node.data.kind === 'type') {
                          const typeLabel =
                            node.data.componentType ? getTypeLabel(t, node.data.componentType) : node.data.label;
                          return (
                            <path
                              key={`${node.data.id}:${index}`}
                              d={path}
                              fill={TYPE_COLORS[node.data.componentType ?? 'skill']}
                              fillOpacity={0.25}
                              stroke="var(--color-border-primary)"
                              strokeWidth={1}
                              role="button"
                              tabIndex={0}
                              aria-label={t('usageInsightsV2.typeTileAria', {
                                type: typeLabel,
                                count: node.value ?? 0,
                              })}
                              onClick={() => {
                                if (node.data.componentType) setFocusedType(node.data.componentType);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  if (node.data.componentType) setFocusedType(node.data.componentType);
                                }
                              }}
                              onMouseEnter={(event) => {
                                const totalUseCount = Math.max(visibleData.summary.totalCurrentUseCount, 1);
                                setTooltip({
                                  x: event.clientX,
                                  y: event.clientY,
                                  title: typeLabel,
                                  lines: [
                                    t('usageInsightsV2.tooltipCurrent', { count: node.value ?? 0 }),
                                    t('usageInsightsV2.tooltipShare', {
                                      value: Math.round(clamp01((node.value ?? 0) / totalUseCount) * 100),
                                    }),
                                  ],
                                });
                              }}
                              onMouseLeave={() => setTooltip(null)}
                              onBlur={() => setTooltip(null)}
                            />
                          );
                        }

                        const usageRatio =
                          node.data.kind === 'leaf' && maxSunburstLeafUseCount > 0
                            ? clamp01((node.value ?? 0) / maxSunburstLeafUseCount)
                            : 0;
                        const isSelected =
                          node.data.kind === 'leaf' &&
                          node.data.componentId !== null &&
                          node.data.componentId === selectedComponentId;
                        const fillColor = getLeafFillColor(
                          node.data.deltaRate ?? 0,
                          usageRatio,
                          chartPalette,
                        );
                        const strokeColor = getLeafStrokeColor(
                          node.data.deltaRate ?? 0,
                          usageRatio,
                          chartPalette,
                        );

                        return (
                          <path
                            key={`${node.data.id}:${index}`}
                            d={path}
                            fill={fillColor}
                            fillOpacity={node.data.isActive === false ? 0.48 : 0.96}
                            stroke={isSelected ? 'var(--color-primary)' : strokeColor}
                            strokeWidth={isSelected ? 4 : 1}
                            strokeDasharray={
                              getCountOnlyRatio(
                                node.data.currentCountOnlyCount ?? 0,
                                node.value ?? 0,
                              ) >= 0.5 && !isSelected
                                ? '5 2'
                                : undefined
                            }
                            role="button"
                            tabIndex={0}
                            aria-label={t('usageInsightsV2.leafTileAria', {
                              name: node.data.label,
                              count: node.value ?? 0,
                            })}
                            onClick={(event) => {
                              if (node.data.componentId) setSelectedComponentId(node.data.componentId);
                              updateTooltipFromMetric(
                                {
                                  title: node.data.label,
                                  currentUseCount: node.value ?? 0,
                                  previousUseCount: node.data.previousUseCount ?? 0,
                                  currentTimeQualifiedCount: node.data.currentTimeQualifiedCount ?? 0,
                                  currentCountOnlyCount: node.data.currentCountOnlyCount ?? 0,
                                  previousTimeQualifiedCount: node.data.previousTimeQualifiedCount ?? 0,
                                  deltaRate: node.data.deltaRate ?? 0,
                                  share: node.data.share ?? 0,
                                },
                                {
                                  clientX: event.clientX,
                                  clientY: event.clientY,
                                },
                              );
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                if (node.data.componentId) setSelectedComponentId(node.data.componentId);
                              }
                            }}
                            onMouseEnter={(event) => {
                              updateTooltipFromMetric(
                                {
                                  title: node.data.label,
                                  currentUseCount: node.value ?? 0,
                                  previousUseCount: node.data.previousUseCount ?? 0,
                                  currentTimeQualifiedCount: node.data.currentTimeQualifiedCount ?? 0,
                                  currentCountOnlyCount: node.data.currentCountOnlyCount ?? 0,
                                  previousTimeQualifiedCount: node.data.previousTimeQualifiedCount ?? 0,
                                  deltaRate: node.data.deltaRate ?? 0,
                                  share: node.data.share ?? 0,
                                },
                                {
                                  clientX: event.clientX,
                                  clientY: event.clientY,
                                },
                              );
                            }}
                            onMouseLeave={() => setTooltip(null)}
                            onBlur={() => setTooltip(null)}
                          />
                        );
                      })}

                      <circle
                        cx={0}
                        cy={0}
                        r={Math.max((sunburstRoot?.y1 ?? 0) * 0.24, 42)}
                        fill="var(--color-bg-surface, #f8fafc)"
                        stroke="var(--color-border-primary)"
                      />
                      <text
                        x={0}
                        y={-6}
                        textAnchor="middle"
                        className="fill-[var(--color-fg-primary)] text-[14px] font-semibold"
                      >
                        {selectedMetric?.componentName
                          ? truncateLabel(selectedMetric.componentName, 18)
                          : t('usageInsightsV2.viewModeSunburst')}
                      </text>
                      <text
                        x={0}
                        y={14}
                        textAnchor="middle"
                        className="fill-[var(--color-fg-secondary)] text-[12px]"
                      >
                        {t('usageInsightsV2.tooltipCurrent', { count: selectedCurrentUseCount })}
                      </text>
                    </g>
                  </svg>
                )}

                {tooltip && (
                  <div
                    className="usage-v2-tooltip pointer-events-none fixed z-50 max-w-[20rem] rounded-md border border-theme px-2.5 py-2 text-xs shadow-lg"
                    style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
                    data-testid="usage-v2-tooltip"
                  >
                    <p className="font-semibold text-theme-primary">{tooltip.title}</p>
                    {tooltip.lines.map((line) => (
                      <p key={line} className="text-theme-secondary">
                        {line}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <section
                className="mt-3 rounded-lg border border-theme bg-theme-elevated p-2.5"
                data-testid="usage-v2-heat-strip-panel"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-theme-primary">{t('usageInsightsV2.heatStripTitle')}</h3>
                  <p className="text-sm text-theme-secondary">{t('usageInsightsV2.heatStripHint')}</p>
                </div>

                {!selectedComponentId && (
                  <p className="text-xs text-theme-secondary" data-testid="usage-v2-heat-strip-empty-selection">
                    {t('usageInsightsV2.heatStripEmptySelection')}
                  </p>
                )}

                {selectedComponentId && timelineLoading && (
                  <div className="grid grid-cols-12 gap-1" data-testid="usage-v2-heat-strip-loading">
                    {Array.from({ length: 24 }).map((_, index) => (
                      <div key={index} className="h-3 animate-pulse rounded border border-theme bg-theme-surface" />
                    ))}
                  </div>
                )}

                {selectedComponentId && !timelineLoading && isTimelineError && (
                  <div className="text-xs text-theme-secondary">
                    <p>{t('usageInsightsV2.heatStripLoadError')}</p>
                    <button
                      type="button"
                      onClick={() => {
                        void refetchTimeline();
                      }}
                      className="mt-2 h-7 rounded-md border border-theme px-2 text-xs text-theme-primary"
                    >
                      {t('common:retry')}
                    </button>
                  </div>
                )}

                {selectedComponentId && !timelineLoading && !isTimelineError && heatStripCells.length === 0 && (
                  <p className="text-xs text-theme-secondary" data-testid="usage-v2-heat-strip-empty-data">
                    {t('usageInsightsV2.heatStripEmptyData')}
                  </p>
                )}

                {selectedComponentId && !timelineLoading && !isTimelineError && heatStripCells.length > 0 && (
                  <div
                    className="grid gap-1"
                    style={{ gridTemplateColumns: `repeat(${heatStripCells.length}, minmax(0, 1fr))` }}
                    aria-label={t('usageInsightsV2.heatStripAria')}
                    data-testid="usage-v2-heat-strip"
                  >
                    {heatStripCells.map((cell) => (
                      <div
                        key={cell.date}
                        role="img"
                        aria-label={t('usageInsightsV2.heatCellAria', { date: cell.date, count: cell.count })}
                        title={t('usageInsightsV2.heatCellAria', { date: cell.date, count: cell.count })}
                        className={`h-6 rounded-[4px] border border-theme ${getHeatClass(cell.level)}`}
                      />
                    ))}
                  </div>
                )}
              </section>
            </section>

            <aside className="space-y-3">
              <section
                className="rounded-lg border border-theme bg-theme-elevated p-3"
                data-testid="usage-v2-action-queue"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-theme-primary">
                    {t('usageInsightsV2.actionQueueTitle')}
                  </h3>
                  <span className="text-[0.95rem] text-theme-secondary">
                    {t('usageInsightsV2.actionQueueCount', { count: visibleData.cleanupCandidates.length })}
                  </span>
                </div>
                <p className="mb-3 text-[0.95rem] text-theme-secondary">
                  {t('usageInsightsV2.actionQueueHint')}
                </p>

                {visibleData.cleanupCandidates.length === 0 ? (
                  <p className="rounded-md border border-theme bg-theme-surface px-2 py-2 text-sm text-theme-secondary">
                    {t('usageInsightsV2.emptyQueue')}
                  </p>
                ) : (
                  <ul className="max-h-72 space-y-2 overflow-auto" data-testid="usage-v2-action-queue-list">
                    {visibleData.cleanupCandidates.map((candidate) => {
                      const checked = selectedQueueIds.has(candidate.componentId);
                      const queueMetric = metricsById.get(candidate.componentId);
                      const queueComparableCounts = queueMetric
                        ? getComparableCounts(
                            queueMetric.currentUseCount,
                            queueMetric.previousUseCount,
                            queueMetric.currentTimeQualifiedCount,
                            queueMetric.previousTimeQualifiedCount,
                          )
                        : null;
                      const queueDeltaText = queueMetric
                        ? formatDeltaRate(
                            queueMetric.deltaRate,
                            queueComparableCounts?.current ?? 0,
                            queueComparableCounts?.previous ?? 0,
                          )
                        : null;

                      return (
                        <li
                          key={candidate.componentId}
                          className={`rounded-md border px-2.5 py-2 ${
                            selectedComponentId === candidate.componentId
                              ? 'border-[var(--color-primary)] bg-theme-surface'
                              : 'border-theme bg-theme-surface'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleQueueSelection(candidate.componentId)}
                              aria-label={t('usageInsightsV2.selectCandidateAria', {
                                name: candidate.componentName,
                              })}
                              data-testid={`usage-v2-queue-checkbox-${candidate.componentId}`}
                              className="mt-1 h-4 w-4 rounded border-theme"
                            />

                            <button
                              type="button"
                              onClick={() => setSelectedComponentId(candidate.componentId)}
                              className="min-w-0 flex-1 text-left"
                              data-testid={`usage-v2-queue-item-${candidate.componentId}`}
                            >
                              <p className="truncate text-base font-semibold text-theme-primary">
                                {candidate.componentName}
                              </p>
                              <p className="mt-0.5 text-[0.95rem] text-theme-secondary">
                                {getCandidateReasonLabel(t, candidate)}
                              </p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[0.95rem] text-theme-secondary">
                                <span
                                  className={`rounded-full px-1.5 py-0.5 ${
                                    candidate.tier === 'strong'
                                      ? 'badge-theme-danger'
                                      : 'badge-theme-warning'
                                  }`}
                                >
                                  {getCandidateTierLabel(t, candidate)}
                                </span>
                                {queueMetric && queueDeltaText && (
                                  <span
                                    className={`rounded-full px-1.5 py-0.5 ${getDeltaBadgeClass(
                                      queueMetric.deltaRate,
                                      queueComparableCounts?.current ?? 0,
                                      queueComparableCounts?.previous ?? 0,
                                    )}`}
                                    data-testid={`usage-v2-queue-delta-${candidate.componentId}`}
                                  >
                                    {queueDeltaText}
                                  </span>
                                )}
                                <span>
                                  {candidate.ageDays === null
                                    ? t('usageInsightsV2.ageUnknown')
                                    : t('usageInsightsV2.ageDays', { days: candidate.ageDays })}
                                </span>
                              </div>
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <button
                  type="button"
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={selectedQueueItems.length === 0 || isDisabling}
                  data-testid="usage-v2-disable-button"
                  className="mt-3 inline-flex h-9 items-center justify-center rounded-md border border-theme px-3 text-sm font-medium text-theme-primary transition-colors hover:bg-theme-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isDisabling
                    ? t('usageInsightsV2.disablePending')
                    : t('usageInsightsV2.disableSelected', {
                        count: selectedQueueItems.length,
                      })}
                </button>
              </section>

              <section
                className={`rounded-lg border-2 p-3 transition-colors ${
                  selectedMetric || selectedCandidate
                    ? 'border-[var(--color-primary)] bg-theme-elevated shadow-sm'
                    : 'border-theme bg-theme-elevated'
                }`}
              >
                {!(selectedMetric || selectedCandidate) && (
                  <p className="text-sm text-theme-tertiary">{t('usageInsightsV2.selectionTitle')}</p>
                )}
                {(selectedMetric || selectedCandidate) && (
                  <div data-testid="usage-v2-selected-stats">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {(selectedMetric?.componentType || selectedCandidate?.componentType) && (
                          <span
                            className="inline-block h-3 w-3 shrink-0 rounded-full"
                            style={{
                              backgroundColor: TYPE_COLORS[(selectedMetric?.componentType ?? selectedCandidate?.componentType) as UsageComponentType] ?? 'var(--color-fg-tertiary)',
                              boxShadow: `0 0 6px ${TYPE_COLORS[(selectedMetric?.componentType ?? selectedCandidate?.componentType) as UsageComponentType] ?? 'transparent'}80`,
                            }}
                          />
                        )}
                        <p
                          className="truncate text-base font-semibold text-theme-primary"
                          data-testid="usage-v2-selected-name"
                        >
                          {selectedMetric?.componentName ?? selectedCandidate?.componentName ?? t('usageInsightsV2.unknownName')}
                        </p>
                      </div>
                      {selectedComponentId && (
                        <Link
                          to={`/components/${selectedComponentId}`}
                          className="shrink-0 text-sm text-[var(--color-primary)] transition-colors hover:underline"
                        >
                          {t('usageInsightsV2.viewDetail', { defaultValue: '상세 →' })}
                        </Link>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-theme-secondary">
                      {selectedTypeLabel && (
                        <span className="rounded-md border border-theme bg-theme-elevated px-2 py-0.5 text-xs text-theme-secondary">
                          {selectedTypeLabel}
                        </span>
                      )}
                      <span className="font-semibold tabular-nums text-theme-primary">
                        {selectedCurrentUseCount.toLocaleString()}{t('usageInsightsV2.tooltipCurrentShort', { defaultValue: '회' })}
                      </span>
                      {selectedDeltaText && selectedMetric && selectedDeltaReliable && (
                        <span className="group relative">
                          <span
                            className={`cursor-default rounded-full px-1.5 py-0.5 text-xs ${getDeltaBadgeClass(
                              selectedMetric.deltaRate,
                              selectedComparableCounts?.current ?? 0,
                              selectedComparableCounts?.previous ?? 0,
                            )}`}
                          >
                            {selectedDeltaText}
                          </span>
                          <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-theme bg-theme-elevated px-2 py-1 text-xs text-theme-secondary opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                            {t('usageInsightsV2.tooltipPrevious', { count: selectedPreviousUseCount })}
                          </span>
                        </span>
                      )}
                      {selectedSharePercent !== null && (
                        <span className="text-xs text-theme-tertiary">
                          {t('usageInsightsV2.tooltipShare', { value: selectedSharePercent })}
                        </span>
                      )}
                    </div>

                    {selectedSharePercent !== null && (
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-theme-skeleton">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.max(selectedSharePercent, 2)}%`,
                            backgroundColor: TYPE_COLORS[(selectedMetric?.componentType ?? selectedCandidate?.componentType) as UsageComponentType] ?? 'var(--color-primary)',
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </section>
            </aside>
          </div>

        </div>
      )}

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="bg-theme-surface border-theme text-theme-primary">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('usageInsightsV2.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('usageInsightsV2.confirmDesc', { count: selectedQueueItems.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="usage-v2-disable-cancel">
              {t('usageInsightsV2.confirmCancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDisable} data-testid="usage-v2-disable-confirm">
              {t('usageInsightsV2.confirmExecute')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
