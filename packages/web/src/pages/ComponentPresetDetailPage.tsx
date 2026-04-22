import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getPreset, getPresetRevision, getPresetRevisions } from '@/common/api';
import { ANALYTICS_NO_CAPTURE_CLASS } from '@/common/analytics/privacy';
import { ComponentWorkspaceTabs, PageFrame } from '@/components/common';

export function ComponentPresetDetailPage() {
  const { t } = useTranslation('components');
  const { id } = useParams<{ id: string }>();
  const presetId = id ?? '';
  const [selectedRevision, setSelectedRevision] = useState<number | null>(null);

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

  const resolvedRevision = useMemo(() => {
    if (selectedRevision != null) return selectedRevision;
    return preset?.latest_revision ?? null;
  }, [preset?.latest_revision, selectedRevision]);

  const { data: revisionDetail, isLoading: isRevisionLoading } = useQuery({
    queryKey: ['preset-revision', presetId, resolvedRevision],
    queryFn: () => getPresetRevision(presetId, Number(resolvedRevision)),
    enabled: Boolean(presetId && resolvedRevision != null),
  });

  if (!presetId) {
    return (
      <PageFrame
        activeNav="components"
        title={t('workspace.presets.detailTitle')}
        subtitle={t('workspace.presets.invalidPresetId')}
      >
        <div />
      </PageFrame>
    );
  }

  return (
    <PageFrame
      activeNav="components"
      title={preset?.name ?? t('workspace.presets.detailTitle')}
      subtitle={preset?.description ?? t('workspace.presets.detailSubtitle')}
      contentClassName="max-w-[74rem] mx-auto"
    >
      <div className="space-y-6">
        <ComponentWorkspaceTabs active="presets" />

        <section className="rounded-2xl border border-theme bg-theme-surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-md border border-theme px-2 py-1 text-xs text-theme-secondary">
                {preset?.component_type ?? '-'}
              </span>
              <span className="rounded-md border border-theme px-2 py-1 text-xs text-theme-secondary">
                {preset?.platform ?? '-'}
              </span>
              <span className="rounded-md border border-theme px-2 py-1 text-xs text-theme-secondary">
                {preset?.scope ?? '-'}
              </span>
              <span className="rounded-md border border-theme px-2 py-1 text-xs text-theme-secondary">
                {t('workspace.presets.revisionLabel', {
                  revision: preset?.latest_revision ?? '-',
                })}
              </span>
            </div>

            {preset?.scope === 'user' ? (
              <Link
                to={`/components/presets/${presetId}/edit`}
                className="rounded-lg px-4 py-2 text-sm font-semibold btn-theme-primary-soft"
              >
                {t('workspace.presets.editAction')}
              </Link>
            ) : null}
          </div>

          {(preset?.tags ?? []).length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1">
              {(preset?.tags ?? []).map((tag) => (
                <span
                  key={`${preset?.id}-${tag}`}
                  className="rounded-full border border-theme px-2 py-0.5 text-[11px] text-theme-secondary"
                >
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-theme bg-theme-surface p-6">
          <h2 className="text-lg font-semibold text-theme-primary">
            {t('workspace.presets.revisionTitle')}
          </h2>

          {isPresetLoading ? (
            <p className="mt-3 text-sm text-theme-secondary">
              {t('workspace.presets.loadingTemplates')}
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[16rem_minmax(0,1fr)]">
              <div className="rounded-xl border border-theme bg-theme-bg p-3">
                <p className="mb-2 text-sm font-medium text-theme-primary">
                  {t('workspace.presets.revisionListLabel')}
                </p>
                <div className="max-h-[24rem] space-y-2 overflow-auto">
                  {(revisionsData?.items ?? []).map((revision) => (
                    <button
                      key={revision.revision}
                      type="button"
                      onClick={() => setSelectedRevision(revision.revision)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                        resolvedRevision === revision.revision
                          ? 'border-theme-primary bg-theme-surface'
                          : 'border-theme bg-theme-bg'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-theme-primary">
                          {t('workspace.presets.revisionLabel', { revision: revision.revision })}
                        </span>
                        <span className="text-[11px] text-theme-secondary">{revision.content_hash.slice(0, 8)}</span>
                      </div>
                      <p className="mt-1 text-xs text-theme-secondary">{revision.change_note}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-theme bg-theme-bg p-3">
                <p className="mb-2 text-sm font-medium text-theme-primary">
                  {t('workspace.presets.revisionDetailTitle')}
                </p>

                {isRevisionLoading ? (
                  <p className="text-sm text-theme-secondary">{t('workspace.presets.loadingTemplates')}</p>
                ) : revisionDetail ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-theme-secondary">
                        {t('workspace.presets.changeNoteLabel')}
                      </p>
                      <p className="text-sm text-theme-primary">{revisionDetail.change_note || '-'}</p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-theme-secondary">
                        {t('workspace.presets.frontmatterLabel')}
                      </p>
                      <pre
                        className={`${ANALYTICS_NO_CAPTURE_CLASS} mt-1 overflow-auto rounded-lg border border-theme bg-theme-surface p-2 text-xs text-theme-primary`}
                      >
                        {JSON.stringify(revisionDetail.frontmatter ?? {}, null, 2)}
                      </pre>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-theme-secondary">
                        {t('workspace.presets.contentLabel')}
                      </p>
                      <pre
                        className={`${ANALYTICS_NO_CAPTURE_CLASS} mt-1 max-h-[28rem] overflow-auto rounded-lg border border-theme bg-theme-surface p-2 text-xs text-theme-primary`}
                      >
                        {revisionDetail.content || ''}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-theme-secondary">{t('workspace.presets.emptyTemplates')}</p>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </PageFrame>
  );
}
