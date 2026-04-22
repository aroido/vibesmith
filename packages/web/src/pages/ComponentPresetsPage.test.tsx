import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n';

vi.mock('@/common/utils', async () => {
  const actual = await vi.importActual<typeof import('@/common/utils')>('@/common/utils');
  return {
    ...actual,
    showErrorToast: vi.fn(),
    showSuccessToast: vi.fn(),
  };
});

import { showErrorToast } from '@/common/utils';
import { ComponentPresetsPage } from './ComponentPresetsPage';

type MockPreset = {
  id: string;
  name: string;
  component_type: 'skill' | 'agent' | 'command' | 'hook' | 'rule';
  platform: 'claude_code' | 'cursor';
  description: string;
  scope: 'system' | 'user';
  tags: string[];
  latest_revision: number;
  revisions_count: number;
  created_at: string;
  updated_at: string;
};

type MockCollectionItem = {
  order_index: number;
  preset_id: string;
  pin_mode: 'pin' | 'latest';
  pinned_revision: number | null;
  resolved_revision: number;
  alias_name: string | null;
};

type MockCollection = {
  id: string;
  name: string;
  description: string;
  scope: 'system' | 'user';
  tags: string[];
  latest_revision: number;
  revisions_count: number;
  items_count: number;
  created_at: string;
  updated_at: string;
  items: MockCollectionItem[];
};

type MockProject = {
  id: string;
  name: string;
  path: string;
  is_global: boolean;
  platform?: string;
  platforms?: string[];
  component_count: number;
  last_scanned_at?: string;
  dir_exists?: boolean;
  has_claude_dir?: boolean;
  created_at: string;
  updated_at: string;
};

type MockProjectComponent = {
  id: string;
  type: 'skill' | 'agent' | 'command' | 'hook' | 'rule';
  name: string;
  description?: string;
  content?: string;
  frontmatter?: Record<string, unknown>;
  enabled: boolean;
  tags: string[];
  project_id: string;
  path: string;
  platform: 'claude_code' | 'cursor';
  created_at: string;
  updated_at: string;
};

const BASE_PRESETS: MockPreset[] = [
  {
    id: 'preset-alpha',
    name: 'Preset Alpha',
    component_type: 'skill',
    platform: 'claude_code',
    description: 'Alpha skill preset',
    scope: 'user',
    tags: ['team', 'core'],
    latest_revision: 3,
    revisions_count: 3,
    created_at: '2026-02-26T00:00:00Z',
    updated_at: '2026-02-26T01:00:00Z',
  },
  {
    id: 'preset-beta',
    name: 'Preset Beta',
    component_type: 'command',
    platform: 'cursor',
    description: 'Beta command preset',
    scope: 'user',
    tags: ['ops'],
    latest_revision: 2,
    revisions_count: 2,
    created_at: '2026-02-26T00:00:00Z',
    updated_at: '2026-02-26T02:00:00Z',
  },
  {
    id: 'preset-gamma',
    name: 'Preset Gamma',
    component_type: 'skill',
    platform: 'claude_code',
    description: 'Gamma system preset',
    scope: 'system',
    tags: ['shared'],
    latest_revision: 1,
    revisions_count: 1,
    created_at: '2026-02-26T00:00:00Z',
    updated_at: '2026-02-26T03:00:00Z',
  },
];

const PRESET_REVISIONS: Record<string, number[]> = {
  'preset-alpha': [3, 2, 1],
  'preset-beta': [2, 1],
  'preset-gamma': [1],
};

const BASE_PROJECTS: MockProject[] = [
  {
    id: 'project-alpha',
    name: 'Project Alpha',
    path: '/tmp/project-alpha',
    is_global: false,
    component_count: 2,
    created_at: '2026-02-26T00:00:00Z',
    updated_at: '2026-02-26T00:00:00Z',
  },
  {
    id: 'project-beta',
    name: 'Project Beta',
    path: '/tmp/project-beta',
    is_global: false,
    component_count: 1,
    created_at: '2026-02-26T00:00:00Z',
    updated_at: '2026-02-26T00:00:00Z',
  },
];

