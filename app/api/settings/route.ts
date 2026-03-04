import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth } from '@/lib/api-helpers';
import { settings } from '@/db/schema';
import { createCache } from '@/lib/d1-cache';

const ALL_SETTINGS_CACHE_KEY = '__all_settings';
const allSettingsCache = createCache<Record<string, unknown>>(30_000);

export async function GET(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireAuth(user);
    if (err) return err;

    const cached = allSettingsCache.get(ALL_SETTINGS_CACHE_KEY);
    if (cached) {
      const res = NextResponse.json(cached);
      res.headers.set('Cache-Control', 'private, max-age=30');
      return res;
    }

    const rows = await db.select({ key: settings.key, value: settings.value }).from(settings);
    const obj: Record<string, unknown> = {};
    for (const r of rows) {
      if (typeof r.value === 'string') {
        try {
          obj[r.key] = JSON.parse(r.value);
        } catch {
          obj[r.key] = r.value;
        }
      } else {
        obj[r.key] = r.value;
      }
    }
    allSettingsCache.set(ALL_SETTINGS_CACHE_KEY, obj);
    const res = NextResponse.json(obj);
    res.headers.set('Cache-Control', 'private, max-age=30');
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
