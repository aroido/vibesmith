import { describe, expect, it } from 'vitest';
import type { UsageScopeIndex, UsageSummary } from '../../types';
import {
  buildCleanupCandidates,
  buildUsageInsightsV2Data,
  buildUsageTreemapMetrics,
  calculateDeltaRate,
  calculatePreviousUseCount,
  isProtectedUsageComponent,
} from './usageTreemapTransform';

function createUsageSummary(
  ranking: UsageSummary['ranking'],
  unused: UsageSummary['unused'] = []
): UsageSummary {
  return {
    ranking,
    unused,
    totalSessionsParsed: 10,
    lastParsedAt: new Date('2026-02-28T00:00:00Z'),
  };
}

describe('usageTreemapTransform', () => {
  it('calculates previous count and delta rate from current vs comparison windows', () => {
    expect(calculatePreviousUseCount(10, 16)).toBe(6);
    expect(calculatePreviousUseCount(8, 4)).toBe(0);
    expect(calculateDeltaRate(10, 6)).toBeCloseTo(0.6667, 4);
    expect(calculateDeltaRate(5, 0)).toBe(0);
  });

  it('builds treemap metrics using id key and fallback key', () => {
    const currentSummary = createUsageSummary([
      {
        componentId: 'comp_a',
        componentName: 'alpha-skill',
        componentType: 'skill',
        useCount: 10,
      },
      {
        componentId: null,
        componentName: 'unknown-usage',
        componentType: 'skill',
        useCount: 5,
      },
    ]);
    const comparisonSummary = createUsageSummary([
      {
        componentId: 'comp_a',
        componentName: 'alpha-skill',
        componentType: 'skill',
        useCount: 16,
      },
      {
        componentId: null,
        componentName: 'unknown-usage',
        componentType: 'skill',
        useCount: 7,
      },
    ]);
    const scopeIndex: UsageScopeIndex = {
      comp_a: {
        id: 'comp_a',
        name: 'alpha-skill',
        type: 'skill',
        projectId: 'proj_1',
        projectName: 'Project 1',
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        tags: [],
      },
    };

    const metrics = buildUsageTreemapMetrics(
      currentSummary,
      comparisonSummary,
      scopeIndex
    );

    expect(metrics).toHaveLength(2);
    expect(metrics[0].componentId).toBe('comp_a');
    expect(metrics[0].previousUseCount).toBe(6);
    expect(metrics[0].deltaRate).toBeCloseTo(0.6667, 4);
    expect(metrics[0].share).toBeCloseTo(10 / 15, 4);

    expect(metrics[1].componentId).toBeNull();
    expect(metrics[1].previousUseCount).toBe(2);
    expect(metrics[1].deltaRate).toBe(0);
  });

  it('calculates delta using only time-qualified counts', () => {
    const currentSummary = createUsageSummary([
      {
        componentId: 'comp_a',
        componentName: 'alpha-skill',
        componentType: 'skill',
        useCount: 110,
        timeQualifiedCount: 10,
        countOnlyCount: 100,
      },
    ]);
    const comparisonSummary = createUsageSummary([
      {
        componentId: 'comp_a',
        componentName: 'alpha-skill',
        componentType: 'skill',
        useCount: 115,
        timeQualifiedCount: 13,
        countOnlyCount: 102,
      },
    ]);
    const scopeIndex: UsageScopeIndex = {
      comp_a: {
        id: 'comp_a',
        name: 'alpha-skill',
        type: 'skill',
        projectId: 'proj_1',
        projectName: 'Project 1',
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        tags: [],
      },
    };

    const [metric] = buildUsageTreemapMetrics(
      currentSummary,
      comparisonSummary,
      scopeIndex
    );

    expect(metric.currentUseCount).toBe(110);
    expect(metric.previousUseCount).toBe(5);
    expect(metric.currentTimeQualifiedCount).toBe(10);
    expect(metric.previousTimeQualifiedCount).toBe(3);
    // (10 - 3) / 3 = +233%
    expect(metric.deltaRate).toBeCloseTo(7 / 3, 4);
  });

  it('classifies cleanup candidates with 30/90 policy and protected tag exclusion', () => {
    const now = new Date('2026-02-28T00:00:00Z');
    const scopeIndex: UsageScopeIndex = {
      comp_a: {
        id: 'comp_a',
        name: 'alpha-skill',
        type: 'skill',
        projectId: 'proj_1',
        projectName: 'Project 1',
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        tags: [],
      },
      comp_b: {
        id: 'comp_b',
        name: 'critical-command',
        type: 'command',
        projectId: 'proj_1',
        projectName: 'Project 1',
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        tags: ['critical'],
      },
      comp_c: {
        id: 'comp_c',
        name: 'beta-agent',
        type: 'agent',
        projectId: 'proj_2',
        projectName: 'Project 2',
        isActive: true,
        createdAt: new Date('2026-01-10T00:00:00Z'),
        tags: [],
      },
      comp_d: {
        id: 'comp_d',
        name: 'inactive-hook',
        type: 'hook',
        projectId: 'proj_2',
        projectName: 'Project 2',
        isActive: false,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        tags: [],
      },
      comp_e: {
        id: 'comp_e',
        name: 'new-skill',
        type: 'skill',
        projectId: 'proj_2',
        projectName: 'Project 2',
        isActive: true,
        createdAt: new Date('2026-02-20T00:00:00Z'),
        tags: [],
      },
      comp_f: {
        id: 'comp_f',
        name: 'old-unused-skill',
        type: 'skill',
        projectId: 'proj_2',
        projectName: 'Project 2',
        isActive: true,
        createdAt: new Date('2026-01-10T00:00:00Z'),
        tags: [],
      },
    };

    const usage30dSummary = createUsageSummary([
      {
        componentId: 'comp_a',
        componentName: 'alpha-skill',
        componentType: 'skill',
        useCount: 3,
      },
      {
        componentId: 'comp_c',
        componentName: 'beta-agent',
        componentType: 'agent',
        useCount: 1,
      },
    ]);
    const usage90dSummary = createUsageSummary([
      {
        componentId: 'comp_a',
        componentName: 'alpha-skill',
        componentType: 'skill',
        useCount: 8,
      },
      {
        componentId: 'comp_c',
        componentName: 'beta-agent',
        componentType: 'agent',
        useCount: 1,
      },
    ]);

    const candidates = buildCleanupCandidates(
      usage30dSummary,
      usage90dSummary,
      scopeIndex,
      now
    );

    expect(candidates.map((item) => item.componentId)).toEqual([
      'comp_f',
      'comp_e',
      'comp_c',
    ]);
    expect(candidates[0].tier).toBe('strong');
    expect(candidates[0].selectedByDefault).toBe(true);
    expect(candidates[1].tier).toBe('medium');
    expect(candidates[1].selectedByDefault).toBe(false);
    expect(candidates[2].last90DaysUseCount).toBe(1);
  });

  it('builds combined v2 dataset summary counts', () => {
    const scopeIndex: UsageScopeIndex = {
      comp_a: {
        id: 'comp_a',
        name: 'alpha-skill',
        type: 'skill',
        projectId: 'proj_1',
        projectName: 'Project 1',
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        tags: [],
      },
    };

    const data = buildUsageInsightsV2Data({
      currentSummary: createUsageSummary([
        {
          componentId: 'comp_a',
          componentName: 'alpha-skill',
          componentType: 'skill',
          useCount: 4,
        },
      ]),
      comparisonSummary: createUsageSummary([
        {
          componentId: 'comp_a',
          componentName: 'alpha-skill',
          componentType: 'skill',
          useCount: 6,
        },
      ]),
      usage30dSummary: createUsageSummary([]),
      usage90dSummary: createUsageSummary([]),
      scopeIndex,
      now: new Date('2026-02-28T00:00:00Z'),
    });

    expect(data.summary.totalCurrentUseCount).toBe(4);
    expect(data.summary.trackedComponentCount).toBe(1);
    expect(data.summary.strongCandidateCount).toBe(1);
    expect(data.summary.mediumCandidateCount).toBe(0);
  });

  it('detects protected tags case-insensitively', () => {
    expect(isProtectedUsageComponent(['Core'])).toBe(true);
    expect(isProtectedUsageComponent(['critical'])).toBe(true);
    expect(isProtectedUsageComponent(['protected'])).toBe(true);
    expect(isProtectedUsageComponent(['normal'])).toBe(false);
  });
});
