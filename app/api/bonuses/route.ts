import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth, requireMutate } from '@/lib/api-helpers';
import {
  bonuses,
  bonusCategories,
  websites,
  users,
} from '@/db/schema';
import { eq, and, gte, lte, lt, isNull, isNotNull, inArray, sql, desc } from 'drizzle-orm';
import { bonusSchema } from '@/lib/validations';
import { getSettingValueCached } from '@/lib/get-setting-cached';
import {
  parsePageParams,
  buildPaginatedResponse,
  buildCursorResponse,
  parseCursorParams,
  getDefaultPageSize,
} from '@/lib/pagination';
import { listCountCache, invalidateDataCaches, getDataCacheVersion, unwrapDataCacheValue } from '@/lib/d1-cache';
import { listCountCacheKey } from '@/lib/list-count-cache';

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

    const defaultPageSize = getDefaultPageSize('bonuses');
    const cursorParams = parseCursorParams(url.searchParams, defaultPageSize);
    const useCursor = cursorParams != null && cursorParams.cursorId != null;

    const conditions: Parameters<typeof and>[0][] = [];
    if (dateFrom) conditions.push(gte(bonuses.bonusTime, dateFrom + 'T00:00'));
    if (dateTo) conditions.push(lte(bonuses.bonusTime, dateTo + 'T23:59:59'));
    if (websiteId) conditions.push(eq(bonuses.websiteId, parseInt(websiteId)));
    if (categoryId) conditions.push(eq(bonuses.categoryId, parseInt(categoryId)));
    if (userFull) conditions.push(eq(bonuses.userFull, userFull));
    conditions.push(deletedOnly ? isNotNull(bonuses.deletedAt) : isNull(bonuses.deletedAt));
    if (useCursor) conditions.push(lt(bonuses.id, cursorParams!.cursorId!));

    const whereClause = and(...conditions);

    if (useCursor) {
      const limit = cursorParams!.limit;
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
        .where(whereClause)
        .orderBy(desc(bonuses.id))
        .limit(limit);

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
      return NextResponse.json(buildCursorResponse(listWithDeletedBy, limit));
    }

    const { page, pageSize, offset } = parsePageParams(
      url.searchParams,
      defaultPageSize
    );

    const countKey = listCountCacheKey('bonuses', url.searchParams);
    const currentVer = result.env.KV ? await getDataCacheVersion(result.env) : 0;
    const rawCount = listCountCache.get(countKey);
    let totalCount = unwrapDataCacheValue<number>(rawCount, currentVer);
    if (rawCount !== undefined && currentVer > 0 && totalCount === undefined) listCountCache.invalidate(countKey);
    if (totalCount === undefined) {
      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(bonuses)
        .where(whereClause);
      totalCount = Number(countRow?.count ?? 0);
      if (result.env.KV) {
        listCountCache.set(countKey, { _v: currentVer, data: totalCount });
      } else {
        listCountCache.set(countKey, totalCount);
      }
    }

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
      .where(whereClause)
      .orderBy(bonuses.bonusTime, bonuses.id)
      .limit(pageSize)
      .offset(offset);

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

    return NextResponse.json(
      buildPaginatedResponse(listWithDeletedBy, totalCount, page, pageSize)
    );
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

    const displayCurrencyRaw = await getSettingValueCached(db, 'DISPLAY_CURRENCY');
    const displayCurrency: string =
      typeof displayCurrencyRaw === 'string' ? displayCurrencyRaw : 'THB';

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
    invalidateDataCaches(result.env);
    return NextResponse.json(inserted);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