const PROJECT_COMPONENTS_BY_PROJECT: Record<string, MockProjectComponent[]> = {
  'project-alpha': [
    {
      id: 'component-alpha-skill',
      type: 'skill',
      name: 'Alpha Skill',
      description: 'alpha skill from project',
      content: '# Alpha Skill\n\nDo alpha work.',
      frontmatter: { name: 'alpha-skill' },
      enabled: true,
      tags: ['alpha'],
      project_id: 'project-alpha',
      path: '/tmp/project-alpha/.claude/skills/alpha.md',
      platform: 'claude_code',
      created_at: '2026-02-26T00:00:00Z',
      updated_at: '2026-02-26T00:00:00Z',
    },
    {
      id: 'component-alpha-command',
      type: 'command',
      name: 'Alpha Command',
      description: 'alpha command from project',
      content: '# Alpha Command\n\nDo command work.',
      frontmatter: { name: 'alpha-command' },
      enabled: false,
      tags: ['alpha', 'cmd'],
      project_id: 'project-alpha',
      path: '/tmp/project-alpha/.claude/commands/alpha.md',
      platform: 'cursor',
      created_at: '2026-02-26T00:00:00Z',
      updated_at: '2026-02-26T00:00:00Z',
    },
  ],
  'project-beta': [
    {
      id: 'component-beta-hook',
      type: 'hook',
      name: 'Beta Hook',
      description: 'beta hook from project',
      content: '{"hooks":{}}',
      frontmatter: { description: 'beta hook' },
      enabled: true,
      tags: ['beta'],
      project_id: 'project-beta',
      path: '/tmp/project-beta/.cursor/hooks/beta.md',
      platform: 'cursor',
      created_at: '2026-02-26T00:00:00Z',
      updated_at: '2026-02-26T00:00:00Z',
    },
  ],
};

const BASE_COLLECTIONS: MockCollection[] = [
  {
    id: 'collection-default',
    name: 'Default Collection',
    description: 'default workflow set',
    scope: 'user',
    tags: ['default'],
    latest_revision: 1,
    revisions_count: 1,
    items_count: 1,
    created_at: '2026-02-26T00:00:00Z',
    updated_at: '2026-02-26T00:00:00Z',
    items: [
      {
        order_index: 0,
        preset_id: 'preset-alpha',
        pin_mode: 'latest',
        pinned_revision: null,
        resolved_revision: 3,
        alias_name: null,
      },
    ],
  },
];

let presets: MockPreset[] = [];
let collections: MockCollection[] = [];
let lastCreatePresetPayload: Record<string, unknown> | null = null;

function cloneCollections(source: MockCollection[]): MockCollection[] {
  return source.map((collection) => ({
    ...collection,
    tags: [...collection.tags],
    items: collection.items.map((item) => ({ ...item })),
  }));
}

function resetMockStore() {
  presets = BASE_PRESETS.map((preset) => ({ ...preset, tags: [...preset.tags] }));
  collections = cloneCollections(BASE_COLLECTIONS);
  lastCreatePresetPayload = null;
}

function toCollectionSummary(collection: MockCollection) {
  return {
    id: collection.id,
    name: collection.name,
    description: collection.description,
    scope: collection.scope,
    tags: collection.tags,
    latest_revision: collection.latest_revision,
    revisions_count: collection.revisions_count,
    items_count: collection.items_count,
    created_at: collection.created_at,
    updated_at: collection.updated_at,
  };
}

function resolveCollectionItem(payloadItem: {
  preset_id: string;
  order_index?: number | null;
  pin_mode: 'pin' | 'latest';
  pinned_revision?: number | null;
  alias_name?: string | null;
}) {
  const preset = presets.find((item) => item.id === payloadItem.preset_id);
  const latestRevision = preset?.latest_revision ?? 1;

  return {
    order_index: payloadItem.order_index ?? 0,
    preset_id: payloadItem.preset_id,
    pin_mode: payloadItem.pin_mode,
    pinned_revision: payloadItem.pin_mode === 'pin' ? (payloadItem.pinned_revision ?? null) : null,
    resolved_revision:
      payloadItem.pin_mode === 'pin'
        ? (payloadItem.pinned_revision ?? latestRevision)
        : latestRevision,
    alias_name: payloadItem.alias_name ?? null,
  } satisfies MockCollectionItem;
}

