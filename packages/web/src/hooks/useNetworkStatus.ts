import { useEffect, useState, useCallback } from 'react';

/**
 * 네트워크 상태를 추적하는 Hook
 *
 * @returns {Object} 네트워크 상태 객체
 * @property {boolean} isOnline - 온라인 여부
 * @property {boolean} isOffline - 오프라인 여부
 * @property {Date | null} lastOnlineAt - 마지막 온라인 시간
 * @property {Date | null} lastOfflineAt - 마지막 오프라인 시간
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isOnline, isOffline } = useNetworkStatus();
 *
 *   if (isOffline) {
 *     return <div>오프라인 모드입니다</div>;
 *   }
 *
 *   return <div>온라인</div>;
 * }
 * ```
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() => {
    // SSR 환경에서는 기본값 true
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  });

  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(null);
  const [lastOfflineAt, setLastOfflineAt] = useState<Date | null>(null);

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    setLastOnlineAt(new Date());
  }, []);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    setLastOfflineAt(new Date());
  }, []);

  useEffect(() => {
    // 초기 상태 설정
    if (typeof window === 'undefined') return;

    // 이벤트 리스너 등록
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 정리 함수
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return {
    isOnline,
    isOffline: !isOnline,
    lastOnlineAt,
    lastOfflineAt,
  };
}
