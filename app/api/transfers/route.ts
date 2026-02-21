export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth, requireMutate } from '@/lib/api-helpers';
import { transfers, wallets, users } from '@/db/schema';
import { eq, gte, lte, and } from 'drizzle-orm';
import { transferSchema } from '@/lib/validations';
import { settings } from '@/db/schema';
import type { Currency } from '@/lib/rates';
import { convertFromDisplay, type RateSnapshot } from '@/lib/rates';

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
    const type = url.searchParams.get('type');

    const conditions: Parameters<typeof and>[0][] = [];
    if (dateFrom) conditions.push(gte(transfers.txnDate, dateFrom));
    if (dateTo) conditions.push(lte(transfers.txnDate, dateTo));
    if (type) conditions.push(eq(transfers.type, type as 'INTERNAL' | 'EXTERNAL_OUT' | 'EXTERNAL_IN'));

    const baseQuery = db
      .select({
        id: transfers.id,
        txnDate: transfers.txnDate,
        type: transfers.type,
        fromWalletId: transfers.fromWalletId,
        toWalletId: transfers.toWalletId,
        displayCurrency: transfers.displayCurrency,
        inputAmountMinor: transfers.inputAmountMinor,
        fromWalletAmountMinor: transfers.fromWalletAmountMinor,
        toWalletAmountMinor: transfers.toWalletAmountMinor,
        rateSnapshot: transfers.rateSnapshot,
        note: transfers.note,
        createdBy: transfers.createdBy,
        createdAt: transfers.createdAt,
      })
      .from(transfers)
      .orderBy(transfers.txnDate, transfers.id);

    const list =
      conditions.length > 0
        ? await baseQuery.where(and(...conditions))
        : await baseQuery;

    const withNames = await Promise.all(
      list.map(async (t) => {
        let fromName = null;
        let toName = null;
        let createdByUsername = '';
        if (t.fromWalletId) {
          const [w] = await db
            .select({ name: wallets.name })
            .from(wallets)
            .where(eq(wallets.id, t.fromWalletId))
            .limit(1);
          fromName = w?.name ?? null;
        }
        if (t.toWalletId) {
          const [w] = await db
            .select({ name: wallets.name })
            .from(wallets)
            .where(eq(wallets.id, t.toWalletId))
            .limit(1);
          toName = w?.name ?? null;
        }
        const [u] = await db
          .select({ username: users.username })
          .from(users)
          .where(eq(users.id, t.createdBy))
          .limit(1);
        createdByUsername = u?.username ?? '?';
        return {
          ...t,
          fromWalletName: fromName,
          toWalletName: toName,
          createdByUsername,
        };
      })
    );

    return NextResponse.json(withNames);
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

    const body = await request.json();
    const parsed = transferSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const [settingsRow] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'DISPLAY_CURRENCY'))
      .limit(1);
    const displayCurrency: Currency =
      (settingsRow?.value &&
        typeof settingsRow.value === 'string' &&
        JSON.parse(settingsRow.value)) ||
      'THB';

    const [ratesRow] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'EXCHANGE_RATES'))
      .limit(1);
    const rateSnapshot: RateSnapshot =
      ratesRow?.value && typeof ratesRow.value === 'string'
        ? JSON.parse(ratesRow.value)
        : {};

    const now = new Date();
    const type = parsed.data.type;

    let fromWalletAmountMinor: number | null = null;
    let toWalletAmountMinor: number | null = null;

    if (type === 'INTERNAL' && parsed.data.fromWalletId && parsed.data.toWalletId) {
      const [fromW] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, parsed.data.fromWalletId))
        .limit(1);
      const [toW] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, parsed.data.toWalletId))
        .limit(1);
      if (!fromW || !toW) {
        return NextResponse.json(
          { error: 'Invalid wallet' },
          { status: 400 }
        );
      }
      fromWalletAmountMinor = convertFromDisplay(
        parsed.data.inputAmountMinor,
        displayCurrency,
        fromW.currency as Currency,
        rateSnapshot
      );
      toWalletAmountMinor = convertFromDisplay(
        parsed.data.inputAmountMinor,
        displayCurrency,
        toW.currency as Currency,
        rateSnapshot
      );
    } else if (type === 'EXTERNAL_OUT' && parsed.data.fromWalletId) {
      const [fromW] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, parsed.data.fromWalletId))
        .limit(1);
      if (!fromW) {
        return NextResponse.json(
          { error: 'Invalid wallet' },
          { status: 400 }
        );
      }
      fromWalletAmountMinor = convertFromDisplay(
        parsed.data.inputAmountMinor,
        displayCurrency,
        fromW.currency as Currency,
        rateSnapshot
      );
    } else if (type === 'EXTERNAL_IN' && parsed.data.toWalletId) {
      const [toW] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, parsed.data.toWalletId))
        .limit(1);
      if (!toW) {
        return NextResponse.json(
          { error: 'Invalid wallet' },
          { status: 400 }
        );
      }
      toWalletAmountMinor = convertFromDisplay(
        parsed.data.inputAmountMinor,
        displayCurrency,
        toW.currency as Currency,
        rateSnapshot
      );
    }

    const [inserted] = await db
      .insert(transfers)
      .values({
        txnDate: parsed.data.txnDate,
        type,
        fromWalletId: parsed.data.fromWalletId,
        toWalletId: parsed.data.toWalletId,
        displayCurrency,
        inputAmountMinor: parsed.data.inputAmountMinor,
        fromWalletAmountMinor,
        toWalletAmountMinor,
        rateSnapshot,
        note: parsed.data.note ?? null,
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
