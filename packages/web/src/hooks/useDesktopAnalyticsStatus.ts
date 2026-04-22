import { useCallback, useEffect, useState } from 'react';
import {
  getAnalyticsBridgeStatus,
  refreshAnalyticsBridgeStatus,
  runAnalyticsSelfTest,
  type AnalyticsBridgeStatus,
  type AnalyticsSelfTestResult,
} from '@/common/analytics/desktopAnalyticsBridge';

const DEFAULT_POLL_INTERVAL_MS = 3_000;

export function useDesktopAnalyticsStatus(
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS
) {
  const [status, setStatus] = useState<AnalyticsBridgeStatus | null>(null);

  const refreshStatus = useCallback(() => {
    const nextStatus =
      refreshAnalyticsBridgeStatus() ?? getAnalyticsBridgeStatus() ?? null;
    setStatus(nextStatus);
    return nextStatus;
  }, []);

  const triggerSelfTest = useCallback(
    async (type: 'event' | 'exception'): Promise<AnalyticsSelfTestResult> => {
      const result = await runAnalyticsSelfTest(type);
      refreshStatus();
      return result;
    },
    [refreshStatus]
  );

  useEffect(() => {
    refreshStatus();

    if (typeof window === 'undefined' || !window.__vibesmithAnalytics) {
      return;
    }

    const intervalId = window.setInterval(() => {
      refreshStatus();
    }, pollIntervalMs);

    const handleFocus = () => {
      refreshStatus();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [pollIntervalMs, refreshStatus]);

  return {
    status,
    refreshStatus,
    runSelfTest: triggerSelfTest,
    isAvailable:
      typeof window !== 'undefined' && Boolean(window.__vibesmithAnalytics),
  };
}
