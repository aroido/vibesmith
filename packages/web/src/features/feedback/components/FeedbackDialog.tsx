import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ANALYTICS_NO_CAPTURE_CLASS } from '@/common/analytics/privacy';
import { showSuccessToast } from '@/common/utils';
import { ApiError } from '@/common/api/errors';
import type {
  FeedbackCategory,
  FeedbackRequest,
  FeedbackResponse,
  FeedbackSystemInfo,
} from '../types';

interface FeedbackDialogProps {
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: FeedbackRequest) => Promise<FeedbackResponse>;
}

const CATEGORY_OPTIONS: FeedbackCategory[] = ['bug', 'feature', 'question'];
const DEFAULT_GITHUB_FEEDBACK_REPOSITORY = 'aroido/vibesmith';

function detectRuntime(): string {
  if (typeof window === 'undefined') return 'unknown';
  return window.location.protocol === 'file:' ? 'desktop' : 'web';
}

async function collectSystemInfo(): Promise<FeedbackSystemInfo> {
  const info: FeedbackSystemInfo = {
    runtime: detectRuntime(),
  };

  if (typeof navigator !== 'undefined') {
    info.os = navigator.platform || 'unknown';
    info.language = navigator.language || 'unknown';
    info.user_agent = navigator.userAgent || 'unknown';
  }

  if (typeof Intl !== 'undefined') {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    info.timezone = timezone || 'unknown';
  }

  if (typeof window !== 'undefined' && typeof window.api?.getAppVersion === 'function') {
    try {
      const version = await window.api.getAppVersion();
      if (version) info.app_version = version;
    } catch {
      // ignore app version lookup failure
    }
  }

  return info;
}

function formatFeedbackDescription(payload: FeedbackRequest): string {
  let body = `## Feedback Type\n${payload.category}\n\n`;
  body += `## Description\n${payload.description}\n\n`;

  if (payload.system_info && Object.keys(payload.system_info).length > 0) {
    body += '## System Info\n';
    for (const [key, value] of Object.entries(payload.system_info)) {
      body += `- ${key}: ${value}\n`;
    }
    body += '\n';
  }

  if (payload.email) {
    body += `## Contact\n${payload.email}\n\n`;
  }

  if (payload.screenshot_url) {
    body += `## Screenshot\n![screenshot](${payload.screenshot_url})\n`;
  }

  return body;
}

function buildManualIssueUrl(payload: FeedbackRequest): string {
  const configuredRepository = (
    import.meta.env.VITE_GITHUB_FEEDBACK_REPOSITORY as string | undefined
  )?.trim();
  const repositoryPath = configuredRepository || DEFAULT_GITHUB_FEEDBACK_REPOSITORY;
  const params = new URLSearchParams();
  params.set('title', payload.title);
  params.set('body', formatFeedbackDescription(payload));
  params.set('labels', `user-feedback,${payload.category}`);
  return `https://github.com/${repositoryPath}/issues/new?${params.toString()}`;
}

function isFeedbackTokenMissingError(error: unknown): boolean {
  if (
    error instanceof ApiError &&
    error.messageKey === 'errors.feedback_token_not_configured'
  ) {
    return true;
  }
  if (error instanceof Error) {
    const normalizedMessage = error.message.toLowerCase();
    return (
      normalizedMessage.includes('feedback token') ||
      normalizedMessage.includes('github token')
    );
  }
  return false;
}

