import type { ReactElement } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, afterEach, afterAll, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { UsageTreemapPanel } from './UsageTreemapPanel';

const toggledIds: string[] = [];

const componentListResponse = [
  {
    id: 'comp_skill_main',
    type: 'skill',
    name: 'main-skill',
    description: 'main skill',
    enabled: true,
    tags: [],
    project_id: 'proj_vibesmith',
    project_name: 'vibesmith',
    path: '/tmp/skill.md',
    created_at: '2025-12-01T00:00:00Z',
    updated_at: '2026-02-28T00:00:00Z',
  },
  {
    id: 'comp_cmd_old',
    type: 'command',
    name: 'legacy-command',
    description: 'legacy command',
    enabled: true,
    tags: [],
    project_id: 'proj_vibesmith',
    project_name: 'vibesmith',
    path: '/tmp/command.md',
    created_at: '2025-12-15T00:00:00Z',
    updated_at: '2026-02-28T00:00:00Z',
  },
  {
    id: 'comp_agent_low',
    type: 'agent',
    name: 'sleepy-agent',
    description: 'sleepy agent',
    enabled: true,
    tags: [],
    project_id: 'proj_vibesmith',
    project_name: 'vibesmith',
    path: '/tmp/agent.md',
    created_at: '2026-02-20T00:00:00Z',
    updated_at: '2026-02-28T00:00:00Z',
  },
];

const usageByDays: Record<number, unknown> = {
  30: {
    ranking: [
      {
        component_id: 'comp_skill_main',
        component_name: 'main-skill',
        component_type: 'skill',
        use_count: 10,
      },
      {
        component_id: 'comp_cmd_old',
        component_name: 'legacy-command',
        component_type: 'command',
        use_count: 0,
      },
    ],
    unused: [],
    total_sessions_parsed: 21,
    last_parsed_at: '2026-02-28T09:00:00Z',
  },
  60: {
    ranking: [
      {
        component_id: 'comp_skill_main',
        component_name: 'main-skill',
        component_type: 'skill',
        use_count: 14,
      },
      {
        component_id: 'comp_cmd_old',
        component_name: 'legacy-command',
        component_type: 'command',
        use_count: 6,
      },
    ],
    unused: [],
    total_sessions_parsed: 34,
    last_parsed_at: '2026-02-28T09:00:00Z',
  },
  90: {
    ranking: [
      {
        component_id: 'comp_skill_main',
        component_name: 'main-skill',
        component_type: 'skill',
        use_count: 16,
      },
      {
        component_id: 'comp_cmd_old',
        component_name: 'legacy-command',
        component_type: 'command',
        use_count: 6,
      },
      {
        component_id: 'comp_agent_low',
        component_name: 'sleepy-agent',
        component_type: 'agent',
        use_count: 1,
      },
    ],
    unused: [],
    total_sessions_parsed: 55,
    last_parsed_at: '2026-02-28T09:00:00Z',
  },
};

const usageTimelineResponse = {
  comp_skill_main: {
    component_id: 'comp_skill_main',
    component_name: 'main-skill',
    timeline: [
      { date: '2026-02-26', count: 2, intensity: 0.4 },
      { date: '2026-02-27', count: 3, intensity: 0.6 },
      { date: '2026-02-28', count: 5, intensity: 1 },
    ],
  },
  comp_cmd_old: {
    component_id: 'comp_cmd_old',
    component_name: 'legacy-command',
    timeline: [
      { date: '2026-02-26', count: 0, intensity: 0 },
      { date: '2026-02-27', count: 1, intensity: 0.4 },
      { date: '2026-02-28', count: 3, intensity: 1 },
    ],
  },
  comp_agent_low: {
    component_id: 'comp_agent_low',
    component_name: 'sleepy-agent',
    timeline: [
      { date: '2026-02-27', count: 0, intensity: 0 },
      { date: '2026-02-28', count: 1, intensity: 1 },
    ],
  },
};

