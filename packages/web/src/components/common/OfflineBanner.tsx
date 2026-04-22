import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WifiOff, Wifi } from 'lucide-react';
import { useNetworkStatus } from '@hooks/useNetworkStatus';

/**
 * 오프라인 상태를 표시하는 배너 컴포넌트
 *
 * - 오프라인 시 상단에 배너 표시
 * - 온라인 복구 시 3초간 성공 메시지 표시 후 자동 숨김
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <>
 *       <OfflineBanner />
 *       <YourContent />
 *     </>
 *   );
 * }
 * ```
 */
export function OfflineBanner() {
  const { t } = useTranslation('common');
  const { isOnline, isOffline } = useNetworkStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    if (isOffline) {
      wasOfflineRef.current = true;
      setShowReconnected(false);
    }

    if (isOnline && wasOfflineRef.current) {
      setShowReconnected(true);
      wasOfflineRef.current = false;

      // 3초 후 재연결 메시지 숨김
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isOnline, isOffline]);

  // 오프라인 배너
  if (isOffline) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="fixed top-0 left-0 right-0 z-50 alert-theme-danger px-4 py-3 shadow-lg"
      >
        <div className="flex items-center justify-center gap-2 text-sm font-medium">
          <WifiOff className="w-4 h-4" aria-hidden="true" />
          <span>
            {t('offlineMessage')}
          </span>
        </div>
      </div>
    );
  }

  // 재연결 성공 배너
  if (showReconnected) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed top-0 left-0 right-0 z-50 alert-theme-success px-4 py-3 shadow-lg animate-slide-down"
      >
        <div className="flex items-center justify-center gap-2 text-sm font-medium">
          <Wifi className="w-4 h-4" aria-hidden="true" />
          <span>{t('reconnectedMessage')}</span>
        </div>
      </div>
    );
  }

  return null;
}
