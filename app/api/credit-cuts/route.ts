import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth, requireMutate } from '@/lib/api-helpers';
import { creditCuts, websites, users } from '@/db/schema';
import { eq, and, gte, lte, isNull, isNotNull, inArray } from 'drizzle-orm';
import { creditCutSchema } from '@/lib/validations';
import { settings } from '@/db/schema';

export async function GET(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db } = result;
    const err = requireAuth(result.user);
    if (err) return err;

    const url = new URL(request.url);
    const dateFrom = url.searchParams.get('dateFrom') || '';
    const dateTo = url.searchParams.get('dateTo') || '';
    const websiteId = url.searchParams.get('websiteId');
    const deletedOnly = url.searchParams.get('deletedOnly') === 'true';

    const conditions: Parameters<typeof and>[0][] = [];
    if (dateFrom) conditions.push(gte(creditCuts.createdAt, new Date(dateFrom + 'T00:00:00')));
    if (dateTo) conditions.push(lte(creditCuts.createdAt, new Date(dateTo + 'T23:59:59')));
    if (websiteId) conditions.push(eq(creditCuts.websiteId, parseInt(websiteId)));
    conditions.push(deletedOnly ? isNotNull(creditCuts.deletedAt) : isNull(creditCuts.deletedAt));

    const list = await db
      .select({
        id: creditCuts.id,
        websiteId: creditCuts.websiteId,
        userIdInput: creditCuts.userIdInput,
        userFull: creditCuts.userFull,
        displayCurrency: creditCuts.displayCurrency,
        amountMinor: creditCuts.amountMinor,
        cutReason: creditCuts.cutReason,
        createdBy: creditCuts.createdBy,
        createdAt: creditCuts.createdAt,
        deletedAt: creditCuts.deletedAt,
        deletedBy: creditCuts.deletedBy,
        deleteReason: creditCuts.deleteReason,
        websiteName: websites.name,
        websitePrefix: websites.prefix,
        createdByUsername: users.username,
      })
      .from(creditCuts)
      .leftJoin(websites, eq(creditCuts.websiteId, websites.id))
      .leftJoin(users, eq(creditCuts.createdBy, users.id))
      .where(and(...conditions))
      .orderBy(creditCuts.createdAt, creditCuts.id);

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
    const parsed = creditCutSchema.safeParse(body);
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
      .insert(creditCuts)
      .values({
        websiteId: parsed.data.websiteId,
        userIdInput: parsed.data.userIdInput,
        userFull: parsed.data.userFull,
        displayCurrency,
        amountMinor: parsed.data.amountMinor,
        cutReason: parsed.data.cutReason,
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