const server = setupServer(
  http.get('*/api/projects', () => HttpResponse.json(BASE_PROJECTS)),

  http.get('*/api/projects/:projectId/components', ({ params }) => {
    const projectId = String(params.projectId);
    return HttpResponse.json({
      items: PROJECT_COMPONENTS_BY_PROJECT[projectId] ?? [],
      total: (PROJECT_COMPONENTS_BY_PROJECT[projectId] ?? []).length,
    });
  }),

  http.get('*/api/components/:componentId', ({ params }) => {
    const componentId = String(params.componentId);
    const component = Object.values(PROJECT_COMPONENTS_BY_PROJECT)
      .flat()
      .find((item) => item.id === componentId);

    if (!component) {
      return HttpResponse.json({ detail: 'not found' }, { status: 404 });
    }

    return HttpResponse.json({
      id: component.id,
      type: component.type,
      name: component.name,
      description: component.description ?? '',
      path: component.path,
      tags: component.tags,
      enabled: component.enabled,
      content: component.content ?? '# Component',
      frontmatter: component.frontmatter ?? {},
      project_id: component.project_id,
      platform: component.platform,
      created_at: component.created_at,
      updated_at: component.updated_at,
    });
  }),

  http.get('*/api/presets', ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.toLowerCase() ?? '';
    const scope = url.searchParams.get('scope') ?? 'all';
    const componentType = url.searchParams.get('component_type');
    const platform = url.searchParams.get('platform');

    const filtered = presets.filter((preset) => {
      if (scope !== 'all' && preset.scope !== scope) return false;
      if (componentType && preset.component_type !== componentType) return false;
      if (platform && preset.platform !== platform) return false;
      if (!q) return true;

      const searchable = [preset.name, preset.description, ...(preset.tags ?? [])]
        .join(' ')
        .toLowerCase();
      return searchable.includes(q);
    });

    return HttpResponse.json({
      items: filtered.map((preset) => ({ ...preset })),
      total: filtered.length,
    });
  }),

  http.post('*/api/presets', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    lastCreatePresetPayload = body;
    const next: MockPreset = {
      id: `preset-${presets.length + 1}`,
      name: String(body.name ?? ''),
      component_type: body.component_type as MockPreset['component_type'],
      platform: body.platform as MockPreset['platform'],
      description: String(body.description ?? ''),
      scope: (body.scope as MockPreset['scope']) ?? 'user',
      tags: Array.isArray(body.tags) ? (body.tags as string[]) : [],
      latest_revision: 1,
      revisions_count: 1,
      created_at: '2026-02-26T10:00:00Z',
      updated_at: '2026-02-26T10:00:00Z',
    };

    presets.unshift(next);
    PRESET_REVISIONS[next.id] = [1];

    return HttpResponse.json(next, { status: 201 });
  }),

  http.delete('*/api/presets/:presetId', ({ params }) => {
    const presetId = String(params.presetId);
    presets = presets.filter((preset) => preset.id !== presetId);
    collections = collections.map((collection) => {
      const nextItems = collection.items.filter((item) => item.preset_id !== presetId);
      return {
        ...collection,
        items: nextItems,
        items_count: nextItems.length,
      };
    });
    return HttpResponse.json({ message: 'deleted' });
  }),

  http.get('*/api/presets/:presetId/revisions', ({ params }) => {
    const presetId = String(params.presetId);
    const revisions = PRESET_REVISIONS[presetId] ?? [1];
    return HttpResponse.json({
      items: revisions.map((revision) => ({
        revision,
        created_at: '2026-02-26T00:00:00Z',
        created_by: null,
        change_note: `rev ${revision}`,
        content_hash: `hash-${presetId}-${revision}`,
      })),
      total: revisions.length,
    });
  }),

  http.get('*/api/collections', ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.toLowerCase() ?? '';
    const scope = url.searchParams.get('scope') ?? 'all';

    const filtered = collections.filter((collection) => {
      if (scope !== 'all' && collection.scope !== scope) return false;
      if (!q) return true;
      const searchable = [collection.name, collection.description].join(' ').toLowerCase();
      return searchable.includes(q);
    });

    return HttpResponse.json({
      items: filtered.map(toCollectionSummary),
      total: filtered.length,
    });
  }),

  http.get('*/api/collections/:collectionId', ({ params }) => {
    const collectionId = String(params.collectionId);
    const found = collections.find((collection) => collection.id === collectionId);

    if (!found) {
      return HttpResponse.json({ detail: 'not found' }, { status: 404 });
    }

    return HttpResponse.json({
      ...toCollectionSummary(found),
      items: found.items,
    });
  }),

  http.post('*/api/collections', async ({ request }) => {
    const body = (await request.json()) as {
      name: string;
      description?: string;
      scope?: 'system' | 'user';
      tags?: string[];
      items: {
        preset_id: string;
        order_index?: number | null;
        pin_mode: 'pin' | 'latest';
        pinned_revision?: number | null;
        alias_name?: string | null;
      }[];
    };
    const collectionId = `collection-${collections.length + 1}`;
    const resolvedItems = body.items.map(resolveCollectionItem);
    const next: MockCollection = {
      id: collectionId,
      name: body.name,
      description: body.description ?? '',
      scope: body.scope ?? 'user',
      tags: body.tags ?? [],
      latest_revision: 1,
      revisions_count: 1,
      items_count: resolvedItems.length,
      created_at: '2026-02-26T10:00:00Z',
      updated_at: '2026-02-26T10:00:00Z',
      items: resolvedItems,
    };

    collections.unshift(next);

    return HttpResponse.json(
      {
        ...toCollectionSummary(next),
        items: next.items,
      },
      { status: 201 }
    );
  }),

  http.put('*/api/collections/:collectionId', async ({ params, request }) => {
    const collectionId = String(params.collectionId);
    const body = (await request.json()) as {
      name: string;
      description?: string;
      scope?: 'system' | 'user';
      tags?: string[];
      items: {
        preset_id: string;
        order_index?: number | null;
        pin_mode: 'pin' | 'latest';
        pinned_revision?: number | null;
        alias_name?: string | null;
      }[];
    };

    collections = collections.map((collection) => {
      if (collection.id !== collectionId) return collection;

      const resolvedItems = body.items.map(resolveCollectionItem);
      return {
        ...collection,
        name: body.name,
        description: body.description ?? '',
        scope: body.scope ?? collection.scope,
        tags: body.tags ?? [],
        latest_revision: collection.latest_revision + 1,
        revisions_count: collection.revisions_count + 1,
        items_count: resolvedItems.length,
        updated_at: '2026-02-26T11:00:00Z',
        items: resolvedItems,
      };
    });

    const updated = collections.find((collection) => collection.id === collectionId);
    if (!updated) {
      return HttpResponse.json({ detail: 'not found' }, { status: 404 });
    }

    return HttpResponse.json({
      ...toCollectionSummary(updated),
      items: updated.items,
    });
  }),

  http.delete('*/api/collections/:collectionId', ({ params }) => {
    const collectionId = String(params.collectionId);
    collections = collections.filter((collection) => collection.id !== collectionId);
    return HttpResponse.json({ message: 'deleted' });
  })
);

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>
  );
}

