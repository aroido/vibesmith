/**
 * CopyToProjectModal
 * 다른 프로젝트로 복사 모달 (component-copy-api.md §5.3)
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import FocusLock from 'react-focus-lock';
import { useQuery } from '@tanstack/react-query';
import { getProjects } from '../services/api';
import { ApiError } from '@/common/api';
import { ModalPortal } from '@/components/common';
import { useCopyComponent } from '../hooks/useCopyComponent';
import type { CopyResponse } from '../types';

interface CopyToProjectModalProps {
  isOpen: boolean;
  componentId: string;
  componentName: string;
  sourceProjectId: string;
  onClose: () => void;
  onSuccess?: (response: CopyResponse) => void;
}

export function CopyToProjectModal({
  isOpen,
  componentId,
  componentName,
  sourceProjectId,
  onClose,
  onSuccess,
}: CopyToProjectModalProps) {
  const { t } = useTranslation(['components', 'common']);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [includeDependencies, setIncludeDependencies] = useState(false);

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
    enabled: isOpen,
  });

  const copyMutation = useCopyComponent(componentId, {
    onSuccess: (res) => {
      onSuccess?.(res);
      onClose();
    },
  });

  const availableProjects = projects.filter((p) => p.id !== sourceProjectId);
  const err = copyMutation.error;
  const error =
    err instanceof Error
      ? (err as ApiError).detail ?? err.message
      : null;

  useEffect(() => {
    if (!isOpen) {
      setSelectedProjectId(null);
      setIncludeDependencies(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  const handleCopy = () => {
    if (!selectedProjectId) return;
    copyMutation.mutate({
      targetProjectId: selectedProjectId,
      includeDependencies,
    });
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="copy-modal-title"
        aria-describedby="copy-modal-desc"
        className="fixed inset-0 z-[2147483100] flex items-center justify-center bg-black/60"
      >
        <FocusLock autoFocus returnFocus>
          <div
            className="w-full max-w-md rounded-xl bg-theme-surface border border-theme p-6 shadow-xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="copy-modal-title"
              className="text-lg font-semibold text-theme-primary mb-4"
            >
              {t('components:copy.title')}
            </h2>

            <p id="copy-modal-desc" className="text-sm text-theme-secondary mb-4">
              {t('components:copy.prompt', { name: componentName })}
            </p>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="copy-project-select"
                  className="block text-sm font-medium text-theme-secondary mb-1"
                >
                  {t('components:copy.targetProject')}
                </label>
                <select
                  id="copy-project-select"
                  value={selectedProjectId ?? ''}
                  onChange={(e) =>
                    setSelectedProjectId(e.target.value || null)
                  }
                  disabled={projectsLoading}
                  aria-label={t('components:copy.targetProjectAria')}
                  className="w-full px-4 py-2 rounded-lg input-theme disabled:opacity-50"
                >
                  <option value="">
                    {projectsLoading ? t('common:loading') : t('components:copy.selectProject')}
                  </option>
                  {availableProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.is_global ? t('components:copy.globalSuffix') : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="include-deps"
                  type="checkbox"
                  checked={includeDependencies}
                  onChange={(e) => setIncludeDependencies(e.target.checked)}
                  aria-label={t('components:copy.includeDependencies')}
                  className="rounded border-theme bg-theme-surface"
                />
                <label htmlFor="include-deps" className="text-sm text-theme-secondary">
                  {t('components:copy.includeDependencies')}
                </label>
              </div>
            </div>

            {availableProjects.length === 0 && !projectsLoading && (
              <p className="mt-3 text-sm text-theme-warning" role="alert">
                {t('components:copy.noProjects')}
              </p>
            )}

            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="mt-3 rounded-lg alert-theme-danger p-3 text-sm"
              >
                {error}
              </div>
            )}

            <div className="mt-6 flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg btn-theme-surface"
              >
                {t('common:cancel')}
              </button>
              <button
                type="button"
                onClick={handleCopy}
                disabled={
                  !selectedProjectId ||
                  copyMutation.isPending ||
                  availableProjects.length === 0
                }
                className="px-4 py-2 rounded-lg btn-theme-primary-soft disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {copyMutation.isPending ? t('components:copy.copying') : t('components:copy.copyButton')}
              </button>
            </div>
          </div>
        </FocusLock>
      </div>
    </ModalPortal>
  );
}
