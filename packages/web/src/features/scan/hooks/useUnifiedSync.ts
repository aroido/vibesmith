import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getComponents,
  getProjects,
  type ComponentListItemResponse,
  type ProjectResponse,
} from '@/common/api';
import { trackFirstValueOnce } from '@/common/analytics/activation';
import {
  trackProjectSyncCompleted,
  trackProjectSyncFailed,
  type ProjectSyncMode,
} from '@/common/analytics/desktopAnalyticsBridge';
import { showErrorToast, showSuccessToast } from '@/common/utils';
import { scan } from '../services/api';
import { useScanProgress } from './useScanProgress';
import type { ScanResponse } from '../types';

const RESCAN_STALE_THRESHOLD_MS = 15 * 60 * 1000;

type SyncPhase = 'idle' | 'refreshing' | 'rescanning' | 'failed';

interface UseUnifiedSyncOptions {
  onSuccess?: (result: ScanResponse) => void;
  source?: string;
}

interface UseUnifiedSyncResult {
  phase: SyncPhase;
  isPending: boolean;
  statusMessage: string | null;
  canForceRescan: boolean;
  sync: () => Promise<void>;
  forceRescan: () => Promise<void>;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function getSummarySource(
  projectsResolved: boolean,
  componentsResolved: boolean
): 'live_fetch' | 'partial_cache_fallback' | 'cache_fallback' {
  if (projectsResolved && componentsResolved) {
    return 'live_fetch';
  }

  if (projectsResolved || componentsResolved) {
    return 'partial_cache_fallback';
  }

  return 'cache_fallback';
}

function getLatestScannedAt(projects: ProjectResponse[]): number | null {
  const values = projects
    .map((project) => {
      if (!project.last_scanned_at) return Number.NaN;
      return Date.parse(project.last_scanned_at);
    })
    .filter((value) => Number.isFinite(value));

  if (values.length === 0) return null;
  return Math.max(...values);
}

function getAutoRescanReason(
  projects: ProjectResponse[],
  components: ComponentListItemResponse[]
): 'component_count_mismatch' | 'stale_scan' | null {
  const projectComponentTotal = projects.reduce(
    (sum, project) => sum + project.component_count,
    0
  );
  const hasCountMismatch = projectComponentTotal !== components.length;

  const latestScannedAt = getLatestScannedAt(projects);
  const isStale =
    latestScannedAt === null
      ? projects.length > 0
      : Date.now() - latestScannedAt > RESCAN_STALE_THRESHOLD_MS;

  if (hasCountMismatch) {
    return 'component_count_mismatch';
  }

  if (isStale) {
    return 'stale_scan';
  }

  return null;
}

export function useUnifiedSync(
  options?: UseUnifiedSyncOptions
): UseUnifiedSyncResult {
  const { t } = useTranslation('scan');
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<SyncPhase>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [canForceRescan, setCanForceRescan] = useState(false);
  const wasScanning = useRef(false);
  const pendingRescanRef = useRef<{
    mode: Exclude<ProjectSyncMode, 'quick_refresh'>;
    startedAt: number;
    source: string;
    rescanReason: 'component_count_mismatch' | 'stale_scan' | 'manual_force' | null;
  } | null>(null);
  const { isScanning } = useScanProgress();
  const analyticsSource = options?.source ?? 'scan_button';

  // 스캔 완료 감지: phase 업데이트 (쿼리 갱신은 useScanProgress에서 자동 처리)
  useEffect(() => {
    if (wasScanning.current && !isScanning) {
      if (phase === 'rescanning') {
        const pendingRescan = pendingRescanRef.current;
        setPhase('idle');
        setStatusMessage(t('syncStatusRescanComplete'));
        showSuccessToast(t('toastComplete', { defaultValue: 'Scan complete' }));
        setCanForceRescan(false);

        if (pendingRescan) {
          void Promise.allSettled([getProjects(), getComponents()])
            .then(([projectsResult, componentsResult]) => {
              const cachedProjects =
                queryClient.getQueryData<ProjectResponse[]>(['projects']) ?? null;
              const cachedComponents =
                queryClient.getQueryData<ComponentListItemResponse[]>(['components']) ??
                null;
              const projects =
                projectsResult.status === 'fulfilled'
                  ? projectsResult.value
                  : cachedProjects;
              const components =
                componentsResult.status === 'fulfilled'
                  ? componentsResult.value
                  : cachedComponents;

              trackProjectSyncCompleted({
                sync_mode: pendingRescan.mode,
                source: pendingRescan.source,
                duration_ms: Date.now() - pendingRescan.startedAt,
                project_count: projects?.length ?? null,
                component_count: components?.length ?? null,
                rescan_reason: pendingRescan.rescanReason,
                summary_source: getSummarySource(
                  projectsResult.status === 'fulfilled',
                  componentsResult.status === 'fulfilled'
                ),
              });
              trackFirstValueOnce('project_sync_completed', {
                sync_mode: pendingRescan.mode,
                sync_source: pendingRescan.source,
              });
            })
            .finally(() => {
              pendingRescanRef.current = null;
            });
        }
      }
    }
    wasScanning.current = isScanning;
  }, [isScanning, phase, queryClient, t]);

  const runRescan = useCallback(
    async (
      reason: 'auto' | 'force',
      rescanReason: 'component_count_mismatch' | 'stale_scan' | 'manual_force' | null
    ) => {
      setPhase('rescanning');
      setStatusMessage(t('syncStatusRescanRunning'));
      pendingRescanRef.current = {
        mode: reason === 'force' ? 'force_rescan' : 'auto_rescan',
        startedAt: Date.now(),
        source: analyticsSource,
        rescanReason,
      };

      try {
        const result = await scan({});
        options?.onSuccess?.(result);

        if (result.status === 'already_running') {
          showSuccessToast(
            t('toastAlreadyRunning', { defaultValue: 'Scan is already running' })
          );
          return;
        }

        // scan-progress 폴링 강제 갱신
        void queryClient.invalidateQueries({ queryKey: ['scan-progress'] });

        const startMessage =
          reason === 'force'
            ? t('toastForceRescanStarted', { defaultValue: 'Force rescan started' })
            : t('toastStarted', { defaultValue: 'Scan started' });
        showSuccessToast(startMessage);
        // 완료 감지는 위의 useEffect에서 처리
      } catch (error) {
        pendingRescanRef.current = null;
        trackProjectSyncFailed({
          sync_mode: reason === 'force' ? 'force_rescan' : 'auto_rescan',
          source: analyticsSource,
          failure_stage: 'scan_start',
          error_message: toErrorMessage(error),
          rescan_reason: rescanReason,
        });
        throw error;
      }
    },
    [analyticsSource, options, queryClient, t]
  );

  const sync = useCallback(async () => {
    if (phase === 'refreshing' || phase === 'rescanning') return;

    setCanForceRescan(false);
    setPhase('refreshing');
    setStatusMessage(t('syncStatusRefreshing'));
    const startedAt = Date.now();

    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['components'] }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);

      const [projects, components] = await Promise.all([
        getProjects(),
        getComponents(),
      ]);

      const autoRescanReason = getAutoRescanReason(projects, components);

      if (autoRescanReason) {
        showSuccessToast(t('syncStatusRescanRunning'));
        try {
          await runRescan('auto', autoRescanReason);
        } catch (error) {
          const message = toErrorMessage(error);
          setPhase('failed');
          setCanForceRescan(true);
          setStatusMessage(t('syncStatusError'));
          showErrorToast(t('syncStatusErrorToast', { message }));
        }
        return;
      }

      options?.onSuccess?.({
        status: 'started',
        scanned_projects: 0,
        total_components: components.length,
        message: '',
      });
      setPhase('idle');
      setStatusMessage(t('syncStatusQuickComplete'));
      showSuccessToast(t('syncStatusQuickComplete'));
      trackProjectSyncCompleted({
        sync_mode: 'quick_refresh',
        source: analyticsSource,
        duration_ms: Date.now() - startedAt,
        project_count: projects.length,
        component_count: components.length,
        rescan_reason: null,
        summary_source: 'live_fetch',
      });
      trackFirstValueOnce('project_sync_completed', {
        sync_mode: 'quick_refresh',
        sync_source: analyticsSource,
      });
    } catch (error) {
      const message = toErrorMessage(error);
      setPhase('failed');
      setCanForceRescan(true);
      setStatusMessage(t('syncStatusError'));
      showErrorToast(t('syncStatusErrorToast', { message }));
      trackProjectSyncFailed({
        sync_mode: 'quick_refresh',
        source: analyticsSource,
        failure_stage: 'refresh',
        error_message: message,
      });
    }
  }, [analyticsSource, options, phase, queryClient, runRescan, t]);

  const forceRescan = useCallback(async () => {
    if (phase === 'refreshing' || phase === 'rescanning') return;

    try {
      await runRescan('force', 'manual_force');
    } catch (error) {
      const message = toErrorMessage(error);
      setPhase('failed');
      setCanForceRescan(true);
      setStatusMessage(t('syncStatusError'));
      showErrorToast(t('syncStatusErrorToast', { message }));
    }
  }, [phase, runRescan, t]);

  const isPending = useMemo(
    () => phase === 'refreshing' || phase === 'rescanning',
    [phase]
  );

  return {
    phase,
    isPending,
    statusMessage,
    canForceRescan,
    sync,
    forceRescan,
  };
}
