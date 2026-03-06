import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth, requireSettings } from '@/lib/api-helpers';
import { websites } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { websiteSchema } from '@/lib/validations';
import { websitesListCache, WEBSITES_LIST_CACHE_KEY, invalidateWebsitesListCache } from '@/lib/d1-cache';

export async function GET(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireAuth(user);
    if (err) return err;

    const cached = websitesListCache.get(WEBSITES_LIST_CACHE_KEY);
    if (cached) {
      const res = NextResponse.json(cached);
      res.headers.set('Cache-Control', 'private, max-age=30');
      return res;
    }
    const list = await db.select().from(websites).orderBy(websites.name);
    websitesListCache.set(WEBSITES_LIST_CACHE_KEY, list);
    const res = NextResponse.json(list);
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

export async function POST(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireSettings(user);
    if (err) return err;

    const body = await request.json();
    const parsed = websiteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const now = new Date();
    const [inserted] = await db
      .insert(websites)
      .values({
        name: parsed.data.name,
        prefix: parsed.data.prefix,
        isActive: true,
        createdAt: now,
      })
      .returning();
    invalidateWebsitesListCache();
    return NextResponse.json(inserted);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
