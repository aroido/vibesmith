/**
 * useMonitoringSettings - 모니터링 설정 (crash reporting, performance, analytics) with localStorage
 */

import { useState, useEffect, useCallback } from 'react';
import * as storage from '../utils/settingsStorage';

export function useMonitoringSettings() {
  const [crashReporting, setCrashReportingState] = useState(
    storage.getCrashReporting
  );
  const [performanceMonitoring, setPerformanceMonitoringState] = useState(
    storage.getPerformanceMonitoring
  );
  const [usageAnalytics, setUsageAnalyticsState] = useState(
    storage.getUsageAnalytics
  );

  useEffect(() => {
    setCrashReportingState(storage.getCrashReporting());
    setPerformanceMonitoringState(storage.getPerformanceMonitoring());
    setUsageAnalyticsState(storage.getUsageAnalytics());
  }, []);

  const setCrashReporting = useCallback((value: boolean) => {
    const persistedValue = storage.setCrashReporting(value);
    setCrashReportingState(persistedValue);
  }, []);

  const setPerformanceMonitoring = useCallback((value: boolean) => {
    const persistedValue = storage.setPerformanceMonitoring(value);
    setPerformanceMonitoringState(persistedValue);
  }, []);

  const setUsageAnalytics = useCallback((value: boolean) => {
    const persistedValue = storage.setUsageAnalytics(value);
    setUsageAnalyticsState(persistedValue);
  }, []);

  return {
    crashReporting,
    setCrashReporting,
    performanceMonitoring,
    setPerformanceMonitoring,
    usageAnalytics,
    setUsageAnalytics,
  };
}
