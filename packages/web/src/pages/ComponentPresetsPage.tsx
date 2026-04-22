import { useEffect, useMemo, useState, type DragEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  createCollection,
  createPreset,
  deleteCollection,
  deletePreset,
  getCollection,
  getCollections,
  getComponents,
  getProjectComponents,
  getProjects,
  getPresetRevisions,
  getPresets,
  updateCollection,
  type CollectionCreateRequest,
  type CollectionItemInput,
  type PinMode,
  type PresetComponentType,
  type PresetPlatform,
  type PresetScope,
  type PresetSummaryResponse,
  type PresetWritableScope,
} from '@/common/api';
import { ANALYTICS_NO_CAPTURE_CLASS } from '@/common/analytics/privacy';
import { showErrorToast, showSuccessToast } from '@/common/utils';
import { ComponentWorkspaceTabs, PageFrame } from '@/components/common';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { CreatePresetFromComponentModal } from '@/components/presets/CreatePresetFromComponentModal';
import { LoadSourceModal, type LoadSourceResult } from '@/components/presets/LoadSourceModal';

const COMPONENT_TYPES: PresetComponentType[] = ['skill', 'agent', 'command', 'hook', 'rule'];
const PLATFORMS: PresetPlatform[] = ['claude_code', 'cursor'];
const BUNDLE_SOURCE_PRESET_DRAG_TYPE = 'application/x-vibesmith-source-preset-id';
const BUNDLE_SOURCE_COMPONENT_DRAG_TYPE = 'application/x-vibesmith-source-component-id';

type BuilderPresetItem = {
  presetId: string;
  pinMode: PinMode;
  pinnedRevision: number | null;
  aliasName: string;
};

type PresetTypeFilter = 'all' | PresetComponentType;
type PresetPlatformFilter = 'all' | PresetPlatform;
type PresetWorkspaceTab = 'preset_list' | 'preset_create' | 'preset_bundle';
type BundleSourceMode = 'preset' | 'project_component';

function parseTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function parseFrontmatter(frontmatterText: string): Record<string, unknown> {
  const trimmed = frontmatterText.trim();
  if (!trimmed) return {};

  const parsed: unknown = JSON.parse(trimmed);
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('frontmatter should be a JSON object');
  }

  return parsed as Record<string, unknown>;
}

function toTemplateName(value: string, fallback: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return slug || fallback;
}

type StarterTemplateTranslator = (key: string, options?: Record<string, unknown>) => string;

function buildTypeStarterTemplate(input: {
  componentType: PresetComponentType;
  platform: PresetPlatform;
  name: string;
  t: StarterTemplateTranslator;
}): { frontmatter: Record<string, unknown>; content: string } {
  const templateName = toTemplateName(input.name, `${input.componentType}-preset`);
  const isCursor = input.platform === 'cursor';
  const translate = input.t;

  if (input.componentType === 'skill') {
    return {
      frontmatter: {
        name: templateName,
        description: translate('workspace.presets.templateStarterFrontmatterDescriptionSkill'),
      },
      content: [
        translate('workspace.presets.templateStarterSkillPurposeTitle'),
        translate('workspace.presets.templateStarterSkillPurposeItem'),
        '',
        translate('workspace.presets.templateStarterSkillWhenToUseTitle'),
        translate('workspace.presets.templateStarterSkillWhenToUseItemTrigger'),
        translate('workspace.presets.templateStarterSkillWhenToUseItemScope'),
        '',
        translate('workspace.presets.templateStarterSkillWorkflowTitle'),
        translate('workspace.presets.templateStarterSkillWorkflowStep1'),
        translate('workspace.presets.templateStarterSkillWorkflowStep2'),
        translate('workspace.presets.templateStarterSkillWorkflowStep3'),
        '',
        translate('workspace.presets.templateStarterSkillOutputTitle'),
        translate('workspace.presets.templateStarterSkillOutputItemFindings'),
        translate('workspace.presets.templateStarterSkillOutputItemChanges'),
        translate('workspace.presets.templateStarterSkillOutputItemVerification'),
      ].join('\n'),
    };
  }

  if (input.componentType === 'agent') {
    return {
      frontmatter: {
        name: templateName,
        description: translate('workspace.presets.templateStarterFrontmatterDescriptionAgent'),
        tools: ['Read', 'Grep', 'Glob', 'Bash'],
        model: 'sonnet',
      },
      content: [
        translate('workspace.presets.templateStarterAgentIntro'),
        '',
        translate('workspace.presets.templateStarterAgentWhenInvoked'),
        translate('workspace.presets.templateStarterAgentStep1'),
        translate('workspace.presets.templateStarterAgentStep2'),
        translate('workspace.presets.templateStarterAgentStep3'),
        '',
        translate('workspace.presets.templateStarterAgentOutputFormat'),
        translate('workspace.presets.templateStarterAgentOutputItemFindings'),
        translate('workspace.presets.templateStarterAgentOutputItemChanges'),
        translate('workspace.presets.templateStarterAgentOutputItemVerification'),
      ].join('\n'),
    };
  }

  if (input.componentType === 'command') {
    return {
      frontmatter: {
        name: templateName,
        description: translate('workspace.presets.templateStarterFrontmatterDescriptionCommand'),
        'argument-hint': '[target-or-context]',
        'allowed-tools': 'Read,Grep,Glob,Bash',
        model: 'sonnet',
      },
      content: [
        translate('workspace.presets.templateStarterCommandIntro'),
        '',
        translate('workspace.presets.templateStarterCommandInput'),
        '',
        translate('workspace.presets.templateStarterCommandStepsTitle'),
        translate('workspace.presets.templateStarterCommandStep1'),
        translate('workspace.presets.templateStarterCommandStep2'),
        translate('workspace.presets.templateStarterCommandStep3'),
      ].join('\n'),
    };
  }

  if (input.componentType === 'hook') {
    return {
      frontmatter: {
        description: translate('workspace.presets.templateStarterFrontmatterDescriptionHook'),
      },
      content: [
        '{',
        '  "hooks": {',
        '    "PostToolUse": [',
        '      {',
        '        "matcher": "Edit|Write|MultiEdit",',
        '        "hooks": [',
        '          {',
        '            "type": "command",',
        '            "command": "npm run lint --silent"',
        '          }',
        '        ]',
        '      }',
        '    ]',
        '  }',
        '}',
      ].join('\n'),
    };
  }

  return {
    frontmatter: isCursor
      ? {
          description: translate('workspace.presets.templateStarterFrontmatterDescriptionRuleCursor'),
          globs: ['**/*.ts', '**/*.tsx'],
          alwaysApply: false,
        }
      : {
          name: templateName,
          description: translate('workspace.presets.templateStarterFrontmatterDescriptionRuleClaude'),
        },
    content: isCursor
      ? [
          translate('workspace.presets.templateStarterRuleCursorTitle'),
          '',
          translate('workspace.presets.templateStarterRuleCursorScopeTitle'),
          translate('workspace.presets.templateStarterRuleCursorScopeItem'),
          '',
          translate('workspace.presets.templateStarterRuleCursorRequirementsTitle'),
          translate('workspace.presets.templateStarterRuleCursorRequirementsItem1'),
          translate('workspace.presets.templateStarterRuleCursorRequirementsItem2'),
          '',
          translate('workspace.presets.templateStarterRuleCursorDeliveryTitle'),
          translate('workspace.presets.templateStarterRuleCursorDeliveryItem'),
        ].join('\n')
      : [
          translate('workspace.presets.templateStarterRuleClaudeTitle'),
          '',
          translate('workspace.presets.templateStarterRuleClaudeScopeTitle'),
          translate('workspace.presets.templateStarterRuleClaudeScopeItem'),
          '',
          translate('workspace.presets.templateStarterRuleClaudeRequirementsTitle'),
          translate('workspace.presets.templateStarterRuleClaudeRequirementsItem1'),
          translate('workspace.presets.templateStarterRuleClaudeRequirementsItem2'),
        ].join('\n'),
  };
}

