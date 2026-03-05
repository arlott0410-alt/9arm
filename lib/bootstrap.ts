import type { Db } from '@/db';
import { settings } from '@/db/schema';
import { getCachedBootstrapKeys, setCachedBootstrapKeys } from '@/lib/d1-cache';
import type { Env } from '@/lib/cf-env';

const DEFAULT_DISPLAY_CURRENCY = 'THB';
import { expandRatesFromBase } from '@/lib/rates';

const DEFAULT_BASE = { THB_LAK: 700, USD_THB: 32, USD_LAK: 22000 };
const DEFAULT_RATES = expandRatesFromBase(DEFAULT_BASE);

const REQUIRED_KEYS = [
  'DISPLAY_CURRENCY',
  'EXCHANGE_RATES',
  'SALARY_FREE_HOLIDAY_DAYS',
  'SALARY_DEDUCT_MULTIPLIER_PER_DAY',
  'SALARY_LATE_PENALTY_PER_MINUTE',
] as const;

const KV_BOOTSTRAPPED_KEY = 'bootstrapped:v1';
const KV_BOOTSTRAPPED_TTL = 86400; // 24h

/** If KV is bound, avoid D1 when already bootstrapped. Idempotent; safe under concurrent calls. */
export async function ensureBootstrapped(db: Db, env: Env): Promise<void> {
  if (env.KV) {
    const flag = await env.KV.get(KV_BOOTSTRAPPED_KEY);
    if (flag != null && flag !== '') return;
  }
  await bootstrapSettings(db);
  if (env.KV) {
    await env.KV.put(KV_BOOTSTRAPPED_KEY, '1', { expirationTtl: KV_BOOTSTRAPPED_TTL });
  }
}

export async function bootstrapSettings(db: Db): Promise<void> {
  const cached = getCachedBootstrapKeys();
  if (cached) {
    const hasAll = REQUIRED_KEYS.every((k) => cached.has(k));
    if (hasAll) return;
  }

  const rows = await db.select({ key: settings.key }).from(settings);
  const keys = new Set(rows.map((r) => r.key));

  const toInsert: { key: string; value: string }[] = [];
  if (!keys.has('DISPLAY_CURRENCY')) toInsert.push({ key: 'DISPLAY_CURRENCY', value: JSON.stringify(DEFAULT_DISPLAY_CURRENCY) });
  if (!keys.has('EXCHANGE_RATES')) toInsert.push({ key: 'EXCHANGE_RATES', value: JSON.stringify(DEFAULT_RATES) });
  if (!keys.has('SALARY_FREE_HOLIDAY_DAYS')) toInsert.push({ key: 'SALARY_FREE_HOLIDAY_DAYS', value: JSON.stringify(4) });
  if (!keys.has('SALARY_DEDUCT_MULTIPLIER_PER_DAY')) toInsert.push({ key: 'SALARY_DEDUCT_MULTIPLIER_PER_DAY', value: JSON.stringify(2) });
  if (!keys.has('SALARY_LATE_PENALTY_PER_MINUTE')) toInsert.push({ key: 'SALARY_LATE_PENALTY_PER_MINUTE', value: JSON.stringify(1000) });

  if (toInsert.length > 0) {
    const batchItems = toInsert.map((row) => db.insert(settings).values({ key: row.key, value: row.value }));
    await db.batch(batchItems as unknown as Parameters<Db['batch']>[0]);
    toInsert.forEach((row) => keys.add(row.key));
  }

  setCachedBootstrapKeys(keys);
}
