import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '@/common/analytics/desktopAnalyticsBridge';

export function RouteAnalyticsTracker() {
  const location = useLocation();
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    const path = `${location.pathname}${location.search}${location.hash}`;
    if (lastPathRef.current === path) return;
    trackPageView(
      path,
      lastPathRef.current === null ? 'initial_load' : 'hash_change'
    );
    lastPathRef.current = path;
  }, [location.hash, location.pathname, location.search]);

  return null;
}
