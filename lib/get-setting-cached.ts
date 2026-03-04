import type { Db } from '@/db';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { settingValueCache, SETTINGS_CACHE_KEY_PREFIX } from '@/lib/d1-cache';

/**
 * Get a setting value by key with in-memory cache (30s TTL) to reduce D1 reads.
 */
export async function getSettingValueCached(db: Db, key: string): Promise<unknown> {
  const cacheKey = SETTINGS_CACHE_KEY_PREFIX + key;
  const cached = settingValueCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const rows = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);
  const raw = rows[0]?.value;
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      value = raw;
    }
  }
  settingValueCache.set(cacheKey, value);
  return value;
}
