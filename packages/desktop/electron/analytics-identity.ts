import { randomUUID } from 'node:crypto';
import Store from 'electron-store';

export type AnalyticsIdentityScope = 'installation';

export interface AnalyticsIdentity {
  distinctId: string;
  scope: AnalyticsIdentityScope;
  createdAt: string;
}

interface AnalyticsIdentityStoreSchema {
  identity?: AnalyticsIdentity;
}

let storeInstance: Store<AnalyticsIdentityStoreSchema> | null = null;

function getStore(): Store<AnalyticsIdentityStoreSchema> {
  if (!storeInstance) {
    storeInstance = new Store<AnalyticsIdentityStoreSchema>({
      name: 'desktop-analytics',
    });
  }

  return storeInstance;
}

function isIsoDateString(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }

  return !Number.isNaN(Date.parse(value));
}

function sanitizeIdentity(raw: unknown): AnalyticsIdentity | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const candidate = raw as Partial<AnalyticsIdentity>;
  if (typeof candidate.distinctId !== 'string' || candidate.distinctId.trim().length === 0) {
    return null;
  }

  return {
    distinctId: candidate.distinctId.trim(),
    scope: candidate.scope === 'installation' ? 'installation' : 'installation',
    createdAt: isIsoDateString(candidate.createdAt)
      ? candidate.createdAt
      : new Date().toISOString(),
  };
}

function createIdentity(): AnalyticsIdentity {
  return {
    distinctId: `vbs-install-${randomUUID()}`,
    scope: 'installation',
    createdAt: new Date().toISOString(),
  };
}

export function getAnalyticsIdentity(): AnalyticsIdentity {
  const store = getStore();
  const storedIdentity = sanitizeIdentity(store.get('identity'));

  if (storedIdentity) {
    return storedIdentity;
  }

  const nextIdentity = createIdentity();
  store.set('identity', nextIdentity);
  return nextIdentity;
}
