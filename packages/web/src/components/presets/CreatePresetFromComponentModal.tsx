import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import FocusLock from 'react-focus-lock';
import {
  createPreset,
  getComponent,
  type PresetComponentType,
  type PresetPlatform,
  type PresetSummaryResponse,
} from '@/common/api';
import { trackFeatureUsed } from '@/common/analytics/desktopAnalyticsBridge';
import { ANALYTICS_NO_CAPTURE_CLASS } from '@/common/analytics/privacy';
import { showErrorToast, showSuccessToast } from '@/common/utils';
import { ModalPortal } from '@/components/common/ModalPortal';

const COMPONENT_TYPES: PresetComponentType[] = ['skill', 'agent', 'command', 'hook', 'rule'];
const PLATFORMS: PresetPlatform[] = ['claude_code', 'cursor'];

function inferPlatformFromPath(path: string): PresetPlatform {
  if (path.toLowerCase().includes('/.cursor/')) return 'cursor';
  return 'claude_code';
}

function inferTypeFromString(type: string): PresetComponentType {
  const valid: PresetComponentType[] = ['skill', 'agent', 'command', 'hook', 'rule'];
  return valid.includes(type as PresetComponentType) ? (type as PresetComponentType) : 'skill';
}

function formatFrontmatter(fm: Record<string, unknown> | null | undefined): string {
  if (!fm || Object.keys(fm).length === 0) return '{}';
  return JSON.stringify(fm, null, 2);
}

function parseFrontmatter(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (!trimmed) return {};
  const parsed: unknown = JSON.parse(trimmed);
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }
  return parsed as Record<string, unknown>;
}

interface CreatePresetFromComponentModalProps {
  isOpen: boolean;
  componentId: string | null;
  onClose: () => void;
  onCreated: (preset: PresetSummaryResponse) => void;
}

