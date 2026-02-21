export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth } from '@/lib/api-helpers';
import type { Db } from '@/db';
import { transactions, wallets, transfers, settings } from '@/db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { convertToDisplay, type Currency, type RateSnapshot } from '@/lib/rates';

async function sumInDisplayCurrency(
  db: Db,
  displayCurrency: Currency,
  rates: RateSnapshot,
  filters: { type: 'DEPOSIT' | 'WITHDRAW'; dateFrom: string; dateTo: string }
) {
  const rows = await db
    .select({
      amountMinor: transactions.amountMinor,
      walletId: transactions.walletId,
    })
    .from(transactions)
    .leftJoin(wallets, eq(transactions.walletId, wallets.id))
    .where(
      and(
        eq(transactions.type, filters.type),
        gte(transactions.txnDate, filters.dateFrom),
        lte(transactions.txnDate, filters.dateTo)
      )
    );
  let total = 0;
  for (const r of rows) {
    const [w] = await db
      .select({ currency: wallets.currency })
      .from(wallets)
      .where(eq(wallets.id, r.walletId))
      .limit(1);
    const walletCurrency = (w?.currency ?? 'THB') as Currency;
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

    const today = new Date().toISOString().slice(0, 10);
    const startOfMonth = today.slice(0, 7) + '-01';
    const endOfMonth = today.slice(0, 7) + '-31';

    const [todayDepTotal, todayWithTotal, monthDepTotal, monthWithTotal] =
      await Promise.all([
        sumInDisplayCurrency(db, displayCurrency, rates, {
          type: 'DEPOSIT',
          dateFrom: today,
          dateTo: today,
        }),
        sumInDisplayCurrency(db, displayCurrency, rates, {
          type: 'WITHDRAW',
          dateFrom: today,
          dateTo: today,
        }),
        sumInDisplayCurrency(db, displayCurrency, rates, {
          type: 'DEPOSIT',
          dateFrom: startOfMonth,
          dateTo: endOfMonth,
        }),
        sumInDisplayCurrency(db, displayCurrency, rates, {
          type: 'WITHDRAW',
          dateFrom: startOfMonth,
          dateTo: endOfMonth,
        }),
      ]);

    const walletList = await db.select().from(wallets).orderBy(wallets.name);

    const balances = await Promise.all(
      walletList.map(async (w) => {
        const depSum = await db
          .select({
            sum: sql<number>`coalesce(sum(${transactions.amountMinor}), 0)`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.walletId, w.id),
              eq(transactions.type, 'DEPOSIT')
            )
          );
        const withSum = await db
          .select({
            sum: sql<number>`coalesce(sum(${transactions.amountMinor}), 0)`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.walletId, w.id),
              eq(transactions.type, 'WITHDRAW')
            )
          );
        const fromSum = await db
          .select({
            sum: sql<number>`coalesce(sum(${transfers.fromWalletAmountMinor}), 0)`,
          })
          .from(transfers)
          .where(eq(transfers.fromWalletId, w.id));
        const toSum = await db
          .select({
            sum: sql<number>`coalesce(sum(${transfers.toWalletAmountMinor}), 0)`,
          })
          .from(transfers)
          .where(eq(transfers.toWalletId, w.id));

        const dep = Number(depSum[0]?.sum ?? 0);
        const wth = Number(withSum[0]?.sum ?? 0);
        const from = Number(fromSum[0]?.sum ?? 0);
        const to = Number(toSum[0]?.sum ?? 0);
        const balance = w.openingBalanceMinor + dep - wth - from + to;

        return {
          id: w.id,
          name: w.name,
          currency: w.currency,
          balance,
        };
      })
    );

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
