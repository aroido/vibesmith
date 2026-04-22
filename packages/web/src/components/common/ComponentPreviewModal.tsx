import { useEffect, useState } from 'react';
import FocusLock from 'react-focus-lock';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ComponentDetailResponse, ComponentListItemResponse } from '@/common/api';
import {
  ANALYTICS_MASK_TEXT_CLASS,
  ANALYTICS_NO_CAPTURE_CLASS,
} from '@/common/analytics/privacy';
import { ModalPortal } from './ModalPortal';

interface ComponentPreviewModalProps {
  isOpen: boolean;
  item: ComponentListItemResponse | null;
  detail: ComponentDetailResponse | null;
  typeLabel: string;
  statusLabel: string;
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onClose: () => void;
}

type ContentViewMode = 'rendered' | 'source';

function makeContentPreview(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length <= 4000) return trimmed;
  return `${trimmed.slice(0, 4000)}\n...`;
}

function makeFrontmatterPreview(frontmatter: Record<string, unknown> | null | undefined): string | null {
  if (!frontmatter || typeof frontmatter !== 'object') return null;
  if (Object.keys(frontmatter).length === 0) return null;
  try {
    return JSON.stringify(frontmatter, null, 2);
  } catch {
    return null;
  }
}

export function ComponentPreviewModal({
  isOpen,
  item,
  detail,
  typeLabel,
  statusLabel,
  isLoading,
  errorMessage,
  onRetry,
  onClose,
}: ComponentPreviewModalProps) {
  const { t, i18n } = useTranslation(['components', 'common']);
  const [contentViewMode, setContentViewMode] = useState<ContentViewMode>('rendered');

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setContentViewMode('rendered');
  }, [isOpen]);

  if (!isOpen || !item) return null;

  const description = item.description?.trim() || t('workspace.presets.componentCardNoDescription');
  const updatedAt = new Date(item.updated_at).toLocaleString(i18n.language === 'ko' ? 'ko-KR' : 'en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const contentPreview = detail?.content ? makeContentPreview(detail.content) : '';
  const frontmatterPreview = makeFrontmatterPreview(detail?.frontmatter);

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[2147483100] flex items-center justify-center bg-black/70 p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="component-preview-modal-title"
      >
        <FocusLock autoFocus returnFocus>
          <div
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-theme bg-theme-elevated shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="shrink-0 border-b border-theme px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-theme-secondary">{t('detail.preview')}</p>
                  <h2
                    id="component-preview-modal-title"
                    className="line-clamp-2 break-all text-lg font-semibold text-theme-primary"
                  >
                    {item.name}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 rounded-lg border border-theme px-3 py-1.5 text-xs font-semibold btn-theme-surface"
                >
                  {t('common:close')}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-theme bg-theme-bg px-2 py-0.5 text-xs text-theme-secondary">
                  {typeLabel}
                </span>
                <span className="rounded-md border border-theme bg-theme-bg px-2 py-0.5 text-xs text-theme-secondary">
                  {statusLabel}
                </span>
                <span className="rounded-md border border-theme bg-theme-bg px-2 py-0.5 text-xs text-theme-secondary">
                  {item.project_name}
                </span>
              </div>
            </header>

            <div className="min-h-0 overflow-y-auto px-5 pb-5 pt-4">
              <div className="rounded-xl border border-theme bg-theme-bg p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-theme-secondary">
                  {t('detail.description')}
                </p>
                <p className="mt-1 text-sm text-theme-primary">{description}</p>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-theme bg-theme-bg px-3 py-2">
                  <p className="text-[11px] text-theme-secondary">{t('detail.path')}</p>
                  <p
                    className={`${ANALYTICS_MASK_TEXT_CLASS} truncate font-mono text-xs text-theme-primary`}
                    title={item.path}
                  >
                    {item.path}
                  </p>
                </div>
                <div className="rounded-lg border border-theme bg-theme-bg px-3 py-2">
                  <p className="text-[11px] text-theme-secondary">{t('detail.updated')}</p>
                  <p className="text-xs text-theme-primary">{updatedAt}</p>
                </div>
                <div className="rounded-lg border border-theme bg-theme-bg px-3 py-2 sm:col-span-2">
                  <p className="text-[11px] text-theme-secondary">{t('list.tags')}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(item.tags ?? []).length > 0 ? (
                      (item.tags ?? []).map((tag) => (
                        <span
                          key={`preview-tag-${item.id}-${tag}`}
                          className="rounded-full border border-theme px-2 py-0.5 text-[11px] text-theme-secondary"
                        >
                          #{tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-theme-secondary">{t('detail.none')}</span>
                    )}
                  </div>
                </div>
              </div>

              <section className="mt-4 rounded-xl border border-theme bg-theme-bg p-3">
                <div className="sticky top-0 z-10 -mx-3 -mt-3 mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-theme bg-theme-bg px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-theme-secondary">
                    {t('detail.preview')}
                  </p>
                  <div
                    role="group"
                    aria-label={t('documentViewer.viewModeAria')}
                    className="flex items-center gap-1"
                  >
                    <button
                      type="button"
                      onClick={() => setContentViewMode('rendered')}
                      aria-pressed={contentViewMode === 'rendered'}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                        contentViewMode === 'rendered' ? 'btn-theme-primary-soft' : 'btn-theme-surface'
                      }`}
                    >
                      {t('documentViewer.viewPreview')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setContentViewMode('source')}
                      aria-pressed={contentViewMode === 'source'}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                        contentViewMode === 'source' ? 'btn-theme-primary-soft' : 'btn-theme-surface'
                      }`}
                    >
                      {t('documentViewer.viewSource')}
                    </button>
                  </div>
                </div>

                {isLoading ? (
                  <p className="text-sm text-theme-secondary">{t('common:loading')}</p>
                ) : errorMessage ? (
                  <div className="rounded-lg border border-theme p-3">
                    <p className="text-sm text-theme-danger">{t('detail.loadError')}</p>
                    <p className="mt-1 text-xs text-theme-secondary break-all">{errorMessage}</p>
                    <button
                      type="button"
                      onClick={onRetry}
                      className="mt-2 rounded-lg border border-theme px-3 py-1 text-xs font-semibold btn-theme-surface"
                    >
                      {t('common:retry')}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <details className="rounded-lg border border-theme bg-theme-surface">
                      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-theme-secondary">
                        {t('detail.frontmatter')}
                      </summary>
                      <pre
                        className={`${ANALYTICS_NO_CAPTURE_CLASS} overflow-x-auto border-t border-theme px-3 py-2 text-xs text-theme-primary`}
                      >
                        {frontmatterPreview ?? t('detail.none')}
                      </pre>
                    </details>
                    <div>
                      <p className="text-xs font-semibold text-theme-secondary">{t('detail.previewContent')}</p>
                      {contentViewMode === 'source' ? (
                        <pre
                          className={`${ANALYTICS_NO_CAPTURE_CLASS} mt-1 overflow-x-auto rounded-lg border border-theme bg-theme-surface p-2 text-xs text-theme-primary whitespace-pre`}
                        >
                          {contentPreview || t('detail.noContent')}
                        </pre>
                      ) : (
                        <div
                          className={`${ANALYTICS_NO_CAPTURE_CLASS} mt-1 rounded-lg border border-theme bg-theme-surface p-3`}
                        >
                          {contentPreview ? (
                            <div className="prose max-w-none prose-pre:overflow-x-auto prose-pre:bg-theme-elevated prose-pre:border prose-pre:border-theme prose-code:bg-theme-bg prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-p:text-theme-secondary prose-li:text-theme-secondary prose-a:text-primary prose-blockquote:border-theme prose-blockquote:bg-theme-bg prose-blockquote:py-0.5 prose-img:rounded-lg">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {contentPreview}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <p className="text-xs text-theme-secondary">{t('detail.noContent')}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        </FocusLock>
      </div>
    </ModalPortal>
  );
}
