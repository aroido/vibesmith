import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import FocusLock from 'react-focus-lock';
import {
  getComponent,
  getPreset,
  getPresetRevision,
  getPresets,
  getProjectComponents,
  getProjects,
  type ComponentDetailResponse,
  type PresetComponentType,
  type PresetPlatform,
  type PresetRevisionResponse,
  type PresetScope,
} from '@/common/api';
import { trackFeatureUsed } from '@/common/analytics/desktopAnalyticsBridge';
import { ANALYTICS_NO_CAPTURE_CLASS } from '@/common/analytics/privacy';
import { ModalPortal } from '@/components/common/ModalPortal';

type SourceTab = 'project_component' | 'preset';

export interface LoadSourceResult {
  name: string;
  description: string;
  componentType: PresetComponentType;
  platform: PresetPlatform;
  content: string;
  frontmatter: string;
  tags: string;
  scope?: 'user' | 'system';
}

interface LoadSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (result: LoadSourceResult) => void;
}

function inferPlatformFromPath(path: string): PresetPlatform {
  if (path.toLowerCase().includes('/.cursor/')) return 'cursor';
  return 'claude_code';
}

function inferTypeFromString(type: string): PresetComponentType {
  const valid: PresetComponentType[] = ['skill', 'agent', 'command', 'hook', 'rule'];
  return valid.includes(type as PresetComponentType) ? (type as PresetComponentType) : 'skill';
}

function formatFrontmatter(fm: Record<string, unknown> | null | undefined): string {
  if (!fm || typeof fm !== 'object' || Object.keys(fm).length === 0) return '{}';
  try {
    return JSON.stringify(fm, null, 2);
  } catch {
    return '{}';
  }
}

