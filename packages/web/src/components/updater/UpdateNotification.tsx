/**
 * UpdateNotification Component
 * 
 * Auto-updater 상태에 따라 자동으로 토스트 알림을 표시합니다:
 * - 새 버전 사용 가능
 * - 다운로드 진행률
 * - 다운로드 완료 (재시작 버튼)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useElectronUpdater } from '@/hooks/useElectronUpdater';
import { Progress } from '@/components/ui/progress';
import { requestOpenReleaseNotes } from './releaseNotesBridge';

const UPDATE_AVAILABLE_TOAST_ID = 'update-available';
const DOWNLOAD_PROGRESS_TOAST_ID = 'download-progress';
const UPDATE_DOWNLOADED_TOAST_ID = 'update-downloaded';
const UPDATE_INSTALLING_TOAST_ID = 'update-installing';
const INSTALL_HINT_DELAY_MS = 20_000;

export function UpdateNotification() {
  const { t } = useTranslation('common');
  const {
    isElectronEnv,
    status,
    updateInfo,
    downloadProgress,
    pendingInstallVersion,
    installingSince,
    justUpdatedVersion,
    error,
    downloadUpdate,
    quitAndInstall,
    acknowledgeUpdateCompletion,
  } = useElectronUpdater();
  const lastAvailableVersionRef = useRef<string | null>(null);
  const lastDownloadedVersionRef = useRef<string | null>(null);
  const lastErrorRef = useRef<string | null>(null);
  const [showInstallDelayHint, setShowInstallDelayHint] = useState(false);

  const openReleaseNotes = useCallback(() => {
    const version = updateInfo?.version;
    requestOpenReleaseNotes(version);

    if (typeof window !== 'undefined') {
      const currentHashPath = window.location.hash.replace(/^#/, '');
      if (!currentHashPath.startsWith('/settings')) {
        window.location.hash = '/settings';
      }
    }

    toast.dismiss(UPDATE_AVAILABLE_TOAST_ID);
  }, [updateInfo?.version]);

  useEffect(() => {
    if (!isElectronEnv || status !== 'installing' || !installingSince) {
      setShowInstallDelayHint(false);
      return;
    }

    const elapsedMs = Date.now() - installingSince;
    if (elapsedMs >= INSTALL_HINT_DELAY_MS) {
      setShowInstallDelayHint(true);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowInstallDelayHint(true);
    }, INSTALL_HINT_DELAY_MS - elapsedMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isElectronEnv, status, installingSince]);

  // 새 버전 사용 가능 알림
  useEffect(() => {
    if (!isElectronEnv || status !== 'available' || !updateInfo) {
      return;
    }
    if (lastAvailableVersionRef.current === updateInfo.version) {
      return;
    }

    lastAvailableVersionRef.current = updateInfo.version;
    toast.info(t('updates.available'), {
      id: UPDATE_AVAILABLE_TOAST_ID,
      description: t('updates.updateAvailableMessage', { version: updateInfo.version }),
      duration: Infinity, // 사용자가 닫을 때까지 유지
      action: {
        label: t('updates.downloadNow'),
        onClick: () => {
          void downloadUpdate();
        },
      },
      cancel: {
        label: t('updates.releaseNotes'),
        onClick: () => {
          openReleaseNotes();
        },
      },
    });
  }, [isElectronEnv, status, updateInfo, downloadUpdate, openReleaseNotes, t]);

  // 다운로드 진행률 표시
  useEffect(() => {
    if (!isElectronEnv) {
      return;
    }
    if (status === 'downloading' && downloadProgress) {
      const percent = Math.round(downloadProgress.percent);
      const speedMBps = (downloadProgress.bytesPerSecond / 1024 / 1024).toFixed(2);

      toast.loading(t('updates.downloading'), {
        id: DOWNLOAD_PROGRESS_TOAST_ID,
        description: (
          <div className="space-y-2 mt-2">
            <Progress value={percent} className="w-full" />
            <div className="flex justify-between text-xs text-theme-secondary">
              <span>{percent}%</span>
              <span>{speedMBps} MB/s</span>
            </div>
          </div>
        ),
        duration: Infinity,
      });
      return;
    }

    // 다운로드 완료/중단 시 progress toast 제거
    toast.dismiss(DOWNLOAD_PROGRESS_TOAST_ID);
  }, [isElectronEnv, status, downloadProgress, t]);

  // 다운로드 완료 알림
  useEffect(() => {
    if (!isElectronEnv || status !== 'downloaded' || !updateInfo) {
      return;
    }
    if (lastDownloadedVersionRef.current === updateInfo.version) {
      return;
    }

    lastDownloadedVersionRef.current = updateInfo.version;
    toast.success(t('updates.downloaded'), {
      id: UPDATE_DOWNLOADED_TOAST_ID,
      description: t('updates.updateDownloadedMessage'),
      duration: Infinity,
      action: {
        label: t('updates.restartNow'),
        onClick: () => {
          void quitAndInstall();
        },
      },
      cancel: {
        label: t('updates.restartLater'),
        onClick: () => {
          toast.dismiss(UPDATE_DOWNLOADED_TOAST_ID);
        },
      },
    });
  }, [isElectronEnv, status, updateInfo, quitAndInstall, t]);

  // 설치 진행 안내
  useEffect(() => {
    if (!isElectronEnv || status !== 'installing') {
      toast.dismiss(UPDATE_INSTALLING_TOAST_ID);
      return;
    }

    const targetVersion = pendingInstallVersion ?? updateInfo?.version ?? '';
    const delayedHint = showInstallDelayHint ? (
      <p className="mt-1 text-xs text-theme-secondary">{t('updates.installDelayHint')}</p>
    ) : null;

    toast.loading(t('updates.installing'), {
      id: UPDATE_INSTALLING_TOAST_ID,
      description: (
        <div className="space-y-1">
          <p>
            {t('updates.installingMessage', {
              version: targetVersion,
            })}
          </p>
          {delayedHint}
        </div>
      ),
      duration: Infinity,
    });

    toast.dismiss(UPDATE_DOWNLOADED_TOAST_ID);
  }, [isElectronEnv, status, pendingInstallVersion, updateInfo, showInstallDelayHint, t]);

  // 재실행 후 설치 완료 알림 (1회)
  useEffect(() => {
    if (!isElectronEnv || !justUpdatedVersion) {
      return;
    }

    toast.dismiss(UPDATE_INSTALLING_TOAST_ID);
    toast.success(t('updates.updatedAfterRestart', { version: justUpdatedVersion }), {
      description: t('updates.updateCompletedMessage'),
      duration: 6000,
    });
    acknowledgeUpdateCompletion();
  }, [isElectronEnv, justUpdatedVersion, acknowledgeUpdateCompletion, t]);

  // 업데이트 확인 에러
  useEffect(() => {
    if (!isElectronEnv || status !== 'error') {
      return;
    }

    const message = error || t('errors.unknown.message');
    if (lastErrorRef.current === message) {
      return;
    }
    lastErrorRef.current = message;

    toast.error(t('updates.error'), {
      description: message,
      duration: 5000,
    });
  }, [isElectronEnv, status, error, t]);

  // 오류/업데이트 상태가 해소되면 중복 방지 ref 초기화
  useEffect(() => {
    if (status !== 'error') {
      lastErrorRef.current = null;
    }
    if (status !== 'available') {
      lastAvailableVersionRef.current = null;
    }
    if (status !== 'downloaded') {
      lastDownloadedVersionRef.current = null;
    }
  }, [status]);

  // 이 컴포넌트는 side-effect만 수행하고 UI를 렌더링하지 않음
  return null;
}
