/**
 * In-worker memory cache with TTL to reduce D1 read queries.
 * Safe for serverless: each isolate has its own Map; no cross-request guarantee.
 */

const defaultTtlMs = 30_000; // 30s

type Entry<T> = { value: T; expiresAt: number };

function now(): number {
  return Date.now();
}

export function createCache<T>(ttlMs: number = defaultTtlMs): {
  get: (key: string) => T | undefined;
  set: (key: string, value: T) => void;
  invalidate: (key: string) => void;
  invalidateAll: () => void;
} {
  const store = new Map<string, Entry<T>>();

  return {
    get(key: string): T | undefined {
      const e = store.get(key);
      if (!e) return undefined;
      if (now() >= e.expiresAt) {
        store.delete(key);
        return undefined;
      }
      return e.value;
    },
    set(key: string, value: T): void {
      store.set(key, { value, expiresAt: now() + ttlMs });
    },
    invalidate(key: string): void {
      store.delete(key);
    },
    invalidateAll(): void {
      store.clear();
    },
  };
}

// Session → user cache (60s) to avoid session+user query on every request
const AUTH_CACHE_TTL_MS = 60_000;
export const authCache = createCache<{ id: number; username: string; role: string; isActive: boolean }>(AUTH_CACHE_TTL_MS);

// Settings keys set for bootstrap (avoid full settings select every request)
const BOOTSTRAP_CACHE_TTL_MS = 120_000;
export const bootstrapKeysCache = createCache<Set<string>>(BOOTSTRAP_CACHE_TTL_MS);
const BOOTSTRAP_CACHE_KEY = '__bootstrap_keys';

export function getCachedBootstrapKeys(): Set<string> | undefined {
  return bootstrapKeysCache.get(BOOTSTRAP_CACHE_KEY);
}

export function setCachedBootstrapKeys(keys: Set<string>): void {
  bootstrapKeysCache.set(BOOTSTRAP_CACHE_KEY, keys);
}

// Single-setting value cache (30s) - key is settings key e.g. DISPLAY_CURRENCY
export const settingValueCache = createCache<unknown>(30_000);

/** Get a single setting value from DB with optional cache (caller can use settingValueCache.get(key) first). */
export const SETTINGS_CACHE_KEY_PREFIX = 'setting:';