export function FeedbackDialog({
  isOpen,
  isSubmitting,
  onClose,
  onSubmit,
}: FeedbackDialogProps) {
  const { t } = useTranslation('feedback');

  const [category, setCategory] = useState<FeedbackCategory>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [systemInfo, setSystemInfo] = useState<FeedbackSystemInfo>({});
  const [isCollectingSystemInfo, setIsCollectingSystemInfo] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedIssue, setSubmittedIssue] = useState<FeedbackResponse | null>(null);
  const [autoTemplate, setAutoTemplate] = useState('');
  const [manualIssueUrl, setManualIssueUrl] = useState<string | null>(null);

  const systemInfoText = useMemo(() => {
    const entries = Object.entries(systemInfo);
    if (entries.length === 0) return '';
    return entries.map(([key, value]) => `${key}: ${value}`).join('\n');
  }, [systemInfo]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const initialTemplate = t('templates.bug');
    setCategory('bug');
    setTitle('');
    setDescription(initialTemplate);
    setEmail('');
    setScreenshotUrl('');
    setSystemInfo({});
    setSubmitError(null);
    setSubmittedIssue(null);
    setAutoTemplate(initialTemplate);
    setManualIssueUrl(null);

    setIsCollectingSystemInfo(true);
    void collectSystemInfo()
      .then((info) => {
        if (cancelled) return;
        setSystemInfo(info);
        setIsCollectingSystemInfo(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSystemInfo({});
        setIsCollectingSystemInfo(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, t]);

  const handleCategoryChange = (nextCategory: FeedbackCategory) => {
    const nextTemplate = t(`templates.${nextCategory}`);
    setCategory(nextCategory);
    setDescription((prev) => {
      if (!prev.trim() || prev === autoTemplate) {
        return nextTemplate;
      }
      return prev;
    });
    setAutoTemplate(nextTemplate);
  };

  const handleApplyTemplate = () => {
    const nextTemplate = t(`templates.${category}`);
    setDescription(nextTemplate);
    setAutoTemplate(nextTemplate);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const trimmedEmail = email.trim();
    const trimmedScreenshotUrl = screenshotUrl.trim();

    if (!trimmedTitle) {
      setSubmitError(t('errors.titleRequired'));
      return;
    }

    if (!trimmedDescription) {
      setSubmitError(t('errors.descriptionRequired'));
      return;
    }

    setSubmitError(null);
    setManualIssueUrl(null);

    const payload: FeedbackRequest = {
      title: trimmedTitle,
      description: trimmedDescription,
      category,
      system_info: systemInfo,
    };

    if (trimmedEmail) payload.email = trimmedEmail;
    if (trimmedScreenshotUrl) payload.screenshot_url = trimmedScreenshotUrl;

    try {
      const response = await onSubmit(payload);
      setSubmittedIssue(response);
      showSuccessToast(t('success.toast', { number: response.issue_number }));
    } catch (error) {
      if (isFeedbackTokenMissingError(error)) {
        setManualIssueUrl(buildManualIssueUrl(payload));
        setSubmitError(t('errors.tokenNotConfigured'));
        return;
      }
      setSubmitError(error instanceof Error ? error.message : t('errors.submitFailed'));
    }
  };

  const handleSubmitAnother = () => {
    const nextTemplate = t(`templates.${category}`);
    setSubmittedIssue(null);
    setTitle('');
    setDescription(nextTemplate);
    setEmail('');
    setScreenshotUrl('');
    setSubmitError(null);
    setManualIssueUrl(null);
    setAutoTemplate(nextTemplate);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !isSubmitting) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-theme-surface border-theme text-theme-primary sm:max-w-2xl">
        {!submittedIssue && (
          <>
            <DialogHeader>
              <DialogTitle>{t('dialog.title')}</DialogTitle>
              <DialogDescription className="text-theme-secondary">
                {t('dialog.description')}
              </DialogDescription>
            </DialogHeader>

            <form
              className="space-y-4"
              onSubmit={(event) => {
                void handleSubmit(event);
              }}
            >
              <div>
                <label htmlFor="feedback-category" className="mb-1 block text-sm font-medium text-theme-secondary">
                  {t('fields.category')}
                </label>
                <select
                  id="feedback-category"
                  value={category}
                  onChange={(event) => handleCategoryChange(event.target.value as FeedbackCategory)}
                  disabled={isSubmitting}
                  className="w-full rounded-lg input-theme"
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {t(`category.${option}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="feedback-title" className="mb-1 block text-sm font-medium text-theme-secondary">
                  {t('fields.title')}
                </label>
                <input
                  id="feedback-title"
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={t('fields.titlePlaceholder')}
                  disabled={isSubmitting}
                  className="w-full rounded-lg input-theme"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label htmlFor="feedback-description" className="block text-sm font-medium text-theme-secondary">
                    {t('fields.description')}
                  </label>
                  <button
                    type="button"
                    onClick={handleApplyTemplate}
                    disabled={isSubmitting}
                    className="rounded-md px-2 py-1 text-xs btn-theme-surface"
                  >
                    {t('templates.apply')}
                  </button>
                </div>
                <textarea
                  id="feedback-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={t('fields.descriptionPlaceholder')}
                  disabled={isSubmitting}
                  rows={8}
                  className={`${ANALYTICS_NO_CAPTURE_CLASS} w-full rounded-lg input-theme resize-y`}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="feedback-email" className="mb-1 block text-sm font-medium text-theme-secondary">
                    {t('fields.email')}
                  </label>
                  <input
                    id="feedback-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={t('fields.emailPlaceholder')}
                    disabled={isSubmitting}
                    className="w-full rounded-lg input-theme"
                  />
                </div>

                <div>
                  <label htmlFor="feedback-screenshot" className="mb-1 block text-sm font-medium text-theme-secondary">
                    {t('fields.screenshotUrl')}
                  </label>
                  <input
                    id="feedback-screenshot"
                    type="url"
                    value={screenshotUrl}
                    onChange={(event) => setScreenshotUrl(event.target.value)}
                    placeholder={t('fields.screenshotPlaceholder')}
                    disabled={isSubmitting}
                    className="w-full rounded-lg input-theme"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-theme bg-theme-elevated p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-theme-secondary">
                  {t('systemInfo.title')}
                </p>
                {isCollectingSystemInfo ? (
                  <p className="text-xs text-theme-tertiary">{t('systemInfo.loading')}</p>
                ) : (
                  <pre
                    className={`${ANALYTICS_NO_CAPTURE_CLASS} overflow-x-auto whitespace-pre-wrap break-all text-xs text-theme-secondary`}
                  >
                    {systemInfoText || t('systemInfo.empty')}
                  </pre>
                )}
              </div>

              {submitError && (
                <div className="space-y-2" role="alert">
                  <p className="text-sm text-theme-danger">{submitError}</p>
                  {manualIssueUrl && (
                    <a
                      href={manualIssueUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                    >
                      {t('errors.openInBrowser')}
                      <ExternalLink className="h-4 w-4" aria-hidden />
                    </a>
                  )}
                </div>
              )}

              <DialogFooter className="gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="rounded-lg px-4 py-2 btn-theme-surface"
                >
                  {t('actions.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 btn-theme-primary-soft font-medium disabled:opacity-60"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  {isSubmitting ? t('actions.submitting') : t('actions.submit')}
                </button>
              </DialogFooter>
            </form>
          </>
        )}

        {submittedIssue && (
          <>
            <DialogHeader>
              <DialogTitle>{t('success.title')}</DialogTitle>
              <DialogDescription className="text-theme-secondary">
                {t('success.description', { number: submittedIssue.issue_number })}
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border border-theme bg-theme-elevated p-4">
              <a
                href={submittedIssue.issue_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                {t('success.openIssue')}
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            </div>

            <DialogFooter className="gap-2">
              <button
                type="button"
                onClick={handleSubmitAnother}
                className="rounded-lg px-4 py-2 btn-theme-surface"
              >
                {t('actions.submitAnother')}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 btn-theme-primary-soft"
              >
                {t('actions.close')}
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
