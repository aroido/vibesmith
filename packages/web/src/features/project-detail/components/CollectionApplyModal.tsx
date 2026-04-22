import { Fragment, useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import FocusLock from 'react-focus-lock';
import { ArrowLeft, Eye, Package, Search, X } from 'lucide-react';
import { diffLines } from 'diff';
import { ModalPortal } from '@/components/common/ModalPortal';
import { ComponentIcon } from '@/components/common/ComponentIcon';
import {
  applyCollection,
  getCollection,
  getCollections,
  previewCollectionApply,
  type CollectionConflictPolicy,
  type CollectionPreviewResponse,
  type CollectionResponse,
  type CollectionSummaryResponse,
  type PresetComponentType,
} from '@/common/api';
import { showErrorToast, showSuccessToast } from '@/common/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface CollectionApplyModalProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ActionLabel = 'create' | 'update' | 'skip' | 'rename' | 'conflict';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const ACTION_BADGE_CLASS: Record<ActionLabel, string> = {
  create: 'alert-theme-success',
  update: 'alert-theme-info',
  skip: 'badge-theme-muted',
  rename: 'badge-theme-info',
  conflict: 'alert-theme-warning',
};

const MODAL_POLICY_OPTIONS: { value: Exclude<CollectionConflictPolicy, 'fail'>; key: string }[] = [
  { value: 'skip', key: 'presetApply.modal.policySkip' },
  { value: 'rename', key: 'presetApply.modal.policyRename' },
  { value: 'overwrite', key: 'presetApply.modal.policyOverwrite' },
];

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function CollectionApplyModal({
  projectId,
  open,
  onOpenChange,
}: CollectionApplyModalProps) {
  const { t } = useTranslation('projectDetail');
  const queryClient = useQueryClient();

  /* ---- core state ---- */
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [policy, setPolicy] = useState<CollectionConflictPolicy>('skip');
  const [previewResult, setPreviewResult] = useState<CollectionPreviewResponse | null>(null);
  const [itemOverrides, setItemOverrides] = useState<Record<string, CollectionConflictPolicy>>({});

  /* ---- reset on close ---- */
  const resetState = useCallback(() => {
    setStep(1);
    setSelectedCollectionId('');
    setSearchQuery('');
    setPolicy('skip');
    setPreviewResult(null);
    setItemOverrides({});
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) resetState();
      onOpenChange(next);
    },
    [onOpenChange, resetState],
  );

  /* ---- queries ---- */
  const { data: collectionsData, isLoading: isLoadingCollections } = useQuery({
    queryKey: ['collections', 'modal-list'],
    queryFn: () => getCollections({ limit: 100, offset: 0 }),
    enabled: open,
  });

  const { data: collectionDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['collection-detail', selectedCollectionId],
    queryFn: () => getCollection(selectedCollectionId),
    enabled: open && Boolean(selectedCollectionId),
  });

  const collections = useMemo(() => collectionsData?.items ?? [], [collectionsData]);

  const filteredCollections = useMemo(() => {
    if (!searchQuery.trim()) return collections;
    const q = searchQuery.trim().toLowerCase();
    return collections.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
    );
  }, [collections, searchQuery]);

  /* ---- preview mutation ---- */
  const previewMutation = useMutation({
    mutationFn: (p: {
      collectionId: string;
      policy: CollectionConflictPolicy;
      overrides?: Record<string, CollectionConflictPolicy>;
    }) =>
      previewCollectionApply(p.collectionId, {
        project_id: projectId,
        conflict_policy: p.policy,
        ...(p.overrides && Object.keys(p.overrides).length > 0
          ? { item_overrides: p.overrides }
          : {}),
      }),
    onSuccess: (result) => {
      setPreviewResult(result);
    },
    onError: (error: Error) => {
      showErrorToast(t('presetApply.previewError', { message: error.message }));
    },
  });

  /* ---- apply mutation ---- */
  const applyMutation = useMutation({
    mutationFn: () =>
      applyCollection(selectedCollectionId, {
        project_id: projectId,
        conflict_policy: policy,
        ...(Object.keys(itemOverrides).length > 0
          ? { item_overrides: itemOverrides }
          : {}),
      }),
    onSuccess: (result) => {
      showSuccessToast(
        t('presetApply.applySuccess', {
          created: result.summary.created,
          updated: result.summary.updated,
          renamed: result.summary.renamed,
          skipped: result.summary.skipped,
        }),
      );
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['project-components', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['project-activities', projectId] });
      handleOpenChange(false);
    },
    onError: (error: Error) => {
      showErrorToast(t('presetApply.applyError', { message: error.message }));
    },
  });

  /* ---- handlers ---- */
  const handlePolicyChange = useCallback(
    (newPolicy: CollectionConflictPolicy) => {
      setPolicy(newPolicy);
      setItemOverrides({});
      if (step === 2 && selectedCollectionId) {
        previewMutation.mutate({ collectionId: selectedCollectionId, policy: newPolicy });
      }
    },
    [step, selectedCollectionId, previewMutation],
  );

  const handleItemOverride = useCallback(
    (presetId: string, itemPolicy: CollectionConflictPolicy) => {
      const next = { ...itemOverrides };
      if (itemPolicy === policy) {
        delete next[presetId];
      } else {
        next[presetId] = itemPolicy;
      }
      setItemOverrides(next);
      if (selectedCollectionId) {
        previewMutation.mutate({
          collectionId: selectedCollectionId,
          policy,
          overrides: Object.keys(next).length > 0 ? next : undefined,
        });
      }
    },
    [itemOverrides, policy, selectedCollectionId, previewMutation],
  );

  const handleGoToPreview = () => {
    if (!selectedCollectionId) return;
    previewMutation.mutate({ collectionId: selectedCollectionId, policy });
    setStep(2);
  };

  const handleBackToStep1 = () => {
    setStep(1);
    setPreviewResult(null);
    setItemOverrides({});
  };

  const handleApply = () => {
    if (!selectedCollectionId || !previewResult) return;
    applyMutation.mutate();
  };

  /* ---- derived ---- */
  const selectedCollection = useMemo(
    () => collections.find((c) => c.id === selectedCollectionId),
    [collections, selectedCollectionId],
  );

  const hasConflicts = (previewResult?.summary.conflicts ?? 0) > 0;

  const summaryBadges = useMemo(() => {
    if (!previewResult) return [];
    const counts: Record<string, number> = {};
    for (const item of previewResult.items) {
      counts[item.action] = (counts[item.action] ?? 0) + 1;
    }
    const order: ActionLabel[] = ['create', 'update', 'skip', 'rename', 'conflict'];
    return order
      .filter((a) => (counts[a] ?? 0) > 0)
      .map((a) => ({ action: a, count: counts[a]! }));
  }, [previewResult]);

  /* ================================================================ */
  /*  Render                                                          */
  /* ================================================================ */

  if (!open) return null;

  return (
    <ModalPortal>
      <FocusLock returnFocus>
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleOpenChange(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') handleOpenChange(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="mx-4 flex max-h-[80vh] w-full max-w-[800px] flex-col overflow-hidden rounded-2xl border border-theme bg-theme-surface shadow-xl"
          >
            {step === 1 ? (
              <Step1SelectCollection
                t={t}
                collections={filteredCollections}
                isLoading={isLoadingCollections}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedCollectionId={selectedCollectionId}
                onSelectCollection={setSelectedCollectionId}
                selectedCollection={selectedCollection ?? null}
                collectionDetail={collectionDetail ?? null}
                isLoadingDetail={isLoadingDetail}
                onCancel={() => handleOpenChange(false)}
                onPreview={handleGoToPreview}
              />
            ) : (
              <Step2PreviewApply
                t={t}
                selectedCollection={selectedCollection ?? null}
                previewResult={previewResult}
                summaryBadges={summaryBadges}
                hasConflicts={hasConflicts}
                policy={policy}
                itemOverrides={itemOverrides}
                onPolicyChange={handlePolicyChange}
                onItemOverride={handleItemOverride}
                isPreviewing={previewMutation.isPending}
                isApplying={applyMutation.isPending}
                onBack={handleBackToStep1}
                onCancel={() => handleOpenChange(false)}
                onApply={handleApply}
              />
            )}
          </div>
        </div>
      </FocusLock>
    </ModalPortal>
  );
}