function serializeBuilderState(input: {
  selectedCollectionId: string | null;
  name: string;
  description: string;
  scope: PresetWritableScope;
  tags: string;
  items: BuilderPresetItem[];
}): string {
  return JSON.stringify({
    selectedCollectionId: input.selectedCollectionId,
    name: input.name,
    description: input.description,
    scope: input.scope,
    tags: input.tags,
    items: input.items.map((item) => ({
      presetId: item.presetId,
      pinMode: item.pinMode,
      pinnedRevision: item.pinnedRevision,
      aliasName: item.aliasName,
    })),
  });
}

function itemToRequest(item: BuilderPresetItem, orderIndex: number): CollectionItemInput {
  return {
    preset_id: item.presetId,
    order_index: orderIndex,
    pin_mode: item.pinMode,
    pinned_revision: item.pinMode === 'pin' ? item.pinnedRevision : null,
    alias_name: item.aliasName.trim() || null,
  };
}

export function ComponentPresetsPage() {
  const { t } = useTranslation('components');
  const queryClient = useQueryClient();
  const [activePresetWorkspaceTab, setActivePresetWorkspaceTab] =
    useState<PresetWorkspaceTab>('preset_list');

  const [presetSearchQuery, setPresetSearchQuery] = useState('');
  const [presetScope] = useState<PresetScope>('all');
  const [presetTypeFilter, setPresetTypeFilter] = useState<PresetTypeFilter>('all');
  const [presetPlatformFilter, setPresetPlatformFilter] = useState<PresetPlatformFilter>('all');
  const [presetTagFilter, setPresetTagFilter] = useState('');

  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createType, setCreateType] = useState<PresetComponentType>('skill');
  const [createPlatform, setCreatePlatform] = useState<PresetPlatform>('claude_code');
  const createScope: PresetWritableScope = 'user';
  const [createTags, setCreateTags] = useState('');
  const [createContent, setCreateContent] = useState('');
  const [createFrontmatter, setCreateFrontmatter] = useState('{}');
  const [createChangeNote, setCreateChangeNote] = useState('');
  const [isLoadSourceApplied, setIsLoadSourceApplied] = useState(false);
  const [isLoadSourceModalOpen, setIsLoadSourceModalOpen] = useState(false);
  const [bundleSourceProjectId, setBundleSourceProjectId] = useState('');
  const [bundleSourceMode, setBundleSourceMode] = useState<BundleSourceMode>('preset');
  const [bundleComponentSearchQuery, setBundleComponentSearchQuery] = useState('');
  const [isBundleCanvasDragOver, setIsBundleCanvasDragOver] = useState(false);
  const [isDraggingFromSource, setIsDraggingFromSource] = useState(false);
  const [presetFromComponentId, setPresetFromComponentId] = useState<string | null>(null);

  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [isCreatingNewCollection, setIsCreatingNewCollection] = useState(false);

  const [collectionName, setCollectionName] = useState('');
  const [collectionDescription, setCollectionDescription] = useState('');
  const [collectionTags, setCollectionTags] = useState('');
  const [collectionChangeNote, setCollectionChangeNote] = useState('');
  const [collectionEditScope, setCollectionEditScope] = useState<PresetWritableScope>('user');
  const [collectionItems, setCollectionItems] = useState<BuilderPresetItem[]>([]);
  const [collectionValidationMessage, setCollectionValidationMessage] = useState<string | null>(
    null
  );
  const [initialBuilderState, setInitialBuilderState] = useState(() =>
    serializeBuilderState({
      selectedCollectionId: null,
      name: '',
      description: '',
      scope: 'user',
      tags: '',
      items: [],
    })
  );

  const {
    data: presetsData,
    isLoading: isPresetsLoading,
    isError: isPresetsError,
  } = useQuery({
    queryKey: [
      'presets',
      'workspace-list',
      presetSearchQuery,
      presetScope,
      presetTypeFilter,
      presetPlatformFilter,
    ],
    queryFn: () =>
      getPresets({
        q: presetSearchQuery,
        scope: presetScope,
        component_type: presetTypeFilter === 'all' ? undefined : presetTypeFilter,
        platform: presetPlatformFilter === 'all' ? undefined : presetPlatformFilter,
        limit: 100,
        offset: 0,
      }),
  });

  const {
    data: presetCatalogData,
    isLoading: isPresetCatalogLoading,
    isError: isPresetCatalogError,
  } = useQuery({
    queryKey: ['presets', 'workspace-catalog'],
    queryFn: () =>
      getPresets({
        scope: 'all',
        limit: 100,
        offset: 0,
      }),
  });
  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'preset-from-project'],
    queryFn: () => getProjects(),
  });
  const {
    data: bundleSourceProjectComponentsData,
    isLoading: isBundleSourceProjectComponentsLoading,
    isError: isBundleSourceProjectComponentsError,
  } = useQuery({
    queryKey: ['project-components', 'bundle-from-project', bundleSourceProjectId || '__all__'],
    queryFn: () =>
      bundleSourceProjectId
        ? getProjectComponents(bundleSourceProjectId)
        : getComponents().then((items) =>
            items.map((c) => ({
              id: c.id,
              type: c.type,
              name: c.name,
              description: c.description,
              enabled: c.enabled,
              tags: c.tags,
              project_id: c.project_id,
              path: c.path,
              created_at: c.created_at,
              updated_at: c.updated_at,
            }))
          ),
    enabled: bundleSourceMode === 'project_component',
  });

  const {
    data: collectionsData,
    isLoading: isCollectionsLoading,
    isError: isCollectionsError,
  } = useQuery({
    queryKey: ['collections', 'workspace-list'],
    queryFn: () =>
      getCollections({
        limit: 100,
        offset: 0,
      }),
  });

  const { data: selectedCollection, isLoading: isSelectedCollectionLoading } = useQuery({
    queryKey: ['collection', selectedCollectionId],
    queryFn: () => getCollection(selectedCollectionId ?? ''),
    enabled: Boolean(selectedCollectionId),
  });

  const presetNameMap = useMemo(
    () =>
      new Map((presetCatalogData?.items ?? []).map((preset) => [preset.id, preset.name])),
    [presetCatalogData?.items]
  );

  const uniqueCollectionPresetIds = useMemo(
    () => Array.from(new Set(collectionItems.map((item) => item.presetId))),
    [collectionItems]
  );

  const collectionPresetRevisionQueries = useQueries({
    queries: uniqueCollectionPresetIds.map((presetId) => ({
      queryKey: ['preset-revisions', 'collection-builder', presetId],
      queryFn: () => getPresetRevisions(presetId, { limit: 200, offset: 0 }),
      enabled: Boolean(presetId),
    })),
  });

  const presetRevisionMap = useMemo(() => {
    const map = new Map<string, number[]>();

    uniqueCollectionPresetIds.forEach((presetId, index) => {
      const revisions = collectionPresetRevisionQueries[index]?.data?.items ?? [];
      const revisionNumbers = revisions
        .map((revision) => revision.revision)
        .sort((left, right) => right - left);
      map.set(presetId, revisionNumbers);
    });

    return map;
  }, [collectionPresetRevisionQueries, uniqueCollectionPresetIds]);

  const filteredPresets = useMemo(() => {
    const presets = presetsData?.items ?? [];
    const normalizedTagFilter = presetTagFilter.trim().toLowerCase();
    if (!normalizedTagFilter) return presets;

    return presets.filter((preset) =>
      (preset.tags ?? []).some((tag) => tag.toLowerCase().includes(normalizedTagFilter))
    );
  }, [presetTagFilter, presetsData?.items]);
  const sourceProjects = useMemo(() => projectsData ?? [], [projectsData]);
  const bundleSourceProjectComponents = useMemo(
    () => bundleSourceProjectComponentsData ?? [],
    [bundleSourceProjectComponentsData]
  );
  const bundleSourcePresetItems = useMemo(
    () => presetCatalogData?.items ?? [],
    [presetCatalogData?.items]
  );
  const bundleSourcePresetMap = useMemo(
    () => new Map(bundleSourcePresetItems.map((preset) => [preset.id, preset])),
    [bundleSourcePresetItems]
  );
  const filteredBundleSourcePresets = useMemo(() => {
    const normalizedSearch = bundleComponentSearchQuery.trim().toLowerCase();
    if (!normalizedSearch) return bundleSourcePresetItems;
    return bundleSourcePresetItems.filter((preset) => {
      const tags = (preset.tags ?? []).join(' ');
      const searchable = `${preset.name} ${preset.description ?? ''} ${tags}`.toLowerCase();
      return searchable.includes(normalizedSearch);
    });
  }, [bundleComponentSearchQuery, bundleSourcePresetItems]);
  const filteredBundleSourceProjectComponents = useMemo(() => {
    const normalizedSearch = bundleComponentSearchQuery.trim().toLowerCase();
    if (!normalizedSearch) return bundleSourceProjectComponents;
    return bundleSourceProjectComponents.filter((component) => {
      const description = component.description ?? '';
      const searchable = `${component.name} ${description}`.toLowerCase();
      return searchable.includes(normalizedSearch);
    });
  }, [bundleComponentSearchQuery, bundleSourceProjectComponents]);

  const collections = collectionsData?.items ?? [];

  const currentBuilderState = useMemo(
    () =>
      serializeBuilderState({
        selectedCollectionId,
        name: collectionName,
        description: collectionDescription,
        scope: collectionEditScope,
        tags: collectionTags,
        items: collectionItems,
      }),
    [
      collectionDescription,
      collectionEditScope,
      collectionItems,
      collectionName,
      collectionTags,
      selectedCollectionId,
    ]
  );

  const isBuilderDirty = currentBuilderState !== initialBuilderState;
  useUnsavedChangesGuard(isBuilderDirty, t('workspace.presets.unsavedChangesGuard'));

  useEffect(() => {
    if (!selectedCollection) return;

    const hydratedItems: BuilderPresetItem[] = selectedCollection.items.map((item) => ({
      presetId: item.preset_id,
      pinMode: item.pin_mode,
      pinnedRevision:
        item.pin_mode === 'pin' ? (item.pinned_revision ?? item.resolved_revision ?? null) : null,
      aliasName: item.alias_name ?? '',
    }));

    const normalizedTags = (selectedCollection.tags ?? []).join(', ');
    setCollectionName(selectedCollection.name);
    setCollectionDescription(selectedCollection.description ?? '');
    setCollectionTags(normalizedTags);
    setCollectionEditScope(selectedCollection.scope);
    setCollectionItems(hydratedItems);
    setCollectionChangeNote('');
    setCollectionValidationMessage(null);

    setInitialBuilderState(
      serializeBuilderState({
        selectedCollectionId: selectedCollection.id,
        name: selectedCollection.name,
        description: selectedCollection.description ?? '',
        scope: selectedCollection.scope,
        tags: normalizedTags,
        items: hydratedItems,
      })
    );
  }, [selectedCollection]);
  useEffect(() => {
    setBundleComponentSearchQuery('');
    setIsBundleCanvasDragOver(false);
  }, [bundleSourceProjectId]);
  useEffect(() => {
    setBundleComponentSearchQuery('');
  }, [bundleSourceMode]);

  const createPresetMutation = useMutation({
    mutationFn: async () => {
      if (!createName.trim()) {
        throw new Error(t('workspace.presets.validationPresetNameRequired'));
      }
      if (!createContent.trim()) {
        throw new Error(t('workspace.presets.validationPresetContentRequired'));
      }

      return createPreset({
        name: createName.trim(),
        description: createDescription.trim(),
        component_type: createType,
        platform: createPlatform,
        scope: createScope,
        tags: parseTags(createTags),
        content: createContent,
        frontmatter: parseFrontmatter(createFrontmatter),
        change_note: createChangeNote.trim() || null,
      });
    },
    onSuccess: (created) => {
      showSuccessToast(t('workspace.presets.presetCreateSuccess', { name: created.name }));
      setCreateName('');
      setCreateDescription('');
      setCreateTags('');
      setCreateContent('');
      setCreateFrontmatter('{}');
      setCreateChangeNote('');
      void queryClient.invalidateQueries({ queryKey: ['presets'] });
    },
    onError: (error: Error) => {
      showErrorToast(t('workspace.presets.presetCreateError', { message: error.message }));
    },
  });
  useEffect(() => {
    if (isLoadSourceApplied) {
      setIsLoadSourceApplied(false);
      return;
    }
    const starterTemplate = buildTypeStarterTemplate({
      componentType: createType,
      platform: createPlatform,
      name: createName,
      t,
    });
    setCreateFrontmatter(JSON.stringify(starterTemplate.frontmatter, null, 2));
    setCreateContent(starterTemplate.content);
    const starterDescription = starterTemplate.frontmatter.description;
    if (typeof starterDescription === 'string') {
      setCreateDescription(starterDescription);
    }
  }, [createType, createPlatform]);

  const deletePresetMutation = useMutation({
    mutationFn: deletePreset,
    onSuccess: () => {
      showSuccessToast(t('workspace.presets.deleteSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['presets'] });
      void queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
    onError: (error: Error) => {
      showErrorToast(t('workspace.presets.deleteError', { message: error.message }));
    },
  });

  const saveCollectionMutation = useMutation({
    mutationFn: (request: CollectionCreateRequest) => {
      if (selectedCollectionId) return updateCollection(selectedCollectionId, request);
      return createCollection(request);
    },
    onSuccess: (saved) => {
      showSuccessToast(
        t(
          selectedCollectionId
            ? 'workspace.presets.collectionUpdateSuccess'
            : 'workspace.presets.collectionCreateSuccess',
          { name: saved.name }
        )
      );
      setCollectionValidationMessage(null);
      setSelectedCollectionId(null);
      setIsCreatingNewCollection(false);
      setCollectionChangeNote('');
      resetCollectionBuilder();
      void queryClient.invalidateQueries({ queryKey: ['collections'] });
      void queryClient.invalidateQueries({ queryKey: ['collection', saved.id] });
    },
    onError: (error: Error) => {
      showErrorToast(t('workspace.presets.collectionSaveError', { message: error.message }));
    },
  });

  const deleteCollectionMutation = useMutation({
    mutationFn: deleteCollection,
    onSuccess: () => {
      showSuccessToast(t('workspace.presets.collectionDeleteSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['collections'] });
      if (selectedCollectionId) {
        setSelectedCollectionId(null);
        setIsCreatingNewCollection(false);
        resetCollectionBuilder();
      }
    },
    onError: (error: Error) => {
      showErrorToast(t('workspace.presets.collectionDeleteError', { message: error.message }));
    },
  });

  const resetCollectionBuilder = () => {
    setCollectionName('');
    setCollectionDescription('');
    setCollectionTags('');
    setCollectionChangeNote('');
    setCollectionEditScope('user');
    setCollectionItems([]);
    setCollectionValidationMessage(null);

    setInitialBuilderState(
      serializeBuilderState({
        selectedCollectionId: null,
        name: '',
        description: '',
        scope: 'user',
        tags: '',
        items: [],
      })
    );
  };

  const confirmDiscardChanges = () => {
    if (!isBuilderDirty) return true;
    return window.confirm(t('workspace.presets.unsavedChangesConfirm'));
  };

  const handleSelectCollection = (collectionId: string) => {
    if (collectionId === selectedCollectionId) return;
    if (!confirmDiscardChanges()) return;

    setCollectionValidationMessage(null);
    setSelectedCollectionId(collectionId);
  };


  const handleDeletePreset = (presetId: string) => {
    if (!window.confirm(t('workspace.presets.deleteConfirm'))) return;
    deletePresetMutation.mutate(presetId);
  };

  const handleDeleteCollection = (collectionId: string) => {
    if (!window.confirm(t('workspace.presets.collectionDeleteConfirm'))) return;
    deleteCollectionMutation.mutate(collectionId);
  };

  const addPresetToCollection = (preset: PresetSummaryResponse) => {
    setCollectionItems((prev) => {
      if (prev.some((item) => item.presetId === preset.id)) {
        showErrorToast(t('workspace.presets.collectionItemAlreadyAdded'));
        return prev;
      }

      return [
        ...prev,
        {
          presetId: preset.id,
          pinMode: 'latest',
          pinnedRevision: null,
          aliasName: '',
        },
      ];
    });
  };
  const handleAddBundleSourcePreset = (presetId: string) => {
    const preset = bundleSourcePresetMap.get(presetId);
    if (!preset) return;
    addPresetToCollection(preset);
  };
  const handleLoadSourceApply = (result: LoadSourceResult) => {
    setIsLoadSourceApplied(true);
    setCreateName(result.name);
    setCreateDescription(result.description);
    setCreateType(result.componentType);
    setCreatePlatform(result.platform);
    setCreateContent(result.content);
    setCreateFrontmatter(result.frontmatter);
    setCreateTags(result.tags);
    showSuccessToast(t('workspace.presets.loadSourceApplied'));
  };
  const handleBundleSourceProjectComponentCardDragStart = (
    event: DragEvent<HTMLElement>,
    componentId: string
  ) => {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(BUNDLE_SOURCE_COMPONENT_DRAG_TYPE, componentId);
    setIsDraggingFromSource(true);
  };
  const handleBundleSourcePresetCardDragStart = (
    event: DragEvent<HTMLElement>,
    presetId: string
  ) => {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(BUNDLE_SOURCE_PRESET_DRAG_TYPE, presetId);
    setIsDraggingFromSource(true);
  };
  const handleBundleSourceDragEnd = () => {
    setIsDraggingFromSource(false);
    setIsBundleCanvasDragOver(false);
  };
  const handleBundleSourceProjectComponentCardKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    componentId: string
  ) => {
    if (event.currentTarget !== event.target) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    setPresetFromComponentId(componentId);
  };
  const handleBundleSourcePresetCardKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    presetId: string
  ) => {
    if (event.currentTarget !== event.target) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handleAddBundleSourcePreset(presetId);
  };
  const handleBundleCanvasDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsBundleCanvasDragOver(true);
  };
  const handleBundleCanvasDragLeave = () => {
    setIsBundleCanvasDragOver(false);
  };
  const removeCollectionItem = (presetId: string) => {
    setCollectionItems((prev) => prev.filter((item) => item.presetId !== presetId));
  };

  const moveCollectionItem = (fromIndex: number, toIndex: number) => {
    setCollectionItems((prev) => {
      if (fromIndex === toIndex) return prev;
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= prev.length || toIndex >= prev.length) {
        return prev;
      }

      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const updateCollectionItem = (
    presetId: string,
    patch: Partial<BuilderPresetItem>
  ) => {
    setCollectionItems((prev) =>
      prev.map((item) =>
        item.presetId === presetId
          ? {
              ...item,
              ...patch,
            }
          : item
      )
    );
  };

  const validateCollectionForm = (): string | null => {
    if (!collectionName.trim()) {
      return t('workspace.presets.validationCollectionNameRequired');
    }

    if (collectionItems.length === 0) {
      return t('workspace.presets.validationCollectionItemsRequired');
    }

    const hasInvalidPinItem = collectionItems.some(
      (item) => item.pinMode === 'pin' && item.pinnedRevision == null
    );

    if (hasInvalidPinItem) {
      return t('workspace.presets.validationPinnedRevisionRequired');
    }

    return null;
  };

  const handleSaveCollection = () => {
    const validationMessage = validateCollectionForm();
    setCollectionValidationMessage(validationMessage);
    if (validationMessage) {
      showErrorToast(validationMessage);
      return;
    }

    saveCollectionMutation.mutate({
      name: collectionName.trim(),
      description: collectionDescription.trim(),
      scope: collectionEditScope,
      tags: parseTags(collectionTags),
      items: collectionItems.map((item, index) => itemToRequest(item, index)),
      change_note: collectionChangeNote.trim() || null,
    });
  };

  const getTypeLabel = (componentType: PresetComponentType | string) => {
    if (componentType === 'skill') return t('list.typeSkill');
    if (componentType === 'agent') return t('list.typeAgent');
    if (componentType === 'command') return t('list.typeCommand');
    if (componentType === 'hook') return t('list.typeHook');
    if (componentType === 'rule') return t('list.typeRule');
    return componentType;
  };

  const getPlatformLabel = (platform: PresetPlatform) => {
    if (platform === 'claude_code') return t('list.platformClaudeCode');
    return t('list.platformCursor');
  };

  const isBundleProjectSourceMode = bundleSourceMode === 'project_component';
  const isBundleSourceSearchDisabled = false;

  return (
    <PageFrame
      activeNav="components"
      title={t('workspace.presets.title')}
      subtitle={t('workspace.presets.subtitle')}
      contentClassName="max-w-[88rem] mx-auto"
    >
      <div className="space-y-6">
        <ComponentWorkspaceTabs active="presets" />

        <section className="rounded-2xl border border-theme bg-theme-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="preset-workspace-tab-list"
              onClick={() => setActivePresetWorkspaceTab('preset_list')}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                activePresetWorkspaceTab === 'preset_list' ? 'btn-theme-primary-soft' : 'btn-theme-surface'
              }`}
            >
              {t('workspace.presets.workspaceTabList')}
            </button>
            <button
              type="button"
              data-testid="preset-workspace-tab-create"
              onClick={() => setActivePresetWorkspaceTab('preset_create')}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                activePresetWorkspaceTab === 'preset_create' ? 'btn-theme-primary-soft' : 'btn-theme-surface'
              }`}
            >
              {t('workspace.presets.workspaceTabCreate')}
            </button>
            <button
              type="button"
              data-testid="preset-workspace-tab-bundle"
              onClick={() => setActivePresetWorkspaceTab('preset_bundle')}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                activePresetWorkspaceTab === 'preset_bundle'
                  ? 'btn-theme-primary-soft'
                  : 'btn-theme-surface'
              }`}
            >
              {t('workspace.presets.workspaceTabBundle')}
            </button>
          </div>
        </section>

        {activePresetWorkspaceTab === 'preset_list' ? (
          <section className="rounded-2xl border border-theme bg-theme-surface p-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-sm text-theme-secondary">
                {t('workspace.presets.searchPlaceholder')}
                <input
                  className="mt-1 w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 text-sm text-theme-primary"
                  value={presetSearchQuery}
                  onChange={(event) => setPresetSearchQuery(event.target.value)}
                  placeholder={t('workspace.presets.searchPlaceholder')}
                />
              </label>

              <label className="text-sm text-theme-secondary">
                {t('workspace.presets.libraryTypeLabel')}
                <select
                  className="mt-1 w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 text-sm text-theme-primary"
                  value={presetTypeFilter}
                  onChange={(event) => setPresetTypeFilter(event.target.value as PresetTypeFilter)}
                >
                  <option value="all">{t('workspace.presets.libraryTypeAll')}</option>
                  {COMPONENT_TYPES.map((componentType) => (
                    <option key={componentType} value={componentType}>
                      {getTypeLabel(componentType)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-theme-secondary">
                {t('list.platformLabel')}
                <select
                  className="mt-1 w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 text-sm text-theme-primary"
                  value={presetPlatformFilter}
                  onChange={(event) =>
                    setPresetPlatformFilter(event.target.value as PresetPlatformFilter)
                  }
                >
                  <option value="all">{t('list.platformAll')}</option>
                  {PLATFORMS.map((platform) => (
                    <option key={platform} value={platform}>
                      {getPlatformLabel(platform)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-theme-secondary">
                {t('workspace.presets.tagsFilterLabel')}
                <input
                  className="mt-1 w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 text-sm text-theme-primary"
                  value={presetTagFilter}
                  onChange={(event) => setPresetTagFilter(event.target.value)}
                  placeholder={t('workspace.presets.tagsFilterPlaceholder')}
                />
              </label>
            </div>

            {isPresetsLoading ? (
              <p className="mt-4 text-sm text-theme-secondary">{t('workspace.presets.loadingTemplates')}</p>
            ) : isPresetsError ? (
              <p className="mt-4 text-sm text-theme-danger">{t('workspace.presets.loadTemplatesError')}</p>
            ) : filteredPresets.length === 0 ? (
              <p className="mt-4 text-sm text-theme-secondary">{t('workspace.presets.emptyTemplates')}</p>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                {filteredPresets.map((preset) => {
                  const tags = preset.tags ?? [];

                  return (
                    <article
                      key={preset.id}
                      data-testid={`preset-list-card-${preset.id}`}
                      className="rounded-xl border border-theme bg-theme-bg p-4"
                    >
                      <div>
                        <h3 className="text-base font-semibold text-theme-primary">{preset.name}</h3>
                        <p className="mt-1 text-sm text-theme-secondary">{preset.description}</p>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-md border border-theme px-2 py-1 text-xs text-theme-secondary">
                          {getTypeLabel(preset.component_type)}
                        </span>
                        <span className="rounded-md border border-theme px-2 py-1 text-xs text-theme-secondary">
                          {getPlatformLabel(preset.platform)}
                        </span>
                        <span className="rounded-md border border-theme px-2 py-1 text-xs text-theme-secondary">
                          {t('workspace.presets.revisionLabel', {
                            revision: preset.latest_revision,
                          })}
                        </span>
                      </div>

                      {tags.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {tags.map((tag) => (
                            <span
                              key={`${preset.id}-${tag}`}
                              className="rounded-full border border-theme px-2 py-0.5 text-[11px] text-theme-secondary"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          to={`/components/presets/${preset.id}`}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold btn-theme-primary-soft"
                        >
                          {t('workspace.presets.viewDetailAction')}
                        </Link>

                        {preset.scope === 'user' ? (
                          <Link
                            to={`/components/presets/${preset.id}/edit`}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold btn-theme-surface"
                          >
                            {t('workspace.presets.editAction')}
                          </Link>
                        ) : null}

                        {preset.scope === 'user' ? (
                          <button
                            type="button"
                            onClick={() => handleDeletePreset(preset.id)}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-theme-danger border border-theme"
                          >
                            {t('workspace.presets.deleteAction')}
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        {activePresetWorkspaceTab === 'preset_create' ? (
          <>
            <section className="rounded-2xl border border-theme bg-theme-surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-theme-primary">
                {t('workspace.presets.presetCreateTitle')}
              </h2>
              <p className="mt-1 text-sm text-theme-secondary">
                {t('workspace.presets.presetCreateDescription')}
              </p>
            </div>
            <button
              type="button"
              data-testid="preset-load-source-button"
              onClick={() => setIsLoadSourceModalOpen(true)}
              className="rounded-lg px-3 py-2 text-sm font-semibold btn-theme-primary-soft"
            >
              {t('workspace.presets.loadSourceButtonLabel')}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-sm text-theme-secondary">
              {t('workspace.presets.snapshotNameLabel')}
              <input
                data-testid="preset-create-name-input"
                className="mt-1 w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 text-sm text-theme-primary"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                placeholder={t('workspace.presets.snapshotNamePlaceholder')}
              />
            </label>

            <label className="text-sm text-theme-secondary">
              {t('workspace.presets.libraryTypeLabel')}
              <select
                data-testid="preset-create-type-select"
                className="mt-1 w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 text-sm text-theme-primary"
                value={createType}
                onChange={(event) => setCreateType(event.target.value as PresetComponentType)}
              >
                {COMPONENT_TYPES.map((componentType) => (
                  <option key={componentType} value={componentType}>
                    {getTypeLabel(componentType)}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-theme-secondary">
              {t('list.platformLabel')}
              <select
                data-testid="preset-create-platform-select"
                className="mt-1 w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 text-sm text-theme-primary"
                value={createPlatform}
                onChange={(event) => setCreatePlatform(event.target.value as PresetPlatform)}
              >
                {PLATFORMS.map((platform) => (
                  <option key={platform} value={platform}>
                    {getPlatformLabel(platform)}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-theme-secondary md:col-span-3">
              {t('workspace.presets.snapshotDescriptionLabel')}
              <input
                className="mt-1 w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 text-sm text-theme-primary"
                value={createDescription}
                onChange={(event) => setCreateDescription(event.target.value)}
                placeholder={t('workspace.presets.snapshotDescriptionPlaceholder')}
              />
            </label>

            <label className="text-sm text-theme-secondary md:col-span-3">
              {t('workspace.presets.snapshotTagsLabel')}
              <input
                className="mt-1 w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 text-sm text-theme-primary"
                value={createTags}
                onChange={(event) => setCreateTags(event.target.value)}
                placeholder={t('workspace.presets.snapshotTagsPlaceholder')}
              />
            </label>

            <label className="text-sm text-theme-secondary md:col-span-3">
              {t('workspace.presets.frontmatterLabel')}
              <textarea
                data-testid="preset-create-frontmatter-input"
                className={`${ANALYTICS_NO_CAPTURE_CLASS} mt-1 min-h-[7.5rem] w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 font-mono text-xs text-theme-primary`}
                value={createFrontmatter}
                onChange={(event) => setCreateFrontmatter(event.target.value)}
                placeholder="{}"
              />
            </label>

            <label className="text-sm text-theme-secondary md:col-span-3">
              {t('workspace.presets.componentContentPlaceholder')}
              <textarea
                data-testid="preset-create-content-input"
                className={`${ANALYTICS_NO_CAPTURE_CLASS} mt-1 min-h-[40rem] w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 font-mono text-xs text-theme-primary`}
                value={createContent}
                onChange={(event) => setCreateContent(event.target.value)}
                placeholder={t('workspace.presets.componentContentPlaceholder')}
              />
            </label>

            <label className="text-sm text-theme-secondary md:col-span-3">
              {t('workspace.presets.changeNoteLabel')}
              <input
                className="mt-1 w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 text-sm text-theme-primary"
                value={createChangeNote}
                onChange={(event) => setCreateChangeNote(event.target.value)}
                placeholder={t('workspace.presets.changeNotePlaceholder')}
              />
            </label>
          </div>

          <div className="mt-4 flex items-center justify-end">
            <button
              type="button"
              onClick={() => createPresetMutation.mutate()}
              disabled={createPresetMutation.isPending}
              className="rounded-lg px-4 py-2 text-sm font-semibold btn-theme-primary-soft disabled:opacity-50"
            >
              {createPresetMutation.isPending
                ? t('workspace.presets.creatingSnapshot')
                : t('workspace.presets.presetCreateAction')}
            </button>
          </div>
        </section>

            <LoadSourceModal
              isOpen={isLoadSourceModalOpen}
              onClose={() => setIsLoadSourceModalOpen(false)}
              onApply={handleLoadSourceApply}
            />
          </>
        ) : null}

        {activePresetWorkspaceTab === 'preset_bundle' ? (
          <section className="overflow-hidden rounded-2xl border border-theme bg-theme-surface">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              {/* Left: Collection Panel */}
              <div className="flex flex-col border-r border-theme">
                {/* Panel Header */}
                <div className="flex min-h-11 items-center justify-between border-b border-theme bg-theme-elevated px-4 py-2">
                  {selectedCollectionId || isCreatingNewCollection ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          if (!confirmDiscardChanges()) return;
                          setSelectedCollectionId(null);
                          setIsCreatingNewCollection(false);
                          resetCollectionBuilder();
                        }}
                        className="flex items-center gap-1 text-sm font-medium text-theme-secondary hover:text-theme-primary"
                      >
                        <span aria-hidden="true">&larr;</span>
                        {t('workspace.presets.backToCollectionList')}
                      </button>
                      {selectedCollectionId &&
                      collections.find((c) => c.id === selectedCollectionId)?.scope === 'user' ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteCollection(selectedCollectionId)}
                          className="rounded px-2 py-0.5 text-xs text-theme-danger hover:bg-theme-bg"
                        >
                          {t('workspace.presets.deleteAction')}
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <h2 className="text-sm font-semibold text-theme-primary">
                        {t('workspace.presets.bundleCollectionPanelTitle')}
                      </h2>
                      <button
                        type="button"
                        onClick={() => {
                          if (!confirmDiscardChanges()) return;
                          setSelectedCollectionId(null);
                          resetCollectionBuilder();
                          setIsCreatingNewCollection(true);
                        }}
                        className="rounded-lg px-2.5 py-1 text-xs font-semibold btn-theme-primary-soft"
                      >
                        + {t('workspace.presets.collectionNewAction')}
                      </button>
                    </>
                  )}
                </div>

                {/* Panel Content */}
                <div
                  className={`flex-1 overflow-y-auto transition-colors ${
                    isDraggingFromSource ? 'bg-theme-elevated/40' : ''
                  }`}
                >
                  {selectedCollectionId || isCreatingNewCollection ? (
                    /* Detail View */
                    <div
                      className={`space-y-4 p-4 transition-colors ${
                        isBundleCanvasDragOver ? 'bg-theme-elevated' : ''
                      }`}
                      onDragOver={handleBundleCanvasDragOver}
                      onDragLeave={handleBundleCanvasDragLeave}
                      onDrop={(event) => {
                        event.preventDefault();
                        setIsBundleCanvasDragOver(false);
                        setIsDraggingFromSource(false);

                        const presetId = event.dataTransfer.getData(
                          BUNDLE_SOURCE_PRESET_DRAG_TYPE
                        );
                        if (presetId) {
                          const preset = bundleSourcePresetMap.get(presetId);
                          if (preset) addPresetToCollection(preset);
                          return;
                        }

                        const componentId = event.dataTransfer.getData(
                          BUNDLE_SOURCE_COMPONENT_DRAG_TYPE
                        );
                        if (componentId) {
                          setPresetFromComponentId(componentId);
                        }
                      }}
                    >
                      {/* Name & Description */}
                      <div className="grid grid-cols-1 gap-3">
                        <label className="text-sm text-theme-secondary">
                          {t('workspace.presets.collectionNameLabel')}
                          <input
                            className="mt-1 w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 text-sm text-theme-primary"
                            value={collectionName}
                            onChange={(event) => setCollectionName(event.target.value)}
                            placeholder={t('workspace.presets.collectionNamePlaceholder')}
                          />
                        </label>

                        <label className="text-sm text-theme-secondary">
                          {t('workspace.presets.snapshotDescriptionLabel')}
                          <input
                            className="mt-1 w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 text-sm text-theme-primary"
                            value={collectionDescription}
                            onChange={(event) => setCollectionDescription(event.target.value)}
                            placeholder={t('workspace.presets.collectionDescriptionPlaceholder')}
                          />
                        </label>
                      </div>

                      {collectionValidationMessage ? (
                        <p role="alert" className="text-sm text-theme-danger">
                          {collectionValidationMessage}
                        </p>
                      ) : null}

                      {/* Collection items */}
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-theme-primary">
                            {t('workspace.presets.collectionItemsTitle')}
                          </h3>
                          <span className="rounded-full border border-theme px-2 py-0.5 text-[11px] text-theme-secondary">
                            {t('workspace.presets.selectedCount', {
                              count: collectionItems.length,
                            })}
                          </span>
                        </div>

                        {collectionItems.length === 0 ? (
                          <p
                            className={`rounded-lg border border-dashed px-3 py-6 text-center text-sm transition-colors ${
                              isBundleCanvasDragOver
                                ? 'border-theme-primary bg-theme-elevated text-theme-primary'
                                : 'border-theme text-theme-secondary'
                            }`}
                          >
                            {t('workspace.presets.bundleCanvasEmptyHint')}
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {collectionItems.map((item, index) => {

                              const revisions = presetRevisionMap.get(item.presetId) ?? [];

                              return (
                                <article
                                  key={`collection-item-${item.presetId}`}
                                  data-testid={`collection-item-${item.presetId}`}
                                  className="rounded-lg border border-theme bg-theme-surface p-3"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold text-theme-primary">
                                        #{index + 1}{' '}
                                        {presetNameMap.get(item.presetId) ?? item.presetId}
                                      </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => moveCollectionItem(index, index - 1)}
                                        disabled={index === 0}
                                        className="rounded-md border border-theme px-2 py-0.5 text-[11px] font-semibold text-theme-secondary disabled:opacity-50"
                                      >
                                        {t('workspace.presets.moveUpAction')}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => moveCollectionItem(index, index + 1)}
                                        disabled={index === collectionItems.length - 1}
                                        className="rounded-md border border-theme px-2 py-0.5 text-[11px] font-semibold text-theme-secondary disabled:opacity-50"
                                      >
                                        {t('workspace.presets.moveDownAction')}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => removeCollectionItem(item.presetId)}
                                        className="rounded-md border border-theme px-2 py-0.5 text-[11px] font-semibold text-theme-danger"
                                      >
                                        {t('workspace.presets.removeComponentAction')}
                                      </button>
                                    </div>
                                  </div>

                                  <div className="mt-2 grid grid-cols-3 gap-2">
                                    <label className="text-xs text-theme-secondary">
                                      {t('workspace.presets.collectionPinModeLabel')}
                                      <select
                                        aria-label={`pin-mode-${item.presetId}`}
                                        className="mt-1 w-full rounded-lg border border-theme bg-theme-bg px-2 py-1 text-xs text-theme-primary"
                                        value={item.pinMode}
                                        onChange={(event) => {
                                          const nextPinMode = event.target.value as PinMode;
                                          const defaultRevision = revisions[0] ?? null;
                                          updateCollectionItem(item.presetId, {
                                            pinMode: nextPinMode,
                                            pinnedRevision:
                                              nextPinMode === 'pin'
                                                ? (item.pinnedRevision ?? defaultRevision)
                                                : null,
                                          });
                                        }}
                                      >
                                        <option value="latest">latest</option>
                                        <option value="pin">pin</option>
                                      </select>
                                    </label>

                                    <label className="text-xs text-theme-secondary">
                                      {t('workspace.presets.collectionPinnedRevisionLabel')}
                                      <select
                                        aria-label={`pinned-revision-${item.presetId}`}
                                        className="mt-1 w-full rounded-lg border border-theme bg-theme-bg px-2 py-1 text-xs text-theme-primary disabled:opacity-50"
                                        value={item.pinnedRevision ?? ''}
                                        disabled={item.pinMode !== 'pin'}
                                        onChange={(event) => {
                                          const value = event.target.value;
                                          updateCollectionItem(item.presetId, {
                                            pinnedRevision: value ? Number(value) : null,
                                          });
                                        }}
                                      >
                                        <option value="">
                                          {t(
                                            'workspace.presets.collectionPinnedRevisionPlaceholder'
                                          )}
                                        </option>
                                        {revisions.map((revision) => (
                                          <option
                                            key={`${item.presetId}-revision-${revision}`}
                                            value={revision}
                                          >
                                            {t('workspace.presets.revisionLabel', { revision })}
                                          </option>
                                        ))}
                                      </select>
                                    </label>

                                    <label className="text-xs text-theme-secondary">
                                      {t('workspace.presets.collectionAliasLabel')}
                                      <input
                                        className="mt-1 w-full rounded-lg border border-theme bg-theme-bg px-2 py-1 text-xs text-theme-primary"
                                        value={item.aliasName}
                                        onChange={(event) =>
                                          updateCollectionItem(item.presetId, {
                                            aliasName: event.target.value,
                                          })
                                        }
                                        placeholder={t(
                                          'workspace.presets.collectionAliasPlaceholder'
                                        )}
                                      />
                                    </label>
                                  </div>
                                </article>
                              );
                            })}
                            {isDraggingFromSource ? (
                              <div
                                className={`mt-2 rounded-lg border-2 border-dashed px-3 py-4 text-center text-xs transition-colors ${
                                  isBundleCanvasDragOver
                                    ? 'border-theme-primary bg-theme-elevated text-theme-primary'
                                    : 'border-theme text-theme-secondary'
                                }`}
                              >
                                {t('workspace.presets.bundleCanvasDropHint')}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>

                      {/* Save / Reset */}
                      <div className="flex items-center justify-between gap-2 border-t border-theme pt-4">
                        <p className="text-xs text-theme-secondary">
                          {isBuilderDirty
                            ? t('workspace.presets.unsavedChangesLabel')
                            : t('workspace.presets.savedStateLabel')}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (!confirmDiscardChanges()) return;
                              setSelectedCollectionId(null);
                              setIsCreatingNewCollection(false);
                              resetCollectionBuilder();
                            }}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold btn-theme-surface"
                          >
                            {t('workspace.presets.resetBuilderAction')}
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveCollection}
                            disabled={
                              saveCollectionMutation.isPending || isSelectedCollectionLoading
                            }
                            className="rounded-lg px-4 py-2 text-sm font-semibold btn-theme-primary-soft disabled:opacity-50"
                          >
                            {saveCollectionMutation.isPending
                              ? t('workspace.presets.savingAction')
                              : t('workspace.presets.collectionSaveAction')}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* List View */
                    <div className="p-3">
                      {isCollectionsLoading ? (
                        <p className="px-1 py-3 text-sm text-theme-secondary">
                          {t('workspace.presets.loadingCollections')}
                        </p>
                      ) : isCollectionsError ? (
                        <p className="px-1 py-3 text-sm text-theme-danger">
                          {t('workspace.presets.loadCollectionsError')}
                        </p>
                      ) : collections.length === 0 ? (
                        <p className="px-1 py-3 text-sm text-theme-secondary">
                          {t('workspace.presets.emptyCollections')}
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {collections.map((collection) => (
                            <button
                              key={collection.id}
                              type="button"
                              onClick={() => {
                                handleSelectCollection(collection.id);
                                setIsCreatingNewCollection(false);
                              }}
                              className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-theme-elevated"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-theme-primary">
                                  {collection.name}
                                </p>
                                <p className="mt-0.5 text-xs text-theme-secondary">
                                  {t('workspace.presets.collectionItemsCount', {
                                    count: collection.items_count,
                                  })}
                                </p>
                              </div>
                              <span className="ml-2 text-theme-secondary" aria-hidden="true">
                                &rsaquo;
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Source Panel */}
              <div className="flex flex-col">
                {/* Panel Header */}
                <div className="flex min-h-11 items-center justify-between border-b border-theme bg-theme-elevated px-4 py-2">
                  <h2 className="text-sm font-semibold text-theme-primary">
                    {t('workspace.presets.bundleSourcePanelTitle')}
                  </h2>
                </div>

                {/* Panel Content */}
                <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="bundle-source-mode-preset"
                    onClick={() => setBundleSourceMode('preset')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      bundleSourceMode === 'preset' ? 'btn-theme-primary-soft' : 'btn-theme-surface'
                    }`}
                  >
                    {t('workspace.presets.bundleSourceModePreset')}
                  </button>
                  <button
                    type="button"
                    data-testid="bundle-source-mode-project-component"
                    onClick={() => setBundleSourceMode('project_component')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      bundleSourceMode === 'project_component'
                        ? 'btn-theme-primary-soft'
                        : 'btn-theme-surface'
                    }`}
                  >
                    {t('workspace.presets.bundleSourceModeProjectComponents')}
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <input
                    data-testid="bundle-from-project-search-input"
                    className="w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 text-sm text-theme-primary disabled:opacity-60"
                    value={bundleComponentSearchQuery}
                    onChange={(event) => setBundleComponentSearchQuery(event.target.value)}
                    placeholder={t('workspace.presets.sourceComponentsSearchPlaceholder')}
                    disabled={isBundleSourceSearchDisabled}
                  />

                  {isBundleProjectSourceMode ? (
                    <select
                      data-testid="bundle-from-project-project-select"
                      className="w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 text-sm text-theme-primary"
                      value={bundleSourceProjectId}
                      onChange={(event) => setBundleSourceProjectId(event.target.value)}
                    >
                      <option value="">{t('workspace.presets.sourceProjectPlaceholder')}</option>
                      {sourceProjects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>

                {/* Source cards */}
                <div className="rounded-xl border border-theme bg-theme-bg p-4">
                  <div className="mb-2 text-xs text-theme-secondary">
                    {t('workspace.presets.bundleCanvasDragHint')}
                  </div>

                  {isBundleProjectSourceMode ? (
                    isBundleSourceProjectComponentsLoading ? (
                      <p className="text-sm text-theme-secondary">
                        {t('workspace.presets.loadingComponents')}
                      </p>
                    ) : isBundleSourceProjectComponentsError ? (
                      <p className="text-sm text-theme-danger">
                        {t('workspace.presets.loadComponentsError')}
                      </p>
                    ) : filteredBundleSourceProjectComponents.length === 0 ? (
                      <p className="text-sm text-theme-secondary">
                        {t(
                          bundleSourceProjectComponents.length === 0
                            ? 'workspace.presets.noComponentsInProject'
                            : 'workspace.presets.noSourceComponentsMatched'
                        )}
                      </p>
                    ) : (
                      <div className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
                        {filteredBundleSourceProjectComponents.map((component) => (
                          <div
                            key={component.id}
                            data-testid={`bundle-from-project-source-card-${component.id}`}
                            draggable
                            onDragStart={(event) =>
                              handleBundleSourceProjectComponentCardDragStart(event, component.id)
                            }
                            onDragEnd={handleBundleSourceDragEnd}
                            onKeyDown={(event) =>
                              handleBundleSourceProjectComponentCardKeyDown(event, component.id)
                            }
                            tabIndex={0}
                            role="button"
                            aria-label={t('workspace.presets.bundleSourceCardKeyboardLabel', {
                              name: component.name,
                            })}
                            className="group flex items-start gap-3 rounded-lg border border-theme bg-theme-surface p-3 transition-colors hover:border-theme-primary"
                          >
                            <span
                              aria-hidden="true"
                              className="mt-0.5 rounded border border-theme bg-theme-bg px-1 text-[10px] text-theme-secondary"
                            >
                              ::
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="truncate text-sm font-semibold text-theme-primary">
                                  {component.name}
                                </p>
                                <span className="rounded-full border border-theme bg-theme-bg px-1.5 py-0.5 text-[10px] text-theme-secondary">
                                  {getTypeLabel(component.type)}
                                </span>
                              </div>
                              <p className="mt-1 line-clamp-1 text-xs text-theme-secondary">
                                {component.description ||
                                  t('workspace.presets.componentCardNoDescription')}
                              </p>
                            </div>
                            <button
                              type="button"
                              data-testid={`bundle-from-project-add-button-${component.id}`}
                              onClick={() => setPresetFromComponentId(component.id)}
                              className="shrink-0 rounded-md border border-theme bg-theme-bg px-2 py-1 text-xs font-semibold text-theme-secondary"
                            >
                              {t('workspace.presets.bundleAddComponentAction')}
                            </button>
                          </div>
                        ))}
                      </div>
                    )
                  ) : isPresetCatalogLoading ? (
                    <p className="text-sm text-theme-secondary">
                      {t('workspace.presets.loadingTemplates')}
                    </p>
                  ) : isPresetCatalogError ? (
                    <p className="text-sm text-theme-danger">
                      {t('workspace.presets.loadTemplatesError')}
                    </p>
                  ) : filteredBundleSourcePresets.length === 0 ? (
                    <p className="text-sm text-theme-secondary">
                      {t('workspace.presets.emptyTemplates')}
                    </p>
                  ) : (
                    <div className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
                      {filteredBundleSourcePresets.map((preset) => (
                        <div
                          key={preset.id}
                          data-testid={`bundle-from-preset-source-card-${preset.id}`}
                          draggable
                          onDragStart={(event) =>
                            handleBundleSourcePresetCardDragStart(event, preset.id)
                          }
                          onDragEnd={handleBundleSourceDragEnd}
                          onKeyDown={(event) =>
                            handleBundleSourcePresetCardKeyDown(event, preset.id)
                          }
                          tabIndex={0}
                          role="button"
                          aria-label={t('workspace.presets.bundleSourceCardKeyboardLabel', {
                            name: preset.name,
                          })}
                          className="group flex items-start gap-2 rounded-lg border border-theme bg-theme-surface p-3 transition-colors hover:border-theme-primary"
                        >
                          <span
                            aria-hidden="true"
                            className="mt-0.5 rounded border border-theme px-1 text-[10px] text-theme-secondary"
                          >
                            ::
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-theme-primary">
                              {preset.name}
                            </p>
                            <p className="mt-0.5 line-clamp-1 text-xs text-theme-secondary">
                              {preset.description ||
                                t('workspace.presets.componentCardNoDescription')}
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              <span className="rounded-md border border-theme px-1.5 py-0.5 text-[10px] text-theme-secondary">
                                {getTypeLabel(preset.component_type)}
                              </span>
                              <span className="rounded-md border border-theme px-1.5 py-0.5 text-[10px] text-theme-secondary">
                                {getPlatformLabel(preset.platform)}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            data-testid={`bundle-from-preset-add-button-${preset.id}`}
                            onClick={() => handleAddBundleSourcePreset(preset.id)}
                            className="shrink-0 rounded-md border border-theme px-2 py-1 text-xs font-semibold text-theme-secondary"
                          >
                            {t('workspace.presets.bundleAddPresetAction')}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <CreatePresetFromComponentModal
          isOpen={presetFromComponentId !== null}
          componentId={presetFromComponentId}
          onClose={() => setPresetFromComponentId(null)}
          onCreated={(created) => {
            addPresetToCollection(created);
            setPresetFromComponentId(null);
          }}
        />
      </div>
    </PageFrame>
  );
}
