import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth, requireSettings } from '@/lib/api-helpers';
import { bonusCategories } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { bonusCategorySchema } from '@/lib/validations';
import { bonusCategoriesListCache, BONUS_CATEGORIES_LIST_CACHE_KEY, invalidateBonusCategoriesListCache } from '@/lib/d1-cache';

export async function GET(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db } = result;
    const err = requireAuth(result.user);
    if (err) return err;

    const cached = bonusCategoriesListCache.get(BONUS_CATEGORIES_LIST_CACHE_KEY);
    if (cached) return NextResponse.json(cached);
    const list = await db
      .select()
      .from(bonusCategories)
      .orderBy(bonusCategories.sortOrder, bonusCategories.name);
    bonusCategoriesListCache.set(BONUS_CATEGORIES_LIST_CACHE_KEY, list);
    return NextResponse.json(list);
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
    const parsed = bonusCategorySchema.safeParse(body);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const msg =
        flat.formErrors?.[0] ??
        Object.values(flat.fieldErrors ?? {}).flat()[0] ??
        'ข้อมูลไม่ถูกต้อง';
      return NextResponse.json(
        { error: typeof msg === 'string' ? msg : 'ข้อมูลไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    const now = new Date();
    const [inserted] = await db
      .insert(bonusCategories)
      .values({
        name: parsed.data.name,
        sortOrder: 0,
        createdAt: now,
      })
      .returning();
    invalidateBonusCategoriesListCache();
    return NextResponse.json(inserted);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
