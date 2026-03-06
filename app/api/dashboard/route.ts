import { NextResponse } from 'next/server';
import { getDbAndUser, requireAuth } from '@/lib/api-helpers';
import type { Db } from '@/db';
import { transactions, wallets, transfers, websites } from '@/db/schema';
import { eq, and, gte, lte, sql, isNull } from 'drizzle-orm';
import { getSettingValueCached } from '@/lib/get-setting-cached';
import { convertToDisplay, type Currency, type RateSnapshot } from '@/lib/rates';
import { todayStrThailand } from '@/lib/utils';
import { setNoStore } from '@/lib/cache-headers';
import { dedupeRequest } from '@/lib/request-dedup';
import { dashboardResponseCache, getDataCacheVersion, unwrapDataCacheValue } from '@/lib/d1-cache';

/** Aggregate in D1 by currency (GROUP BY), then convert each bucket in Worker. Reduces CPU vs per-row JS loop. */
async function sumInDisplayCurrency(
  db: Db,
  displayCurrency: Currency,
  rates: RateSnapshot,
  filters: { type: 'DEPOSIT' | 'WITHDRAW'; dateFrom: string; dateTo: string; websiteId?: number }
): Promise<number> {
  const conditions: Parameters<typeof and>[0][] = [
    eq(transactions.type, filters.type),
    gte(transactions.txnDate, filters.dateFrom),
    lte(transactions.txnDate, filters.dateTo),
    isNull(transactions.deletedAt),
  ];
  if (filters.websiteId) conditions.push(eq(transactions.websiteId, filters.websiteId));

  // D1 aggregates by currency (max 3 rows: LAK, THB, USD); null currency treated as THB
  const rows = await db
    .select({
      currency: wallets.currency,
      sumMinor: sql<number>`coalesce(sum(${transactions.amountMinor}), 0)`,
    })
    .from(transactions)
    .leftJoin(wallets, eq(transactions.walletId, wallets.id))
    .where(and(...conditions))
    .groupBy(wallets.currency);

  let total = 0;
  for (const r of rows) {
    const currency = (r.currency ?? 'THB') as Currency;
    total += convertToDisplay(Number(r.sumMinor ?? 0), currency, displayCurrency, rates);
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

    const url = new URL(request.url);
    const websiteIdParam = url.searchParams.get('websiteId');
    const dedupeKey = `dashboard:${websiteIdParam ?? 'all'}`;

    const currentVer = result.env.KV ? await getDataCacheVersion(result.env) : 0;
    const raw = dashboardResponseCache.get(dedupeKey);
    const cached = unwrapDataCacheValue<unknown>(raw, currentVer);
    if (cached !== undefined) {
      const res = NextResponse.json(cached);
      setNoStore(res);
      return res;
    }
    if (raw !== undefined && currentVer > 0) dashboardResponseCache.invalidate(dedupeKey);

    const payload = await dedupeRequest(dedupeKey, async () => {
    const [displayCurrency, rates] = await Promise.all([
      getSettingValueCached(db, 'DISPLAY_CURRENCY').then(
        (v) => (typeof v === 'string' ? v : 'THB') as Currency
      ),
      getSettingValueCached(db, 'EXCHANGE_RATES').then(
        (v) => (v && typeof v === 'object' ? (v as RateSnapshot) : {})
      ),
    ]);

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

    const [walletList, websiteList] = await Promise.all([
      db.select({ id: wallets.id, name: wallets.name, currency: wallets.currency, openingBalanceMinor: wallets.openingBalanceMinor }).from(wallets).orderBy(wallets.name),
      db.select({ id: websites.id, name: websites.name, prefix: websites.prefix }).from(websites).orderBy(websites.name),
    ]);

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

    const result = {
      displayCurrency,
      websites: websiteList,
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
    };
    if (result.env.KV) {
      const ver = await getDataCacheVersion(result.env);
      dashboardResponseCache.set(dedupeKey, { _v: ver, data: result });
    } else {
      dashboardResponseCache.set(dedupeKey, result);
    }
    return result;
    });

    const res = NextResponse.json(payload);
    setNoStore(res);
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