async function openPresetBundleTab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('preset-workspace-tab-bundle'));
  await screen.findByTestId('bundle-source-mode-preset');
}

async function openPresetCreateTab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('preset-workspace-tab-create'));
  await screen.findByTestId('preset-create-name-input');
}

async function openDefaultCollectionEditor(user: ReturnType<typeof userEvent.setup>) {
  await openPresetBundleTab(user);
  await user.click(await screen.findByRole('button', { name: /Default Collection/i }));
  await screen.findByTestId('collection-item-preset-alpha');
}

beforeAll(() => server.listen());
beforeEach(async () => {
  resetMockStore();
  await i18n.changeLanguage('en');
  vi.mocked(showErrorToast).mockClear();
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => server.close());

describe('ComponentPresetsPage', () => {
  it('renders preset list and supports search filter', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ComponentPresetsPage />);

    expect(await screen.findByTestId('preset-list-card-preset-alpha')).toBeInTheDocument();
    expect(screen.getByTestId('preset-list-card-preset-beta')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(
      i18n.t('components:workspace.presets.searchPlaceholder')
    );
    await user.clear(searchInput);
    await user.type(searchInput, 'beta');

    await waitFor(() => {
      expect(screen.queryByTestId('preset-list-card-preset-alpha')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('preset-list-card-preset-beta')).toBeInTheDocument();
  });

  it('switches across preset list/create/bundle tabs', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ComponentPresetsPage />);

    expect(await screen.findByTestId('preset-list-card-preset-alpha')).toBeInTheDocument();

    await openPresetCreateTab(user);
    expect(screen.getByTestId('preset-create-name-input')).toBeInTheDocument();
    expect(screen.queryByTestId('preset-list-card-preset-alpha')).not.toBeInTheDocument();

    await openPresetBundleTab(user);
    expect(screen.getByTestId('bundle-source-mode-preset')).toBeInTheDocument();
    expect(screen.queryByTestId('preset-create-name-input')).not.toBeInTheDocument();
  });

  it('supports collection add/remove/reorder from preset source library', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ComponentPresetsPage />);
    await openDefaultCollectionEditor(user);

    await user.click(screen.getByTestId('bundle-from-preset-add-button-preset-beta'));

    expect(screen.getByTestId('collection-item-preset-beta')).toBeInTheDocument();

    const betaRow = screen.getByTestId('collection-item-preset-beta');
    await user.click(
      within(betaRow).getByRole('button', {
        name: new RegExp(i18n.t('components:workspace.presets.moveUpAction'), 'i'),
      })
    );

    await waitFor(() => {
      const rows = screen.getAllByTestId(/collection-item-/);
      expect(within(rows[0]).getByText(/#1 Preset Beta/i)).toBeInTheDocument();
    });

    const firstRow = screen.getAllByTestId(/collection-item-/)[0];
    await user.click(
      within(firstRow).getByRole('button', {
        name: new RegExp(i18n.t('components:workspace.presets.removeComponentAction'), 'i'),
      })
    );

    await waitFor(() => {
      expect(screen.queryByTestId('collection-item-preset-beta')).not.toBeInTheDocument();
    });
  });

  it('supports keyboard add from preset source card', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ComponentPresetsPage />);
    await openDefaultCollectionEditor(user);

    const sourceCard = await screen.findByTestId('bundle-from-preset-source-card-preset-alpha');
    sourceCard.focus();
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByTestId('collection-item-preset-alpha')).toBeInTheDocument();
    });
  });

  it('supports pin/latest toggle with pinned revision selector', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ComponentPresetsPage />);
    await openDefaultCollectionEditor(user);

    const pinModeSelect = (await screen.findByLabelText(
      'pin-mode-preset-alpha'
    )) as HTMLSelectElement;
    const revisionSelect = (await screen.findByLabelText(
      'pinned-revision-preset-alpha'
    )) as HTMLSelectElement;

    await user.selectOptions(pinModeSelect, 'pin');

    await waitFor(() => {
      expect(revisionSelect).toBeEnabled();
    });

    await user.selectOptions(revisionSelect, '2');
    expect(revisionSelect).toHaveValue('2');

    await user.selectOptions(pinModeSelect, 'latest');

    await waitFor(() => {
      expect(revisionSelect).toBeDisabled();
    });
  });

  it('shows validation error and error toast when saving invalid preset bundle', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ComponentPresetsPage />);
    await openPresetBundleTab(user);

    await user.click(
      await screen.findByRole('button', {
        name: new RegExp(i18n.t('components:workspace.presets.collectionNewAction'), 'i'),
      })
    );

    const saveButton = await screen.findByRole('button', {
      name: new RegExp(i18n.t('components:workspace.presets.collectionSaveAction'), 'i'),
    });
    await user.click(saveButton);

    const validationMessage = i18n.t('components:workspace.presets.validationCollectionNameRequired');
    expect(await screen.findByRole('alert')).toHaveTextContent(validationMessage);
    expect(showErrorToast).toHaveBeenCalledWith(validationMessage);
  });

  it('applies starter template by type/platform and submits with generated content', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ComponentPresetsPage />);

    await openPresetCreateTab(user);
    await user.type(screen.getByTestId('preset-create-name-input'), 'cursor-rule-starter');
    await user.selectOptions(screen.getByTestId('preset-create-type-select'), 'rule');
    await user.selectOptions(screen.getByTestId('preset-create-platform-select'), 'cursor');

    const frontmatterInput = screen.getByTestId('preset-create-frontmatter-input');
    const contentInput = screen.getByTestId('preset-create-content-input');

    expect((frontmatterInput as HTMLTextAreaElement).value).toContain('"globs"');
    expect((frontmatterInput as HTMLTextAreaElement).value).toContain('"alwaysApply"');
    expect((contentInput as HTMLTextAreaElement).value).toContain('## Requirements');

    await user.click(
      screen.getByRole('button', {
        name: new RegExp(i18n.t('components:workspace.presets.presetCreateAction'), 'i'),
      })
    );

    await waitFor(() => {
      expect(lastCreatePresetPayload).not.toBeNull();
    });

    expect(lastCreatePresetPayload).toMatchObject({
      name: 'cursor-rule-starter',
      component_type: 'rule',
      platform: 'cursor',
    });
    expect(
      (lastCreatePresetPayload as { frontmatter?: Record<string, unknown> }).frontmatter
    ).toMatchObject({
      description: 'Rule description and intent',
      globs: ['**/*.ts', '**/*.tsx'],
      alwaysApply: false,
    });
    expect(String((lastCreatePresetPayload as { content?: string }).content ?? '')).toContain(
      '# Project Rule'
    );
  });

  it('applies localized starter template content in Korean', async () => {
    const user = userEvent.setup();
    await i18n.changeLanguage('ko');
    renderWithProviders(<ComponentPresetsPage />);

    await openPresetCreateTab(user);
    await user.type(screen.getByTestId('preset-create-name-input'), 'cursor-rule-starter');
    await user.selectOptions(screen.getByTestId('preset-create-type-select'), 'rule');
    await user.selectOptions(screen.getByTestId('preset-create-platform-select'), 'cursor');

    const frontmatterInput = screen.getByTestId('preset-create-frontmatter-input');
    const contentInput = screen.getByTestId('preset-create-content-input');
    expect((frontmatterInput as HTMLTextAreaElement).value).toContain('"description": "규칙 설명과 의도"');
    expect((contentInput as HTMLTextAreaElement).value).toContain('# 프로젝트 규칙');
    expect((contentInput as HTMLTextAreaElement).value).toContain('## 요구사항');
  });

  it('creates preset from project component via modal and adds it to collection', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ComponentPresetsPage />);
    await openDefaultCollectionEditor(user);

    await user.click(screen.getByTestId('bundle-source-mode-project-component'));
    const projectSelect = screen.getByTestId('bundle-from-project-project-select');
    await waitFor(() => {
      expect(within(projectSelect).getByRole('option', { name: 'Project Alpha' })).toBeInTheDocument();
    });

    await user.selectOptions(projectSelect, 'project-alpha');
    await screen.findByTestId('bundle-from-project-add-button-component-alpha-skill');
    await user.click(screen.getByTestId('bundle-from-project-add-button-component-alpha-skill'));

    const modal = await screen.findByRole('dialog');
    const createButton = within(modal).getByRole('button', {
      name: new RegExp(i18n.t('components:workspace.presets.presetCreateAction'), 'i'),
    });
    await waitFor(() => {
      expect(createButton).toBeEnabled();
    });
    await user.click(createButton);

    await waitFor(
      () => {
        expect(lastCreatePresetPayload).not.toBeNull();
      },
      { timeout: 3000 }
    );
    expect(lastCreatePresetPayload).toMatchObject({
      name: 'Alpha Skill',
      component_type: 'skill',
      platform: 'claude_code',
      scope: 'user',
    });
  });

  it('contains required i18n keys for component-preset/preset-bundle workflow', async () => {
    const requiredKeys = [
      'workspace.presets.collectionPinModeLabel',
      'workspace.presets.collectionPinnedRevisionLabel',
      'workspace.presets.validationCollectionItemsRequired',
      'workspace.presets.collectionSaveAction',
      'workspace.presets.collectionNewAction',
      'workspace.presets.bundleSourceModePreset',
      'workspace.presets.bundleSourceModeProjectComponents',
      'workspace.presets.workspaceTabCreate',
      'workspace.presets.workspaceTabBundle',
      'workspace.presets.presetCreateAction',
      'workspace.presets.templateStarterFrontmatterDescriptionSkill',
      'workspace.presets.templateStarterRuleCursorTitle',
      'workspace.presets.bundleCanvasDragHint',
      'workspace.presets.bundleSourceCardKeyboardLabel',
    ] as const;

    for (const key of requiredKeys) {
      expect(i18n.exists(`components:${key}`, { lng: 'en' })).toBe(true);
      expect(i18n.exists(`components:${key}`, { lng: 'ko' })).toBe(true);
    }
  });
});
