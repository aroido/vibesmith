import Store from 'electron-store';

export type DebugLevel = 'info' | 'debug';

export interface DebugSettings {
  enabled: boolean;
  level: DebugLevel;
  expireAt: string | null;
  updatedAt: string;
}

interface DesktopSettingsSchema {
  debug: DebugSettings;
}

const DEFAULT_DEBUG_SETTINGS: DebugSettings = {
  enabled: false,
  level: 'info',
  expireAt: null,
  updatedAt: new Date().toISOString(),
};

let storeInstance: Store<DesktopSettingsSchema> | null = null;

function getStore(): Store<DesktopSettingsSchema> {
  if (!storeInstance) {
    storeInstance = new Store<DesktopSettingsSchema>({
      name: 'desktop-settings',
      defaults: {
        debug: DEFAULT_DEBUG_SETTINGS,
      },
    });
  }
  return storeInstance;
}

function isIsoDateString(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }
  const time = Date.parse(value);
  return !Number.isNaN(time);
}

function sanitizeDebugSettings(raw: unknown): DebugSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_DEBUG_SETTINGS };
  }

  const candidate = raw as Partial<DebugSettings>;
  const enabled = Boolean(candidate.enabled);
  const level: DebugLevel = candidate.level === 'debug' ? 'debug' : 'info';
  const expireAt =
    candidate.expireAt === null || candidate.expireAt === undefined
      ? null
      : isIsoDateString(candidate.expireAt)
      ? candidate.expireAt
      : null;

  const updatedAt = isIsoDateString(candidate.updatedAt)
    ? candidate.updatedAt
    : new Date().toISOString();

  return {
    enabled,
    level,
    expireAt,
    updatedAt,
  };
}

function applyExpiration(settings: DebugSettings): DebugSettings {
  if (!settings.enabled || !settings.expireAt) {
    return settings;
  }

  const expireTime = Date.parse(settings.expireAt);
  if (Number.isNaN(expireTime) || expireTime > Date.now()) {
    return settings;
  }

  return {
    enabled: false,
    level: 'info',
    expireAt: null,
    updatedAt: new Date().toISOString(),
  };
}

export function getDebugSettings(): DebugSettings {
  const store = getStore();
  const stored = sanitizeDebugSettings(store.get('debug'));
  const resolved = applyExpiration(stored);

  if (
    resolved.enabled !== stored.enabled ||
    resolved.level !== stored.level ||
    resolved.expireAt !== stored.expireAt
  ) {
    store.set('debug', resolved);
  }

  return resolved;
}

export function updateDebugSettings(
  patch: Partial<Pick<DebugSettings, 'enabled' | 'level' | 'expireAt'>> & {
    ttlHours?: number;
  }
): DebugSettings {
  const current = getDebugSettings();

  const enabled = patch.enabled ?? current.enabled;
  const level: DebugLevel = patch.level === 'debug' || patch.level === 'info'
    ? patch.level
    : enabled
    ? 'debug'
    : 'info';

  let expireAt = current.expireAt;
  if (enabled) {
    if (patch.expireAt === null) {
      expireAt = null;
    } else if (isIsoDateString(patch.expireAt)) {
      expireAt = patch.expireAt;
    } else if (!expireAt) {
      const ttlHours = patch.ttlHours && patch.ttlHours > 0 ? patch.ttlHours : 24;
      expireAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
    }
  } else {
    expireAt = null;
  }

  const next: DebugSettings = applyExpiration({
    enabled,
    level,
    expireAt,
    updatedAt: new Date().toISOString(),
  });

  getStore().set('debug', next);
  return next;
}
