import { trackFirstValueReached } from './desktopAnalyticsBridge';

type FirstValueSource =
  | 'project_sync_completed'
  | 'project_created'
  | 'component_create'
  | 'global_search_result_select';

type ActivationEventProperties = Record<
  string,
  string | number | boolean | null
>;

const FIRST_VALUE_REACHED_STORAGE_KEY =
  'vibesmith.analytics.first-value-reached.v1';

let firstValueReachedCache: boolean | null = null;

function hasAnalyticsBridgeEnabled(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return Boolean(window.__vibesmithAnalytics?.isEnabled?.());
}

function hasStoredFirstValueReached(): boolean {
  if (firstValueReachedCache !== null) {
    return firstValueReachedCache;
  }

  if (typeof window === 'undefined') {
    firstValueReachedCache = false;
    return false;
  }

  try {
    firstValueReachedCache =
      window.localStorage.getItem(FIRST_VALUE_REACHED_STORAGE_KEY) === 'true';
  } catch {
    firstValueReachedCache = false;
  }

  return firstValueReachedCache;
}

function markFirstValueReached(): void {
  firstValueReachedCache = true;

  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(FIRST_VALUE_REACHED_STORAGE_KEY, 'true');
  } catch {
    // Ignore storage failures and keep in-memory dedupe for this session.
  }
}

export function trackFirstValueOnce(
  valueSource: FirstValueSource,
  properties: ActivationEventProperties = {}
): boolean {
  if (hasStoredFirstValueReached() || !hasAnalyticsBridgeEnabled()) {
    return false;
  }

  trackFirstValueReached({
    value_source: valueSource,
    ...properties,
  });
  markFirstValueReached();
  return true;
}
