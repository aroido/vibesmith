import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getPreset,
  getPresetRevision,
  getPresetRevisions,
  restorePresetRevision,
  updatePreset,
  type PresetComponentType,
  type PresetPlatform,
  type PresetWritableScope,
} from '@/common/api';
import { ANALYTICS_NO_CAPTURE_CLASS } from '@/common/analytics/privacy';
import { showErrorToast, showSuccessToast } from '@/common/utils';
import { ComponentWorkspaceTabs, PageFrame } from '@/components/common';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';

const COMPONENT_TYPES: PresetComponentType[] = ['skill', 'agent', 'command', 'hook', 'rule'];
const PLATFORMS: PresetPlatform[] = ['claude_code', 'cursor'];

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

function serializePresetFormState(input: {
  name: string;
  description: string;
  componentType: PresetComponentType;
  platform: PresetPlatform;
  scope: PresetWritableScope;
  tagsText: string;
  content: string;
  frontmatterText: string;
  changeNote: string;
}): string {
  return JSON.stringify(input);
}

export function ComponentPresetEditPage() {
  const { t } = useTranslation('components');
  const { id } = useParams<{ id: string }>();
  const presetId = id ?? '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [componentType, setComponentType] = useState<PresetComponentType>('skill');
  const [platform, setPlatform] = useState<PresetPlatform>('claude_code');
  const [scope, setScope] = useState<PresetWritableScope>('user');
  const [tagsText, setTagsText] = useState('');
  const [content, setContent] = useState('');
  const [frontmatterText, setFrontmatterText] = useState('{}');
  const [changeNote, setChangeNote] = useState('');
  const [initialFormState, setInitialFormState] = useState(() =>
    serializePresetFormState({
      name: '',
      description: '',
      componentType: 'skill',
      platform: 'claude_code',
      scope: 'user',
      tagsText: '',
      content: '',
      frontmatterText: '{}',
      changeNote: '',
    })
  );

  const { data: preset, isLoading: isPresetLoading } = useQuery({
    queryKey: ['preset', presetId],
    queryFn: () => getPreset(presetId),
    enabled: Boolean(presetId),
  });

  const { data: revisionsData } = useQuery({
    queryKey: ['preset-revisions', presetId],
    queryFn: () => getPresetRevisions(presetId, { limit: 200, offset: 0 }),
    enabled: Boolean(presetId),
  });

  const { data: latestRevisionDetail } = useQuery({
    queryKey: ['preset-revision-latest', presetId, preset?.latest_revision],
    queryFn: () => getPresetRevision(presetId, Number(preset?.latest_revision)),
    enabled: Boolean(presetId && preset?.latest_revision != null),
  });

  useEffect(() => {
    if (!preset || !latestRevisionDetail) return;

    const nextName = preset.name;
    const nextDescription = preset.description ?? '';
    const nextComponentType = preset.component_type;
    const nextPlatform = preset.platform;
    const nextScope = preset.scope;
    const nextTagsText = (preset.tags ?? []).join(', ');
    const nextContent = latestRevisionDetail.content ?? '';
    const nextFrontmatterText = JSON.stringify(latestRevisionDetail.frontmatter ?? {}, null, 2);

    setName(nextName);
    setDescription(nextDescription);
    setComponentType(nextComponentType);
    setPlatform(nextPlatform);
    setScope(nextScope);
    setTagsText(nextTagsText);
    setContent(nextContent);
    setFrontmatterText(nextFrontmatterText);
    setChangeNote('');

    setInitialFormState(
      serializePresetFormState({
        name: nextName,
        description: nextDescription,
        componentType: nextComponentType,
        platform: nextPlatform,
        scope: nextScope,
        tagsText: nextTagsText,
        content: nextContent,
        frontmatterText: nextFrontmatterText,
        changeNote: '',
      })
    );
  }, [latestRevisionDetail, preset]);

  const currentFormState = useMemo(
    () =>
      serializePresetFormState({
        name,
        description,
        componentType,
        platform,
        scope,
        tagsText,
        content,
        frontmatterText,
        changeNote,
      }),
    [changeNote, componentType, content, description, frontmatterText, name, platform, scope, tagsText]
  );

  const isDirty = currentFormState !== initialFormState;
  useUnsavedChangesGuard(isDirty, t('workspace.presets.unsavedChangesGuard'));

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) {
        throw new Error(t('workspace.presets.validationPresetNameRequired'));
      }
      if (!content.trim()) {
        throw new Error(t('workspace.presets.validationPresetContentRequired'));
      }

      return updatePreset(presetId, {
        name: name.trim(),
        description: description.trim(),
        component_type: componentType,
        platform,
        scope,
        tags: parseTags(tagsText),
        content,
        frontmatter: parseFrontmatter(frontmatterText),
        change_note: changeNote.trim() || null,
      });
    },
    onSuccess: () => {
      showSuccessToast(t('workspace.presets.updateSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['preset', presetId] });
      void queryClient.invalidateQueries({ queryKey: ['preset-revisions', presetId] });
      void queryClient.invalidateQueries({ queryKey: ['presets'] });
      void navigate(`/components/presets/${presetId}`);
    },
    onError: (error: Error) => {
      showErrorToast(t('workspace.presets.updateError', { message: error.message }));
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (revision: number) => restorePresetRevision(presetId, revision, changeNote),
    onSuccess: (restored) => {
      showSuccessToast(t('workspace.presets.restoreSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['preset', presetId] });
      void queryClient.invalidateQueries({ queryKey: ['preset-revisions', presetId] });
      setContent(restored.content ?? '');
      setFrontmatterText(JSON.stringify(restored.frontmatter ?? {}, null, 2));
    },
    onError: (error: Error) => {
      showErrorToast(t('workspace.presets.restoreError', { message: error.message }));
    },
  });

  if (!presetId) {
    return (
      <PageFrame
        activeNav="components"
        title={t('workspace.presets.editTitle')}
        subtitle={t('workspace.presets.invalidPresetId')}
      >
        <div />
      </PageFrame>
    );
  }

  return (
    <PageFrame
      activeNav="components"
      title={t('workspace.presets.editTitle')}
      subtitle={preset?.name ?? t('workspace.presets.editSubtitle')}
      contentClassName="max-w-[74rem] mx-auto"
    >
      <div className="space-y-6">
        <ComponentWorkspaceTabs active="presets" />

        {preset?.scope === 'system' ? (
          <section className="rounded-2xl border border-theme bg-theme-surface p-6">
            <p className="text-sm text-theme-secondary">
              {t('workspace.presets.systemPresetReadOnly')}
            </p>
          </section>
        ) : null}

        <section className="rounded-2xl border border-theme bg-theme-surface p-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm text-theme-secondary">
              {t('workspace.presets.snapshotNameLabel')}
              <input
                className="mt-1 w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 text-sm text-theme-primary"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>

            <label className="text-sm text-theme-secondary">
              {t('workspace.presets.libraryTypeLabel')}
              <select
                className="mt-1 w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 text-sm text-theme-primary"
                value={componentType}
                onChange={(event) =>
                  setComponentType(event.target.value as PresetComponentType)
                }
              >
                {COMPONENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-theme-secondary">
              {t('list.platformLabel')}
              <select
                className="mt-1 w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 text-sm text-theme-primary"
                value={platform}
                onChange={(event) => setPlatform(event.target.value as PresetPlatform)}
              >
                {PLATFORMS.map((platformOption) => (
                  <option key={platformOption} value={platformOption}>
                    {platformOption}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-theme-secondary">
              {t('workspace.presets.scopeUser')}
              <select
                className="mt-1 w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 text-sm text-theme-primary"
                value={scope}
                onChange={(event) => setScope(event.target.value as PresetWritableScope)}
              >
                <option value="user">{t('workspace.presets.scopeUser')}</option>
                <option value="system">{t('workspace.presets.scopeSystem')}</option>
              </select>
            </label>

            <label className="text-sm text-theme-secondary md:col-span-2">
              {t('workspace.presets.snapshotDescriptionLabel')}
              <input
                className="mt-1 w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 text-sm text-theme-primary"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>

            <label className="text-sm text-theme-secondary md:col-span-2">
              {t('workspace.presets.snapshotTagsLabel')}
              <input
                className="mt-1 w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 text-sm text-theme-primary"
                value={tagsText}
                onChange={(event) => setTagsText(event.target.value)}
              />
            </label>

            <label className="text-sm text-theme-secondary md:col-span-2">
              {t('workspace.presets.frontmatterLabel')}
              <textarea
                className={`${ANALYTICS_NO_CAPTURE_CLASS} mt-1 min-h-20 w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 font-mono text-xs text-theme-primary`}
                value={frontmatterText}
                onChange={(event) => setFrontmatterText(event.target.value)}
              />
            </label>

            <label className="text-sm text-theme-secondary md:col-span-2">
              {t('workspace.presets.contentLabel')}
              <textarea
                className={`${ANALYTICS_NO_CAPTURE_CLASS} mt-1 min-h-48 w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 font-mono text-xs text-theme-primary`}
                value={content}
                onChange={(event) => setContent(event.target.value)}
              />
            </label>

            <label className="text-sm text-theme-secondary md:col-span-2">
              {t('workspace.presets.changeNoteLabel')}
              <input
                className="mt-1 w-full rounded-lg border border-theme bg-theme-bg px-3 py-2 text-sm text-theme-primary"
                value={changeNote}
                onChange={(event) => setChangeNote(event.target.value)}
                placeholder={t('workspace.presets.changeNotePlaceholder')}
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-theme bg-theme-surface p-6">
          <h2 className="text-lg font-semibold text-theme-primary">
            {t('workspace.presets.revisionRestoreTitle')}
          </h2>
          {isPresetLoading ? (
            <p className="mt-3 text-sm text-theme-secondary">{t('workspace.presets.loadingTemplates')}</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {(revisionsData?.items ?? []).map((revision) => (
                <button
                  key={`restore-${revision.revision}`}
                  type="button"
                  onClick={() => restoreMutation.mutate(revision.revision)}
                  className="rounded-lg border border-theme px-3 py-1.5 text-xs font-semibold btn-theme-surface"
                >
                  {t('workspace.presets.restoreAction', { revision: revision.revision })}
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || restoreMutation.isPending || preset?.scope === 'system'}
            className="rounded-lg px-4 py-2 text-sm font-semibold btn-theme-primary-soft disabled:opacity-50"
          >
            {updateMutation.isPending
              ? t('workspace.presets.savingAction')
              : t('workspace.presets.saveAction')}
          </button>

          <Link
            to={`/components/presets/${presetId}`}
            className="rounded-lg px-4 py-2 text-sm font-semibold btn-theme-surface"
          >
            {t('wizard.cancel')}
          </Link>
        </div>
      </div>
    </PageFrame>
  );
}