/* ================================================================== */
/*  Step 1 - Collection Selection                                     */
/* ================================================================== */

interface Step1Props {
  t: ReturnType<typeof useTranslation>['t'];
  collections: CollectionSummaryResponse[];
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCollectionId: string;
  onSelectCollection: (id: string) => void;
  selectedCollection: CollectionSummaryResponse | null;
  collectionDetail: CollectionResponse | null;
  isLoadingDetail: boolean;
  onCancel: () => void;
  onPreview: () => void;
}

function Step1SelectCollection({
  t,
  collections,
  isLoading,
  searchQuery,
  onSearchChange,
  selectedCollectionId,
  onSelectCollection,
  selectedCollection,
  collectionDetail,
  isLoadingDetail,
  onCancel,
  onPreview,
}: Step1Props) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 border-b border-theme px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-theme-primary">
            {t('presetApply.modal.title')}
          </h2>
          <p className="mt-1 text-sm text-theme-secondary">
            {t('presetApply.subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-2 py-1 text-sm text-theme-secondary hover:text-theme-primary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Two-column body */}
      <div className="flex min-h-0 flex-1">
        {/* Left panel: search + list */}
        <div className="flex w-1/2 flex-col border-r border-theme">
          {/* Search */}
          <div className="shrink-0 px-4 pt-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-tertiary" />
              <input
                type="text"
                className="w-full rounded-lg border border-theme bg-theme-bg py-2 pl-9 pr-3 text-sm text-theme-primary placeholder:text-theme-tertiary focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                placeholder={t('presetApply.modal.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          </div>

          {/* Collection list */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {isLoading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-theme border-t-[var(--color-accent)]" />
              </div>
            ) : collections.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <Package className="h-10 w-10 text-theme-tertiary" />
                <p className="text-sm font-medium text-theme-secondary">
                  {t('presetApply.modal.emptyList')}
                </p>
                <Link
                  to="/components/presets"
                  className="text-xs font-semibold text-[var(--color-accent)] underline-offset-2 hover:underline"
                >
                  {t('presetApply.modal.emptyListAction')}
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {collections.map((c) => {
                  const isSelected = c.id === selectedCollectionId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onSelectCollection(c.id)}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        isSelected
                          ? 'border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] ring-1 ring-[var(--color-accent)]'
                          : 'border-theme hover:bg-theme-hover'
                      }`}
                    >
                      <p className="text-sm font-semibold text-theme-primary truncate">
                        {c.name}
                      </p>
                      <p className="mt-0.5 text-xs text-theme-secondary truncate">
                        {c.description || '\u00A0'}
                      </p>
                      <p className="mt-1 text-[11px] text-theme-tertiary">
                        {t('presetApply.modal.presetCount', { count: c.items_count })}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right panel: detail */}
        <div className="flex w-1/2 flex-col overflow-y-auto px-4 py-4">
          {!selectedCollectionId ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-theme-tertiary">
                {t('presetApply.modal.emptySelection')}
              </p>
            </div>
          ) : (
            <CollectionDetailPanel
              t={t}
              collection={selectedCollection}
              detail={collectionDetail}
              isLoading={isLoadingDetail}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex shrink-0 justify-end gap-2 border-t border-theme px-6 py-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-semibold btn-theme-surface"
        >
          {t('presetApply.modal.cancelButton')}
        </button>
        <button
          type="button"
          onClick={onPreview}
          disabled={!selectedCollectionId}
          className="rounded-lg px-4 py-2 text-sm font-semibold btn-theme-primary-soft disabled:opacity-50"
        >
          {t('presetApply.modal.previewButton')}
        </button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Collection detail (right panel of Step 1)                         */
/* ------------------------------------------------------------------ */

interface CollectionDetailPanelProps {
  t: ReturnType<typeof useTranslation>['t'];
  collection: CollectionSummaryResponse | null;
  detail: CollectionResponse | null;
  isLoading: boolean;
}

function CollectionDetailPanel({ t, collection, detail, isLoading }: CollectionDetailPanelProps) {
  if (!collection) return null;

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-theme-primary">{collection.name}</h4>
        {collection.description && (
          <p className="mt-1 text-xs text-theme-secondary">{collection.description}</p>
        )}
      </div>

      {/* Tags */}
      {collection.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {collection.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full px-2 py-0.5 text-[11px] badge-theme-muted"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Items list */}
      <div>
        <p className="mb-2 text-xs font-semibold text-theme-primary">
          {t('presetApply.modal.presetCount', { count: collection.items_count })}
        </p>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-theme border-t-[var(--color-accent)]" />
          </div>
        ) : detail ? (
          <ul className="space-y-1.5">
            {detail.items.map((item) => (
              <li
                key={`${item.preset_id}-${item.order_index}`}
                className="flex items-center gap-2 rounded-md border border-theme px-2.5 py-1.5"
              >
                <span className="text-xs font-medium text-theme-primary truncate">
                  {item.alias_name || item.preset_name || item.preset_id}
                </span>
                <span className="ml-auto shrink-0 text-[11px] text-theme-tertiary">
                  {item.pin_mode === 'latest'
                    ? t('presetApply.modal.pinLatest')
                    : t('presetApply.modal.pinFixed', { revision: item.pinned_revision ?? item.resolved_revision })}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Step 2 - Preview & Apply                                          */
/* ================================================================== */

interface Step2Props {
  t: ReturnType<typeof useTranslation>['t'];
  selectedCollection: CollectionSummaryResponse | null;
  previewResult: CollectionPreviewResponse | null;
  summaryBadges: { action: ActionLabel; count: number }[];
  hasConflicts: boolean;
  policy: CollectionConflictPolicy;
  itemOverrides: Record<string, CollectionConflictPolicy>;
  onPolicyChange: (p: CollectionConflictPolicy) => void;
  onItemOverride: (presetId: string, p: CollectionConflictPolicy) => void;
  isPreviewing: boolean;
  isApplying: boolean;
  onBack: () => void;
  onCancel: () => void;
  onApply: () => void;
}

function Step2PreviewApply({
  t,
  selectedCollection,
  previewResult,
  summaryBadges,
  hasConflicts,
  policy,
  itemOverrides,
  onPolicyChange,
  onItemOverride,
  isPreviewing,
  isApplying,
  onBack,
  onCancel,
  onApply,
}: Step2Props) {
  const [expandedContent, setExpandedContent] = useState<string | null>(null);

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 border-b border-theme px-6 py-4">
        <div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="rounded-md p-1 text-theme-secondary hover:bg-theme-hover hover:text-theme-primary"
              aria-label={t('presetApply.modal.backButton')}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h2 className="text-lg font-semibold text-theme-primary">
              {t('presetApply.modal.previewTitle')}
            </h2>
          </div>
          {selectedCollection && (
            <p className="mt-1 text-sm text-theme-secondary">
              {selectedCollection.name}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-2 py-1 text-sm text-theme-secondary hover:text-theme-primary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isPreviewing && !previewResult ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-theme border-t-[var(--color-accent)]" />
          </div>
        ) : previewResult ? (
          <div className="space-y-4">
            {/* Summary + global policy row */}
            <div className="flex items-center justify-between gap-3">
              {/* Summary badges */}
              <div className="flex flex-wrap gap-1.5">
                {summaryBadges.map((b) => (
                  <span
                    key={b.action}
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ACTION_BADGE_CLASS[b.action]}`}
                  >
                    {t(`presetApply.actionLabels.${b.action}`)} {b.count}
                  </span>
                ))}
              </div>

              {/* Global policy selector */}
              {hasConflicts && (
                <div className="flex shrink-0 items-center gap-2">
                  <label className="text-[11px] font-semibold text-theme-secondary whitespace-nowrap">
                    {t('presetApply.modal.conflictPolicyLabel')}
                  </label>
                  <select
                    className="rounded-md border border-theme bg-theme-bg px-2 py-1 text-xs text-theme-primary"
                    value={policy}
                    onChange={(e) => onPolicyChange(e.target.value as CollectionConflictPolicy)}
                  >
                    {MODAL_POLICY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t(opt.key)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {policy === 'overwrite' && hasConflicts && (
              <p className="text-[11px] font-medium text-[var(--color-state-warning)]">
                {t('presetApply.modal.policyOverwriteWarn')}
              </p>
            )}

            {/* Flat item list */}
            <div className="rounded-lg border border-theme">
              {previewResult.items.map((item, idx) => {
                const isConflict = item.target_component_id != null;
                const hasOverride = itemOverrides[item.preset_id] !== undefined;
                const isContentOpen = expandedContent === item.preset_id;
                const hasContent = item.existing_content || item.new_content;

                return (
                  <div
                    key={`${item.preset_id}-${idx}`}
                    className={idx > 0 ? 'border-t border-theme' : ''}
                  >
                    {/* Item row */}
                    <div className="flex items-center gap-2 px-3 py-2.5 text-xs">
                      <ComponentIcon
                        type={item.type as PresetComponentType}
                        className="!h-5 !w-5 shrink-0 [&>svg]:!h-3.5 [&>svg]:!w-3.5"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-theme-primary">
                          {item.name}
                        </span>
                        {item.renamed_to && (
                          <span className="block truncate text-[11px] text-theme-secondary">
                            &rarr; {item.renamed_to}
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 text-theme-tertiary">{item.type}</span>

                      {/* Content toggle button */}
                      {isConflict && hasContent && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedContent(isContentOpen ? null : item.preset_id)
                          }
                          className={`shrink-0 rounded-md p-1 transition-colors ${
                            isContentOpen
                              ? 'bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] text-[var(--color-accent)]'
                              : 'text-theme-tertiary hover:text-theme-primary'
                          }`}
                          title={t('presetApply.modal.viewContent')}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {/* Action badge or per-item dropdown */}
                      {isConflict ? (
                        <select
                          className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${ACTION_BADGE_CLASS[item.action]} ${
                            hasOverride ? 'ring-1 ring-[var(--color-accent)]' : ''
                          }`}
                          value={itemOverrides[item.preset_id] ?? policy}
                          onChange={(e) =>
                            onItemOverride(item.preset_id, e.target.value as CollectionConflictPolicy)
                          }
                        >
                          {MODAL_POLICY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {t(opt.key)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${ACTION_BADGE_CLASS[item.action]}`}
                        >
                          {t(`presetApply.actionLabels.${item.action}`)}
                        </span>
                      )}
                    </div>

                    {/* Expanded content diff */}
                    {isContentOpen && hasContent && (
                      <ContentDiffPanel
                        existing={item.existing_content ?? ''}
                        incoming={item.new_content ?? ''}
                        existingLabel={t('presetApply.modal.existingContent')}
                        incomingLabel={t('presetApply.modal.newContent')}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {isPreviewing && (
              <div className="flex justify-center py-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-theme border-t-[var(--color-accent)]" />
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Footer */}
      <div className="flex shrink-0 justify-end gap-2 border-t border-theme px-6 py-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-semibold btn-theme-surface"
        >
          {t('presetApply.modal.cancelButton')}
        </button>
        <button
          type="button"
          onClick={onApply}
          disabled={isApplying || !previewResult || isPreviewing}
          className="rounded-lg px-4 py-2 text-sm font-semibold btn-theme-primary-soft disabled:opacity-50"
        >
          {isApplying
            ? t('presetApply.modal.applyingText')
            : t('presetApply.modal.applyButton')}
        </button>
      </div>
    </>
  );
}

/* ================================================================== */
/*  Content diff panel                                                 */
/* ================================================================== */

interface ContentDiffPanelProps {
  existing: string;
  incoming: string;
  existingLabel: string;
  incomingLabel: string;
}

function ContentDiffPanel({ existing, incoming, existingLabel, incomingLabel }: ContentDiffPanelProps) {
  type DiffLine = { text: string; type: 'removed' | 'added' | 'common' | 'blank' };

  const rows = useMemo(() => {
    const changes = diffLines(existing, incoming);
    const result: { left: DiffLine; right: DiffLine }[] = [];
    let i = 0;

    while (i < changes.length) {
      const cur = changes[i];
      const next = changes[i + 1];
      const splitLines = (v: string) => v.replace(/\n$/, '').split('\n');

      // Consecutive removed + added → align side-by-side
      if (cur.removed && next?.added) {
        const leftLines = splitLines(cur.value);
        const rightLines = splitLines(next.value);
        const max = Math.max(leftLines.length, rightLines.length);
        for (let j = 0; j < max; j++) {
          result.push({
            left: j < leftLines.length
              ? { text: leftLines[j], type: 'removed' }
              : { text: '', type: 'blank' },
            right: j < rightLines.length
              ? { text: rightLines[j], type: 'added' }
              : { text: '', type: 'blank' },
          });
        }
        i += 2;
      } else if (cur.removed) {
        for (const line of splitLines(cur.value)) {
          result.push({
            left: { text: line, type: 'removed' },
            right: { text: '', type: 'blank' },
          });
        }
        i++;
      } else if (cur.added) {
        for (const line of splitLines(cur.value)) {
          result.push({
            left: { text: '', type: 'blank' },
            right: { text: line, type: 'added' },
          });
        }
        i++;
      } else {
        for (const line of splitLines(cur.value)) {
          result.push({
            left: { text: line, type: 'common' },
            right: { text: line, type: 'common' },
          });
        }
        i++;
      }
    }
    return result;
  }, [existing, incoming]);

  return (
    <div className="border-t border-theme">
      {/* Header */}
      <div className="grid grid-cols-2 divide-x divide-theme">
        <div className="bg-theme-bg px-3 py-1.5">
          <span className="text-[11px] font-semibold text-theme-danger">
            − {existingLabel}
          </span>
        </div>
        <div className="bg-theme-bg px-3 py-1.5">
          <span className="text-[11px] font-semibold text-theme-success">
            + {incomingLabel}
          </span>
        </div>
      </div>
      {/* Rows */}
      <div className="max-h-64 overflow-auto">
        <div className="grid grid-cols-2 divide-x divide-theme text-[11px] font-mono leading-relaxed">
          {rows.map((row, i) => (
            <Fragment key={i}>
              <div
                className="px-3 whitespace-pre-wrap break-all"
                style={
                  row.left.type === 'removed'
                    ? { backgroundColor: 'color-mix(in srgb, var(--color-state-danger) 15%, transparent)', color: 'var(--color-state-danger)' }
                    : row.left.type === 'blank'
                      ? { opacity: 0.3 }
                      : undefined
                }
              >
                {row.left.type === 'blank' ? '\u00A0' : row.left.text}
              </div>
              <div
                className="px-3 whitespace-pre-wrap break-all"
                style={
                  row.right.type === 'added'
                    ? { backgroundColor: 'color-mix(in srgb, var(--color-state-success) 15%, transparent)', color: 'var(--color-state-success)' }
                    : row.right.type === 'blank'
                      ? { opacity: 0.3 }
                      : undefined
                }
              >
                {row.right.type === 'blank' ? '\u00A0' : row.right.text}
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
