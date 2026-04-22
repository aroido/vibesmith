import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  createProjectWithPreset,
  getCollections,
  type ConflictPolicy,
  type CreateProjectWithPresetResponse,
} from '@/common/api';
import { trackFirstValueOnce } from '@/common/analytics/activation';
import { getConfig } from '@/services/configApi';
import { trackProjectCreated } from '@/common/analytics/desktopAnalyticsBridge';
import { showErrorToast, showSuccessToast } from '@/common/utils';

interface CreateProjectPresetFormProps {
  onSuccess?: (result: CreateProjectWithPresetResponse) => void;
}

const COLLECTIONS_QUERY_KEY = ['collections', 'list'] as const;

function isValidPath(path: string): boolean {
  const trimmed = path.trim();
  if (!trimmed) return false;
  return trimmed.startsWith('/') || trimmed.startsWith('~/');
}

export function CreateProjectPresetForm({ onSuccess }: CreateProjectPresetFormProps) {
  const { t } = useTranslation('scan');
  const queryClient = useQueryClient();
  const [projectPath, setProjectPath] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [conflictPolicy, setConflictPolicy] = useState<ConflictPolicy>('fail');
  const [error, setError] = useState<string | null>(null);

  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: getConfig,
    staleTime: 5 * 60 * 1000,
  });

  const rootPath = useMemo(() => {
    const paths = config?.root_paths ?? [];
    if (paths.length > 0) {
      const p = paths[0];
      return p.endsWith('/') ? p : `${p}/`;
    }
    return '';
  }, [config]);

  useEffect(() => {
    if (rootPath && !projectPath) {
      setProjectPath(rootPath);
    }
  }, [rootPath, projectPath]);

  const {
    data: collectionsData,
    isLoading: isCollectionsLoading,
    isError: isCollectionsError,
    error: collectionsError,
    refetch: refetchCollections,
  } = useQuery({
    queryKey: [...COLLECTIONS_QUERY_KEY, 'all'],
    queryFn: () => getCollections({ scope: 'all', limit: 50, offset: 0 }),
    staleTime: 60 * 1000,
  });

  const collections = useMemo(() => collectionsData?.items ?? [], [collectionsData]);

  useEffect(() => {
    if (collections.length === 0) {
      setSelectedCollectionId('');
      return;
    }

    const hasCurrent = collections.some((c) => c.id === selectedCollectionId);
    if (!selectedCollectionId || !hasCurrent) {
      setSelectedCollectionId(collections[0].id);
    }
  }, [collections, selectedCollectionId]);

  const { mutate, isPending } = useMutation({
    mutationFn: createProjectWithPreset,
    onSuccess: (result) => {
      setProjectPath(rootPath);
      setError(null);

      showSuccessToast(
        t('toastProjectPresetCreateSuccess', {
          project: result.project.name,
          preset: result.applied_preset.name,
          components: result.created_components,
        })
      );

      trackProjectCreated({
        source: 'projects_preset_create',
        preset_id: result.applied_preset.id,
        created_components: result.created_components,
      });
      trackFirstValueOnce('project_created', {
        project_create_source: 'projects_preset_create',
        created_components: result.created_components,
      });

      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['components'] });

      onSuccess?.(result);
    },
    onError: (mutationError: Error) => {
      showErrorToast(
        t('toastProjectPresetCreateError', {
          message: mutationError.message,
        })
      );
    },
  });

  const handlePathChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setProjectPath(event.target.value);
    setError(null);
  }, []);

  const handleCollectionChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextId = event.target.value;
    setSelectedCollectionId(nextId);
    setError(null);
  }, [collections]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmed = projectPath.trim();
    if (!trimmed) {
      setError(t('pathRequired'));
      return;
    }

    if (!isValidPath(trimmed)) {
      setError(t('pathAbsoluteRequired'));
      return;
    }

    if (!selectedCollectionId) {
      setError(t('projectPresetRequired'));
      return;
    }

    mutate({
      path: trimmed,
      preset_id: selectedCollectionId,
      conflict_policy: conflictPolicy,
      scan_after_create: true,
    });
  };

  const isSubmitDisabled = isPending || isCollectionsLoading || collections.length === 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="project-preset-create-form">
      <div>
        <label
          htmlFor="create-project-path"
          className="block text-sm font-medium text-theme-secondary mb-2"
        >
          {t('projectCreatePathLabel')}
        </label>
        <input
          id="create-project-path"
          type="text"
          value={projectPath}
          onChange={handlePathChange}
          disabled={isPending}
          placeholder={t('projectCreatePathPlaceholder')}
          aria-describedby={error ? 'create-project-preset-error' : undefined}
          aria-invalid={Boolean(error)}
          className="w-full px-4 py-2 rounded-lg input-theme disabled:opacity-50"
        />
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <label
            htmlFor="create-project-preset"
            className="block text-sm font-medium text-theme-secondary"
          >
            {t('projectBundleLabel')}
          </label>
          <div className="flex items-center gap-2">
            <Link
              to="/components/presets"
              className="rounded-lg border border-theme px-3 py-2 text-xs font-semibold text-theme-primary hover:bg-theme-hover"
            >
              {t('projectPresetManageAction')}
            </Link>
          </div>
        </div>
        <select
          id="create-project-preset"
          value={selectedCollectionId}
          onChange={handleCollectionChange}
          disabled={isSubmitDisabled}
          className="w-full rounded-lg border border-theme bg-theme-surface px-4 py-2 text-sm text-theme-primary disabled:opacity-50"
          data-testid="project-preset-select"
        >
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.items_count})
            </option>
          ))}
        </select>

        {collections.length > 0 && (
          <p className="mt-2 text-xs text-theme-secondary">
            {collections.find((c) => c.id === selectedCollectionId)?.description}
          </p>
        )}

        {collections.length > 0 && (
          <div className="mt-3">
            <label className="text-xs text-theme-secondary">
              {t('projectPresetConflictPolicyLabel')}
              <select
                value={conflictPolicy}
                onChange={(event) =>
                  setConflictPolicy(event.target.value as ConflictPolicy)
                }
                className="mt-1 w-full rounded-lg border border-theme bg-theme-surface px-3 py-2 text-sm text-theme-primary"
              >
                <option value="fail">fail</option>
                <option value="skip">skip</option>
                <option value="rename">rename</option>
                <option value="overwrite">overwrite</option>
              </select>
            </label>
          </div>
        )}

        {!isCollectionsLoading && collections.length === 0 && (
          <p className="mt-2 text-xs text-theme-secondary">
            {t('projectBundleEmpty')}
          </p>
        )}

        {isCollectionsError && (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-theme bg-theme-surface p-3"
          >
            <p className="text-sm text-theme-danger">
              {t('projectPresetLoadFailed', {
                message:
                  collectionsError instanceof Error
                    ? collectionsError.message
                    : t('projectPresetLoadUnknownError'),
              })}
            </p>
            <button
              type="button"
              onClick={() => void refetchCollections()}
              className="mt-2 text-sm font-semibold text-theme-primary underline underline-offset-2"
              data-testid="project-preset-retry-button"
            >
              {t('projectPresetRetry')}
            </button>
          </div>
        )}
      </div>

      {error && (
        <p id="create-project-preset-error" role="alert" className="text-sm text-theme-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitDisabled}
        aria-busy={isPending}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg btn-theme-primary-soft font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid="project-preset-create-submit"
      >
        {isPending ? (
          <>
            <RotateCw className="h-4 w-4 animate-spin" aria-hidden />
            <span>{t('creatingProject')}</span>
          </>
        ) : (
          <span>{t('createProjectWithPreset')}</span>
        )}
      </button>
    </form>
  );
}
