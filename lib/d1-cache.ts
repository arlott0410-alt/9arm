/**
 * In-worker memory cache with TTL to reduce D1 read queries.
 * Safe for serverless: each isolate has its own Map; no cross-request guarantee.
 * When KV is bound, data caches (dashboard/reports/wallets/listCount) honour a global invalidation version so other isolates see fresh data after mutations.
 */

import type { Env } from '@/lib/cf-env';

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

// Full GET /api/settings response cache (30s). Invalidated when any setting is updated.
export const ALL_SETTINGS_CACHE_KEY = '__all_settings';
export const allSettingsCache = createCache<Record<string, unknown>>(30_000);

/** Call after updating any setting (display-currency, exchange-rates, holiday-head, allowance-types) so GET /api/settings and getSettingValueCached see fresh data. */
export function invalidateSettingsCaches(): void {
  allSettingsCache.invalidate(ALL_SETTINGS_CACHE_KEY);
  settingValueCache.invalidateAll();
}

// Semi-static list caches (30s) for GET /api/settings/websites and GET /api/settings/bonus-categories
const SEMI_STATIC_TTL_MS = 30_000;
export const WEBSITES_LIST_CACHE_KEY = '__websites_list';
export const websitesListCache = createCache<unknown[]>(SEMI_STATIC_TTL_MS);
export const BONUS_CATEGORIES_LIST_CACHE_KEY = '__bonus_categories_list';
export const bonusCategoriesListCache = createCache<unknown[]>(SEMI_STATIC_TTL_MS);

export function invalidateWebsitesListCache(): void {
  websitesListCache.invalidate(WEBSITES_LIST_CACHE_KEY);
}
export function invalidateBonusCategoriesListCache(): void {
  bonusCategoriesListCache.invalidate(BONUS_CATEGORIES_LIST_CACHE_KEY);
}

/** Get a single setting value from DB with optional cache (caller can use settingValueCache.get(key) first). */
export const SETTINGS_CACHE_KEY_PREFIX = 'setting:';

// Dashboard/Reports/Wallets response cache (45s) — reduces D1 reads for repeated identical requests in same isolate
const DATA_RESPONSE_TTL_MS = 45_000;
export const dashboardResponseCache = createCache<unknown>(DATA_RESPONSE_TTL_MS);
export const reportsResponseCache = createCache<unknown>(DATA_RESPONSE_TTL_MS);
export const walletsBalanceResponseCache = createCache<unknown>(DATA_RESPONSE_TTL_MS);

// GET /api/wallets/[id] response cache (45s) — แต่ละ wallet ถูก aggregate 4 ครั้ง (dep/with/from/to); cache ลด D1 row read เมื่อเปิดดูซ้ำ
export const walletDetailCache = createCache<unknown>(DATA_RESPONSE_TTL_MS);
export function walletDetailCacheKey(id: number): string {
  return `wallet:${id}`;
}

// List count cache (25s). Value may be number or { _v, data: number } when KV is used for cross-isolate invalidation.
export const listCountCache = createCache<number | { _v: number; data: number }>(25_000);

// KV key for cross-isolate invalidation; when present, GET handlers check this version before using cached data
const DATA_CACHE_VERSION_KV_KEY = 'data-cache:version';
const DATA_VERSION_MEMORY_TTL_MS = 5_000; // 5s — avoid hitting KV on every request
const dataCacheVersionCache = createCache<number>(DATA_VERSION_MEMORY_TTL_MS);
const DATA_VERSION_CACHE_KEY = '__data_version';

/**
 * Last invalidation timestamp from KV (0 if no KV or unset). Cached in memory for a few seconds to limit KV reads.
 * Used by dashboard/reports/wallets/list GET handlers to reject in-memory cache when a mutation in another isolate invalidated.
 */
export async function getDataCacheVersion(env: Env): Promise<number> {
  if (!env.KV) return 0;
  const mem = dataCacheVersionCache.get(DATA_VERSION_CACHE_KEY);
  if (mem !== undefined) return mem;
  try {
    const raw = await env.KV.get(DATA_CACHE_VERSION_KV_KEY);
    const n = raw ? parseInt(raw, 10) : 0;
    const version = Number.isNaN(n) ? 0 : n;
    dataCacheVersionCache.set(DATA_VERSION_CACHE_KEY, version);
    return version;
  } catch {
    return 0;
  }
}

/** Cached value may be wrapped with _v (version at store time) when KV is used, so we can reject stale entries. */
export function unwrapDataCacheValue<T>(raw: unknown, currentVersion: number): T | undefined {
  if (raw === undefined) return undefined;
  if (raw != null && typeof raw === 'object' && '_v' in raw && 'data' in (raw as { _v: number; data: unknown })) {
    const entry = raw as { _v: number; data: unknown };
    if (currentVersion > entry._v) return undefined; // stale
    return entry.data as T;
  }
  return raw as T;
}

/**
 * Invalidate cached GET /api/wallets/[id] for specific wallet(s) only.
 * Call this from routes that change balance for given wallet(s) so we don't clear every wallet's cache.
 */
export function invalidateWalletDetails(walletIds: number[]): void {
  for (const id of walletIds) {
    walletDetailCache.invalidate(walletDetailCacheKey(id));
  }
}

/**
 * Call from mutation routes so next GET sees fresh data (same isolate + other isolates when KV is bound).
 * Pass env when available so KV can broadcast invalidation; if env omitted or KV not bound, only in-memory caches are cleared.
 * Does NOT clear walletDetailCache — use invalidateWalletDetails([...]) for the specific wallet(s) that changed.
 *
 * Routes that MUST call this after successful mutation:
 * - app/api/transactions/route.ts (POST) + invalidateWalletDetails([walletId])
 * - app/api/transactions/[id]/route.ts (DELETE)
 * - app/api/transfers/route.ts (POST) + invalidateWalletDetails([fromWalletId, toWalletId])
 * - app/api/transfers/[id]/route.ts (DELETE)
 * - app/api/wallets/route.ts (POST)
 * - app/api/wallets/[id]/route.ts (DELETE) + invalidateWalletDetails([id])
 * - app/api/bonuses/route.ts (POST)
 * - app/api/bonuses/[id]/route.ts (DELETE)
 * - app/api/credit-cuts/route.ts (POST)
 * - app/api/credit-cuts/[id]/route.ts (DELETE)
 */
export function invalidateDataCaches(env?: Env): void {
  if (env?.KV) {
    env.KV.put(DATA_CACHE_VERSION_KV_KEY, String(Date.now()), { expirationTtl: 86400 }).catch(() => {});
    dataCacheVersionCache.invalidateAll();
  }
  dashboardResponseCache.invalidateAll();
  reportsResponseCache.invalidateAll();
  walletsBalanceResponseCache.invalidateAll();
  listCountCache.invalidateAll();
  // walletDetailCache: clear only affected wallets via invalidateWalletDetails() in the route
}