export function LoadSourceModal({ isOpen, onClose, onApply }: LoadSourceModalProps) {
  const { t } = useTranslation('components');
  const [activeTab, setActiveTab] = useState<SourceTab>('project_component');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [presetScopeFilter, setPresetScopeFilter] = useState<PresetScope>('all');

  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedComponentId(null);
      setSelectedPresetId(null);
      setSearchQuery('');
      setSelectedProjectId('');
      setActiveTab('project_component');
      setPresetScopeFilter('all');
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedComponentId(null);
    setSelectedPresetId(null);
    setSearchQuery('');
  }, [activeTab]);

  const { data: projects } = useQuery({
    queryKey: ['projects', 'load-source-modal'],
    queryFn: () => getProjects(),
    enabled: isOpen,
  });

  const { data: components, isLoading: isComponentsLoading } = useQuery({
    queryKey: ['project-components', 'load-source-modal', selectedProjectId],
    queryFn: () => getProjectComponents(selectedProjectId),
    enabled: isOpen && activeTab === 'project_component' && Boolean(selectedProjectId),
  });

  const { data: presetsData, isLoading: isPresetsLoading } = useQuery({
    queryKey: ['presets', 'load-source-modal', presetScopeFilter],
    queryFn: () => getPresets({ scope: presetScopeFilter, limit: 100, offset: 0 }),
    enabled: isOpen && activeTab === 'preset',
  });

  const { data: componentDetail, isLoading: isComponentDetailLoading } = useQuery({
    queryKey: ['component', 'load-source-modal-preview', selectedComponentId],
    queryFn: () => getComponent(selectedComponentId!),
    enabled: isOpen && Boolean(selectedComponentId),
  });

  const { data: presetDetail } = useQuery({
    queryKey: ['preset', 'load-source-modal-preview', selectedPresetId],
    queryFn: () => getPreset(selectedPresetId!),
    enabled: isOpen && Boolean(selectedPresetId),
  });

  const { data: presetRevisionDetail, isLoading: isPresetRevisionLoading } = useQuery({
    queryKey: ['preset-revision', 'load-source-modal-preview', selectedPresetId, presetDetail?.latest_revision],
    queryFn: () => getPresetRevision(selectedPresetId!, presetDetail!.latest_revision),
    enabled: isOpen && Boolean(selectedPresetId) && Boolean(presetDetail?.latest_revision),
  });

  const filteredComponents = useMemo(() => {
    const list = components ?? [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => {
      const desc = c.description ?? '';
      return `${c.name} ${desc}`.toLowerCase().includes(q);
    });
  }, [components, searchQuery]);

  const filteredPresets = useMemo(() => {
    const list = presetsData?.items ?? [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => {
      const tags = (p.tags ?? []).join(' ');
      return `${p.name} ${p.description ?? ''} ${tags}`.toLowerCase().includes(q);
    });
  }, [presetsData?.items, searchQuery]);

  const hasSelection = activeTab === 'project_component' ? Boolean(selectedComponentId) : Boolean(selectedPresetId);

  const handleApply = () => {
    if (activeTab === 'project_component' && componentDetail) {
      trackFeatureUsed('preset', {
        action: 'apply_source',
        result: 'success',
        source: 'project_component',
      });
      onApply(buildResultFromComponent(componentDetail));
    } else if (activeTab === 'preset' && presetDetail && presetRevisionDetail) {
      trackFeatureUsed('preset', {
        action: 'apply_source',
        result: 'success',
        source: 'preset',
      });
      onApply(buildResultFromPreset(presetDetail, presetRevisionDetail));
    } else {
      trackFeatureUsed('preset', {
        action: 'apply_source',
        result: 'failure',
        source: activeTab,
      });
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[2147483100] flex items-center justify-center bg-black/70 p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="load-source-modal-title"
      >
        <FocusLock autoFocus returnFocus>
          <div
            className="flex max-h-[85vh] w-[64rem] flex-col overflow-hidden rounded-2xl border border-theme bg-theme-elevated shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <header className="shrink-0 border-b border-theme px-5 py-4">
              <div className="flex items-center justify-between">
                <h2 id="load-source-modal-title" className="text-lg font-semibold text-theme-primary">
                  {t('workspace.presets.loadSourceModalTitle')}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-theme px-3 py-1.5 text-xs font-semibold btn-theme-surface"
                >
                  &times;
                </button>
              </div>

              {/* Tabs */}
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('project_component')}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                    activeTab === 'project_component' ? 'btn-theme-primary-soft' : 'btn-theme-surface'
                  }`}
                >
                  {t('workspace.presets.loadSourceTabProjectComponent')}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('preset')}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                    activeTab === 'preset' ? 'btn-theme-primary-soft' : 'btn-theme-surface'
                  }`}
                >
                  {t('workspace.presets.loadSourceTabPreset')}
                </button>
              </div>
            </header>

            {/* Body: 2-column layout */}
            <div className="flex h-[28rem]">
              {/* Left: List */}
              <div className="flex w-1/2 flex-col border-r border-theme">
                {/* Filters */}
                <div className="shrink-0 space-y-2 border-b border-theme p-3">
                  {activeTab === 'project_component' ? (
                    <select
                      className="w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 text-sm text-theme-primary"
                      value={selectedProjectId}
                      onChange={(e) => {
                        setSelectedProjectId(e.target.value);
                        setSelectedComponentId(null);
                      }}
                    >
                      <option value="">{t('workspace.presets.loadSourceProjectSelect')}</option>
                      {(projects ?? []).map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  ) : null}
                  <input
                    className="w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 text-sm text-theme-primary"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('workspace.presets.loadSourceSearchPlaceholder')}
                  />
                </div>

                {/* Item list */}
                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                  {activeTab === 'project_component' ? (
                    renderComponentList()
                  ) : (
                    renderPresetList()
                  )}
                </div>
              </div>

              {/* Right: Preview */}
              <div className="flex w-1/2 flex-col">
                <div className="shrink-0 border-b border-theme px-4 py-3">
                  <h3 className="text-sm font-semibold text-theme-primary">
                    {t('workspace.presets.loadSourcePreviewTitle')}
                  </h3>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  {renderPreview()}
                </div>
              </div>
            </div>

            {/* Footer */}
            <footer className="shrink-0 flex items-center justify-end gap-3 border-t border-theme px-5 py-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-semibold btn-theme-surface"
              >
                {t('workspace.presets.loadSourceCancelAction')}
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={!hasSelection}
                className="rounded-lg px-4 py-2 text-sm font-semibold btn-theme-primary-soft disabled:opacity-50"
              >
                {t('workspace.presets.loadSourceApplyAction')}
              </button>
            </footer>
          </div>
        </FocusLock>
      </div>
    </ModalPortal>
  );

  function renderComponentList() {
    if (!selectedProjectId) {
      return <p className="p-3 text-sm text-theme-secondary">{t('workspace.presets.sourceProjectHint')}</p>;
    }
    if (isComponentsLoading) {
      return <p className="p-3 text-sm text-theme-secondary">{t('workspace.presets.loadSourceLoading')}</p>;
    }
    if (filteredComponents.length === 0) {
      return <p className="p-3 text-sm text-theme-secondary">{t('workspace.presets.loadSourceNoItems')}</p>;
    }
    return (
      <div className="space-y-1">
        {filteredComponents.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedComponentId(c.id)}
            className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
              selectedComponentId === c.id
                ? 'border-theme-primary bg-theme-elevated'
                : 'border-transparent hover:bg-theme-bg'
            }`}
          >
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-theme-primary">{c.name}</p>
              <span className="shrink-0 rounded-full border border-theme px-1.5 py-0.5 text-[10px] text-theme-secondary">
                {c.type}
              </span>
            </div>
            <p className="mt-0.5 line-clamp-1 text-xs text-theme-secondary">
              {c.description || t('workspace.presets.componentCardNoDescription')}
            </p>
          </button>
        ))}
      </div>
    );
  }

  function renderPresetList() {
    if (isPresetsLoading) {
      return <p className="p-3 text-sm text-theme-secondary">{t('workspace.presets.loadSourceLoading')}</p>;
    }
    if (filteredPresets.length === 0) {
      return <p className="p-3 text-sm text-theme-secondary">{t('workspace.presets.loadSourceNoItems')}</p>;
    }
    return (
      <div className="space-y-1">
        {filteredPresets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelectedPresetId(p.id)}
            className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
              selectedPresetId === p.id
                ? 'border-theme-primary bg-theme-elevated'
                : 'border-transparent hover:bg-theme-bg'
            }`}
          >
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-theme-primary">{p.name}</p>
              <span className="shrink-0 rounded-full border border-theme px-1.5 py-0.5 text-[10px] text-theme-secondary">
                {p.component_type}
              </span>
              <span className="shrink-0 rounded-full border border-theme px-1.5 py-0.5 text-[10px] text-theme-secondary">
                {p.platform}
              </span>
            </div>
            <p className="mt-0.5 line-clamp-1 text-xs text-theme-secondary">
              {p.description || t('workspace.presets.componentCardNoDescription')}
            </p>
          </button>
        ))}
      </div>
    );
  }

  function renderPreview() {
    if (activeTab === 'project_component') {
      if (!selectedComponentId) {
        return <p className="text-sm text-theme-secondary">{t('workspace.presets.loadSourcePreviewEmpty')}</p>;
      }
      if (isComponentDetailLoading) {
        return <p className="text-sm text-theme-secondary">{t('workspace.presets.loadSourceLoading')}</p>;
      }
      if (!componentDetail) {
        return <p className="text-sm text-theme-secondary">{t('workspace.presets.loadSourceError')}</p>;
      }
      return renderDetailPreview({
        name: componentDetail.name,
        type: componentDetail.type,
        platform: inferPlatformFromPath(componentDetail.path),
        description: componentDetail.description,
        tags: componentDetail.tags,
        frontmatter: formatFrontmatter(componentDetail.frontmatter),
        content: componentDetail.content,
      });
    }

    if (!selectedPresetId) {
      return <p className="text-sm text-theme-secondary">{t('workspace.presets.loadSourcePreviewEmpty')}</p>;
    }
    if (isPresetRevisionLoading || !presetRevisionDetail) {
      return <p className="text-sm text-theme-secondary">{t('workspace.presets.loadSourceLoading')}</p>;
    }
    return renderDetailPreview({
      name: presetDetail?.name ?? '',
      type: presetDetail?.component_type ?? 'skill',
      platform: presetDetail?.platform ?? 'claude_code',
      description: presetDetail?.description ?? '',
      tags: presetRevisionDetail.tags ?? [],
      frontmatter: formatFrontmatter(presetRevisionDetail.frontmatter),
      content: presetRevisionDetail.content,
    });
  }

  function renderDetailPreview(data: {
    name: string;
    type: string;
    platform: string;
    description: string;
    tags: string[];
    frontmatter: string;
    content: string;
  }) {
    return (
      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold text-theme-secondary">Name</p>
          <p className="text-sm text-theme-primary">{data.name}</p>
        </div>
        <div className="flex gap-2">
          <span className="rounded-full border border-theme px-2 py-0.5 text-xs text-theme-secondary">{data.type}</span>
          <span className="rounded-full border border-theme px-2 py-0.5 text-xs text-theme-secondary">{data.platform}</span>
        </div>
        {data.description && (
          <div>
            <p className="text-xs font-semibold text-theme-secondary">Description</p>
            <p className="text-sm text-theme-secondary">{data.description}</p>
          </div>
        )}
        {data.tags.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-theme-secondary">Tags</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {data.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-theme px-2 py-0.5 text-[10px] text-theme-secondary">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}
        <div>
          <p className="text-xs font-semibold text-theme-secondary">
            {t('workspace.presets.loadSourcePreviewFrontmatter')}
          </p>
          <pre
            className={`${ANALYTICS_NO_CAPTURE_CLASS} mt-1 max-h-32 overflow-auto rounded-lg border border-theme bg-theme-bg p-2 text-xs text-theme-primary`}
          >
            {data.frontmatter}
          </pre>
        </div>
        <div>
          <p className="text-xs font-semibold text-theme-secondary">
            {t('workspace.presets.loadSourcePreviewContent')}
          </p>
          <pre
            className={`${ANALYTICS_NO_CAPTURE_CLASS} mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-theme bg-theme-bg p-2 text-xs text-theme-primary`}
          >
            {data.content || '(empty)'}
          </pre>
        </div>
      </div>
    );
  }
}

function buildResultFromComponent(detail: ComponentDetailResponse): LoadSourceResult {
  return {
    name: detail.name,
    description: detail.description ?? '',
    componentType: inferTypeFromString(detail.type),
    platform: inferPlatformFromPath(detail.path),
    content: detail.content ?? '',
    frontmatter: formatFrontmatter(detail.frontmatter),
    tags: (detail.tags ?? []).join(', '),
  };
}

function buildResultFromPreset(
  preset: { name: string; component_type: PresetComponentType; platform: PresetPlatform; description: string; scope: string },
  revision: PresetRevisionResponse
): LoadSourceResult {
  return {
    name: preset.name,
    description: preset.description ?? '',
    componentType: preset.component_type,
    platform: preset.platform,
    content: revision.content ?? '',
    frontmatter: formatFrontmatter(revision.frontmatter),
    tags: (revision.tags ?? []).join(', '),
    scope: preset.scope === 'system' ? 'system' : 'user',
  };
}
