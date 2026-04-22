/**
 * Dashboard API MSW Handlers
 * GET /api/stats, GET /api/system/status
 * Based on docs/api/spec.md §4
 */

import { http, HttpResponse } from 'msw';

const mockStats = {
  total_skills: 42,
  total_agents: 12,
  total_commands: 18,
  total_hooks: 5,
  total_rules: 23,
  active_count: 89,
  inactive_count: 11,
  total_count: 100,
  trends: {
    skills: { value: 3, percentage: 7.7, direction: 'up' as const },
    agents: { value: 1, percentage: 9.1, direction: 'up' as const },
    commands: { value: 0, percentage: 0.0, direction: 'neutral' as const },
    hooks: { value: -1, percentage: -16.7, direction: 'down' as const },
    rules: { value: 2, percentage: 9.5, direction: 'up' as const },
  },
};

const mockSystemStatus = {
  is_live: true,
  last_scan_at: '2026-02-12T10:00:00Z',
  active_workers: {
    watcher: true,
    usage_scanner: true,
  },
  health_score: 98,
};

const mockUsage = {
  ranking: [
    {
      component_id: 'comp_001',
      component_name: 'git-commit',
      component_type: 'skill',
      use_count: 42,
    },
  ],
  unused: [
    {
      component_name: 'unused-skill',
      component_type: 'skill',
      created_at: '2026-02-01T00:00:00Z',
    },
  ],
  total_sessions_parsed: 15,
  last_parsed_at: '2026-02-20T10:35:00Z',
};

const mockContextStats = {
  platforms: [
    {
      platform: 'claude_code',
      tiers: [
        {
          name: 'always',
          label: 'Always loaded',
          description: 'Injected at the start of every conversation',
          components: [
            {
              id: 'comp_001',
              name: 'git-commit',
              type: 'skill',
              estimated_tokens: 900,
              file_size_bytes: 1800,
            },
          ],
          total_tokens: 900,
          count: 1,
          counts_toward_limit: true,
        },
        {
          name: 'catalog',
          label: 'Catalog',
          description: 'Listed in component index',
          components: [
            {
              id: 'comp_005',
              name: 'code-reviewer',
              type: 'agent',
              estimated_tokens: 600,
              file_size_bytes: 1200,
            },
          ],
          total_tokens: 600,
          count: 1,
          counts_toward_limit: true,
        },
      ],
      recommended_max_tokens: 12000,
      effective_tokens: 1500,
      status: 'ok' as const,
    },
    {
      platform: 'cursor',
      tiers: [
        {
          name: 'always',
          label: 'Always apply',
          description: 'Always-applied rules',
          components: [],
          total_tokens: 0,
          count: 0,
          counts_toward_limit: true,
        },
      ],
      recommended_max_tokens: 8000,
      effective_tokens: 0,
      status: 'ok' as const,
    },
  ],
  suggestions: [],
};

const mockUsageTimelineByComponentId: Record<
  string,
  { component_id: string; component_name: string; timeline: Array<{ date: string; count: number; intensity: number }> }
> = {
  comp_001: {
    component_id: 'comp_001',
    component_name: 'git-commit',
    timeline: [
      { date: '2026-02-26', count: 6, intensity: 0.6 },
      { date: '2026-02-27', count: 8, intensity: 0.8 },
      { date: '2026-02-28', count: 10, intensity: 1 },
    ],
  },
  comp_005: {
    component_id: 'comp_005',
    component_name: 'code-reviewer',
    timeline: [
      { date: '2026-02-26', count: 2, intensity: 0.4 },
      { date: '2026-02-27', count: 3, intensity: 0.6 },
      { date: '2026-02-28', count: 5, intensity: 1 },
    ],
  },
};

const mockUsageScanResult = {
  sessions_parsed: 3,
  stats_saved: 12,
};

const mockUsageResetResult = {
  deleted_sessions: 15,
  deleted_parse_states: 43,
  preserved_sessions: 3,
  preserved_parse_states: 3,
};

export const dashboardHandlers = [
  // GET /api/stats
  http.get('*/api/stats', () => {
    return HttpResponse.json(mockStats);
  }),

  // GET /api/system/status
  http.get('*/api/system/status', () => {
    return HttpResponse.json(mockSystemStatus);
  }),

  // GET /api/usage
  http.get('*/api/usage', () => {
    return HttpResponse.json(mockUsage);
  }),

  // GET /api/usage/component
  http.get('*/api/usage/component', ({ request }) => {
    const url = new URL(request.url);
    const componentId = url.searchParams.get('component_id') ?? 'comp_001';

    return HttpResponse.json(
      mockUsageTimelineByComponentId[componentId] ?? {
        component_id: componentId,
        component_name: componentId,
        timeline: [],
      }
    );
  }),

  // GET /api/stats/context
  http.get('*/api/stats/context', () => {
    return HttpResponse.json(mockContextStats);
  }),

  // POST /api/usage/scan
  http.post('*/api/usage/scan', () => {
    return HttpResponse.json(mockUsageScanResult);
  }),

  // POST /api/usage/reset
  http.post('*/api/usage/reset', () => {
    return HttpResponse.json(mockUsageResetResult);
  }),
];