const server = setupServer(
  http.get('*/api/usage', ({ request }) => {
    const url = new URL(request.url);
    const days = Number(url.searchParams.get('days') ?? '30');
    const body = (usageByDays[days] ?? usageByDays[30]) as Record<string, unknown>;
    return HttpResponse.json(body);
  }),
  http.get('*/api/components', () => HttpResponse.json(componentListResponse)),
  http.get('*/api/usage/component', ({ request }) => {
    const url = new URL(request.url);
    const componentId = url.searchParams.get('component_id') ?? '';
    const body = usageTimelineResponse[componentId as keyof typeof usageTimelineResponse] ?? {
      component_id: componentId,
      component_name: componentId,
      timeline: [],
    };
    return HttpResponse.json(body);
  }),
  http.post('*/api/components/:componentId/toggle', ({ params }) => {
    const componentId = String(params.componentId);
    toggledIds.push(componentId);
    return HttpResponse.json({ id: componentId, enabled: false });
  }),
);

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-03-01T00:00:00Z'));
  server.listen();
});
beforeEach(() => {
  toggledIds.length = 0;
});
afterEach(() => server.resetHandlers());
afterAll(() => {
  server.close();
  vi.useRealTimers();
});

describe('UsageTreemapPanel', () => {
  it('supports treemap zoom and breadcrumb navigation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UsageTreemapPanel projectId="proj_vibesmith" />);

    expect(await screen.findByTestId('usage-v2-treemap')).toBeInTheDocument();
    const skillTypeTile = screen.queryByTestId('usage-v2-type-tile-skill');
    if (skillTypeTile) {
      await user.click(skillTypeTile);
    }

    expect(await screen.findByTestId('usage-v2-leaf-tile-comp_skill_main')).toBeInTheDocument();
    const breadcrumb = screen.getByTestId('usage-v2-breadcrumb');
    if (skillTypeTile) {
      expect(within(breadcrumb).getByText(/Skills|스킬/i)).toBeInTheDocument();
    } else {
      expect(within(breadcrumb).queryByText(/Skills|스킬/i)).not.toBeInTheDocument();
    }
    expect(screen.getByTestId('usage-v2-delta-legend')).toBeInTheDocument();

    await user.click(within(breadcrumb).getByRole('button', { name: /All|전체/i }));
    expect(await screen.findByTestId('usage-v2-treemap')).toBeInTheDocument();
    expect(
      screen.queryByTestId('usage-v2-type-tile-skill') ??
        screen.queryByTestId('usage-v2-leaf-tile-comp_skill_main'),
    ).toBeInTheDocument();
  });

  it('switches visualization modes between treemap, pareto, and sunburst', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UsageTreemapPanel projectId="proj_vibesmith" />);

    expect(await screen.findByTestId('usage-v2-treemap')).toBeInTheDocument();

    await user.click(screen.getByTestId('usage-v2-viewmode-pareto'));
    expect(await screen.findByTestId('usage-v2-pareto')).toBeInTheDocument();

    await user.click(screen.getByTestId('usage-v2-viewmode-sunburst'));
    expect(await screen.findByTestId('usage-v2-sunburst')).toBeInTheDocument();
  });

  it('selects strong candidates by default and disables after confirmation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UsageTreemapPanel projectId="proj_vibesmith" />);

    const strongCheckbox = await screen.findByTestId('usage-v2-queue-checkbox-comp_cmd_old');
    const mediumCheckbox = await screen.findByTestId('usage-v2-queue-checkbox-comp_agent_low');

    expect(strongCheckbox).toBeChecked();
    expect(mediumCheckbox).not.toBeChecked();

    const disableButton = screen.getByTestId('usage-v2-disable-button');
    expect(disableButton).toBeEnabled();
    expect(await screen.findByTestId('usage-v2-queue-delta-comp_cmd_old')).toHaveTextContent('-100%');

    await user.click(disableButton);
    await user.click(await screen.findByTestId('usage-v2-disable-confirm'));

    expect(toggledIds).toContain('comp_cmd_old');
  });

  it('renders heat strip for selected component', async () => {
    renderWithProviders(<UsageTreemapPanel projectId="proj_vibesmith" />);

    expect(await screen.findByTestId('usage-v2-selected-name')).toHaveTextContent('main-skill');
    expect(await screen.findByTestId('usage-v2-selected-stats')).toHaveTextContent('+150%');
    expect(await screen.findByTestId('usage-v2-heat-strip')).toBeInTheDocument();
  });
});