export function CreatePresetFromComponentModal({
  isOpen,
  componentId,
  onClose,
  onCreated,
}: CreatePresetFromComponentModalProps) {
  const { t } = useTranslation('components');
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [componentType, setComponentType] = useState<PresetComponentType>('skill');
  const [platform, setPlatform] = useState<PresetPlatform>('claude_code');
  const [tags, setTags] = useState('');
  const [content, setContent] = useState('');
  const [frontmatter, setFrontmatter] = useState('{}');

  const { data: componentDetail, isLoading } = useQuery({
    queryKey: ['component-detail', componentId],
    queryFn: () => getComponent(componentId!),
    enabled: isOpen && Boolean(componentId),
  });

  useEffect(() => {
    if (!componentDetail) return;
    setName(componentDetail.name);
    setDescription(componentDetail.description ?? '');
    setComponentType(inferTypeFromString(componentDetail.type));
    setPlatform(inferPlatformFromPath(componentDetail.path));
    setTags((componentDetail.tags ?? []).join(', '));
    setContent(componentDetail.content ?? '');
    setFrontmatter(formatFrontmatter(componentDetail.frontmatter));
  }, [componentDetail]);

  const mutation = useMutation({
    mutationFn: () =>
      createPreset({
        name: name.trim(),
        description: description.trim(),
        component_type: componentType,
        platform,
        scope: 'user',
        tags: name
          ? Array.from(
              new Set(
                tags
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              )
            )
          : [],
        content,
        frontmatter: parseFrontmatter(frontmatter),
      }),
    onSuccess: (created) => {
      trackFeatureUsed('preset', {
        action: 'create',
        result: 'success',
        source: 'component_modal',
      });
      showSuccessToast(t('workspace.presets.presetCreateSuccess', { name: created.name }));
      void queryClient.invalidateQueries({ queryKey: ['presets'] });
      onCreated(created);
      onClose();
    },
    onError: (error: Error) => {
      trackFeatureUsed('preset', {
        action: 'create',
        result: 'failure',
        source: 'component_modal',
      });
      showErrorToast(t('workspace.presets.presetCreateError', { message: error.message }));
    },
  });

  if (!isOpen) return null;

  const getTypeLabel = (ct: PresetComponentType) => {
    const labels: Record<PresetComponentType, string> = {
      skill: 'Skill',
      agent: 'Agent',
      command: 'Command',
      hook: 'Hook',
      rule: 'Rule',
    };
    return labels[ct] ?? ct;
  };

  const getPlatformLabel = (p: PresetPlatform) => {
    const labels: Record<PresetPlatform, string> = {
      claude_code: 'Claude Code',
      cursor: 'Cursor',
    };
    return labels[p] ?? p;
  };

  return (
    <ModalPortal>
      <FocusLock returnFocus>
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-theme bg-theme-surface shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-theme px-6 py-4">
              <h2 className="text-lg font-semibold text-theme-primary">
                {t('workspace.presets.presetCreateTitle')}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-2 py-1 text-sm text-theme-secondary hover:text-theme-primary"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
              {isLoading ? (
                <p className="py-8 text-center text-sm text-theme-secondary">
                  {t('workspace.presets.loadingComponents')}
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <label className="text-sm text-theme-secondary">
                      {t('workspace.presets.snapshotNameLabel')}
                      <input
                        className="mt-1 w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 text-sm text-theme-primary"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t('workspace.presets.snapshotNamePlaceholder')}
                      />
                    </label>

                    <label className="text-sm text-theme-secondary">
                      {t('workspace.presets.libraryTypeLabel')}
                      <select
                        className="mt-1 w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 text-sm text-theme-primary"
                        value={componentType}
                        onChange={(e) => setComponentType(e.target.value as PresetComponentType)}
                      >
                        {COMPONENT_TYPES.map((ct) => (
                          <option key={ct} value={ct}>
                            {getTypeLabel(ct)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-sm text-theme-secondary">
                      {t('list.platformLabel')}
                      <select
                        className="mt-1 w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 text-sm text-theme-primary"
                        value={platform}
                        onChange={(e) => setPlatform(e.target.value as PresetPlatform)}
                      >
                        {PLATFORMS.map((p) => (
                          <option key={p} value={p}>
                            {getPlatformLabel(p)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-sm text-theme-secondary md:col-span-3">
                      {t('workspace.presets.snapshotDescriptionLabel')}
                      <input
                        className="mt-1 w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 text-sm text-theme-primary"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={t('workspace.presets.snapshotDescriptionPlaceholder')}
                      />
                    </label>

                    <label className="text-sm text-theme-secondary md:col-span-3">
                      {t('workspace.presets.snapshotTagsLabel')}
                      <input
                        className="mt-1 w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 text-sm text-theme-primary"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        placeholder={t('workspace.presets.snapshotTagsPlaceholder')}
                      />
                    </label>

                    <label className="text-sm text-theme-secondary md:col-span-3">
                      {t('workspace.presets.frontmatterLabel')}
                      <textarea
                        className={`${ANALYTICS_NO_CAPTURE_CLASS} mt-1 min-h-[5rem] w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 font-mono text-xs text-theme-primary`}
                        value={frontmatter}
                        onChange={(e) => setFrontmatter(e.target.value)}
                        placeholder="{}"
                      />
                    </label>

                    <label className="text-sm text-theme-secondary md:col-span-3">
                      {t('workspace.presets.componentContentPlaceholder')}
                      <textarea
                        className={`${ANALYTICS_NO_CAPTURE_CLASS} mt-1 min-h-[15rem] w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 font-mono text-xs text-theme-primary`}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder={t('workspace.presets.componentContentPlaceholder')}
                      />
                    </label>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-theme px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-semibold btn-theme-surface"
              >
                {t('workspace.presets.cancelAction')}
              </button>
              <button
                type="button"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || isLoading || !name.trim() || !content.trim()}
                className="rounded-lg px-4 py-2 text-sm font-semibold btn-theme-primary-soft disabled:opacity-50"
              >
                {mutation.isPending
                  ? t('workspace.presets.creatingSnapshot')
                  : t('workspace.presets.presetCreateAction')}
              </button>
            </div>
          </div>
        </div>
      </FocusLock>
    </ModalPortal>
  );
}
