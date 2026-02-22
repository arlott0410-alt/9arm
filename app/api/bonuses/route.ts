import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth, requireMutate } from '@/lib/api-helpers';
import {
  bonuses,
  bonusCategories,
  websites,
  users,
} from '@/db/schema';
import { eq, and, gte, lte, isNull, isNotNull, inArray } from 'drizzle-orm';
import { bonusSchema } from '@/lib/validations';
import { settings } from '@/db/schema';

export async function GET(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireAuth(user);
    if (err) return err;

    const url = new URL(request.url);
    const dateFrom = url.searchParams.get('dateFrom') || '';
    const dateTo = url.searchParams.get('dateTo') || '';
    const websiteId = url.searchParams.get('websiteId');
    const categoryId = url.searchParams.get('categoryId');
    const userFull = url.searchParams.get('userFull');
    const deletedOnly = url.searchParams.get('deletedOnly') === 'true';

    const conditions: Parameters<typeof and>[0][] = [];
    if (dateFrom) conditions.push(gte(bonuses.bonusTime, dateFrom + 'T00:00'));
    if (dateTo) conditions.push(lte(bonuses.bonusTime, dateTo + 'T23:59:59'));
    if (websiteId) conditions.push(eq(bonuses.websiteId, parseInt(websiteId)));
    if (categoryId) conditions.push(eq(bonuses.categoryId, parseInt(categoryId)));
    if (userFull) conditions.push(eq(bonuses.userFull, userFull));
    conditions.push(deletedOnly ? isNotNull(bonuses.deletedAt) : isNull(bonuses.deletedAt));

    const list = await db
      .select({
        id: bonuses.id,
        websiteId: bonuses.websiteId,
        userIdInput: bonuses.userIdInput,
        userFull: bonuses.userFull,
        categoryId: bonuses.categoryId,
        displayCurrency: bonuses.displayCurrency,
        amountMinor: bonuses.amountMinor,
        bonusTime: bonuses.bonusTime,
        createdBy: bonuses.createdBy,
        createdAt: bonuses.createdAt,
        deletedAt: bonuses.deletedAt,
        deletedBy: bonuses.deletedBy,
        deleteReason: bonuses.deleteReason,
        websiteName: websites.name,
        websitePrefix: websites.prefix,
        categoryName: bonusCategories.name,
        createdByUsername: users.username,
      })
      .from(bonuses)
      .leftJoin(websites, eq(bonuses.websiteId, websites.id))
      .leftJoin(bonusCategories, eq(bonuses.categoryId, bonusCategories.id))
      .leftJoin(users, eq(bonuses.createdBy, users.id))
      .where(and(...conditions))
      .orderBy(bonuses.bonusTime, bonuses.id);

    const deletedByIds = [...new Set(list.filter((r) => r.deletedBy != null).map((r) => r.deletedBy!))];
    const deletedByUsers =
      deletedByIds.length > 0
        ? await db.select({ id: users.id, username: users.username }).from(users).where(inArray(users.id, deletedByIds))
        : [];
    const deletedByMap = new Map(deletedByUsers.map((u) => [u.id, u.username]));
    const listWithDeletedBy = list.map((r) => ({
      ...r,
      deletedByUsername: r.deletedBy ? (deletedByMap.get(r.deletedBy) ?? '?') : null,
    }));

    return NextResponse.json(listWithDeletedBy);
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
    const err = requireMutate(user);
    if (err) return err;

    const [settingsRow] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'DISPLAY_CURRENCY'))
      .limit(1);
    const displayCurrency: string =
      settingsRow?.value && typeof settingsRow.value === 'string'
        ? JSON.parse(settingsRow.value)
        : 'THB';

    const body = await request.json();
    const parsed = bonusSchema.safeParse(body);
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
      .insert(bonuses)
      .values({
        websiteId: parsed.data.websiteId,
        userIdInput: parsed.data.userIdInput,
        userFull: parsed.data.userFull,
        categoryId: parsed.data.categoryId,
        displayCurrency,
        amountMinor: parsed.data.amountMinor,
        bonusTime: parsed.data.bonusTime,
        createdBy: user!.id,
        createdAt: now,
      })
      .returning();
    return NextResponse.json(inserted);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
