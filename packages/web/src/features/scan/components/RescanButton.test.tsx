import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import i18n from '@/i18n';
import { RescanButton } from './RescanButton';

type MockProject = {
  id: string;
  name: string;
  path: string;
  is_global: boolean;
  component_count: number;
  last_scanned_at: string;
  created_at: string;
  updated_at: string;
};

type MockComponent = {
  id: string;
  type: string;
  name: string;
  description: string;
  enabled: boolean;
  tags: string[];
  project_id: string;
  project_name: string;
  path: string;
  created_at: string;
  updated_at: string;
};

let projectsPayload: MockProject[] = [];
let projectsStatus = 200;
let componentsPayload: MockComponent[] = [];
let componentsStatus = 200;
let scanStatus = 200;
let scanCallCount = 0;

const server = setupServer(
  http.get('*/api/projects', () => HttpResponse.json(projectsPayload, { status: projectsStatus })),
  http.get('*/api/components', () => HttpResponse.json(componentsPayload, { status: componentsStatus })),
  http.post('*/api/scan', () => {
    scanCallCount += 1;
    return HttpResponse.json(
      {
        scanned_projects: 3,
        total_components: 25,
      },
      { status: scanStatus }
    );
  })
);

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  const now = new Date().toISOString();
  projectsStatus = 200;
  componentsStatus = 200;
  scanStatus = 200;
  scanCallCount = 0;
  projectsPayload = [
    {
      id: 'proj-1',
      name: 'Demo',
      path: '/tmp/demo',
      is_global: false,
      component_count: 2,
      last_scanned_at: now,
      created_at: now,
      updated_at: now,
    },
  ];
  componentsPayload = [
    {
      id: 'cmp-1',
      type: 'skill',
      name: 'Skill A',
      description: 'a',
      enabled: true,
      tags: [],
      project_id: 'proj-1',
      project_name: 'Demo',
      path: '/tmp/demo/.claude/skills/a.md',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'cmp-2',
      type: 'command',
      name: 'Command B',
      description: 'b',
      enabled: true,
      tags: [],
      project_id: 'proj-1',
      project_name: 'Demo',
      path: '/tmp/demo/.claude/commands/b.md',
      created_at: now,
      updated_at: now,
    },
  ];
});

describe('RescanButton', () => {
  it('should render with sync aria-label', () => {
    renderWithProviders(<RescanButton />);
    const ariaLabel = i18n.t('scan:syncAria');
    expect(screen.getByRole('button', { name: ariaLabel })).toBeInTheDocument();
  });

  it('should complete quick sync without rescan when data is consistent', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RescanButton />);

    const button = screen.getByRole('button', { name: i18n.t('scan:syncAria') });
    await user.click(button);

    await waitFor(() => {
      expect(button).not.toBeDisabled();
      expect(
        screen.getByText(i18n.t('scan:syncStatusQuickComplete'))
      ).toBeInTheDocument();
    });

    expect(scanCallCount).toBe(0);
  });

  it('should run auto rescan when mismatch is detected', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    projectsPayload = [{ ...projectsPayload[0], component_count: 10 }];

    renderWithProviders(<RescanButton onSuccess={onSuccess} />);

    const button = screen.getByRole('button', { name: i18n.t('scan:syncAria') });
    await user.click(button);

    await waitFor(() => {
      expect(scanCallCount).toBe(1);
    });

    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        scanned_projects: 3,
        total_components: 25,
      })
    );
    expect(
      screen.getByText(i18n.t('scan:syncStatusRescanRunning'))
    ).toBeInTheDocument();
  });

  it('should expose force full scan action when sync fails', async () => {
    const user = userEvent.setup();
    projectsStatus = 500;

    renderWithProviders(<RescanButton />);

    const button = screen.getByRole('button', { name: i18n.t('scan:syncAria') });
    await user.click(button);

    const forceButton = await screen.findByRole('button', {
      name: i18n.t('scan:forceRescan'),
    });
    expect(scanCallCount).toBe(0);

    projectsStatus = 200;
    await user.click(forceButton);

    await waitFor(() => {
      expect(scanCallCount).toBe(1);
      expect(
        screen.getByText(i18n.t('scan:syncStatusRescanRunning'))
      ).toBeInTheDocument();
    });
  });

  it('should apply variant and size classes', () => {
    renderWithProviders(
      <RescanButton variant="secondary" size="sm" />
    );
    const button = screen.getByRole('button', { name: i18n.t('scan:syncAria') });
    expect(button).toHaveClass('btn-theme-surface');
    expect(button).toHaveClass('px-3');
    expect(button).toHaveClass('py-1.5');
  });
});
