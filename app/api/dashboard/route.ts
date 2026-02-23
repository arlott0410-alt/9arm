import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth } from '@/lib/api-helpers';
import type { Db } from '@/db';
import { transactions, wallets, transfers, settings } from '@/db/schema';
import { eq, and, gte, lte, sql, isNull } from 'drizzle-orm';
import { convertToDisplay, type Currency, type RateSnapshot } from '@/lib/rates';
import { todayStrThailand } from '@/lib/utils';

async function sumInDisplayCurrency(
  db: Db,
  displayCurrency: Currency,
  rates: RateSnapshot,
  filters: { type: 'DEPOSIT' | 'WITHDRAW'; dateFrom: string; dateTo: string; websiteId?: number }
) {
  const conditions: Parameters<typeof and>[0][] = [
    eq(transactions.type, filters.type),
    gte(transactions.txnDate, filters.dateFrom),
    lte(transactions.txnDate, filters.dateTo),
    isNull(transactions.deletedAt),
  ];
  if (filters.websiteId) conditions.push(eq(transactions.websiteId, filters.websiteId));

  // Select wallet.currency via join to avoid N+1 per-row wallet lookups
  const rows = await db
    .select({
      amountMinor: transactions.amountMinor,
      walletCurrency: wallets.currency,
    })
    .from(transactions)
    .leftJoin(wallets, eq(transactions.walletId, wallets.id))
    .where(and(...conditions));
  let total = 0;
  for (const r of rows) {
    const walletCurrency = (r.walletCurrency ?? 'THB') as Currency;
    total += convertToDisplay(
      r.amountMinor,
      walletCurrency,
      displayCurrency,
      rates
    );
  }
  return Math.round(total);
}

export async function GET(request: Request) {
  try {
    const result = await getDbAndUser(request);
    if (result instanceof NextResponse) return result;
    const { db, user } = result;
    const err = requireAuth(user);
    if (err) return err;

    const [dcRow] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'DISPLAY_CURRENCY'))
      .limit(1);
    const displayCurrency: Currency =
      (dcRow?.value &&
        typeof dcRow.value === 'string' &&
        JSON.parse(dcRow.value)) ||
      'THB';
    const [ratesRow] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'EXCHANGE_RATES'))
      .limit(1);
    const rates: RateSnapshot =
      ratesRow?.value && typeof ratesRow.value === 'string'
        ? JSON.parse(ratesRow.value)
        : {};

    const url = new URL(request.url);
    const websiteIdParam = url.searchParams.get('websiteId');
    const websiteId = websiteIdParam ? parseInt(websiteIdParam) : undefined;

    const today = todayStrThailand();
    const startOfMonth = today.slice(0, 7) + '-01';
    const endOfMonth = today.slice(0, 7) + '-31';

    const [todayDepTotal, todayWithTotal, monthDepTotal, monthWithTotal] =
      await Promise.all([
        sumInDisplayCurrency(db, displayCurrency, rates, {
          type: 'DEPOSIT',
          dateFrom: today,
          dateTo: today,
          websiteId,
        }),
        sumInDisplayCurrency(db, displayCurrency, rates, {
          type: 'WITHDRAW',
          dateFrom: today,
          dateTo: today,
          websiteId,
        }),
        sumInDisplayCurrency(db, displayCurrency, rates, {
          type: 'DEPOSIT',
          dateFrom: startOfMonth,
          dateTo: endOfMonth,
          websiteId,
        }),
        sumInDisplayCurrency(db, displayCurrency, rates, {
          type: 'WITHDRAW',
          dateFrom: startOfMonth,
          dateTo: endOfMonth,
          websiteId,
        }),
      ]);

    const walletList = await db.select().from(wallets).orderBy(wallets.name);

    // Grouped aggregations: 4 queries total instead of 4 per wallet
    const [depRows, withRows, fromRows, toRows] = await Promise.all([
      db
        .select({
          walletId: transactions.walletId,
          sum: sql<number>`coalesce(sum(${transactions.amountMinor}), 0)`,
        })
        .from(transactions)
        .where(and(eq(transactions.type, 'DEPOSIT'), isNull(transactions.deletedAt)))
        .groupBy(transactions.walletId),
      db
        .select({
          walletId: transactions.walletId,
          sum: sql<number>`coalesce(sum(${transactions.amountMinor} + coalesce(${transactions.withdrawFeeMinor}, 0)), 0)`,
        })
        .from(transactions)
        .where(and(eq(transactions.type, 'WITHDRAW'), isNull(transactions.deletedAt)))
        .groupBy(transactions.walletId),
      db
        .select({
          walletId: transfers.fromWalletId,
          sum: sql<number>`coalesce(sum(${transfers.fromWalletAmountMinor}), 0)`,
        })
        .from(transfers)
        .where(isNull(transfers.deletedAt))
        .groupBy(transfers.fromWalletId),
      db
        .select({
          walletId: transfers.toWalletId,
          sum: sql<number>`coalesce(sum(${transfers.toWalletAmountMinor}), 0)`,
        })
        .from(transfers)
        .where(isNull(transfers.deletedAt))
        .groupBy(transfers.toWalletId),
    ]);

    const depByWallet = new Map<number, number>();
    for (const r of depRows) {
      if (r.walletId != null) depByWallet.set(r.walletId, Number(r.sum ?? 0));
    }
    const withByWallet = new Map<number, number>();
    for (const r of withRows) {
      if (r.walletId != null) withByWallet.set(r.walletId, Number(r.sum ?? 0));
    }
    const fromByWallet = new Map<number, number>();
    for (const r of fromRows) {
      if (r.walletId != null) fromByWallet.set(r.walletId, Number(r.sum ?? 0));
    }
    const toByWallet = new Map<number, number>();
    for (const r of toRows) {
      if (r.walletId != null) toByWallet.set(r.walletId, Number(r.sum ?? 0));
    }

    const balances = walletList.map((w) => {
      const dep = depByWallet.get(w.id) ?? 0;
      const wth = withByWallet.get(w.id) ?? 0;
      const from = fromByWallet.get(w.id) ?? 0;
      const to = toByWallet.get(w.id) ?? 0;
      const balance = w.openingBalanceMinor + dep - wth - from + to;
      return {
        id: w.id,
        name: w.name,
        currency: w.currency,
        balance,
      };
    });

    return NextResponse.json({
      displayCurrency,
      today: {
        deposits: todayDepTotal,
        withdraws: todayWithTotal,
        net: todayDepTotal - todayWithTotal,
      },
      month: {
        deposits: monthDepTotal,
        withdraws: monthWithTotal,
        net: monthDepTotal - monthWithTotal,
      },
      wallets: balances,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
